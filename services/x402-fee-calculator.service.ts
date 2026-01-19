export type FeeOptions = {
  amount: string
  bps?: number
  cap?: string
}

function parseUint(value: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new Error("Amount must be an integer string")
  }
  return BigInt(value)
}

export function calculateRelayerFee(options: FeeOptions): { fee: string } {
  const bps = options.bps ?? 50 // 0.5%
  const cap = options.cap ? parseUint(options.cap) : null

  const amount = parseUint(options.amount)
  const fee = (amount * BigInt(bps)) / 10000n

  if (cap !== null && fee > cap) {
    throw new Error("Relayer fee exceeds cap")
  }

  return { fee: fee.toString() }
}
