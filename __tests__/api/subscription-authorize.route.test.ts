/**
 * /api/subscriptions/[id]/authorize and /api/subscriptions/[id]/onchain
 *
 * These two routes decide what the scheduler will later submit on-chain without
 * the payer present, so their checks are the last point at which a bad
 * authorization can be caught while the error is still legible:
 *
 *  - authorize verifies each EIP-712 signature against the exact tuple it claims
 *    to sign. An unverified signature stored here would sit until its billing
 *    period, then revert on-chain with no useful reason.
 *  - onchain re-reads the mandate from the chain before linking it, so a caller
 *    cannot point their subscription at a mandate they do not own.
 */

import { GET as getPlan, POST as storeAuthorizations } from "@/app/api/subscriptions/[id]/authorize/route"
import { POST as linkOnChain } from "@/app/api/subscriptions/[id]/onchain/route"
import { prisma } from "@/lib/prisma"
import { verifyJwt } from "@/lib/auth/jwt"
import { subscriptionService } from "@/lib/services/subscription-service"
import { verifyTypedData } from "viem"
import { NextRequest } from "next/server"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    subscriptionAuthorization: { findFirst: jest.fn(), createMany: jest.fn() },
    subscription: { update: jest.fn() },
  },
}))

jest.mock("@/lib/auth/jwt", () => ({ verifyJwt: jest.fn() }))
jest.mock("@/lib/auth/session", () => ({ verifySession: jest.fn().mockResolvedValue(null) }))
jest.mock("@/lib/services/subscription-service", () => ({
  subscriptionService: { getById: jest.fn() },
}))

// Signature verification is the property under test; drive it explicitly rather
// than generating real signatures.
jest.mock("viem", () => {
  const actual = jest.requireActual("viem")
  return { ...actual, verifyTypedData: jest.fn(), createPublicClient: jest.fn() }
})

const OWNER = "0x1234567890123456789012345678901234567890"
const OTHER = "0x9999999999999999999999999999999999999999"
const MERCHANT = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"

const SUBSCRIPTION = {
  id: "sub_1",
  owner_address: OWNER,
  recipient_address: MERCHANT,
  service_name: "Netflix",
  amount: "15",
  token: "USDC",
  frequency: "monthly",
  chain_id: 42161,
  next_payment_date: new Date("2026-09-01").toISOString(),
  schedule_day: undefined,
  schedule_time: undefined,
}

