/**
 * Pay intent + EIP-3009 verification. The platform never moves funds: the payer
 * signs, this module checks the signature against the owner and the requested
 * payment, and the relayer only submits what was signed.
 */
import { parseSignature } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { buildPaymentIntent, resolveChain, verifyPaymentAuthorization } from "@/lib/agent/pay"

const account = privateKeyToAccount(generatePrivateKey())
const TO = "0x2222222222222222222222222222222222222222"
const NOW = 1_800_000_000

function intent(overrides: { to?: string; amountUsd?: number; token?: string; chain?: string } = {}) {
  const built = buildPaymentIntent({
    from: account.address,
    to: overrides.to ?? TO,
    amountUsd: overrides.amountUsd ?? 25,
    token: overrides.token ?? "USDC",
    chain: overrides.chain ?? "base",
    nowSeconds: NOW,
  })
  if (!built.ok) throw new Error(built.error)
  return built.intent
}

async function signed(overrides: { to?: string; amountUsd?: number; token?: string; chain?: string } = {}) {
  const built = intent(overrides)
  const typed = built.typedData!
  const signature = await account.signTypedData({
    domain: typed.domain,
    types: typed.types,
    primaryType: typed.primaryType,
    message: typed.message,
  })
  const parsed = parseSignature(signature)
  return {
    intent: built,
    signature: { v: Number(parsed.v), r: parsed.r, s: parsed.s },
  }
}

describe("resolveChain", () => {
  it("resolves ids and names case-insensitively", () => {
    expect(resolveChain("base")?.chainId).toBe(8453)
    expect(resolveChain("Base")?.chainId).toBe(8453)
    expect(resolveChain("ethereum")?.chainId).toBe(1)
    expect(resolveChain("nope")).toBeNull()
  })
})

describe("buildPaymentIntent", () => {
  it("builds signable EIP-712 data for EVM USDC", () => {
    const built = intent()

    expect(built.chainId).toBe(8453)
    expect(built.token).toBe("USDC")
    expect(built.executable).toBe(true)
    expect(built.authorization.value).toBe("25000000")
    expect(built.authorization.from).toBe(account.address.toLowerCase())
    expect(built.typedData?.primaryType).toBe("TransferWithAuthorization")
    expect(built.typedData?.domain.verifyingContract).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
  })

  it("keeps Solana and non-3009 tokens prepare-only", () => {
    const solana = intent({ to: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" })
    expect(solana.executable).toBe(false)
    expect(solana.typedData).toBeNull()

    const usdt = intent({ token: "USDT" })
    expect(usdt.executable).toBe(false)
    expect(usdt.typedData).toBeNull()
  })
})

describe("verifyPaymentAuthorization", () => {
  it("recovers the payer and accepts the exact payment", async () => {
    const { intent: built, signature } = await signed()

    const checked = await verifyPaymentAuthorization({
      owner: account.address,
      to: TO,
      amountUsd: 25,
      token: "USDC",
      chain: "base",
      authorization: built.authorization,
      signature,
      nowSeconds: NOW,
    })

    expect(checked.ok).toBe(true)
    if (checked.ok) expect(checked.value).toBe(25_000_000n)
  })

  it("rejects a different amount", async () => {
    const { intent: built, signature } = await signed()

    const checked = await verifyPaymentAuthorization({
      owner: account.address,
      to: TO,
      amountUsd: 30,
      token: "USDC",
      chain: "base",
      authorization: built.authorization,
      signature,
      nowSeconds: NOW,
    })

    expect(checked.ok).toBe(false)
    if (!checked.ok) expect(checked.error).toMatch(/value does not match/)
  })

  it("rejects a different recipient", async () => {
    const { intent: built, signature } = await signed()

    const checked = await verifyPaymentAuthorization({
      owner: account.address,
      to: "0x3333333333333333333333333333333333333333",
      amountUsd: 25,
      token: "USDC",
      chain: "base",
      authorization: built.authorization,
      signature,
      nowSeconds: NOW,
    })

    expect(checked.ok).toBe(false)
  })

  it("rejects a signature from another key", async () => {
    const { intent: built, signature } = await signed()
    const other = privateKeyToAccount(generatePrivateKey())

    const checked = await verifyPaymentAuthorization({
      owner: other.address,
      to: TO,
      amountUsd: 25,
      token: "USDC",
      chain: "base",
      authorization: { ...built.authorization, from: other.address.toLowerCase() },
      signature,
      nowSeconds: NOW,
    })

    expect(checked.ok).toBe(false)
    if (!checked.ok) expect(checked.error).toMatch(/signed by/)
  })

  it("rejects an expired authorization", async () => {
    const { intent: built, signature } = await signed()

    const checked = await verifyPaymentAuthorization({
      owner: account.address,
      to: TO,
      amountUsd: 25,
      token: "USDC",
      chain: "base",
      authorization: built.authorization,
      signature,
      nowSeconds: built.authorization.validBefore + 1,
    })

    expect(checked.ok).toBe(false)
    if (!checked.ok) expect(checked.error).toMatch(/expired/)
  })
})
