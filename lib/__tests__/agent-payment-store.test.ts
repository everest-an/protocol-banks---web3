import { paymentEventData, paymentView } from "@/lib/agent/payment-store"

const payment = {
  id: "pay_test",
  owner_address: "0x1111111111111111111111111111111111111111",
  from_address: "0x1111111111111111111111111111111111111111",
  to_address: "0x2222222222222222222222222222222222222222",
  token: "USDC",
  chain: "base",
  chain_id: 8453,
  amount_usd: 25,
  amount_units: "25000000",
  nonce: "0x" + "11".repeat(32),
  tx_hash: "0x" + "22".repeat(32),
  status: "confirmed",
  error: null,
  memo: "invoice 41",
  created_at: new Date("2026-10-30T21:04:11.000Z"),
  confirmed_at: new Date("2026-10-30T21:04:13.000Z"),
  updated_at: new Date("2026-10-30T21:04:13.000Z"),
}

describe("payment view", () => {
  it("exposes the durable id and confirmed fields", () => {
    const view = paymentView(payment as never)
    expect(view.id).toBe("pay_test")
    expect(view.status).toBe("confirmed")
    expect(view.txHash).toBe(payment.tx_hash)
    expect(view.confirmedAt).toBe("2026-10-30T21:04:13.000Z")
  })

  it("builds the webhook payload with the same payment id", () => {
    const data = paymentEventData(payment as never)
    expect(data.payment_id).toBe("pay_test")
    expect(data.amount).toBe("25")
    expect(data.chain_id).toBe(8453)
    expect(data.tx_hash).toBe(payment.tx_hash)
  })
})
