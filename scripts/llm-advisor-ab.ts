/**
 * A/B the BYO-LLM advisor slot: the incumbent (OpenRouter deepseek-v4-flash,
 * what runs in production today) against a self-hostable 4B crypto router
 * (Velvet-Capital/VelvetFlash, Q4_K_M via local Ollama).
 *
 * The inputs are REAL: live Hyperliquid markets through the same signal code
 * the agent uses (strategies.ts + the agent's universe filters), the live
 * account state, the same system prompt and the same validator
 * (llm-advisor.ts). Only the model varies — which is exactly the question:
 * can a 4B local model hold this slot?
 *
 * Run:  npx tsx -r dotenv/config scripts/tmp-llm-ab.ts     (DOTENV_CONFIG_PATH=.env.local)
 */
import fs from "node:fs"
import { HyperliquidClient } from "../lib/trading/hyperliquid"
import { momentumZ, combineSignal, describeSignal, type Signal } from "../lib/trading/strategies"
import { DEFAULT_RISK, passesUniverseFilters } from "../lib/trading/risk"
import {
  ADVISOR_SYSTEM_PROMPT,
  buildPrompt,
  parseProposal,
  readinessGate,
  type AdvisorRequest,
} from "../lib/trading/llm-advisor"
import { getUserState } from "../lib/trading/exchange"

const WALLET = process.env.AB_WALLET || "0xBf0D7119F553eB5f85C9806f0849f9c86a9B768C"
const CANDIDATE_MODEL = process.env.AB_CANDIDATE_MODEL || "hf.co/mradermacher/VelvetFlash-GGUF:Q4_K_M"
/** Ollama's native endpoint; override when the model lives in a second server
 *  (e.g. AB_CANDIDATE_URL=http://localhost:11435/api/chat). */
const CANDIDATE_URL = process.env.AB_CANDIDATE_URL || "http://localhost:11434/api/chat"
const INCUMBENT_MODEL = process.env.AB_INCUMBENT_MODEL || "deepseek/deepseek-v4-flash"
const UNIVERSE_SIZE = Number(process.env.AB_UNIVERSE || 12)
/** Production entry bar is DEFAULT_RISK.entryThreshold (0.45). For an A/B we
 *  need a batch to compare on; AB_MIN_SCORE widens the bar so a quiet market
 *  still yields real (just lower-conviction) signals. Inputs stay real. */
const MIN_SCORE = Number(process.env.AB_MIN_SCORE || DEFAULT_RISK.entryThreshold)
/** The advisor's own cost gate (|z|>=1.25 or |score|>=0.5). AB_GATE=0 disables
 *  it for evaluation runs so a quiet market still yields comparison inputs. */
const APPLY_GATE = process.env.AB_GATE !== "0"

interface ModelCall {
  raw: string
  ms: number
  error?: string
}

async function callOpenRouter(prompt: string): Promise<ModelCall> {
  const t0 = Date.now()
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return { raw: "", ms: 0, error: "no OPENROUTER_API_KEY" }
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: INCUMBENT_MODEL,
        messages: [
          { role: "system", content: ADVISOR_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 1500, // production setting: reasoning models spend budget before the JSON
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(90_000),
    })
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      error?: { message?: string }
    }
    const content = body.choices?.[0]?.message?.content ?? ""
    if (!res.ok || !content) {
      return { raw: content, ms: Date.now() - t0, error: `HTTP ${res.status} ${body.error?.message ?? ""}`.slice(0, 160) }
    }
    return { raw: content, ms: Date.now() - t0 }
  } catch (e) {
    return { raw: "", ms: Date.now() - t0, error: e instanceof Error ? e.message.slice(0, 160) : "network error" }
  }
}

/** The incumbent in production is OpenRouter when it has credits, and the
 *  DeepSeek-direct channel is the documented fallback (llm-advisor platform
 *  channels). OpenRouter answered 402 on 2026-10-15, so the baseline runs on
 *  whichever channel is actually usable — the point is a real incumbent. */
async function callDeepSeek(prompt: string): Promise<ModelCall> {
  const t0 = Date.now()
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) return { raw: "", ms: 0, error: "no DEEPSEEK_API_KEY" }
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.AB_DEEPSEEK_MODEL || "deepseek-flash",
        messages: [
          { role: "system", content: ADVISOR_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 1500, // production setting: reasoning models spend budget before the JSON
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(90_000),
    })
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      error?: { message?: string }
    }
    const content = body.choices?.[0]?.message?.content ?? ""
    if (!res.ok || !content) {
      return { raw: content, ms: Date.now() - t0, error: `HTTP ${res.status} ${body.error?.message ?? ""}`.slice(0, 160) }
    }
    return { raw: content, ms: Date.now() - t0 }
  } catch (e) {
    return { raw: "", ms: Date.now() - t0, error: e instanceof Error ? e.message.slice(0, 160) : "network error" }
  }
}