describe("/api/subscriptions/[id]/authorize", () => {
  const prismaMock = prisma as unknown as {
    subscriptionAuthorization: { findFirst: jest.Mock; createMany: jest.Mock }
    subscription: { update: jest.Mock }
  }
  const verifyJwtMock = verifyJwt as jest.Mock
  const getByIdMock = subscriptionService.getById as jest.Mock
  const verifyTypedDataMock = verifyTypedData as unknown as jest.Mock

  function req(url: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers)
    headers.set("authorization", "Bearer test-token")
    return new NextRequest(new Request(url, { ...init, headers }))
  }

  function signed(periodIndex: number) {
    return {
      periodIndex,
      nonce: "0x" + String(periodIndex).padStart(64, "0"),
      validAfter: 1_800_000_000,
      validBefore: 1_800_100_000,
      signature: "0x" + "ab".repeat(65),
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    verifyJwtMock.mockResolvedValue({ sub: OWNER })
    getByIdMock.mockResolvedValue(SUBSCRIPTION)
    prismaMock.subscriptionAuthorization.findFirst.mockResolvedValue(null)
    prismaMock.subscriptionAuthorization.createMany.mockResolvedValue({ count: 2 })
    verifyTypedDataMock.mockResolvedValue(true)
  })

  describe("GET (plan)", () => {
    it("issues one authorization per period, each with its own nonce", async () => {
      const res = await getPlan(req("http://localhost/api/subscriptions/sub_1/authorize?periods=4"))
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.authorizations).toHaveLength(4)

      // A repeated nonce would make every charge after the first revert.
      const nonces = body.authorizations.map((a: any) => a.nonce)
      expect(new Set(nonces).size).toBe(4)

      // Windows must not overlap, or two periods could be charged at once.
      for (let i = 1; i < body.authorizations.length; i++) {
        expect(body.authorizations[i].validAfter).toBeGreaterThan(
          body.authorizations[i - 1].validAfter
        )
      }
    })

    it("refuses a subscription for a token without ERC-3009 support", async () => {
      getByIdMock.mockResolvedValueOnce({ ...SUBSCRIPTION, token: "SHIB", chain_id: 42161 })
      const res = await getPlan(req("http://localhost/api/subscriptions/sub_1/authorize"))
      expect(res.status).toBe(422)
    })

    it("returns 404 for a subscription the caller does not own", async () => {
      // getById filters by owner, so someone else's id simply is not found.
      getByIdMock.mockResolvedValueOnce(null)
      const res = await getPlan(req("http://localhost/api/subscriptions/sub_1/authorize"))
      expect(res.status).toBe(404)
    })
  })

  describe("POST (store signatures)", () => {
    it("stores authorizations whose signatures verify", async () => {
      const res = await storeAuthorizations(
        req("http://localhost/api/subscriptions/sub_1/authorize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ authorizations: [signed(0), signed(1)] }),
        })
      )

      expect(res.status).toBe(201)
      expect(prismaMock.subscriptionAuthorization.createMany).toHaveBeenCalled()
    })

    it("stores nothing when any signature fails to verify", async () => {
      // First verifies, second does not.
      verifyTypedDataMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

      const res = await storeAuthorizations(
        req("http://localhost/api/subscriptions/sub_1/authorize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ authorizations: [signed(0), signed(1)] }),
        })
      )

      expect(res.status).toBe(400)
      expect(await res.json()).toHaveProperty("error", expect.stringMatching(/does not verify/))

      // Partially storing would leave the subscription chargeable for some
      // periods and silently dead for others.
      expect(prismaMock.subscriptionAuthorization.createMany).not.toHaveBeenCalled()
    })

    it("verifies each signature against the address that must have signed it", async () => {
      await storeAuthorizations(
        req("http://localhost/api/subscriptions/sub_1/authorize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ authorizations: [signed(0)] }),
        })
      )

      expect(verifyTypedDataMock).toHaveBeenCalledWith(
        expect.objectContaining({ address: OWNER.toLowerCase() })
      )
    })

    it("rejects an empty submission", async () => {
      const res = await storeAuthorizations(
        req("http://localhost/api/subscriptions/sub_1/authorize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ authorizations: [] }),
        })
      )
      expect(res.status).toBe(400)
    })

    it("caps how many can be stored at once", async () => {
      const many = Array.from({ length: 50 }, (_, i) => signed(i))
      const res = await storeAuthorizations(
        req("http://localhost/api/subscriptions/sub_1/authorize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ authorizations: many }),
        })
      )
      expect(res.status).toBe(400)
      expect(prismaMock.subscriptionAuthorization.createMany).not.toHaveBeenCalled()
    })
  })

  describe("POST /onchain (link mandate)", () => {
    it("rejects a malformed subscription id", async () => {
      const res = await linkOnChain(
        req("http://localhost/api/subscriptions/sub_1/onchain", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ subscriptionId: "not-a-bytes32" }),
        })
      )

      expect(res.status).toBe(400)
      expect(prismaMock.subscription.update).not.toHaveBeenCalled()
    })

    it("refuses to link when no manager is deployed on the chain", async () => {
      // Mainnet chains are intentionally left unregistered until audit.
      getByIdMock.mockResolvedValueOnce({ ...SUBSCRIPTION, chain_id: 1 })

      const res = await linkOnChain(
        req("http://localhost/api/subscriptions/sub_1/onchain", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ subscriptionId: "0x" + "11".repeat(32) }),
        })
      )

      expect(res.status).toBe(422)
      expect(prismaMock.subscription.update).not.toHaveBeenCalled()
    })
  })
})
