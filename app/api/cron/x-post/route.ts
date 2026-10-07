// rls:system — cron route: no wallet request context. Posts product updates
// to X and Bluesky from real repository activity; no user data is read.
//
// Runs on Vercel Cron (see vercel.json, daily 01:00 UTC = 09:00 Asia/Shanghai)
// so the automation lives on Protocol Bank's own infrastructure. Mirrors
// docs/growth/x-agent/x-poster.mjs but with zero extra dependencies:
// GitHub REST for activity, OpenRouter for the draft, a hand-rolled OAuth 1.0a
// HMAC-SHA1 signer for X, and the AT Protocol XRPC endpoints for Bluesky.
//
// Compliance (see docs/growth/x-agent/X-PLAYBOOK.md): original posts only,
// posted through the official APIs. No replies, no follows, no scraping.
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { verifyCronAuth } from '@/lib/cron-auth'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const REPO = 'everest-an/protocol-banks---web3'
const GH_HEADERS = { Accept: 'application/vnd.github+json', 'User-Agent': 'protocol-bank-x-post' }

const PRODUCT =
  'Protocol Bank — a non-custodial AI trading agent on Hyperliquid. The agent gets trading-only rights (it can never withdraw); your worst case is the budget you choose. Paper mode is free, live pays 20% of profits. Every live account is public with real PnL. Also ships a Model Context Protocol server so any chat assistant can read and control the agent.'

const VOICE =
  'Technical, concise, honest. No hype, no emoji spam. First person plural (we). Cite specifics and numbers (Hyperliquid, agent-wallet model, risk caps, real PnL). Never invent facts. Never give financial advice and never promise returns — say plainly that trading can lose the entire budget.'

// ---------- GitHub activity (public REST, unauthenticated: 60 req/h is plenty for 1 run/day) ----------
async function recentActivity(): Promise<string[]> {
  const since = new Date(Date.now() - 7 * 864e5).toISOString()
  try {
    const r = await fetch(
      `https://api.github.com/repos/${REPO}/commits?since=${since}&per_page=20`,
      { headers: GH_HEADERS, cache: 'no-store' },
    )
    if (!r.ok) return []
    const commits = (await r.json()) as Array<{ commit?: { message?: string } }>
    return commits
      .map((c) => (c.commit?.message || '').split('\n')[0].trim())
      .filter(Boolean)
      .slice(0, 10)
  } catch {
    return []
  }
}

