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
import { renderTradingGif } from '@/lib/media/trading-gif'

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

/** One angle per day, rotating. The feed turned into slop (2026-10-07..20:
 *  thirteen near-identical posts, 0-1 like each) because every day mined the
 *  same two themes — non-custody and the repo's star count. */
const ANGLES = [
  'an execution or risk lesson for people building trading agents: a concrete failure, and the mechanism that now handles it',
  'a market-structure observation (funding, liquidations, order flow on perp venues) that a trader could act on',
  'a build-log beat with ONE honest number from the live account, and what changed because of it',
  'a contrarian take on custody or agent permissions, argued from mechanics rather than marketing',
  'one specific user flow, described without adjectives',
  'a failure post-mortem: what broke, what it cost, what we changed',
]

export interface RecentPost {
  id: string
  text: string
  hook: string
  cta: string
  at: string
}

/** Last few posts, so the generator can be told what NOT to repeat. Best
 *  effort: a failure here must never block the daily post. */
async function recentPosts(limit = 8): Promise<RecentPost[]> {
  const userId = (process.env.X_ACCESS_TOKEN || '').split('-')[0]
  if (!/^\d{5,}$/.test(userId)) return []
  const base = `https://api.x.com/2/users/${userId}/tweets`
  const params: Record<string, string> = {
    max_results: String(Math.max(5, Math.min(100, limit))),
    'tweet.fields': 'created_at',
    exclude: 'retweets,replies',
  }
  try {
    const qs = Object.keys(params)
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&')
    const res = await fetch(`${base}?${qs}`, {
      headers: { Authorization: oauth1('GET', base, params) },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const body = (await res.json()) as { data?: { id: string; text: string; created_at?: string }[] }
    return (body.data ?? []).slice(0, limit).map((t) => {
      const lines = t.text
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      return {
        id: t.id,
        text: t.text,
        hook: lines[0] ?? '',
        cta: lines.length >= 2 ? lines[lines.length - 2] : '',
        at: t.created_at ?? '',
      }
    })
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

/** Internal terms, filler stats and links that made the feed unreadable:
 *  a reader cannot care about our A/B numbers, model names or star counts. */
const BANNED_PATTERNS: Array<{ re: RegExp; why: string }> = [
  {
    re: /\b(a\/b|ab harness|6\/7|nl routing|whitelist validator|confirmation gate|velvetflash|deepseek|4b)\b/i,
    why: 'names internal tooling or a model A/B the reader cannot know',
  },
  { re: /[★⭐]|\b\d+\s+stars?\b|\b\d+\s+forks?\b/i, why: 'repo star/fork filler instead of substance' },
  { re: /https?:\/\//i, why: 'a link in the post kills reach' },
]

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

/** True when a hook reuses a recent hook's wording. */
function repeatsRecentHook(hook: string, recent: RecentPost[]): boolean {
  const words = new Set(norm(hook).split(' ').filter(Boolean))
  if (!words.size) return false
  const prefix = norm(hook).split(' ').slice(0, 4).join(' ')
  return recent.some((r) => {
    const old = new Set(norm(r.hook).split(' ').filter(Boolean))
    if (!old.size) return false
    if (prefix && prefix === norm(r.hook).split(' ').slice(0, 4).join(' ')) return true
    const shared = [...words].filter((w) => old.has(w)).length
    return shared / Math.max(words.size, old.size) > 0.8
  })
}

function lastCta(text: string): string {
  const lines = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  return lines.length >= 2 ? lines[lines.length - 2] : ''
}

/** Enforced, not just prompted — same checks as the local poster. */
export function validatePost(p: string, recent: RecentPost[] = []): string[] {
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
  for (const { re, why } of BANNED_PATTERNS) if (re.test(t)) issues.push(why)
  if (recent.length) {
    if (repeatsRecentHook(firstLine, recent)) issues.push('hook repeats one of the last 8 posts')
    const cta = norm(lastCta(t))
    if (cta && recent.some((r) => norm(r.cta) === cta)) issues.push('CTA repeats a recent post — write a new closing line')
  }
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

/**
 * Upload an animated GIF through the v1.1 media endpoint. OAuth 1.0a with an
 * x-www-form-urlencoded body: the body parameter IS part of the signature
 * base string (unlike multipart), which our hand-rolled signer covers.
 */
async function uploadMedia(gif: Uint8Array): Promise<string | null> {
  const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json'
  const mediaData = Buffer.from(gif).toString('base64')
  try {
    const r = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: oauth1('POST', uploadUrl, { media_data: mediaData }),
      },
      body: `media_data=${encodeURIComponent(mediaData)}`,
    })
    const j = (await r.json()) as { media_id_string?: string }
    if (!r.ok || !j.media_id_string) return null
    return j.media_id_string
  } catch {
    return null
  }
}

/** The live account's cumulative PnL for the motion graphic (null when none). */
async function livePnl(): Promise<number | null> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const row = await prisma.tradingAccount.findFirst({
      where: { status: 'live' },
      select: { state_json: true },
    })
    const st = row?.state_json as { account?: { allTimePnl?: number } } | null
    const v = st?.account?.allTimePnl
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

async function postToX(text: string, mediaId?: string | null): Promise<{ posted?: string; error?: string }> {
  if (!process.env.X_CONSUMER_KEY || !process.env.X_CONSUMER_SECRET || !process.env.X_ACCESS_TOKEN || !process.env.X_ACCESS_SECRET) {
    return { error: 'no X keys' }
  }
  const url = 'https://api.x.com/2/tweets'
  try {
    let payload: Record<string, unknown> = { text: text.slice(0, 280) }
    if (mediaId) payload = { ...payload, media: { media_ids: [mediaId] } }
    let r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: oauth1('POST', url, {}) },
      body: JSON.stringify(payload),
    })
    if (!r.ok && mediaId) {
      // Some tiers reject media tweets — never lose the post to the card.
      payload = { text: text.slice(0, 280) }
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: oauth1('POST', url, {}) },
        body: JSON.stringify(payload),
      })
    }
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

