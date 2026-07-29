/**
 * Client-side flow for pre-signing a subscription's upcoming charges.
 *
 * An ERC-3009 signature is single-use, so a recurring charge needs one signature
 * per billing period. This fetches the server-generated plan (one tuple per
 * period), has the wallet sign each, and posts the signatures back.
 *
 * The wallet prompts once per period, so `onProgress` is provided to keep the UI
 * honest about how far along the user is.
 */

import { authHeaders } from '@/lib/authenticated-fetch'

export interface AuthorizationPlanEntry {
  periodIndex: number
  dueDate: string
  nonce: string
  validAfter: number
  validBefore: number
}

export interface AuthorizationPlan {
  subscriptionId: string
  from: string
  to: string
  amount: string
  token: string
  tokenAddress: string
  chainId: number
  authorizations: AuthorizationPlanEntry[]
}

export type SignAuthorizationFn = (params: {
  tokenAddress: string
  from: string
  to: string
  amount: string
  chainId?: number
  nonce?: string
  validAfter?: number
  validBefore?: number
}) => Promise<{ signature: string }>

/** Fetch the unsigned per-period authorization plan. */
export async function fetchAuthorizationPlan(
  subscriptionId: string,
  ownerAddress: string,
  periods: number
): Promise<AuthorizationPlan> {
  const res = await fetch(
    `/api/subscriptions/${subscriptionId}/authorize?periods=${periods}`,
    { headers: authHeaders(ownerAddress) }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to load authorization plan')
  return data
}

/**
 * Sign every period in the plan and store the signatures.
 *
 * Aborts on the first rejected signature: a partially signed plan would leave
 * later periods silently unpayable, which the user would only discover when a
 * charge failed.
 */
export async function signAndStoreAuthorizations(params: {
  plan: AuthorizationPlan
  ownerAddress: string
  signAuthorization: SignAuthorizationFn
  onProgress?: (signed: number, total: number) => void
}): Promise<{ stored: number }> {
  const { plan, ownerAddress, signAuthorization, onProgress } = params
  const total = plan.authorizations.length
  const signed: Array<AuthorizationPlanEntry & { signature: string }> = []

  for (const entry of plan.authorizations) {
    const result = await signAuthorization({
      tokenAddress: plan.tokenAddress,
      from: plan.from,
      to: plan.to,
      amount: plan.amount,
      chainId: plan.chainId,
      nonce: entry.nonce,
      validAfter: entry.validAfter,
      validBefore: entry.validBefore,
    })

    signed.push({ ...entry, signature: result.signature })
    onProgress?.(signed.length, total)
  }

  const res = await fetch(`/api/subscriptions/${plan.subscriptionId}/authorize`, {
    method: 'POST',
    headers: authHeaders(ownerAddress, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      authorizations: signed.map((s) => ({
        periodIndex: s.periodIndex,
        nonce: s.nonce,
        validAfter: s.validAfter,
        validBefore: s.validBefore,
        signature: s.signature,
      })),
    }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to store authorizations')
  return data
}

/**
 * Terms for an on-chain mandate, as the SubscriptionManager expects them.
 * Field order matches the Solidity struct — ABI tuples are positional.
 */
export interface OnChainTerms {
  merchant: string
  token: string
  amountPerPeriod: bigint
  totalAuthorised: bigint
  periodSeconds: bigint
  firstChargeAt: bigint
  endTime: bigint
  noticeSeconds: bigint
  maxPeriods: number
}

/**
 * Record an on-chain mandate against a subscription.
 *
 * The server re-reads the mandate from the chain before storing it, so a
 * mismatched or unowned id is rejected there rather than silently linked.
 */
export async function linkOnChainSubscription(params: {
  subscriptionId: string
  ownerAddress: string
  onchainSubscriptionId: string
  txHash?: string
}): Promise<{ linked: boolean }> {
  const res = await fetch(`/api/subscriptions/${params.subscriptionId}/onchain`, {
    method: 'POST',
    headers: authHeaders(params.ownerAddress, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      subscriptionId: params.onchainSubscriptionId,
      txHash: params.txHash,
    }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to link on-chain subscription')
  return data
}

const PERMIT_TYPES = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

const PERMIT_TOKEN_ABI = [
  'function nonces(address owner) view returns (uint256)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)',
]

const MANAGER_ABI = [
  'function createSubscriptionWithPermit((address merchant,address token,uint256 amountPerPeriod,uint256 totalAuthorised,uint64 periodSeconds,uint64 firstChargeAt,uint64 endTime,uint64 noticeSeconds,uint32 maxPeriods) terms, uint256 permitValue, uint256 permitDeadline, uint8 v, bytes32 r, bytes32 s) returns (bytes32)',
  'event SubscriptionCreated(bytes32 indexed subscriptionId, address indexed payer, address indexed merchant, address token, uint256 amountPerPeriod, uint256 totalAuthorised, uint64 periodSeconds, uint64 firstChargeAt, uint64 endTime, uint64 noticeSeconds, uint32 maxPeriods)',
]

/**
 * Set up a subscription through the SubscriptionManager contract.
 *
 * One wallet interaction covers the whole thing: the payer signs an EIP-2612
 * permit off-chain and submits it together with the terms, so the allowance and
 * the mandate are established in a single transaction. Every later period is
 * then charged with no further input from them.
 *
 * The permit must be submitted by the payer — it authorises an allowance but
 * says nothing about the subscription terms, so a relayer holding it could
 * otherwise create a mandate naming any merchant.
 */
export async function createOnChainMandate(params: {
  signer: any // ethers Signer
  managerAddress: string
  plan: AuthorizationPlan
  periods: number
  periodSeconds: number
  noticeSeconds: number
  permitDeadlineSeconds?: number
}): Promise<{ onchainSubscriptionId: string; txHash: string }> {
  const { ethers } = await import('ethers')
  const { signer, managerAddress, plan, periods, periodSeconds, noticeSeconds } = params

  const payer = await signer.getAddress()
  const token = new ethers.Contract(plan.tokenAddress, PERMIT_TOKEN_ABI, signer)

  const [decimals, tokenName, nonce] = await Promise.all([
    token.decimals(),
    token.name(),
    token.nonces(payer),
  ])

  const amountPerPeriod = ethers.parseUnits(plan.amount, decimals)
  const totalAuthorised = amountPerPeriod * BigInt(periods)
  const deadline = BigInt(
    Math.floor(Date.now() / 1000) + (params.permitDeadlineSeconds ?? 3600)
  )

  // The allowance must cover this subscription's whole budget; the contract
  // rejects anything smaller.
  const signature = await signer.signTypedData(
    {
      name: tokenName,
      version: '1',
      chainId: plan.chainId,
      verifyingContract: plan.tokenAddress,
    },
    PERMIT_TYPES,
    {
      owner: payer,
      spender: managerAddress,
      value: totalAuthorised,
      nonce,
      deadline,
    }
  )
  const { v, r, s } = ethers.Signature.from(signature)

  const manager = new ethers.Contract(managerAddress, MANAGER_ABI, signer)
  const tx = await manager.createSubscriptionWithPermit(
    {
      merchant: plan.to,
      token: plan.tokenAddress,
      amountPerPeriod,
      totalAuthorised,
      periodSeconds: BigInt(periodSeconds),
      firstChargeAt: 0n,
      endTime: 0n,
      noticeSeconds: BigInt(noticeSeconds),
      maxPeriods: periods,
    },
    totalAuthorised,
    deadline,
    v,
    r,
    s
  )

  const receipt = await tx.wait()

  // The id is assigned by the contract, so it has to be read back from the log
  // rather than computed here.
  const created = receipt.logs
    .map((log: any) => {
      try {
        return manager.interface.parseLog(log)
      } catch {
        return null
      }
    })
    .find((parsed: any) => parsed?.name === 'SubscriptionCreated')

  if (!created) {
    throw new Error(
      'The transaction succeeded but no SubscriptionCreated event was found. ' +
      'The mandate may exist on-chain but is not linked — check the transaction before retrying.'
    )
  }

  return {
    onchainSubscriptionId: created.args.subscriptionId,
    txHash: receipt.hash,
  }
}

/** Convenience wrapper: fetch the plan, sign it, store it. */
export async function authorizeSubscriptionPeriods(params: {
  subscriptionId: string
  ownerAddress: string
  periods: number
  signAuthorization: SignAuthorizationFn
  onProgress?: (signed: number, total: number) => void
}): Promise<{ stored: number; total: number }> {
  const plan = await fetchAuthorizationPlan(
    params.subscriptionId,
    params.ownerAddress,
    params.periods
  )

  if (plan.authorizations.length === 0) {
    return { stored: 0, total: 0 }
  }

  const { stored } = await signAndStoreAuthorizations({
    plan,
    ownerAddress: params.ownerAddress,
    signAuthorization: params.signAuthorization,
    onProgress: params.onProgress,
  })

  return { stored, total: plan.authorizations.length }
}
