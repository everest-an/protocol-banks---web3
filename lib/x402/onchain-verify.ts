/**
 * On-chain verification for x402 settlements.
 *
 * The x402 endpoints previously trusted a client-supplied `txHash`: `verify`
 * checked only that it looked like a hash (`/^0x[a-fA-F0-9]{64}$/`) and then
 * marked the authorization `completed`, and `execute` gates the paid resource
 * on that same status. A caller could therefore pass an arbitrary 64-hex string
 * — e.g. 64 zeros — and be told "Payment verified successfully" without any
 * money moving. Both endpoints are public.
 *
 * This module checks the claim against the chain: the transaction must exist,
 * have succeeded, and contain an ERC-20 `Transfer` log for the expected token,
 * sender, recipient and (minimum) amount.
 *
 * The log-matching rule is kept pure so it can be tested without an RPC.
 */

import { JsonRpcProvider } from "ethers"
import { parseTokenAmount, getTokenAddress, getTokenDecimals } from "@/lib/erc3009"
import { EVM_NETWORKS } from "@/lib/networks"

/** keccak256("Transfer(address,address,uint256)") */
export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

export interface RawLog {
  address: string
  topics: string[]
  data: string
}

export interface ExpectedTransfer {
  /** ERC-20 contract that must have emitted the log. */
  tokenAddress: string
  from: string
  to: string
  /** Base units; a transfer of at least this much counts as paid. */
  minAmount: bigint
}

export interface VerificationOutcome {
  ok: boolean
  reason: string
}

/** Does any log prove this exact transfer? Pure — no network. */
export function matchTransferLog(logs: RawLog[], expected: ExpectedTransfer): VerificationOutcome {
  const token = expected.tokenAddress.toLowerCase()
  const from = expected.from.toLowerCase()
  const to = expected.to.toLowerCase()
  let sawTokenTransfer = false

  for (const log of logs) {
    if (log.address.toLowerCase() !== token) continue
    if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue
    if (log.topics.length < 3) continue
    sawTokenTransfer = true

    const logFrom = `0x${log.topics[1].slice(-40)}`.toLowerCase()
    const logTo = `0x${log.topics[2].slice(-40)}`.toLowerCase()
    let amount = 0n
    try {
      amount = BigInt(log.data && log.data !== "0x" ? log.data : "0x0")
    } catch {
      continue
    }

    if (logFrom !== from) continue
    if (logTo !== to) continue
    if (amount < expected.minAmount) {
      return {
        ok: false,
        reason: `transfer of ${amount} is below the authorized ${expected.minAmount} base units`,
      }
    }
    return { ok: true, reason: `matched ${amount} base units from ${logFrom} to ${logTo}` }
  }

  return {
    ok: false,
    reason: sawTokenTransfer
      ? "no transfer log matched the expected sender, recipient and amount"
      : "no ERC-20 transfer log for the expected token in this transaction",
  }
}

/**
 * Fetch the transaction and require a matching transfer log.
 * Returns ok=false with a human-readable reason for every rejection.
 */
export async function verifyErc20TransferOnChain(params: {
  chainId: number
  txHash: string
  tokenSymbol: string
  from: string
  to: string
  amount: string
}): Promise<VerificationOutcome> {
  const tokenAddress = getTokenAddress(params.chainId, params.tokenSymbol)
  if (!tokenAddress) {
    return { ok: false, reason: `unsupported token ${params.tokenSymbol} on chain ${params.chainId}` }
  }

  const network = Object.values(EVM_NETWORKS).find((n) => n.chainId === params.chainId)
  if (!network?.rpcUrl) {
    return { ok: false, reason: `no RPC endpoint configured for chain ${params.chainId}` }
  }

  let minAmount: bigint
  try {
    minAmount = parseTokenAmount(params.amount, getTokenDecimals(params.chainId, params.tokenSymbol))
  } catch {
    return { ok: false, reason: `invalid amount ${params.amount}` }
  }

  let receipt: Awaited<ReturnType<JsonRpcProvider["getTransactionReceipt"]>>
  try {
    const provider = new JsonRpcProvider(network.rpcUrl, undefined, { staticNetwork: true })
    receipt = await provider.getTransactionReceipt(params.txHash)
  } catch (e) {
    return { ok: false, reason: `RPC lookup failed: ${e instanceof Error ? e.message : String(e)}` }
  }

  if (!receipt) return { ok: false, reason: "transaction not found on chain" }
  if (receipt.status !== 1) return { ok: false, reason: "transaction reverted" }

  return matchTransferLog(
    receipt.logs.map((log) => ({ address: log.address, topics: [...log.topics], data: log.data })),
    { tokenAddress, from: params.from, to: params.to, minAmount },
  )
}
