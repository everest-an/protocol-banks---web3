/**
 * Official test vectors from hyperliquid-python-sdk `tests/signing_test.py`.
 *
 * Everything in `lib/trading/exchange.ts` is a hand-port of the reference
 * implementation (msgpack of the action + nonce + vault marker → keccak →
 * phantom-agent EIP-712). Ports drift silently: a wrong key order or a string
 * that should have stayed a number still produces a *valid-looking* signature
 * that the venue simply recovers to some other address — exactly how the
 * `v = sig.v + 27` mistake stayed invisible behind our own `recoverSigner`.
 *
 * These vectors are the only check that is external to our own code, so they
 * are the ones that would catch that class of bug before it costs a real order.
 * Source:
 *   https://github.com/hyperliquid-dex/hyperliquid-python-sdk/blob/master/tests/signing_test.py
 */

import { Wallet } from "ethers"
import { l1ActionDigest, signL1Action, type L1Action } from "@/lib/trading/exchange"

// Key used by the SDK's own tests.
const VECTOR_KEY = "0x0123456789012345678901234567890123456789012345678901234567890123"

/**
 * The SDK's expected values come from eth_utils `to_hex()`, which does NOT pad
 * leading zeros (a signature whose r starts with a zero nibble is published as
 * 63 hex characters), while ethers serialises r/s zero-padded to 32 bytes.
 * Compare numerically so the assertion is about the signature, not about two
 * libraries' string conventions.
 */
const asInt = (hex: string): bigint => BigInt(hex)

describe("official vectors: l1_action_signing_matches", () => {
  // SDK: action = {"type": "dummy", "num": float_to_int_for_hashing(1000)}
  // float_to_int_for_hashing(x) = round(x * 1e8) → 1000 * 1e8
  const action: L1Action = { type: "dummy", num: 1000 * 1e8 }
  const wallet = new Wallet(VECTOR_KEY)

  it("mainnet (phantom-agent source 'a')", () => {
    const sig = signL1Action(wallet, action, { vaultAddress: null, nonce: 0, isMainnet: true })
    expect(asInt(sig.r)).toBe(asInt("0x53749d5b30552aeb2fca34b530185976545bb22d0b3ce6f62e31be961a59298"))
    expect(asInt(sig.s)).toBe(asInt("0x755c40ba9bf05223521753995abb2f73ab3229be8ec921f350cb447e384d8ed8"))
    expect(sig.v).toBe(27)
  })

  it("testnet (phantom-agent source 'b')", () => {
    const sig = signL1Action(wallet, action, { vaultAddress: null, nonce: 0, isMainnet: false })
    expect(asInt(sig.r)).toBe(asInt("0x542af61ef1f429707e3c76c5293c80d01f74ef853e34b76efffcb57e574f9510"))
    expect(asInt(sig.s)).toBe(asInt("0x17b8b32f086e8cdede991f1e2c529f5dd5297cbe8128500e00cbaf766204a613"))
    expect(sig.v).toBe(28)
  })

  it("keeps r/s zero-padded to 32 bytes on the wire", () => {
    // The HTTP body carries r/s as 0x-prefixed 32-byte strings, so a signature
    // with a short hex form must still serialise to the full width.
    const sig = signL1Action(wallet, action, { vaultAddress: null, nonce: 0, isMainnet: true })
    expect(sig.r).toHaveLength(66)
    expect(sig.s).toHaveLength(66)
  })
})

describe("official vectors: phantom agent connectionId for an order action", () => {
  it("hashes an IOC order to the reference connectionId", () => {
    // SDK: OrderRequest{coin: "ETH", is_buy: true, sz: 0.0147, limit_px: 1670.1,
    //      reduce_only: false, order_type: {limit: {tif: "Ioc"}}} at asset index 4,
    //      nonce 1677777606040, no vault.
    // float_to_wire keeps the decimal string: "1670.1" / "0.0147".
    const action: L1Action = {
      type: "order",
      orders: [
        { a: 4, b: true, p: "1670.1", s: "0.0147", r: false, t: { limit: { tif: "Ioc" } } },
      ],
      grouping: "na",
    }

    expect(l1ActionDigest(action, null, 1677777606040)).toBe(
      "0x0fcbeda5ae3c4950a548021552a4fea2226858c4453571bf3f24ba017eac2908",
    )
  })
})