async function repoStats(): Promise<string[]> {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}`, { headers: GH_HEADERS, cache: 'no-store' })
    if (!r.ok) return []
    const d = (await r.json()) as { full_name: string; stargazers_count: number; forks_count: number; pushed_at?: string }
    return [`${d.full_name}: ${d.stargazers_count}★, ${d.forks_count} forks, updated ${(d.pushed_at || '').slice(0, 10)}`]
  } catch {
    return []
  }
}

// ---------- draft ----------
// Provider chain: OpenRouter (cheap) -> DeepSeek direct (paid fallback).
// OpenRouter free-tier accounts intermittently get 402 on frontier models, so
// the paid DeepSeek key keeps the daily post alive.
async function llm(system: string, user: string): Promise<string> {
  const providers: Array<{ url: string; key: string; model: string }> = []
  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: process.env.OPENROUTER_API_KEY,
      model: 'deepseek/deepseek-v4-flash',
    })
  }
  if (process.env.DEEPSEEK_API_KEY) {
    providers.push({
      url: 'https://api.deepseek.com/chat/completions',
      key: process.env.DEEPSEEK_API_KEY,
      model: 'deepseek-flash',
    })
  }
  if (!providers.length) throw new Error('no LLM provider configured (OPENROUTER_API_KEY or DEEPSEEK_API_KEY)')

  let last = 'no provider attempted'
  for (const p of providers) {
    try {
      const r = await fetch(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
        body: JSON.stringify({
          model: p.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.7,
        }),
      })
      if (!r.ok) {
        last = `${p.url} -> ${r.status}`
        continue
      }
      const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const content = j.choices?.[0]?.message?.content
      if (content) return content
      last = `${p.url} -> empty completion`
    } catch (e) {
      last = `${p.url} -> ${e instanceof Error ? e.message : 'network error'}`
    }
  }
  throw new Error('all LLM providers failed: ' + last)
}

// Enforced, not just prompted — same checks as the local poster.
function validatePost(p: string): string[] {
  const t = String(p || '').trim()
  const issues: string[] = []
  if (t.length > 280) issues.push(`too long (${t.length} chars)`)
  const tags = t.match(/#[\w-]+/g) || []
  if (tags.length !== 2) issues.push(`needs exactly 2 hashtags (has ${tags.length})`)
  const firstLine = t.split('\n')[0].trim()
  if (firstLine.split(/\s+/).length > 12) issues.push('hook is longer than 12 words')
  if (/^(we|i|our|awareness|protocol)\b/i.test(firstLine)) issues.push('hook must not start with We/I/the product name')
  if (/\b\d+\s+commits?\b|we shipped|we built/i.test(t)) issues.push('reads like a changelog')
  if (/it'?s not .+,\s*it'?s|not because .+because|the result\?/i.test(t)) issues.push('contains an AI-tell')
  if (!/\d/.test(t)) issues.push('missing a concrete number/proof')
  return issues
}

// ---------- X API (OAuth 1.0a user context) ----------
function oauth1(method: string, url: string, params: Record<string, string>): string {
  const keys = {
    ck: process.env.X_CONSUMER_KEY || '',
    cs: process.env.X_CONSUMER_SECRET || '',
    at: process.env.X_ACCESS_TOKEN || '',
    as: process.env.X_ACCESS_SECRET || '',
  }
  const oauth: Record<string, string> = {
    oauth_consumer_key: keys.ck,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: keys.at,
    oauth_version: '1.0',
  }
  const enc = (s: string) =>
    encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  const all = { ...params, ...oauth }
  const base = [method.toUpperCase(), enc(url), enc(Object.keys(all).sort().map((k) => `${enc(k)}=${enc(all[k])}`).join('&'))].join('&')
  oauth.oauth_signature = crypto.createHmac('sha1', `${enc(keys.cs)}&${enc(keys.as)}`).update(base).digest('base64')
  return 'OAuth ' + Object.keys(oauth).sort().map((k) => `${enc(k)}="${enc(oauth[k])}"`).join(', ')
}

async function postToX(text: string): Promise<{ posted?: string; error?: string }> {
  if (!process.env.X_CONSUMER_KEY || !process.env.X_CONSUMER_SECRET || !process.env.X_ACCESS_TOKEN || !process.env.X_ACCESS_SECRET) {
    return { error: 'no X keys' }
  }
  const url = 'https://api.x.com/2/tweets'
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: oauth1('POST', url, {}) },
      body: JSON.stringify({ text: text.slice(0, 280) }),
    })
    const j = (await r.json()) as { data?: { id?: string }; title?: string; detail?: string }
    if (!r.ok) return { error: `${r.status} ${j.title || j.detail || ''}`.slice(0, 200) }
    return { posted: j.data?.id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'x network error' }
  }
}

// ---------- Bluesky (AT Protocol) ----------
async function postToBluesky(text: string): Promise<{ posted?: string; error?: string }> {
  const id = process.env.BSKY_IDENTIFIER
  const pw = process.env.BSKY_APP_PASSWORD
  if (!id || !pw) return { error: 'no Bluesky keys' }
  try {
    const s = (await (
      await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: id, password: pw }),
      })
    ).json()) as { accessJwt?: string; did?: string; handle?: string }
    if (!s.accessJwt || !s.did) return { error: 'bluesky login failed' }
    const r = (await (
      await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.accessJwt },
        body: JSON.stringify({
          repo: s.did,
          collection: 'app.bsky.feed.post',
          record: { $type: 'app.bsky.feed.post', text: text.slice(0, 300), createdAt: new Date().toISOString() },
        }),
      })
    ).json()) as { uri?: string }
    if (!r.uri) return { error: 'bluesky create failed' }
    return { posted: `https://bsky.app/profile/${s.handle}/post/${r.uri.split('/').pop()}` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'bluesky network error' }
  }
}

