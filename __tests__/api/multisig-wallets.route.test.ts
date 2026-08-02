/**
 * /api/multisig/wallets and /api/multisig/transactions
 *
 * These routes replaced a browser-side module that talked to Prisma directly —
 * which could never work, since Prisma is server-only. The behaviour that
 * matters now is ownership: a caller must only ever see or touch their own
 * wallets, because the authenticated address is the sole thing standing between
 * one user and another's multisig configuration.
 */

import { GET as getWallets, POST as createWallet } from "@/app/api/multisig/wallets/route"
import {
  GET as getTransactions,
  POST as createTransaction,
} from "@/app/api/multisig/transactions/route"
import { prisma } from "@/lib/prisma"
import { verifyJwt } from "@/lib/auth/jwt"
import { NextRequest } from "next/server"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    multisigWallet: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    multisigTransaction: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
  },
}))

// withAuth closes over the real requireAuth, so mocking that export has no
// effect. Mock the credential check instead — this also exercises the real
// middleware, which is where the ownership guarantee actually comes from.
jest.mock("@/lib/auth/jwt", () => ({ verifyJwt: jest.fn() }))
jest.mock("@/lib/auth/session", () => ({ verifySession: jest.fn().mockResolvedValue(null) }))

const OWNER = "0x1234567890123456789012345678901234567890"
const OTHER = "0x9999999999999999999999999999999999999999"

describe("/api/multisig", () => {
  const prismaMock = prisma as unknown as {
    multisigWallet: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock }
    multisigTransaction: { findMany: jest.Mock; count: jest.Mock; create: jest.Mock }
  }
  const verifyJwtMock = verifyJwt as jest.Mock

  /** Request carrying a bearer token the mocked verifier will accept. */
  function req(url: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers)
    headers.set("authorization", "Bearer test-token")
    return new NextRequest(new Request(url, { ...init, headers }))
  }

  beforeEach(() => {
    jest.clearAllMocks()
    verifyJwtMock.mockResolvedValue({ sub: OWNER })
    prismaMock.multisigWallet.findMany.mockResolvedValue([
      { id: "w_1", owner_address: OWNER, name: "Treasury", transactions: [] },
    ])
    prismaMock.multisigWallet.findUnique.mockResolvedValue({
      id: "w_1",
      owner_address: OWNER,
      threshold: 2,
    })
    prismaMock.multisigTransaction.findMany.mockResolvedValue([])
    prismaMock.multisigTransaction.count.mockResolvedValue(0)
  })

  describe("GET /wallets", () => {
    it("returns only wallets owned by the authenticated address", async () => {
      const res = await getWallets(req("http://localhost/api/multisig/wallets"))
      expect(res.status).toBe(200)

      // The ownership filter is the access control; without it every caller
      // would see every wallet.
      expect(prismaMock.multisigWallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { owner_address: OWNER } })
      )
    })

    it("rejects a caller with no valid credential", async () => {
      // No bearer token and no session, so verifyJwt is never reached — the
      // x-wallet-address header alone must not authenticate, since that was the
      // impersonation hole this middleware closed.
      const res = await getWallets(
        new NextRequest(
          new Request("http://localhost/api/multisig/wallets", {
            headers: { "x-wallet-address": OWNER },
          })
        )
      )

      expect(res.status).toBe(401)
      expect(prismaMock.multisigWallet.findMany).not.toHaveBeenCalled()
    })

    it("rejects a header claiming a different address than the token", async () => {
      const res = await getWallets(
        req("http://localhost/api/multisig/wallets", {
          headers: { "x-wallet-address": OTHER },
        })
      )

      expect(res.status).toBe(403)
      expect(prismaMock.multisigWallet.findMany).not.toHaveBeenCalled()
    })
  })

  describe("POST /wallets", () => {
    it("records the authenticated address as the owner", async () => {
      prismaMock.multisigWallet.create.mockResolvedValue({ id: "w_2" })

      const res = await createWallet(
        req("http://localhost/api/multisig/wallets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Ops",
            address: "0xaaa",
            chainId: 42161,
            threshold: 2,
            // A caller cannot assign ownership to someone else: the route uses
            // the authenticated address, not anything from the body.
            owner_address: OTHER,
            signers: ["0xaaa", "0xbbb"],
          }),
        })
      )

      expect(res.status).toBe(201)
      expect(prismaMock.multisigWallet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ owner_address: OWNER }),
        })
      )
    })

    it("rejects incomplete terms", async () => {
      const res = await createWallet(
        req("http://localhost/api/multisig/wallets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Ops" }),
        })
      )

      expect(res.status).toBe(400)
      expect(prismaMock.multisigWallet.create).not.toHaveBeenCalled()
    })

    it("reports a duplicate wallet address as a conflict", async () => {
      prismaMock.multisigWallet.create.mockRejectedValue({ code: "P2002" })

      const res = await createWallet(
        req("http://localhost/api/multisig/wallets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Ops",
            address: "0xaaa",
            chainId: 42161,
            threshold: 2,
            signers: ["0xaaa"],
          }),
        })
      )

      expect(res.status).toBe(409)
    })
  })

  describe("GET /transactions", () => {
    it("refuses to list transactions of a wallet the caller does not own", async () => {
      prismaMock.multisigWallet.findUnique.mockResolvedValueOnce({
        id: "w_1",
        owner_address: OTHER,
      })

      const res = await getTransactions(
        req("http://localhost/api/multisig/transactions?walletId=w_1")
      )

      expect(res.status).toBe(403)
      expect(prismaMock.multisigTransaction.findMany).not.toHaveBeenCalled()
    })

    it("requires a wallet id", async () => {
      const res = await getTransactions(req("http://localhost/api/multisig/transactions"))
      expect(res.status).toBe(400)
    })

    it("returns pending transactions for an owned wallet", async () => {
      const res = await getTransactions(
        req("http://localhost/api/multisig/transactions?walletId=w_1")
      )

      expect(res.status).toBe(200)
      expect(prismaMock.multisigTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ multisig_id: "w_1", status: "pending" }),
        })
      )
    })
  })

  describe("POST /transactions", () => {
    it("refuses to create a transaction against someone else's wallet", async () => {
      prismaMock.multisigWallet.findUnique.mockResolvedValueOnce({
        id: "w_1",
        owner_address: OTHER,
        threshold: 2,
      })

      const res = await createTransaction(
        req("http://localhost/api/multisig/transactions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ walletId: "w_1", to: "0xbbb", value: "100" }),
        })
      )

      expect(res.status).toBe(403)
      expect(prismaMock.multisigTransaction.create).not.toHaveBeenCalled()
    })

    it("takes the threshold from the wallet rather than the request", async () => {
      prismaMock.multisigTransaction.create.mockResolvedValue({ id: "t_1" })

      const res = await createTransaction(
        req("http://localhost/api/multisig/transactions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            walletId: "w_1",
            to: "0xbbb",
            value: "100",
            // A caller-supplied threshold would let them lower the number of
            // signatures their own transaction needs.
            threshold: 1,
          }),
        })
      )

      expect(res.status).toBe(201)
      expect(prismaMock.multisigTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ threshold: 2, created_by: OWNER }),
        })
      )
    })
  })
})
