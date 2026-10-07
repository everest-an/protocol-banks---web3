#!/usr/bin/env node
/**
 * x-poster — server-side scheduled agent that turns YOUR recent GitHub activity
 * into effective X posts.
 *
 *   GitHub recent activity (commits / releases / new repos / PRs)
 *        -> LLM drafts 1-3 posts grounded in REAL activity
 *        -> post via the OFFICIAL X API if keys are set
 *           else deliver the draft (Telegram / console) for you to post
 *
 * Compliant: posts only ORIGINAL content about your own project. No auto-reply,
 * no auto-follow, no simulated browsing.
 *
 * Usage:  node x-poster.mjs [--dry-run]
 * Env:    LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
 *         X_CONSUMER_KEY, X_CONSUMER_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET   (to auto-post)
 *         TG_TOKEN, TG_CHAT_ID                                                   (to deliver drafts)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8'));
const DRY = process.argv.includes('--dry-run');
const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || '';
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1/chat/completions';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek/deepseek-v4-flash';
const OUT_DIR = path.join(DIR, 'out');

const log = (...a) => console.log('•', ...a);

function gh(p) { try { return JSON.parse(execFileSync('gh', ['api', p], { encoding: 'utf8' })); } catch { return null; } }

// ---------- gather recent GitHub activity ----------
function recentActivity() {
  const sinceMs = Date.now() - 7 * 24 * 3600 * 1000;
  const sinceIso = encodeURIComponent(new Date(sinceMs).toISOString());
  const lines = [];

  // 1) concrete commit messages per repo (the best grounding for "what we shipped")
  for (const repo of cfg.github.repos) {
    const commits = gh(`repos/${repo}/commits?since=${sinceIso}&per_page=15`) || [];
    if (commits.length) {
      const msgs = commits.slice(0, 6).map((c) => '· ' + (c.commit && c.commit.message ? c.commit.message.split('\n')[0] : ''));
      lines.push(`COMMITS in ${repo} (${commits.length} in 7d):\n    ${msgs.join('\n    ')}`);
    }
    const rel = gh(`repos/${repo}/releases?per_page=3`) || [];
    for (const r of rel) if (new Date(r.published_at).getTime() >= sinceMs) lines.push(`RELEASE ${repo} ${r.tag_name}: ${(r.name || '').trim()}`);
  }

  // 2) events for new repos / merged PRs
  const events = gh(`users/${cfg.github.user}/events/public?per_page=60`) || [];
  for (const e of events) {
    if (new Date(e.created_at).getTime() < sinceMs) continue;
    const repo = e.repo && e.repo.name;
    if (e.type === 'CreateEvent' && e.payload && e.payload.ref_type === 'repository') lines.push(`NEW REPO ${repo}`);
    if (e.type === 'PullRequestEvent' && e.payload && e.payload.action === 'closed' && e.payload.pull_request && e.payload.pull_request.merged) {
      lines.push(`MERGED PR ${repo} #${e.payload.pull_request.number}: ${e.payload.pull_request.title}`);
    }
  }
  return lines;
}

function repoStats() {
  const out = [];
  for (const r of cfg.github.repos) {
    const d = gh(`repos/${r}`);
    if (d) out.push(`${d.full_name}: ${d.stargazers_count}⭐, ${d.forks_count} forks, updated ${(d.pushed_at || '').slice(0, 10)}`);
  }
  return out;
}

async function llm(system, user) {
  const r = await fetch(LLM_BASE_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_API_KEY}` },
    body: JSON.stringify({ model: LLM_MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.7 }),
  });
  if (!r.ok) throw new Error('LLM ' + r.status);
  const j = await r.json();
  return j.choices?.[0]?.message?.content || '';
}

// ---------- X API (OAuth 1.0a user context) ----------
function oauth1(method, url, params, keys) {
  const oauth = {
    oauth_consumer_key: keys.ck, oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: keys.at, oauth_version: '1.0',
  };
  const enc = (s) => encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  const all = { ...params, ...oauth };
  const base = [method.toUpperCase(), enc(url), enc(Object.keys(all).sort().map((k) => `${enc(k)}=${enc(all[k])}`).join('&'))].join('&');
  oauth.oauth_signature = crypto.createHmac('sha1', `${enc(keys.cs)}&${enc(keys.as)}`).update(base).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort().map((k) => `${enc(k)}="${enc(oauth[k])}"`).join(', ');
}
function xKeys() {
  return { ck: process.env.X_CONSUMER_KEY, cs: process.env.X_CONSUMER_SECRET, at: process.env.X_ACCESS_TOKEN, as: process.env.X_ACCESS_SECRET };
}

async function postToX(text, mediaPath) {
  const keys = xKeys();
  if (!Object.values(keys).every(Boolean)) return { skipped: 'no X keys' };
  if (DRY) return { dry: text };
  try {
    const { TwitterApi } = await import('twitter-api-v2');
    const client = new TwitterApi({ appKey: keys.ck, appSecret: keys.cs, accessToken: keys.at, accessSecret: keys.as });
    const payload = { text: text.slice(0, 280) };
    if (mediaPath && fs.existsSync(mediaPath)) {
      try {
        const mediaId = await client.v1.uploadMedia(mediaPath);
        payload.media = { media_ids: [mediaId] };
        log('uploaded media', mediaId);
      } catch (e) { log('media upload failed (posting text only):', e.message); }
    }
    let r;
    try {
      r = await client.v2.tweet(payload);
    } catch (e) {
      if (!payload.media) throw e;
      // Some X tiers/accounts reject media tweets (403 "not permitted") even though the
      // v1.1 upload succeeded. The text post still works, so never lose the post to the card.
      log('media tweet rejected (' + (e.code || (e.data && e.data.status) || '') + ') -> retrying text-only');
      delete payload.media;
      r = await client.v2.tweet(payload);
    }
    return { posted: r.data?.id };
  } catch (e) {
    const code = e.code || e.data?.status || (e.data && e.data.title) || '';
    return { error: code || 0, body: (e.data ? JSON.stringify(e.data) : e.message).slice(0, 300) };
  }
}

async function postToBluesky(text) {
  const id = process.env.BSKY_IDENTIFIER, pw = process.env.BSKY_APP_PASSWORD;
  if (!id || !pw) return { skipped: 'no Bluesky keys' };
  if (DRY) return { dry: text };
  try {
    const s = await (await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: id, password: pw }) })).json();
    if (!s.accessJwt) return { error: 'login', body: JSON.stringify(s).slice(0, 200) };
    const r = await (await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.accessJwt }, body: JSON.stringify({ repo: s.did, collection: 'app.bsky.feed.post', record: { $type: 'app.bsky.feed.post', text: text.slice(0, 300), createdAt: new Date().toISOString() } }) })).json();
    if (r.uri) return { posted: 'https://bsky.app/profile/' + s.handle + '/post/' + r.uri.split('/').pop() };
    return { error: 'create', body: JSON.stringify(r).slice(0, 200) };
  } catch (e) { return { error: 'net', body: e.message }; }
}
async function alertEmail(subject, body) {
  const { SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) { log('(no SMTP env — skipping email alert)'); return; }
  try {
    const { default: nodemailer } = await import('nodemailer');
    const t = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.exmail.qq.com', port: parseInt(process.env.SMTP_PORT || '465', 10), secure: (process.env.SMTP_SECURE || 'true') !== 'false', auth: { user: SMTP_USER, pass: SMTP_PASS } });
    await t.sendMail({ from: `"Protocol Bank" <${process.env.MAIL_FROM || SMTP_USER}>`, to: process.env.ALERT_TO || SMTP_USER, subject, text: body });
    log('alert email sent to ' + (process.env.ALERT_TO || SMTP_USER));
  } catch (e) { log('alert email failed:', e.message); }
}

async function deliver(text) {
  if (process.env.TG_TOKEN && process.env.TG_CHAT_ID) {
    try {
      await fetch(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: process.env.TG_CHAT_ID, text: text.slice(0, 3900), disable_web_page_preview: true }),
      });
      log('draft delivered to Telegram');
    } catch (e) { log('tg deliver failed', e.message); }
  }
}

(async () => {
  if (!LLM_API_KEY) { console.error('Missing LLM_API_KEY'); process.exit(1); }
  log('reading GitHub activity...');
  const activity = recentActivity();
  const stats = repoStats();
  if (!activity.length) { log('no public activity in the last 7 days — nothing to post'); return; }
  log(`${activity.length} activity line(s)`);

  const system = [
    `You are the social lead for Protocol Bank (@${cfg.x.handle}), writing for technical builders on X.`,
    `Product: ${cfg.product}`,
    `Voice: ${cfg.voice}`,
    'You follow the X ranking playbook: hook in the first 8 words, name the topic in the first 10 words, write to be DM-forwarded and to earn a follow (not a like), be specific, never use AI-tells.',
  ].join('\n');
  const user = `My GitHub activity (last 7 days):\n${activity.map((a) => '- ' + a).join('\n')}\n\nRepo stats:\n${stats.map((s) => '- ' + s).join('\n')}\n\nWrite ONE X post that would earn shares and follows from crypto traders and developers building AI agents (Hyperliquid perp DEX, non-custodial tooling).\n\nFORMAT (proven; the ENTIRE post MUST be <= ${cfg.x.max_chars} chars INCLUDING newlines and hashtags - count characters before you answer):\n- Line 1 = HOOK: a specific claim, pain, or surprising number within the FIRST 8 words. Do NOT start with "We", "I", or the product name. Name the topic (AI trading / Hyperliquid / non-custodial / MCP) within the first 10 words. <= 8 words / ~60 chars.\n- Then 1-2 short lines (~70 chars each) that give the reader something useful. Translate the work into what a developer building agents CARES ABOUT - never describe our commits, PRs or workflows.\n- 1 short line of PROOF: a real number from the data above (~45 chars).\n- 1 short line CTA: a question OR "repo in bio" (~35 chars).\n- LAST line: EXACTLY 2 hashtags (X rewards 1-2; more looks spammy).\n- BUDGET: hook 60 + middle 70 + proof 45 + CTA 35 + hashtags 25 = ~235 chars. If you are over ${cfg.x.max_chars}, CUT WORDS - never drop the hashtag line.\n\nBANNED phrases (AI-tells + reach killers): "It's not X, it's Y" / "Not because X. Because Y." / negation lists ("no X, no Y") / colon reveals ("The result? ...") / trailing pile-ons / engagement-bait / raw changelogs ("N commits", "we shipped").\nHARD RULES: <= ${cfg.x.max_chars} chars total; use specific nouns (Hyperliquid, MCP, MetaMask, USDC, agent wallet); grounded ONLY in the data above (never invent); NO URLs; <=1 emoji.\n\nAlso write the card image copy. Return STRICT JSON only:\n{"post":"<full post incl. newlines and the 2-hashtag last line>","card":{"eyebrow":"<2-3 word CAPS label>","title":"<punchy hook headline <=60 chars>","sub":"<one supporting line <=100 chars>","stat":"<short proof stat, may contain <b>..</b>>"}}`;

  // --- FIXED POSTING REQUIREMENTS (X playbook) — enforced, not just prompted ---
  function validatePost(p) {
    const t = String(p || '').trim();
    const issues = [];
    if (t.length > cfg.x.max_chars) issues.push(`too long (${t.length} chars)`);
    const tags = t.match(/#[\w-]+/g) || [];
    if (tags.length !== 2) issues.push(`needs exactly 2 hashtags (has ${tags.length})`);
    const firstLine = t.split('\n')[0].trim();
    if (firstLine.split(/\s+/).length > 12) issues.push('hook is longer than 12 words');
    if (/^(we|i|our|awareness|protocol)\b/i.test(firstLine)) issues.push('hook must not start with We/I/the product name');
    if (/\b\d+\s+commits?\b|we shipped|we built/i.test(t)) issues.push('reads like a changelog');
    if (/it'?s not .+,\s*it'?s|not because .+because|the result\?/i.test(t)) issues.push('contains an AI-tell');
    if (!/\d/.test(t)) issues.push('missing a concrete number/proof');
    return issues;
  }
  let draft = '', issues = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const u = attempt === 1 ? user : user + `\n\nYour previous draft failed these checks: ${issues.join('; ')}. Rewrite so it passes ALL of them. JSON only.`;
    draft = (await llm(system, u)).trim();
    let pj = {};
    try { pj = JSON.parse((draft.match(/\{[\s\S]*\}/) || [draft])[0]); } catch { pj = { post: draft }; }
    issues = validatePost(pj.post);
    if (!issues.length) { log(`post passed all checks (attempt ${attempt})`); break; }
    log(`attempt ${attempt} failed: ${issues.join('; ')}`);
  }
  if (issues.length) log('WARNING: posting anyway, still failing: ' + issues.join('; '));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `post-${new Date().toISOString().slice(0, 10)}.md`);
  fs.writeFileSync(out, `# X post draft — ${new Date().toISOString().slice(0, 10)}\n\n${draft}\n`, 'utf8');
  log('draft:\n' + draft);

  // parse the structured JSON (fallback: raw text); strip URLs to keep the API cost at $0.015 not $0.20
  let parsed = {};
  try { parsed = JSON.parse((draft.match(/\{[\s\S]*\}/) || [draft])[0]); } catch { parsed = { post: draft }; }
  const card = parsed.card || {};
  const first = String(parsed.post || '').replace(/https?:\/\/\S+/g, '').replace(/[ \t]{2,}/g, ' ').trim();

  // 1) render an attractive card for the post
  let cardPath = path.join(OUT_DIR, `card-${new Date().toISOString().slice(0, 10)}.png`);
  try {
    const title = String(card.title || first.split(/\n/)[0]).slice(0, 96);
    execFileSync(process.execPath, ['make-card.mjs',
      '--eyebrow', card.eyebrow || 'SHIPPED THIS WEEK',
      '--title', title,
      '--sub', card.sub || 'Non-custodial AI trading on Hyperliquid - the agent can trade, never withdraw.',
      '--stat', card.stat || '<b>Trading-only</b> agent wallet &middot; public track record',
      '--out', cardPath,
    ], { cwd: DIR, stdio: 'ignore' });
    log('card rendered: ' + cardPath);
  } catch (e) { log('card render failed:', e.message); cardPath = null; }

  // 2) post (with the card image)
  const res = await postToX(first, cardPath);
  if (res.posted) log('✅ posted to X (with image), id=' + res.posted);
  else if (res.skipped) { log('X keys not set → delivering draft + card instead'); await deliver(draft + (cardPath ? '\n\n[card] ' + cardPath : '')); }
  else if (res.dry) log('dry-run: would post:\n' + res.dry);
  else {
    log('X post failed:', JSON.stringify(res));
    // if it looks like a credits/quota issue, email the owner to top up
    const s = JSON.stringify(res).toLowerCase();
    if (/credit|402|403|quota|payment|billing|usage cap/.test(s)) {
      await alertEmail('[Protocol Bank] X posting paused — top up credits',
        `Your scheduled X poster could not post (credits/quota).\n\nError: ${JSON.stringify(res)}\n\nTop up: https://console.x.com/accounts/2090896037367914496\n(Draft kept at ${out})`);
    }
  }
  // 3) cross-post the same text to Bluesky (independent of X)
  const bres = await postToBluesky(first);
  if (bres.posted) log('cross-posted to Bluesky: ' + bres.posted);
  else if (bres.skipped) log('(no Bluesky keys - skipping cross-post)');
  else if (bres.dry) log('dry-run: would post to Bluesky');
  else log('Bluesky post failed:', JSON.stringify(bres));
  log('wrote ' + out);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
