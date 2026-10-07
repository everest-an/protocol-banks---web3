#!/usr/bin/env node
/**
 * x-engage — X community-engagement cockpit (READ + DRAFT ONLY).
 *
 * WHY DRAFT-ONLY: X's own developer docs (Oct 2026) make API replies to strangers
 * technically impossible and automated likes/follows/quotes prohibited:
 *   - "Replies are only permitted if the original post's author has explicitly
 *      summoned the replying account by @mentioning them or quoting one of their posts."
 *   - "Quote-posting (quote_tweet_id) requires an Enterprise plan. It is not
 *     available on self-serve (pay-per-use) tiers."
 *   - "Likes must be directly initiated by the authenticated user."
 *   - Follow/Unfollow: "No bulk, aggressive, or automated following."
 *   - "Non-API automation (scraping, browser automation) results in permanent suspension."
 *   - AI-generated replies: "Requires prior approval from X."
 * This tool therefore does the judgement-heavy half (find the right posts, write a
 * reply that actually adds something) and leaves the 1-tap posting to a human.
 *
 * Usage:
 *   node x-engage.mjs --resolve     # map config.x.track_accounts -> numeric ids (cached)
 *   node x-engage.mjs               # scan + draft the engagement queue
 *   node x-engage.mjs --budget 1.5  # override the daily read-budget cap (USD)
 *
 * Env: X_CONSUMER_KEY/SECRET, X_ACCESS_TOKEN/SECRET   (required)
 *      X_USER_ID                                       (own numeric id; else resolved once & cached)
 *      X_LIST_ID                                       (curated List of target accounts -> 1 cheap call)
 *      LLM_API_KEY, LLM_BASE_URL, LLM_MODEL            (local Doubao gateway)
 *      TG_TOKEN, TG_CHAT_ID                            (deliver the queue)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8'));
const OUT_DIR = path.join(DIR, 'out');
const STATE_PATH = path.join(OUT_DIR, 'engage-state.json');
fs.mkdirSync(OUT_DIR, { recursive: true });

const argv = process.argv.slice(2);
const RESOLVE = argv.includes('--resolve');
const MAKE_LIST = argv.includes('--make-list');
const budgetArg = argv.indexOf('--budget');
const BUDGET = budgetArg >= 0 ? Number(argv[budgetArg + 1]) : Number(process.env.ENGAGE_BUDGET_USD || 1.0);
const maxArg = argv.indexOf('--max');
const MAXDRAFT = maxArg >= 0 ? Number(argv[maxArg + 1]) : 8;

const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || '';
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1/chat/completions';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek/deepseek-v4-flash';

// ---------- X price list (docs.x.com/x-api/getting-started/pricing, Oct 2026) ----------
const PRICE = {
  mentionRead: 0.001, // Owned Read: GET /2/users/{id}/mentions
  postRead: 0.005,    // Post: Read  (any other account's post)
  userRead: 0.01,     // User: Read
  listRead: 0.005,    // List: Read (per post returned)
};

const log = (...a) => console.log('•', ...a);

// ---------- state (dedupe + spend ledger) ----------
const state = fs.existsSync(STATE_PATH)
  ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
  : { seen: {}, spend: {}, users: {} };
const today = new Date().toISOString().slice(0, 10);
const spentToday = () => state.spend[today] || 0;
function charge(usd, what) {
  state.spend[today] = Math.round((spentToday() + usd) * 1e6) / 1e6;
  log(`read ${what} (+$${usd.toFixed(3)} → $${state.spend[today].toFixed(3)} today)`);
}
function save() { fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8'); }

// ---------- X API v2 (OAuth 1.0a user context) ----------
function xKeys() {
  return { ck: process.env.X_CONSUMER_KEY, cs: process.env.X_CONSUMER_SECRET, at: process.env.X_ACCESS_TOKEN, as: process.env.X_ACCESS_SECRET };
}
function oauth1(method, baseUrl, params, keys) {
  const oauth = {
    oauth_consumer_key: keys.ck, oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: keys.at, oauth_version: '1.0',
  };
  const enc = (s) => encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  const all = { ...params, ...oauth };
  const base = [method.toUpperCase(), enc(baseUrl), enc(Object.keys(all).sort().map((k) => `${enc(k)}=${enc(all[k])}`).join('&'))].join('&');
  oauth.oauth_signature = crypto.createHmac('sha1', `${enc(keys.cs)}&${enc(keys.as)}`).update(base).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort().map((k) => `${enc(k)}="${enc(oauth[k])}"`).join(', ');
}
async function xGet(pathOnly, query = {}) {
  const keys = xKeys();
  if (!Object.values(keys).every(Boolean)) throw new Error('missing X_* env vars');
  const qs = Object.keys(query).length ? '?' + new URLSearchParams(query).toString() : '';
  const r = await fetch('https://api.x.com' + pathOnly + qs, {
    headers: { Authorization: oauth1('GET', 'https://api.x.com' + pathOnly, query, keys) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`GET ${pathOnly} → ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}
async function xPost(pathOnly, body) {
  const keys = xKeys();
  if (!Object.values(keys).every(Boolean)) throw new Error('missing X_* env vars');
  const r = await fetch('https://api.x.com' + pathOnly, {
    method: 'POST',
    headers: { Authorization: oauth1('POST', 'https://api.x.com' + pathOnly, {}, keys), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`POST ${pathOnly} → ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}
async function xDelete(pathOnly) {
  const keys = xKeys();
  const r = await fetch('https://api.x.com' + pathOnly, {
    method: 'DELETE',
    headers: { Authorization: oauth1('DELETE', 'https://api.x.com' + pathOnly, {}, keys) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`DELETE ${pathOnly} → ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}

// ---------- local LLM (Doubao gateway) ----------
async function llm(system, user) {
  const r = await fetch(LLM_BASE_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_API_KEY}` },
    body: JSON.stringify({ model: LLM_MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.8 }),
  });
  if (!r.ok) throw new Error('LLM ' + r.status);
  const j = await r.json();
  return j.choices?.[0]?.message?.content || '';
}

// ---------- reply rules (from the X engagement playbook) ----------
// A reply must ADD something: a new data point, concrete experience, a polite
// pushback, or a sharp question. "Great post!" is worth literally zero.
function validateReply(t) {
  const s = String(t || '').trim();
  const bad = [];
  if (s.length < 45) bad.push('too short to add anything');
  if (s.length > 275) bad.push(`too long (${s.length})`);
  if (/https?:\/\//.test(s)) bad.push('contains a URL (link replies are penalised + cost $0.20)');
  if (/^(great|nice|awesome|love this|thanks for sharing|this is great|agreed)/i.test(s)) bad.push('opens with empty praise');
  if (/\b(great post|well said|100%|this!)\b/i.test(s)) bad.push('empty-praise filler');
  if (/\b(awareness|protocol bank|protocolbank|our product|we built|check out our)\b/i.test(s)) bad.push('pitches our product (spam)');
  if (/it'?s not .+,\s*it'?s|not because .+because|the result\?/i.test(s)) bad.push('AI-tell phrasing');
  if (!/[?.]|\d/.test(s)) bad.push('no question, no number, no claim');
  return bad;
}

// ---------- gather ----------
async function myId() {
  if (process.env.X_USER_ID) return process.env.X_USER_ID;
  if (state.me) return state.me;
  const j = await xGet('/2/users/me', { 'user.fields': 'username' });
  charge(PRICE.userRead, 'GET /2/users/me');
  state.me = j.data.id;
  save();
  return state.me;
}

async function resolveTracked() {
  const names = ((cfg.x && cfg.x.track_accounts) || []).map((n) => n.toLowerCase());
  const need = names.filter((n) => !state.users[n]);
  if (need.length) {
    // one call, up to 100 usernames -> $0.010 per user returned
    for (let i = 0; i < need.length; i += 100) {
      const chunk = need.slice(i, i + 100);
      const j = await xGet('/2/users/by', { usernames: chunk.join(','), 'user.fields': 'username,name,description,public_metrics' });
      charge(PRICE.userRead * (j.data || []).length, `users/by (${chunk.length})`);
      for (const u of j.data || []) {
        state.users[u.username.toLowerCase()] = { id: u.id, name: u.name, followers: u.public_metrics?.followers_count, bio: (u.description || '').slice(0, 200) };
      }
    }
    save();
  }
  // ONLY the accounts currently listed in config.json — the cache may hold stale ones
  return Object.fromEntries(names.filter((n) => state.users[n]).map((n) => [n, state.users[n]]));
}

async function mentions(me) {
  const j = await xGet(`/2/users/${me}/mentions`, {
    max_results: 20, 'tweet.fields': 'created_at,public_metrics,author_id,conversation_id',
    expansions: 'author_id', 'user.fields': 'username,name,public_metrics',
  });
  const users = Object.fromEntries(((j.includes && j.includes.users) || []).map((u) => [u.id, u]));
  const out = (j.data || []).map((t) => ({ ...t, author: users[t.author_id] || {}, kind: 'mention' }));
  charge(PRICE.mentionRead * out.length, `mentions (${out.length})`);
  return out;
}

async function listTimeline() {
  const listId = process.env.X_LIST_ID;
  if (!listId) { log('no X_LIST_ID set → skipping target-account scan (run with a List for the cheap $0.005/post path)'); return []; }
  const j = await xGet(`/2/lists/${listId}/tweets`, {
    max_results: 40, 'tweet.fields': 'created_at,public_metrics,author_id',
    expansions: 'author_id', 'user.fields': 'username,name,public_metrics',
  });
  const users = Object.fromEntries(((j.includes && j.includes.users) || []).map((u) => [u.id, u]));
  const out = (j.data || []).map((t) => ({ ...t, author: users[t.author_id] || {}, kind: 'tracked' }));
  charge(PRICE.postRead * out.length, `list timeline (${out.length})`);
  return out;
}

// ---------- draft ----------
const SYSTEM = [
  `You write X (Twitter) replies for @${cfg.x.handle} — the account behind Protocol Bank - a non-custodial AI trading agent on Hyperliquid. The agent gets trading-only rights, can never withdraw, and every live account is public with real PnL.`,
  `Voice: ${cfg.voice}`,
  'You are NOT selling. You are a practitioner joining a technical conversation. A reply that only praises is worth zero — you must ADD one of: a new data point, a concrete first-hand experience, a polite disagreement, or a sharp question.',
  'Write like a human engineer on a phone: no corporate tone, no hashtags, no emoji spam, never more than 2 short sentences.',
].join('\n');

async function draftFor(post) {
  const meta = post.author || {};
  const user = `Post by @${meta.username || 'unknown'} (${meta.public_metrics?.followers_count ?? '?'} followers):
"""
${post.text}
"""

Metrics: ${JSON.stringify(post.public_metrics || {})}

TASK: decide if replying adds value. If the post is off-topic (not about AI trading, Hyperliquid, perpetual futures, non-custodial tooling, MCP, agent wallets), or is a job ad / pure promotion, or you have nothing real to add — say SKIP.
Otherwise write ONE reply that adds exactly one of: a new data point, a concrete experience, a polite pushback, or a sharp question.

HARD RULES: <= 260 chars; NO URLs; NO hashtags; NO product pitch or brand mention; do not open with praise; reference something SPECIFIC from their post; no AI-tell phrasing ("it's not X, it's Y", "the result?").

Return STRICT JSON only:
{"action":"reply"|"repost"|"skip","why":"<why this is worth engaging, <=15 words>","reply":"<the reply text, empty if skip>"}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const u = attempt === 1 ? user : `${user}\n\nPrevious attempt failed: ${draftFor.lastIssues.join('; ')}. Fix all of them. JSON only.`;
    const raw = await llm(SYSTEM, u);
    let j = {};
    try { j = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]); } catch { j = { action: 'skip', why: 'unparseable' }; }
    if (j.action === 'skip') return { action: 'skip', why: j.why || '' };
    const issues = validateReply(j.reply);
    if (!issues.length) return { action: j.action || 'reply', why: j.why || '', reply: String(j.reply).trim(), attempt };
    draftFor.lastIssues = issues;
    log(`  draft attempt ${attempt} rejected: ${issues.join('; ')}`);
  }
  return { action: 'skip', why: 'could not draft a reply that adds value' };
}

async function deliver(text) {
  if (!(process.env.TG_TOKEN && process.env.TG_CHAT_ID)) return log('(no TG env — queue written to disk only)');
  try {
    await fetch(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TG_CHAT_ID, text: text.slice(0, 3900), disable_web_page_preview: true }),
    });
    log('queue delivered to Telegram');
  } catch (e) { log('tg deliver failed', e.message); }
}

// ---------- run ----------
(async () => {
  const keys = xKeys();
  if (!Object.values(keys).every(Boolean)) { console.error('missing X_CONSUMER_KEY/SECRET + X_ACCESS_TOKEN/SECRET'); process.exit(1); }

  if (RESOLVE) {
    const users = await resolveTracked();
    const rows = Object.entries(users).map(([u, v]) => `@${u}\t${v.id}\t${v.followers ?? '?'} followers`);
    console.log(['username\tid\tfollowers', ...rows].join('\n'));
    console.log('\nNow create one X List containing these accounts (X app → Lists → New), then set X_LIST_ID=<id>.');
    save();
    return;
  }

  if (MAKE_LIST) {
    const delIdx = argv.indexOf('--delete');
    if (delIdx >= 0 && argv[delIdx + 1]) {
      await xDelete(`/2/lists/${argv[delIdx + 1]}`);
      charge(0.005, 'DELETE /2/lists');
      log(`deleted old list ${argv[delIdx + 1]}`);
    }
    const users = await resolveTracked();
    const ids = Object.values(users).map((v) => v.id);
    if (!ids.length) { console.error('no resolved accounts — run --resolve first'); process.exit(1); }
    const j = await xPost('/2/lists', {
      name: 'AI trading / Hyperliquid watch',
      description: 'Accounts Protocol Bank engages with: AI trading, Hyperliquid, perp DEX, MCP tooling.',
      private: false,
    });
    charge(0.010, 'POST /2/lists');
    const listId = j.data && j.data.id;
    log(`created list ${listId} (${ids.length} accounts)`);
    for (const id of ids) { await xPost(`/2/lists/${listId}/members`, { user_id: id }); charge(0.005, 'list member add'); }
    save();
    console.log('\nX_LIST_ID=' + listId);
    return;
  }

  const me = await myId();
  log(`me = ${me} | budget $${BUDGET.toFixed(2)}/day | spent today $${spentToday().toFixed(3)}`);
  if (!process.env.X_LIST_ID) log('hint: set X_LIST_ID (one curated List) — it is the cheapest way to watch 25 accounts.');
  if (spentToday() >= BUDGET) { console.error(`daily read budget $${BUDGET} reached — stopping.`); return; }

  log('reading our mentions (Owned Read, $0.001 each)...');
  const ms = await mentions(me);
  log('reading curated list timeline ($0.005/post)...');
  const lt = await listTimeline();

  const fresh = [...ms, ...lt].filter((p) => {
    if (state.seen[p.id]) return false;
    const ageH = (Date.now() - new Date(p.created_at || Date.now()).getTime()) / 3600e3;
    return ageH <= 48; // the 15-minute window matters, so drop anything stale
  });
  log(`${fresh.length} fresh post(s) to consider (${ms.length} mentions, ${lt.length} tracked)`);

  const queue = [];
  for (const p of fresh.slice(0, MAXDRAFT)) {
    if (spentToday() >= BUDGET) { log('budget reached mid-scan — stopping'); break; }
    const d = await draftFor(p);
    state.seen[p.id] = new Date().toISOString();
    if (d.action === 'skip') { log(`  skip @${p.author?.username}: ${d.why}`); continue; }
    const url = `https://x.com/${p.author?.username || 'i'}/status/${p.id}`;
    queue.push({ ...d, url, author: p.author?.username, followers: p.author?.public_metrics?.followers_count, text: p.text, kind: p.kind });
    log(`  ${d.action} → @${p.author?.username}`);
  }
  save();

  const date = new Date().toISOString().slice(0, 10);
  const md = [
    `# X engagement queue — ${date}`,
    '',
    `Budget used today: **$${spentToday().toFixed(3)}** of $${BUDGET.toFixed(2)}.`,
    '',
    '**Post these by hand** (X blocks API replies to accounts that have not summoned you).',
    'Aim for the first 15 minutes after the original post — that window is worth 3-5x.',
    '',
    ...(queue.length
      ? queue.map((q, i) => [
          `## ${i + 1}. ${q.action === 'repost' ? '🔁 repost' : '💬 reply'} → @${q.author} (${q.followers ?? '?'} followers)`,
          `Why: ${q.why}`,
          `Post: ${q.text.replace(/\n+/g, ' ').slice(0, 180)}…`,
          `Link: ${q.url}`,
          q.action === 'repost' ? '_Repost is API-allowed; reply by hand._' : '',
          '```',
          q.reply,
          '```',
          '',
        ].filter(Boolean).join('\n'))
      : ['_Nothing worth replying to this run. Correct behaviour — no filler._']),
  ].join('\n');
  const outFile = path.join(OUT_DIR, `engage-${date}.md`);
  fs.writeFileSync(outFile, md, 'utf8');
  log(`wrote ${outFile} (${queue.length} item(s), $${spentToday().toFixed(3)} spent today)`);
  if (queue.length) await deliver(md);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
