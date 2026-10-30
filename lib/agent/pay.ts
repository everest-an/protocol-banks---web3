/**
 * Pay execution: an intent the payer signs with EIP-3009, validated and
 * submitted by the platform relayer.
 *
 * The platform never holds funds. The authorization moves the payer's own USDC;
 * the relayer only pays gas. The key's policy is checked before submission, so
 * the same caps that gate trades also gate payments.
 */
import { getAddress, parseUnits, recoverTypedDataAddress, serializeSignature } from "viem"
import {
  buildTransferAuthorizationTypedData,
  ERC3009_TYPES,
  generateNonce,
  getEIP712Domain,
  getTokenDecimals,
  isERC3009Supported,
} from "@/lib/erc3009"
import { EVM_NETWORKS } from "@/lib/networks"

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/
export const PAY_VALIDITY_SECONDS = 15 * 60

export interface PaymentAuthorization {
  from: string
  to: string
  value: string
  validAfter: number
  validBefore: number
  nonce: string
}

export interface PaymentSignature {
  v: number
  r: string
  s: string
}

export interface PaymentIntent {
  chain: string
  chainId: number
  token: string
  authorization: PaymentAuthorization
  typedData: ReturnType<typeof buildTransferAuthorizationTypedData> | null
  executable: boolean
}

export interface ChainRef {
  id: string
  chainId: number
}

/** Resolve a chain name ("base", "Base", "ethereum") to its id and chainId. */
export function resolveChain(chain: string): ChainRef | null {
  const needle = chain.trim().toLowerCase()
  for (const network of Object.values(EVM_NETWORKS)) {
    if (network.type !== "EVM" || network.chainId === undefined) continue
    if (network.id === needle || network.name.toLowerCase() === needle) {
      return { id: network.id, chainId: network.chainId }
    }
  }
  return null
}

/** USDC has 6 decimals; reject an amount with more precision than the token. */
function toTokenUnits(amountUsd: number, decimals: number): bigint | null {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return null
  const rounded = Number(amountUsd.toFixed(decimals))
  if (!Number.isFinite(rounded) || rounded <= 0) return null
  try {
    return parseUnits(rounded.toFixed(decimals), decimals)
  } catch {
    return null
  }
}

function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null
  const hex = value.startsWith("0x") ? value : `0x${value}`
  return /^0x[0-9a-fA-F]{64}$/.test(hex) ? hex : null
}

/**
 * Build the unsigned intent. `executable` is false for destinations or tokens
 * that cannot take EIP-3009 (e.g. Solana, or USDT); those stay prepare-only.
 */
export function buildPaymentIntent(params: {
  from: string
  to: string
  amountUsd: number
  token: string
  chain: string
  validitySeconds?: number
  nowSeconds?: number
}): { ok: true; intent: PaymentIntent } | { ok: false; error: string } {
  const chain = resolveChain(params.chain)
  if (!chain) return { ok: false, error: `unsupported chain "${params.chain}"` }

  const token = params.token.trim().toUpperCase()
  const decimals = getTokenDecimals(chain.chainId, token)
  const value = toTokenUnits(params.amountUsd, decimals)
  if (value === null) return { ok: false, error: "amountUsd is not a valid token amount" }

  const executable = EVM_ADDRESS.test(params.to) && isERC3009Supported(chain.chainId, token)
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000)
  const authorization: PaymentAuthorization = {
    from: params.from.toLowerCase(),
    to: params.to.toLowerCase(),
    value: value.toString(),
    validAfter: now - 60,
    validBefore: now + (params.validitySeconds ?? PAY_VALIDITY_SECONDS),
    nonce: generateNonce(),
  }

  const typedData = executable
    ? buildTransferAuthorizationTypedData(chain.chainId, token, authorization)
    : null

  return {
    ok: true,
    intent: { chain: chain.id, chainId: chain.chainId, token, authorization, typedData, executable },
  }
}

/**
 * Validate a signed authorization against the payer, recipient, amount and
 * window. Returns the normalized signature components for the relayer.
 */
export async function verifyPaymentAuthorization(params: {
  owner: string
  to: string
  amountUsd: number
  token: string
  chain: string
  authorization: PaymentAuthorization
  signature: PaymentSignature
  nowSeconds?: number
}): Promise<{ ok: true; chainId: number; token: string; value: bigint; v: number; r: string; s: string } | { ok: false; error: string }> {
  const chain = resolveChain(params.chain)
  if (!chain) return { ok: false, error: `unsupported chain "${params.chain}"` }
  const token = params.token.trim().toUpperCase()
  if (!isERC3009Supported(chain.chainId, token)) {
    return { ok: false, error: `${token} does not support EIP-3009 on ${chain.id}` }
  }
  if (!EVM_ADDRESS.test(params.to)) return { ok: false, error: "EIP-3009 payments require an EVM destination" }

  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000)
  const authorization = params.authorization
  if (!authorization || typeof authorization !== "object") {
    return { ok: false, error: "authorization is required" }
  }
  if (typeof authorization.validBefore !== "number" || authorization.validBefore <= now) {
    return { ok: false, error: "authorization expired" }
  }
  if (typeof authorization.validAfter !== "number" || authorization.validAfter > now) {
    return { ok: false, error: "authorization is not valid yet" }
  }

  const decimals = getTokenDecimals(chain.chainId, token)
  const value = toTokenUnits(params.amountUsd, decimals)
  if (value === null) return { ok: false, error: "amountUsd is not a valid token amount" }

  if (authorization.from?.toLowerCase() !== params.owner.toLowerCase()) {
    return { ok: false, error: "authorization.from must be the key's owner address" }
  }
  if (authorization.to?.toLowerCase() !== params.to.toLowerCase()) {
    return { ok: false, error: "authorization.to does not match the destination" }
  }
  let declared: bigint
  try {
    declared = BigInt(authorization.value)
  } catch {
    return { ok: false, error: "authorization value is not a valid integer" }
  }
  if (declared !== value) {
    return { ok: false, error: "authorization value does not match amountUsd" }
  }

  const r = normalizeHex(params.signature?.r)
  const s = normalizeHex(params.signature?.s)
  const nonce = normalizeHex(authorization.nonce)
  if (!r || !s || !nonce) return { ok: false, error: "malformed signature components" }

  const rawV = params.signature?.v
  const v = typeof rawV === "number" && rawV < 27 ? rawV + 27 : rawV
  if (v !== 27 && v !== 28) return { ok: false, error: `invalid signature v (${rawV})` }

  const domain = getEIP712Domain(chain.chainId, token)
  if (!domain) return { ok: false, error: `missing EIP-712 domain for ${token}` }

  const signature = serializeSignature({ r: r as `0x${string}`, s: s as `0x${string}`, v: BigInt(v) })
  const signer = await recoverTypedDataAddress({
    domain: {
      name: domain.name,
      version: domain.version,
      chainId: domain.chainId,
      verifyingContract: getAddress(domain.verifyingContract),
    },
    types: ERC3009_TYPES,
    primaryType: "TransferWithAuthorization",
    message: {
      from: authorization.from as `0x${string}`,
      to: authorization.to as `0x${string}`,
      value,
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: nonce as `0x${string}`,
    },
    signature,
  })

  if (signer.toLowerCase() !== params.owner.toLowerCase()) {
    return { ok: false, error: `authorization signed by ${signer}, not the key's owner` }
  }

  return { ok: true, chainId: chain.chainId, token, value, v, r, s }
}