async function callIncumbent(prompt: string): Promise<ModelCall> {
  const which = (process.env.AB_INCUMBENT || "deepseek").toLowerCase()
  if (which === "openrouter") return callOpenRouter(prompt)
  return callDeepSeek(prompt)
}

async function callOllama(prompt: string): Promise<ModelCall> {
  const t0 = Date.now()
  try {
    const res = await fetch(CANDIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: CANDIDATE_MODEL,
        messages: [
          { role: "system", content: ADVISOR_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        stream: false,
        think: false, // the model card's recommendation for short answers
        // 2048 is plenty for this prompt (~500 tokens) and is what fits an 8 GB
        // laptop GPU: at 8192 the KV cache alone wants ~1.2 GB and CUDA OOMs.
        options: { temperature: 0, num_predict: 600, num_ctx: 2048 },
      }),
      signal: AbortSignal.timeout(120_000),
    })
    const body = (await res.json()) as { message?: { content?: string }; error?: string }
    const content = body.message?.content ?? ""
    if (!res.ok || !content) {
      return { raw: content, ms: Date.now() - t0, error: (body.error ?? `HTTP ${res.status}`).slice(0, 160) }
    }
    return { raw: content, ms: Date.now() - t0 }
  } catch (e) {
    return { raw: "", ms: Date.now() - t0, error: e instanceof Error ? e.message.slice(0, 160) : "network error" }
  }
}

/** The live batch: exactly what the agent's scan would hand the advisor now. */
async function buildSignals(): Promise<{ sig: Signal; equityUsd: number; positions: string[] }[]> {
  const client = new HyperliquidClient()
  const { universe, ctxs } = await client.metaAndAssetCtxs()
  const ranked = universe
    .map((u, i) => ({ coin: u.name, ctx: ctxs[i] }))
    .filter((x) => x.ctx)
    .map((x) => ({ coin: x.coin, ctx: x.ctx, volumeUsd: parseFloat(x.ctx.dayNtlVlm) || 0 }))
    .sort((a, b) => b.volumeUsd - a.volumeUsd)
    .slice(0, UNIVERSE_SIZE)

  const out: Signal[] = []
  const dropped: Record<string, number> = { universeFilter: 0, shortCandles: 0, belowThreshold: 0, gate: 0 }
  for (const { coin, ctx, volumeUsd } of ranked) {
    const markPx = parseFloat(ctx.markPx)
    if (!passesUniverseFilters(volumeUsd, markPx, DEFAULT_RISK)) {
      dropped.universeFilter++
      continue
    }
    const candles = await client.candles(coin, "1h", 5).catch(() => [])
    if (candles.length < 20) {
      dropped.shortCandles++
      continue
    }
    const z = momentumZ(candles.map((c) => c.c))
    const funding = parseFloat(ctx.funding) || 0
    const { score, side } = combineSignal(z, funding)
    if (Math.abs(score) < MIN_SCORE) {
      dropped.belowThreshold++
      continue
    }
    const sig: Signal = {
      coin,
      side,
      score,
      momentumZ: z,
      funding,
      volumeUsd,
      markPx,
      reason: describeSignal({ momentumZ: z, funding, side }),
    }
    if (APPLY_GATE && !readinessGate(sig)) {
      dropped.gate++
      continue
    }
    out.push(sig)
  }
  console.log(
    `universe: ${ranked.length} scanned | dropped — universeFilter ${dropped.universeFilter}, shortCandles ${dropped.shortCandles}, belowThreshold ${dropped.belowThreshold}, gate ${dropped.gate}`,
  )
  out.sort((a, b) => Math.abs(b.score) - Math.abs(a.score))

  let equityUsd = 0
  let positions: string[] = []
  const st = await getUserState(WALLET).catch(() => null)
  if (st) {
    equityUsd = Number(st.marginSummary?.accountValue ?? 0)
    positions = (st.assetPositions ?? []).map((p) => p.position.coin)
  }
  return out.map((sig) => ({ sig, equityUsd, positions }))
}

