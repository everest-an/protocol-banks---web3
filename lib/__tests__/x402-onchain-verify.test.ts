/**
 * x402 on-chain verification — the rule that decides whether a claimed
 * transaction actually pays.
 *
 * This is the security boundary: before it existed, `POST /api/x402/verify`
 * accepted any 64-hex string (a call with 64 zeros answered "Payment verified
 * successfully") and `/execute` released the paid resource on that status.
 *
 * The matcher is pure, so every rejection path can be pinned without a chain.
 */

import { matchTransferLog, TRANSFER_TOPIC, type RawLog } from "@/lib/x402/onchain-verify"

const TOKEN = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // USDC
const PAYER = "0xBf0D7119F553eB5f85C9806f0849f9c86a9B768C"
const PAYEE = "0xBB14Dd923A28DBEB6BA86801DA38CdE60b72D35b"
const OTHER = "0x9999999999999999999999999999999999999999"

/** Build an ERC-20 Transfer log as it appears in a receipt. */
function transferLog(opts: {
  token?: string
  from?: string
  to?: string
  amount?: bigint
  topic?: string
}): RawLog {
  const { token = TOKEN, from = PAYER, to = PAYEE, amount = 1_000_000n, topic = TRANSFER_TOPIC } = opts
  return {
    address: token,
    topics: [topic, `0x${"0".repeat(24)}${from.slice(2)}`, `0x${"0".repeat(24)}${to.slice(2)}`],
    data: `0x${amount.toString(16).padStart(64, "0")}`,
  }
}

const EXPECTED = { tokenAddress: TOKEN, from: PAYER, to: PAYEE, minAmount: 1_000_000n }

describe("matchTransferLog", () => {
  it("accepts a transfer of exactly the authorized amount", () => {
    const out = matchTransferLog([transferLog({})], EXPECTED)
    expect(out.ok).toBe(true)
  })

  it("accepts an overpayment", () => {
    expect(matchTransferLog([transferLog({ amount: 2_000_000n })], EXPECTED).ok).toBe(true)
  })

  it("rejects an underpayment and says why", () => {
    const out = matchTransferLog([transferLog({ amount: 999_999n })], EXPECTED)
    expect(out.ok).toBe(false)
    expect(out.reason).toContain("below the authorized")
  })

  it("rejects a transfer from a different sender", () => {
    const out = matchTransferLog([transferLog({ from: OTHER })], EXPECTED)
    expect(out.ok).toBe(false)
    expect(out.reason).toContain("no transfer log matched")
  })

  it("rejects a transfer to a different recipient", () => {
    expect(matchTransferLog([transferLog({ to: OTHER })], EXPECTED).ok).toBe(false)
  })

  it("rejects a transfer of a different token contract", () => {
    const out = matchTransferLog([transferLog({ token: OTHER })], EXPECTED)
    expect(out.ok).toBe(false)
    expect(out.reason).toContain("no ERC-20 transfer log for the expected token")
  })

  it("ignores non-Transfer events from the same contract", () => {
    const approvalLog = transferLog({ topic: `0x${"ab".repeat(32)}` })
    expect(matchTransferLog([approvalLog], EXPECTED).ok).toBe(false)
  })

  it("rejects an empty receipt", () => {
    expect(matchTransferLog([], EXPECTED).ok).toBe(false)
  })

  it("ignores malformed logs instead of throwing", () => {
    const malformed: RawLog[] = [
      { address: TOKEN, topics: [TRANSFER_TOPIC], data: "0x" }, // too few topics
      { address: TOKEN, topics: [TRANSFER_TOPIC, "0xzz", "0xzz"], data: "0xnothex" },
    ]
    expect(matchTransferLog(malformed, EXPECTED).ok).toBe(false)
  })

  it("finds a valid transfer among unrelated logs", () => {
    const noisy = [
      transferLog({ token: OTHER, from: OTHER, to: OTHER }),
      transferLog({ topic: `0x${"cd".repeat(32)}` }),
      transferLog({}),
    ]
    expect(matchTransferLog(noisy, EXPECTED).ok).toBe(true)
  })

  it("matches addresses case-insensitively", () => {
    const upper = transferLog({ from: PAYER.toUpperCase().replace("0X", "0x"), to: PAYEE.toUpperCase().replace("0X", "0x") })
    expect(matchTransferLog([upper], { ...EXPECTED, from: PAYER.toUpperCase().replace("0X", "0x") }).ok).toBe(true)
  })
})
