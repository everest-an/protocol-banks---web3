/**
 * BYO-LLM advisor.
 *
 * An optional second opinion for entry signals. The user's own model key
 * (OpenRouter by default, DeepSeek direct as the platform fallback) reviews
 * each eligible entry and can only ever VETO it — the deterministic risk
 * engine in agent.ts keeps every cap (position size, stop-loss, circuit
 * breakers) regardless of what the model says. When no channel answers, the
 * caller proceeds with the plain quant signal, so the LLM can never block
 * trading by being down.
 *
 * Prompts carry market context only (coin, side, z-score, funding, volume,
 * mark price) — never wallet addresses or personal data, which also keeps
 * free-tier data policies acceptable.
 */
import { hasKeySecret, openSecret, type EncryptedBlob } from "./keys"

export interface LlmChannel {
  provider: "openrouter" | "deepseek"
  baseUrl: string
  apiKey: string
  model: string
}

export interface AdvisorSignalInput {
  coin: string
  side: "long" | "short"
  score: number
  momentumZ: number
  funding: number
  volumeUsd: number
  markPx: number
}

export interface AdvisorRequest {
  signal: AdvisorSignalInput
  equityUsd: number
  openPositions: string[]
}

export interface AdvisorProposal {
  action: "proceed" | "skip"
  sizeFactor: number
  reason: string
}

const OPENROUTER_BASE = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"
const DEEPSEEK_BASE = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"
const DEFAULT_OPENROUTER_MODEL = process.env.LLM_DEFAULT_MODEL || "deepseek/deepseek-v4-flash"
const DEFAULT_DEEPSEEK_MODEL = process.env.LLM_FALLBACK_MODEL || "deepseek-flash"

const SYSTEM_PROMPT =
  "You are a conservative trading risk reviewer for a perpetual futures agent. " +
  "You receive one entry signal and must decide whether the agent should take it. " +
  "You cannot increase size or leverage. Reply with a single JSON object: " +
  '{"action":"proceed"|"skip","sizeFactor":0.0-1.0,"reason":"<=140 chars"}. ' +
  "Prefer 'skip' when the setup is unclear, crowded, or contradicts recent price action. " +
  "No markdown, no text outside the JSON."

/**
 * Consult the model only when the deterministic edge is meaningful — keeps
 * token spend (and free-tier quota) off marginal signals. Conservative on
 * purpose: the gate is a cost control, not a quality filter.
 */
export function readinessGate(signal: AdvisorSignalInput): boolean {
  return Math.abs(signal.momentumZ) >= 1.25 || Math.abs(signal.score) >= 0.5
}

/** Compact, PII-free market snapshot for the review prompt. */
export function buildPrompt(req: AdvisorRequest): string {
  const s = req.signal
  return JSON.stringify({
    task: "review_entry_signal",
    signal: {
      coin: s.coin,
      side: s.side,
      momentum_z: Number(s.momentumZ.toFixed(2)),
      funding_per_hour: Number((s.funding * 100).toFixed(4)) + "%",
      volume_usd_24h: Math.round(s.volumeUsd),
      mark_price: s.markPx,
      composite_score: Number(s.score.toFixed(2)),
    },
    account: {
      equity_usd: Number(req.equityUsd.toFixed(2)),
      open_positions: req.openPositions,
    },
    constraints: {
      max_positions: 3,
      take_profit_pct: 2.5,
      stop_loss_pct: 2.5,
      daily_loss_circuit_breaker_pct: 5,
      note: "sizing and stops are enforced by the platform and cannot be changed by you",
    },
  })
}

/** Extract and validate the model's JSON answer. Returns null on any doubt. */
export function parseProposal(raw: string): AdvisorProposal | null {
  if (!raw) return null
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end <= start) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object") return null
  const obj = parsed as Record<string, unknown>
  const action = obj.action === "skip" ? "skip" : obj.action === "proceed" ? "proceed" : null
  if (!action) return null
  const rawFactor = typeof obj.sizeFactor === "number" ? obj.sizeFactor : 1
  // The model may shrink size; never let it grow beyond the signal's own size.
  const sizeFactor = Math.max(0, Math.min(1, Number.isFinite(rawFactor) ? rawFactor : 1))
  const reason = typeof obj.reason === "string" ? obj.reason.slice(0, 200) : ""
  return { action, sizeFactor, reason }
}

