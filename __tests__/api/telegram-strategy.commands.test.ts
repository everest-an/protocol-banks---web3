/**
 * The Telegram strategy commands, exercised through the real route handler:
 * a read, a proposal that needs /confirm, the confirmation itself, and the
 * group-chat refusal. Telegram and Prisma are mocked; the command logic is not.
 */
jest.mock("@/lib/prisma", () => ({
  prisma: {
    tradingAccount: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}))
jest.mock("@/lib/trading/agent", () => ({ invalidateAgentForWallet: jest.fn() }))

import { POST } from "@/app/api/telegram/webhook/route"
import { prisma } from "@/lib/prisma"
import { invalidateAgentForWallet } from "@/lib/trading/agent"

const account = prisma.tradingAccount as unknown as {
  findUnique: jest.Mock
  findFirst: jest.Mock
  update: jest.Mock
}
const invalidate = invalidateAgentForWallet as jest.Mock

const OWNER_CHAT = "999"
const WALLET = "0xabc0000000000000000000000000000000000001"
const MENTION = "@ProtocolTraderBot"

function makeRequest(text: string, chatId = OWNER_CHAT, type = "private"): Request {
  const prefix = type === "private" ? "" : `${MENTION} `
  return new Request("https://protocolbanks.test/api/telegram/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        chat: { id: Number(chatId), type },
        text: prefix + text,
        entities: prefix ? [{ type: "mention", offset: 0, length: MENTION.length }] : [],
      },
    }),
  })
}

async function post(text: string, chatId = OWNER_CHAT, type = "private"): Promise<string> {
  const sent: string[] = []
  global.fetch = (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { text?: string }
    if (body.text) sent.push(body.text)
    return { ok: true, json: async () => ({ ok: true }) } as unknown as Response
  }) as unknown as typeof fetch
  await POST(makeRequest(text, chatId, type) as never)
  return sent.join("\n---\n")
}

describe("telegram /strategy", () => {
  const saved = {
    token: process.env.TG_TOKEN,
    chat: process.env.TG_CHAT_ID,
    wallet: process.env.TG_ACCOUNT_WALLET,
    secret: process.env.TG_WEBHOOK_SECRET,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.TG_TOKEN = "test-token"
    process.env.TG_CHAT_ID = OWNER_CHAT
    process.env.TG_ACCOUNT_WALLET = WALLET
    delete process.env.TG_WEBHOOK_SECRET
    account.findUnique.mockResolvedValue({ risk_config: null })
    account.update.mockResolvedValue({})
  })

  afterEach(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value) process.env[key] = value
      else delete process.env[key]
    }
    restore("TG_TOKEN", saved.token)
    restore("TG_CHAT_ID", saved.chat)
    restore("TG_ACCOUNT_WALLET", saved.wallet)
    restore("TG_WEBHOOK_SECRET", saved.secret)
  })

  it("shows the current strategy (balanced by default) without writing anything", async () => {
    const reply = await post("/strategy")
    expect(reply).toContain("策略：balanced")
    expect(reply).toContain("预设：balanced | momentum")
    expect(account.update).not.toHaveBeenCalled()
  })

  it("proposes a preset without applying it, storing the pending change beside the current one", async () => {
    const reply = await post("/strategy preset aggressive")
    expect(reply).toContain("拟改为 aggressive")
    expect(reply).toContain("/confirm")
    const data = account.update.mock.calls[0][0].data.risk_config
    expect(data.pending.preset).toBe("aggressive")
    expect(data.preset).toBeUndefined()
  })

  it("applies the pending preset on /confirm and drops the agent cache", async () => {
    account.findUnique.mockResolvedValue({
      risk_config: { preset: "balanced", pending: { preset: "aggressive", requestedAt: new Date().toISOString() } },
    })
    const reply = await post("/confirm")
    expect(reply).toContain("aggressive（已生效）")
    const data = account.update.mock.calls[0][0].data.risk_config
    expect(data.preset).toBe("aggressive")
    expect(data.pending).toBeUndefined()
    expect(data.appliedVia).toBe("telegram")
    expect(invalidate).toHaveBeenCalledWith(WALLET)
  })

  it("refuses an expired proposal", async () => {
    account.findUnique.mockResolvedValue({
      risk_config: {
        preset: "balanced",
        pending: { preset: "aggressive", requestedAt: new Date(Date.now() - 11 * 60_000).toISOString() },
      },
    })
    const reply = await post("/confirm")
    expect(reply).toContain("没有待确认的策略变更")
    expect(account.update).not.toHaveBeenCalled()
  })

  it("refuses a strategy change in a group chat", async () => {
    const reply = await post("/strategy preset aggressive", "-100123", "supergroup")
    expect(reply).toContain("群里只能查看策略")
    expect(account.update).not.toHaveBeenCalled()
  })
})
