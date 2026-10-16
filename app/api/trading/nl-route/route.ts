import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { requireAuth } from "@/lib/middleware/api-auth"
import { completeWithPlatform } from "@/lib/trading/llm-advisor"
import { buildRouterPrompt, buildSkillDoc, parseRouteAny, validateRoute } from "@/lib/trading/nl-router"

/**
 * POST /api/trading/nl-route?wallet=<address>
 *   { "request": "pause the agent" }
 *
 * Turns a sentence into ONE validated cockpit action — and deliberately does
 * nothing else. There is no execution path here: the answer is a proposal with
 * a confirmation string, and the client executes it through the existing
 * POST /api/trading/actions (same server-side checks as the buttons).
 *
 * Auth is required because each call spends a model request. The model reads
 * user text, so it is an injection surface: everything it returns goes through
 * the whitelist validator, which is what makes an injected instruction inert.
 */
export const maxDuration = 45
export const dynamic = "force-dynamic"

/** Optional self-hosted router (Ollama / vLLM, OpenAI-compatible), e.g.
 *  NL_ROUTER_BASE_URL=http://localhost:11434/v1 with NL_ROUTER_MODEL=velvetflash.
 *  Without it the platform channels (OpenRouter, then DeepSeek) are used. */
const SELF_HOSTED_BASE = process.env.NL_ROUTER_BASE_URL
const SELF_HOSTED_MODEL = process.env.NL_ROUTER_MODEL || "velvetflash"
const SELF_HOSTED_KEY = process.env.NL_ROUTER_API_KEY || "local"

interface Completion {
  raw: string
  provider: string
  ms: number
}

async function callRouter(system: string, user: string): Promise<Completion | null> {
  const t0 = Date.now()
  if (SELF_HOSTED_BASE) {
    try {
      const res = await fetch(`${SELF_HOSTED_BASE.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SELF_HOSTED_KEY}` },
        body: JSON.stringify({
          model: SELF_HOSTED_MODEL,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0,
          max_tokens: 400,
        }),
        signal: AbortSignal.timeout(20_000),
      })
      const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const raw = body.choices?.[0]?.message?.content
      if (res.ok && raw?.trim()) return { raw, provider: "self-hosted", ms: Date.now() - t0 }
    } catch {
      // fall through to the platform channels
    }
  }
  const out = await completeWithPlatform(system, user, 20_000)
  return out ? { ...out, ms: Date.now() - t0 } : null
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { component: "trading-nl-route" })
  if (!auth.address) {
    return (
      auth.error ?? NextResponse.json({ error: "Authentication required" }, { status: 401 })
    )
  }
  const walletParam = new URL(request.url).searchParams.get("wallet")
  if (walletParam && walletParam.toLowerCase() !== auth.address.toLowerCase()) {
    return NextResponse.json({ error: "wallet parameter does not match the authenticated identity" }, { status: 403 })
  }

  let body: { request?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const text = typeof body.request === "string" ? body.request.trim() : ""
  if (!text) return NextResponse.json({ error: "Provide a request" }, { status: 400 })
  if (text.length > 400) return NextResponse.json({ error: "Request is too long" }, { status: 400 })

  const completion = await callRouter(buildSkillDoc(), buildRouterPrompt(text))
  if (!completion) {
    return NextResponse.json({ error: "The command router is unavailable — use the buttons." }, { status: 503 })
  }

  const verdict = validateRoute(parseRouteAny(completion.raw))
  if (!verdict.ok) {
    return NextResponse.json({
      ok: false,
      refused: verdict.reason,
      provider: completion.provider,
      ms: completion.ms,
    })
  }
  return NextResponse.json({
    ok: true,
    route: verdict.route,
    provider: completion.provider,
    ms: completion.ms,
  })
}
