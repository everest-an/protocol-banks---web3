import { generateKeyPairSync, verify } from "crypto"
import { buildPayAIJwt, getPayAISupported, settlePayAIPayment } from "../payments/payai-facilitator"

function decode(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
}

describe("PayAI facilitator adapter", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519")
  const keyId = "test-key"
  const secret = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64")

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.PAYAI_API_KEY_ID
    delete process.env.PAYAI_API_KEY_SECRET
  })

  it("builds a verifiable Ed25519 JWT", () => {
    const token = buildPayAIJwt(keyId, `payai_sk_${secret}`, { now: 1_800_000_000, jti: "jti-1" })
    const [header, payload, signature] = token.split(".")
    expect(JSON.parse(decode(header))).toMatchObject({ alg: "EdDSA", kid: keyId })
    expect(JSON.parse(decode(payload))).toMatchObject({ sub: keyId, iss: "payai-merchant", jti: "jti-1" })
    const ok = verify(null, Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature.replace(/-/g, "+").replace(/_/g, "/"), "base64"))
    expect(ok).toBe(true)
  })

  it("calls the public supported endpoint without credentials", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ kinds: [] }), { status: 200 }))
    const result = await getPayAISupported()
    expect(result).toEqual({ kinds: [] })
    expect(fetchMock).toHaveBeenCalledWith("https://facilitator.payai.network/supported", expect.objectContaining({ method: "GET" }))
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Headers
    expect(headers.get("authorization")).toBeNull()
  })

  it("sends an authorization header when keys are configured", async () => {
    process.env.PAYAI_API_KEY_ID = keyId
    process.env.PAYAI_API_KEY_SECRET = secret
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }))
    await settlePayAIPayment({ payload: 1 }, { scheme: "exact" })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = init.headers as Headers
    expect(headers.get("authorization")).toMatch(/^Bearer .+\..+\..+$/)
    expect(JSON.parse(String(init.body))).toMatchObject({ x402Version: 2, paymentPayload: { payload: 1 } })
  })
})