// ---------- handler ----------
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  const dry = req.nextUrl.searchParams.get('dry') === '1'

  try {
    const activity = await recentActivity()
  if (!activity.length) return NextResponse.json({ ok: true, skipped: 'no public activity in the last 7 days' })
  const stats = await repoStats()

  const system = [
    `You are the social lead for Protocol Bank (@0xPrococolBank), writing for technical builders on X.`,
    `Product: ${PRODUCT}`,
    `Voice: ${VOICE}`,
    'You follow the X ranking playbook: hook in the first 8 words, name the topic in the first 10 words, write to be DM-forwarded and to earn a follow (not a like), be specific, never use AI-tells.',
  ].join('\n')

  const user = `My GitHub activity (last 7 days):\n${activity.map((a) => '- ' + a).join('\n')}\n\nRepo stats:\n${stats.map((s) => '- ' + s).join('\n')}\n\nWrite ONE X post that would earn shares and follows from crypto traders and developers building AI agents (Hyperliquid perp DEX, non-custodial tooling).\n\nFORMAT (proven; the ENTIRE post MUST be <= 280 chars INCLUDING newlines and hashtags - count characters before you answer):\n- Line 1 = HOOK: a specific claim, pain, or surprising number within the FIRST 8 words. Do NOT start with "We", "I", or the product name. Name the topic (AI trading / Hyperliquid / non-custodial / MCP) within the first 10 words. <= 8 words / ~60 chars.\n- Then 1-2 short lines (~70 chars each) that give the reader something useful. Translate the work into what a developer building agents CARES ABOUT - never describe our commits, PRs or workflows.\n- 1 short line of PROOF: a real number from the data above (~45 chars).\n- 1 short line CTA: a question OR "repo in bio" (~35 chars).\n- LAST line: EXACTLY 2 hashtags (X rewards 1-2; more looks spammy).\n\nBANNED phrases (AI-tells + reach killers): "It\'s not X, it\'s Y" / "Not because X. Because Y." / negation lists ("no X, no Y") / colon reveals ("The result? ...") / trailing pile-ons / engagement-bait / raw changelogs ("N commits", "we shipped").\nHARD RULES: <= 280 chars total; use specific nouns (Hyperliquid, MCP, MetaMask, USDC, agent wallet); grounded ONLY in the data above (never invent); NO URLs; <=1 emoji.\n\nReturn STRICT JSON only:\n{"post":"<full post incl. newlines and the 2-hashtag last line>"}`

  let parsed: { post?: string } = {}
  let issues: string[] = []
  let attempts = 0
  for (attempts = 1; attempts <= 3; attempts++) {
    const u = attempts === 1 ? user : user + `\n\nYour previous draft failed these checks: ${issues.join('; ')}. Rewrite so it passes ALL of them. JSON only.`
    const raw = (await llm(system, u)).trim()
    try {
      parsed = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0])
    } catch {
      parsed = { post: raw }
    }
    const text = String(parsed.post || '').replace(/https?:\/\/\S+/g, '').replace(/[ \t]{2,}/g, ' ').trim()
    issues = validatePost(text)
    if (!issues.length) {
      parsed.post = text
      break
    }
  }

  const text = String(parsed.post || '').trim()
  if (!text) return NextResponse.json({ ok: false, error: 'empty draft' }, { status: 502 })

  if (dry) return NextResponse.json({ ok: true, dry: true, attempts, issues, post: text })

  const [x, bsky] = await Promise.all([postToX(text), postToBluesky(text)])
  return NextResponse.json({ ok: true, attempts, issues, post: text, x, bluesky: bsky })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'poster failed' },
      { status: 502 },
    )
  }
}