// ---------- Telegram notification (optional) ----------
// Media/tech broadcasts go through the MEDIA bot (TG_MEDIA_TOKEN, @Gavis0bot);
// trading progress stays on the trading bot. Never throws: a notification
// failure must not lose a post that already went out.
async function notifyTelegram(text: string): Promise<void> {
  const token = process.env.TG_MEDIA_TOKEN || process.env.TG_TOKEN
  const chat = process.env.TG_CHAT_ID
  if (!token || !chat) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: text.slice(0, 3900), disable_web_page_preview: true }),
    })
  } catch {
    // swallow
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
  // What we already said, so we do not say it again (this is the fix for the
  // 2026-10-07..20 stretch of thirteen near-identical posts).
  const recent = await recentPosts(8)
  const dayIndex = Math.floor(Date.now() / 86_400_000)
  const angle = ANGLES[dayIndex % ANGLES.length]
  const avoid = recent.length
    ? `\n\nRECENT POSTS — the reader has already seen these. Do NOT reuse their theme, hook, stats, structure or closing line:\n${recent.map((r, i) => `${i + 1}. ${r.hook}`).join('\n')}`
    : ''

  const system = [
    `You are the social lead for Protocol Bank (@0xPrococolBank), writing for technical builders on X.`,
    `Product: ${PRODUCT}`,
    `Voice: ${VOICE}`,
    'You follow the X ranking playbook: hook in the first 8 words, name the topic in the first 10 words, write to be DM-forwarded and to earn a follow (not a like), be specific, never use AI-tells.',
  ].join('\n')

  const user = `My GitHub activity (last 7 days):\n${activity.map((a) => '- ' + a).join('\n')}${avoid}\n\nANGLE FOR THIS POST (must differ from every recent post above): ${angle}.\n\nWrite ONE X post that would earn shares and follows from crypto traders and developers building AI agents (Hyperliquid perp DEX, non-custodial tooling).\n\nFORMAT (proven; the ENTIRE post MUST be <= 280 chars INCLUDING newlines and hashtags - count characters before you answer):\n- Line 1 = HOOK: a specific claim, pain, or surprising number within the FIRST 8 words. Do NOT start with "We", "I", or the product name. Name the topic (AI trading / Hyperliquid / non-custodial / MCP) within the first 10 words. <= 8 words / ~60 chars.\n- Then 1-2 short lines (~70 chars each) that give the reader something useful. Translate the work into what a developer building agents CARES ABOUT - never describe our commits, PRs or workflows.\n- 1 short line of PROOF: a real number from the data above (~45 chars).\n- 1 short line CTA: a question OR "repo in bio" (~35 chars).\n- LAST line: EXACTLY 2 hashtags (X rewards 1-2; more looks spammy).\n\nBANNED phrases (AI-tells + reach killers): "It\'s not X, it\'s Y" / "Not because X. Because Y." / negation lists ("no X, no Y") / colon reveals ("The result? ...") / trailing pile-ons / engagement-bait / raw changelogs ("N commits", "we shipped").\nHARD RULES: <= 280 chars total; use specific nouns (Hyperliquid, MCP, MetaMask, USDC, agent wallet); grounded ONLY in the data above (never invent); NO URLs; <=1 emoji.\n\nHOOK LAB - write 3 candidate posts, all opening with a BOLD SPECIFIC CLAIM (62% of viral crypto posts do; listicles 3% and question hooks 4% flop). Use three flavours: (a) a bold claim about AI trading backed by one real number; (b) an honest build-log line ("Day N of an AI agent running real money - here is what changed"); (c) a surprising specific number as the literal first words. Data from 900+ viral CT posts: storytelling / build-in-public wins (457 avg likes vs 95 for promo), metric posts get the most reposts, hashtags beyond 2 hurt, links kill reach. Write like an operator, not a marketer - admit a real trade-off or loss when it fits. The hook must win attention in the FIRST 6 words.\nReturn STRICT JSON only:\n{"posts":["<candidate 1: full post incl. newlines and the 2-hashtag last line>","<candidate 2>","<candidate 3>"]}`

  let chosen = ''
  let issues: string[] = []
  let attempts = 0
  for (attempts = 1; attempts <= 3; attempts++) {
    const u = attempts === 1 ? user : user + `\n\nYour previous candidates failed these checks: ${issues.join('; ')}. Rewrite so they pass ALL of them. JSON only.`
    const raw = (await llm(system, u)).trim()
    let candidates: string[] = []
    try {
      const parsedJson = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]) as { posts?: unknown; post?: unknown }
      if (Array.isArray(parsedJson.posts)) candidates = parsedJson.posts.map(String)
      else if (typeof parsedJson.post === 'string') candidates = [parsedJson.post]
    } catch {
      candidates = [raw]
    }
    const normalized = candidates
      .map((c) => c.replace(/https?:\/\/\S+/g, '').replace(/[ \t]{2,}/g, ' ').trim())
      .filter(Boolean)
    if (!normalized.length) {
      issues = ['no candidates returned']
      continue
    }
    const passing = normalized.filter((c) => validatePost(c, recent).length === 0)
    if (passing.length) {
      // Prefer the punchiest passing hook (shortest first line).
      chosen = passing.sort((a, b) => a.split('\n')[0].length - b.split('\n')[0].length)[0]
      issues = []
      break
    }
    chosen = normalized[0]
    issues = validatePost(chosen, recent)
  }

  const text = chosen.trim()
  if (!text) return NextResponse.json({ ok: false, error: 'empty draft' }, { status: 502 })

  if (dry) return NextResponse.json({ ok: true, dry: true, attempts, issues, post: text })

  if (req.nextUrl.searchParams.get('tg') === '1') {
    await notifyTelegram('Protocol Bank Telegram channel test from /api/cron/x-post.')
    return NextResponse.json({ ok: true, tg: 'sent' })
  }

  // Animated card: draw the live account's cumulative PnL as a motion graphic
  // and attach it. Any failure degrades to a text-only post — the daily post
  // must never be lost to the card.
  let mediaId: string | null = null
  try {
    const pnl = await livePnl()
    const gif = await renderTradingGif({
      pnl: pnl ?? 0,
      headline: text.split('\n')[0],
      sub: pnl !== null ? 'LIVE ACCOUNT · SINCE LAUNCH' : 'PROTOCOL BANK · AI TRADING',
      paper: pnl === null,
    })
    if (gif.length > 0 && gif.length < 15 * 1024 * 1024) mediaId = await uploadMedia(gif)
  } catch {
    mediaId = null
  }

  const [x, bsky] = await Promise.all([postToX(text, mediaId), postToBluesky(text)])
  const xLine = x.posted ? `https://x.com/0xPrococolBank/status/${x.posted}` : `X failed: ${x.error}`
  const bLine = bsky.posted || `Bluesky failed: ${bsky.error}`
  await notifyTelegram(`Protocol Bank daily post\nX: ${xLine}\nBluesky: ${bLine}\n\n${text}`)
  return NextResponse.json({ ok: true, attempts, issues, post: text, media: mediaId ? 'attached' : 'none', x, bluesky: bsky })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'poster failed'
    await notifyTelegram(`Protocol Bank x-post FAILED: ${msg}`)
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 502 },
    )
  }
}
