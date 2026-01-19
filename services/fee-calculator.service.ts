import { getToken } from "@/services/token-metadata.service"

export type FeeBreakdown = {
  gasEstimate: string
  serviceFee: string
  totalFee: string
  breakdown: Record<string, { gasEstimate: string; serviceFee: string }>
}

const GAS_PER_ITEM_STANDARD = 65000n // per transfer
const DEFAULT_GAS_PRICE_GWEI = 30n
const GWEI = 1_000_000_000n
const WEI_IN_ETH = 1_000_000_000_000_000_000n

function toBaseUnits(amount: string, decimals: number): bigint {
  const [intPart, fracPart = ""] = amount.split(".")
  const safeFrac = (fracPart + "0".repeat(decimals)).slice(0, decimals)
  return BigInt(intPart || "0") * BigInt(10) ** BigInt(decimals) + BigInt(safeFrac || "0")
}

function fromBaseUnits(amount: bigint, decimals: number): string {
  const divisor = BigInt(10) ** BigInt(decimals)
  const intPart = amount / divisor
  const fracPart = amount % divisor
  if (fracPart === 0n) return intPart.toString()
  const fracStr = fracPart.toString().padStart(decimals, "0").replace(/0+$/, "")
  return `${intPart.toString()}.${fracStr}`
}

function calcServiceFee(total: bigint, decimals: number): bigint {
  // serviceFee = max(1, min(500, total * 0.5%)) in token units (approx)
  const percent = (total * 5n) / 1000n // 0.5%
  const oneToken = BigInt(10) ** BigInt(decimals)
  const minFee = oneToken
  const maxFee = oneToken * 500n
  return percent < minFee ? minFee : percent > maxFee ? maxFee : percent
}

export function calculateFees(options: {
  items: { token_symbol: string; amount: string; token_address: string; chain_id: number }[]
  paymentMethod: "standard" | "x402"
  gasPriceGwei?: number
}): FeeBreakdown {
  const gasPrice = BigInt(Math.max(1, Math.floor(options.gasPriceGwei ?? Number(DEFAULT_GAS_PRICE_GWEI))))
  let totalGasWei = 0n
  const breakdown: Record<string, { gasEstimate: string; serviceFee: string }> = {}

  const perTokenTotals = new Map<string, { total: bigint; decimals: number; count: number }>()

  for (const item of options.items) {
    const token = getToken(item.token_symbol, item.chain_id)
    if (!token) continue
    const base = toBaseUnits(item.amount, token.decimals)
    const current = perTokenTotals.get(item.token_symbol) || { total: 0n, decimals: token.decimals, count: 0 }
    current.total += base
    current.count += 1
    perTokenTotals.set(item.token_symbol, current)
    if (options.paymentMethod === "standard") {
      totalGasWei += GAS_PER_ITEM_STANDARD * gasPrice * GWEI
    }
  }

  const serviceFees: Record<string, bigint> = {}
  let totalServiceFeeWei = 0n

  for (const [symbol, info] of perTokenTotals.entries()) {
    const fee = calcServiceFee(info.total, info.decimals)
    serviceFees[symbol] = fee
    // We express service fee in token units; not converted to ETH
  }

  // Build breakdown strings
  for (const [symbol, info] of perTokenTotals.entries()) {
    const token = getToken(symbol, options.items[0]?.chain_id)
    if (!token) continue
    const gasForTokenWei = options.paymentMethod === "standard"
      ? GAS_PER_ITEM_STANDARD * BigInt(info.count) * gasPrice * GWEI
      : 0n
    const serviceFee = serviceFees[symbol]
    breakdown[symbol] = {
      gasEstimate: fromBaseUnits(gasForTokenWei, 18),
      serviceFee: fromBaseUnits(serviceFee, token.decimals),
    }
  }

  // Total fee = gas (in ETH) + sum service fees (token-specific, here aggregated as Wei-equivalent 0)
  const totalServiceFeeEth = 0n
  const totalFeeWei = totalGasWei + totalServiceFeeEth

  return {
    gasEstimate: fromBaseUnits(totalGasWei, 18),
    serviceFee: "token-denominated", // service fees are per-token above
    totalFee: fromBaseUnits(totalFeeWei, 18),
    breakdown,
  }
}
