import fs from "fs"
import os from "os"
import path from "path"
import { verifyMessage } from "ethers"

const rows = new Map<string, Record<string, unknown>>()

const mockPrisma = {
  agentWallet: {
    findUnique: jest.fn(async ({ where }: { where: { agent_id: string } }) => rows.get(where.agent_id) ?? null),
    upsert: jest.fn(async ({ where, create, update }: { where: { agent_id: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
      const existing = rows.get(where.agent_id)
      const now = new Date()
      const row = existing
        ? { ...existing, ...update, updated_at: now }
        : { ...create, agent_id: where.agent_id, created_at: now, updated_at: now }
      rows.set(where.agent_id, row)
      return row
    }),
  },
  agentActivity: {
    create: jest.fn(async () => ({})),
  },
}

jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import {
  createAgentWallet,
  getAgentWallet,
  hasAgentWalletSecret,
  revokeAgentWallet,
  rotateAgentWallet,
  signWithAgentWallet,
  toPublicWallet,
} from "../agent/wallet"

const AGENT_ID = "agent-wallet-test"
const OWNER = "0x" + "1".repeat(40)
let stateDir: string

describe("agent wallet custody", () => {
  beforeEach(() => {
    rows.clear()
    jest.clearAllMocks()
    process.env.AGENT_WALLET_SECRET = "a".repeat(64)
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "pb-agent-wallet-"))
    process.env.AGENT_WALLET_STATE_DIR = stateDir
  })

  afterEach(() => {
    fs.rmSync(stateDir, { recursive: true, force: true })
    delete process.env.AGENT_WALLET_STATE_DIR
  })

  it("reports whether the custody secret is configured", () => {
    expect(hasAgentWalletSecret()).toBe(true)
    delete process.env.AGENT_WALLET_SECRET
    delete process.env.TRADING_KEY_SECRET
    expect(hasAgentWalletSecret()).toBe(false)
  })

  it("creates one wallet per agent and never returns the private key", async () => {
    const wallet = await createAgentWallet(AGENT_ID, OWNER, "Research agent")
    expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(wallet.status).toBe("active")
    expect(wallet.encryptedKey).not.toBeNull()
    expect(wallet.encryptedKey?.data).not.toContain("0x")

    const publicWallet = toPublicWallet(wallet)
    expect(publicWallet).toMatchObject({
      address: wallet.address,
      status: "active",
      canSign: true,
      label: "Research agent",
    })
    expect(JSON.stringify(publicWallet)).not.toContain("encryptedKey")
  })

  it("is idempotent while the wallet is active", async () => {
    const first = await createAgentWallet(AGENT_ID, OWNER)
    const second = await createAgentWallet(AGENT_ID, OWNER)
    expect(second.address).toBe(first.address)
  })

  it("falls back to the encrypted file store when the table is unavailable", async () => {
    mockPrisma.agentWallet.findUnique.mockRejectedValue(new Error("relation does not exist"))
    mockPrisma.agentWallet.upsert.mockRejectedValue(new Error("relation does not exist"))

    const created = await createAgentWallet(AGENT_ID, OWNER)
    const loaded = await getAgentWallet(AGENT_ID)

    expect(loaded?.address).toBe(created.address)
    expect(loaded?.encryptedKey?.data).toBeTruthy()
  })

  it("signs a message with the agent address", async () => {
    const wallet = await createAgentWallet(AGENT_ID, OWNER)
    const message = "hello from the agent"
    const result = await signWithAgentWallet(AGENT_ID, { kind: "message", message })

    expect(result.address).toBe(wallet.address)
    expect(verifyMessage(message, result.signature)).toBe(wallet.address)
  })

  it("refuses unsupported typed data", async () => {
    await createAgentWallet(AGENT_ID, OWNER)
    await expect(
      signWithAgentWallet(AGENT_ID, {
        kind: "typedData",
        domain: { name: "Test" },
        types: { Mail: [{ name: "contents", type: "string" }] },
        value: { contents: "hi" },
      }),
    ).rejects.toThrow("Unsupported typed data type")
  })

  it("revokes the key material and refuses to sign", async () => {
    await createAgentWallet(AGENT_ID, OWNER)
    await revokeAgentWallet(AGENT_ID)

    const record = await getAgentWallet(AGENT_ID)
    expect(record?.status).toBe("revoked")
    expect(record?.encryptedKey).toBeNull()
    await expect(
      signWithAgentWallet(AGENT_ID, { kind: "message", message: "nope" }),
    ).rejects.toThrow("revoked")
  })

  it("rotates a revoked wallet to a new address", async () => {
    const first = await createAgentWallet(AGENT_ID, OWNER)
    await revokeAgentWallet(AGENT_ID)
    const second = await rotateAgentWallet(AGENT_ID, OWNER)

    expect(second.status).toBe("active")
    expect(second.address).not.toBe(first.address)
    expect(second.keyVersion).toBe(2)
  })
})
