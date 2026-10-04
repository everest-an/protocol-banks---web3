/**
 * Local relayer submission.
 *
 * Submits EIP-3009 authorizations on-chain with the platform's own
 * RELAYER_PRIVATE_KEY — the same proven path the batch payout bridge uses.
 * Used when no hosted relayer service (RELAYER_URL / RELAYER_API_KEY) is
 * configured, so subscriptions and x402 can settle without an external relayer.
 *
 * Transactions are serialized per chain+address and given explicit,
 * locally-sequenced nonces. Two races showed up in the batch E2E run:
 * concurrent sends fetched the same pending nonce ("replacement transaction
 * underpriced"), and the shared public RPC sometimes lagged the mempool and
 * handed out a stale pending nonce. Both disappear when the queue owns the
 * nonce: only a failure re-syncs from the chain.
 *
 * Scoped per serverless instance; the Go payout service keeps its own
 * distributed nonce locking on the production path.
 */
import { createPublicClient, createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { arbitrum, base, bsc, mainnet, optimism, polygon, sepolia, type Chain } from "viem/chains"
import { EVM_NETWORKS } from "../networks"
import { TRANSFER_WITH_AUTHORIZATION_ABI } from "../erc3009"

const CHAIN_BY_ID: Record<number, Chain> = {
  1: mainnet,
  137: polygon,
  8453: base,
  42161: arbitrum,
  10: optimism,
  56: bsc,
  11155111: sepolia,
}

export type RelayerSendQueue = { tail: Promise<unknown>; nextNonce?: number }
export const relayerSendQueues = new Map<string, RelayerSendQueue>()

export function enqueueRelayerSend<T>(
  key: string,
  fetchNonce: () => Promise<number>,
  send: (nonce: number) => Promise<T>,
): Promise<T> {
  const queue = relayerSendQueues.get(key) ?? { tail: Promise.resolve() }
  const run = async (): Promise<T> => {
    const nonce = queue.nextNonce ?? (await fetchNonce())
    try {
      const result = await send(nonce)
      queue.nextNonce = nonce + 1
      return result
    } catch (error) {
      // After any failure the chain is the source of truth again.
      queue.nextNonce = undefined
      throw error
    }
  }
  const next = queue.tail.catch(() => {}).then(run)
  queue.tail = next
  relayerSendQueues.set(key, queue)
  return next
}

export interface TransferWithAuthorizationParams {
  chainId: number
  tokenAddress: string
  from: string
  to: string
  value: bigint
  validAfter: number
  validBefore: number
  nonce: string
  v: number
  r: string
  s: string
}

/** Ethers' raw wording for an empty-gas relayer is not actionable on its own. */
function isInsufficientFunds(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? error).toLowerCase()
  return message.includes("insufficient funds") || message.includes("insufficient balance")
}

/**
 * Submit a signed EIP-3009 authorization with the local relayer key and wait
 * for the receipt. Returns the transaction hash.
 */
export async function submitTransferWithAuthorization(
  params: TransferWithAuthorizationParams,
): Promise<`0x${string}`> {
  const privateKey = process.env.RELAYER_PRIVATE_KEY
  if (!privateKey) {
    throw new Error("Relayer not configured (RELAYER_PRIVATE_KEY missing)")
  }
  const chain = CHAIN_BY_ID[params.chainId]
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${params.chainId}`)
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`)
  const rpcUrl = Object.values(EVM_NETWORKS).find((network) => network.chainId === params.chainId)?.rpcUrl
  const transport = rpcUrl ? http(rpcUrl) : http()
  const walletClient = createWalletClient({ account, chain, transport })
  const publicClient = createPublicClient({ chain, transport })
  const sendKey = `${account.address}:${params.chainId}`

  const txHash = await enqueueRelayerSend(
    sendKey,
    () => publicClient.getTransactionCount({ address: account.address, blockTag: "pending" }),
    (txNonce) =>
      walletClient.writeContract({
        address: params.tokenAddress as `0x${string}`,
        abi: TRANSFER_WITH_AUTHORIZATION_ABI,
        functionName: "transferWithAuthorization",
        args: [
          params.from as `0x${string}`,
          params.to as `0x${string}`,
          params.value,
          BigInt(params.validAfter),
          BigInt(params.validBefore),
          params.nonce as `0x${string}`,
          params.v,
          params.r as `0x${string}`,
          params.s as `0x${string}`,
        ],
        nonce: txNonce,
      }),
  ).catch((error: unknown) => {
    if (isInsufficientFunds(error)) {
      throw new Error(
        `Relayer ${account.address} has no gas on chain ${params.chainId}; settlements on this chain cannot be submitted. ` +
          "Fund it with native currency — check gaps with scripts/relayer-readiness.ts.",
      )
    }
    throw error
  })

  await publicClient.waitForTransactionReceipt({ hash: txHash })
  return txHash
}