async function callChannel(channel: LlmChannel, prompt: string, timeoutMs = 25_000): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${channel.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${channel.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: channel.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        // Reasoning models spend most of the budget on hidden reasoning before
        // emitting the JSON, so keep this generous (cost is still ~$0.00001).
        max_tokens: 1500,
        temperature: 0.2,
      }),
    })
    if (!res.ok) throw new Error(`[${channel.provider}] HTTP ${res.status}`)
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error(`[${channel.provider}] empty completion`)
    return content
  } finally {
    clearTimeout(timer)
  }
}

/** The user's own key from TradingAccount, when configured and decryptable. */
async function resolveUserChannel(wallet: string): Promise<LlmChannel | null> {
  if (!hasKeySecret()) return null
  const { prisma } = await import("@/lib/prisma")
  const row = await prisma.tradingAccount.findUnique({
    where: { wallet_address: wallet.toLowerCase() },
    select: {
      llm_key_encrypted: true,
      llm_key_iv: true,
      llm_key_tag: true,
      llm_provider: true,
      llm_model: true,
    },
  })
  if (!row?.llm_key_encrypted || !row.llm_key_iv || !row.llm_key_tag) return null
  let apiKey: string
  try {
    apiKey = openSecret({
      data: row.llm_key_encrypted,
      iv: row.llm_key_iv,
      tag: row.llm_key_tag,
    } satisfies EncryptedBlob)
  } catch {
    console.warn("[llm-advisor] stored key could not be decrypted; ignoring it")
    return null
  }
  const provider = row.llm_provider === "deepseek" ? "deepseek" : "openrouter"
  return {
    provider,
    baseUrl: provider === "deepseek" ? DEEPSEEK_BASE : OPENROUTER_BASE,
    apiKey,
    model:
      row.llm_model ||
      (provider === "deepseek" ? DEFAULT_DEEPSEEK_MODEL : DEFAULT_OPENROUTER_MODEL),
  }
}

/** Platform channels: OpenRouter first (≈free), DeepSeek direct as the backup. */
function platformChannels(): LlmChannel[] {
  const channels: LlmChannel[] = []
  if (process.env.OPENROUTER_API_KEY) {
    channels.push({
      provider: "openrouter",
      baseUrl: OPENROUTER_BASE,
      apiKey: process.env.OPENROUTER_API_KEY,
      model: DEFAULT_OPENROUTER_MODEL,
    })
  }
  if (process.env.DEEPSEEK_API_KEY) {
    channels.push({
      provider: "deepseek",
      baseUrl: DEEPSEEK_BASE,
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: DEFAULT_DEEPSEEK_MODEL,
    })
  }
  return channels
}

/** Channel order: the user's key (when set) wins; platform defaults follow. */
async function resolveChannels(wallet: string): Promise<LlmChannel[]> {
  const channels: LlmChannel[] = []
  try {
    const user = await resolveUserChannel(wallet)
    if (user) channels.push(user)
  } catch (error) {
    console.warn("[llm-advisor] user channel lookup failed:", error instanceof Error ? error.message : error)
  }
  channels.push(...platformChannels())
  return channels
}

/**
 * Ask the model about one entry. Returns null when the gate is closed, no
 * channel answers, or the answer is unusable — the caller then proceeds with
 * the deterministic signal (the model can never block trading by being down).
 */
export async function adviseOnSignal(
  wallet: string | null | undefined,
  req: AdvisorRequest,
): Promise<AdvisorProposal | null> {
  if (!wallet) return null
  if (!readinessGate(req.signal)) return null
  const channels = await resolveChannels(wallet)
  if (channels.length === 0) return null

  const prompt = buildPrompt(req)
  for (const channel of channels) {
    try {
      const raw = await callChannel(channel, prompt)
      const proposal = parseProposal(raw)
      if (proposal) return proposal
      console.warn(`[llm-advisor] unparseable answer from ${channel.provider}`)
    } catch (error) {
      console.warn(
        `[llm-advisor] channel ${channel.provider} failed:`,
        error instanceof Error ? error.message : error,
      )
    }
  }
  return null
}