interface Row {
  coin: string
  side: string
  z: number
  score: number
  /** The full signal, so a run can be replayed later on identical inputs. */
  signal: { coin: string; side: string; momentumZ: number; funding: number; volumeUsd: number; markPx: number; score: number }
  prompt: string
  incumbent: { action: string | null; sizeFactor: number | null; ms: number; error: string | null; raw: string }
  candidate: { action: string | null; sizeFactor: number | null; ms: number; error: string | null; raw: string }
}

async function main() {
  const batch = await buildSignals()
  console.log(
    `signals: ${batch.length} | equity $${batch[0]?.equityUsd.toFixed(2) ?? "?"} | open: ${batch[0]?.positions.join(",") || "-"}\n`,
  )
  if (!batch.length) {
    console.log("no eligible signals right now — nothing to compare")
    return
  }

  const rows: Row[] = []
  for (const { sig, equityUsd, positions } of batch) {
    const req: AdvisorRequest = { signal: sig, equityUsd, openPositions: positions }
    const prompt = buildPrompt(req)
    const inc = await callIncumbent(prompt)
    const cand = await callOllama(prompt)
    const incP = parseProposal(inc.raw)
    const candP = parseProposal(cand.raw)

    rows.push({
      coin: sig.coin,
      side: sig.side,
      z: Number(sig.momentumZ.toFixed(2)),
      score: Number(sig.score.toFixed(2)),
      signal: {
        coin: sig.coin,
        side: sig.side,
        momentumZ: sig.momentumZ,
        funding: sig.funding,
        volumeUsd: sig.volumeUsd,
        markPx: sig.markPx,
        score: sig.score,
      },
      prompt,
      incumbent: { action: incP?.action ?? null, sizeFactor: incP?.sizeFactor ?? null, ms: inc.ms, error: inc.error ?? null, raw: inc.raw.slice(0, 400) },
      candidate: { action: candP?.action ?? null, sizeFactor: candP?.sizeFactor ?? null, ms: cand.ms, error: cand.error ?? null, raw: cand.raw.slice(0, 400) },
    })
    console.log(
      `${sig.coin.padEnd(9)} ${sig.side.padEnd(5)} z=${sig.momentumZ.toFixed(2).padStart(6)} score=${sig.score.toFixed(2).padStart(5)} | inc ${String(incP?.action ?? "INVALID").padEnd(7)} ${String(inc.ms + "ms").padStart(8)} | cand ${String(candP?.action ?? "INVALID").padEnd(7)} ${String(cand.ms + "ms").padStart(8)}${inc.error ? " | inc ERR " + inc.error.slice(0, 40) : ""}${cand.error ? " | cand ERR " + cand.error.slice(0, 40) : ""}`,
    )
  }

  const n = rows.length
  const validInc = rows.filter((r) => r.incumbent.action).length
  const validCand = rows.filter((r) => r.candidate.action).length
  const agree = rows.filter((r) => r.incumbent.action && r.candidate.action && r.incumbent.action === r.candidate.action).length
  const incSkip = rows.filter((r) => r.incumbent.action === "skip").length
  const candSkip = rows.filter((r) => r.candidate.action === "skip").length
  const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0)

  console.log(`\nvalid JSON   : incumbent ${validInc}/${n} · candidate ${validCand}/${n}`)
  console.log(`skip rate    : incumbent ${incSkip}/${n} · candidate ${candSkip}/${n}`)
  console.log(`agreement    : ${agree}/${n}`)
  console.log(`mean latency : incumbent ${mean(rows.map((r) => r.incumbent.ms))}ms · candidate ${mean(rows.map((r) => r.candidate.ms))}ms`)

  fs.mkdirSync("docs/trading", { recursive: true })
  const outPath = process.env.AB_OUT || "docs/trading/llm-advisor-ab.json"
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        wallet: WALLET,
        incumbent: process.env.AB_INCUMBENT || "deepseek",
        incumbentModel: (process.env.AB_INCUMBENT || "deepseek") === "openrouter" ? INCUMBENT_MODEL : process.env.AB_DEEPSEEK_MODEL || "deepseek-flash",
        candidateModel: CANDIDATE_MODEL,
        universe: UNIVERSE_SIZE,
        minScore: MIN_SCORE,
        gate: APPLY_GATE,
        rows,
      },
      null,
      2,
    ),
  )
  console.log(`\nsaved ${outPath}`)
}

main().catch((e) => {
  console.error("FAILED", e)
  process.exit(1)
})
