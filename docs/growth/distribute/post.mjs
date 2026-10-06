#!/usr/bin/env node
/**
 * Content auto-distributor — cross-post one content item to every ENABLED channel.
 *
 * Usage:  node post.mjs content/sample-thread.json [--dry-run]
 *
 * Enabled by env vars (missing ones are skipped):
 *   Telegram : TG_TOKEN + TG_CHAT_ID
 *   Discord  : DISCORD_TOKEN + DISCORD_CHANNEL_ID
 *   X        : X_CONSUMER_KEY + X_CONSUMER_SECRET + X_ACCESS_TOKEN + X_ACCESS_SECRET
 *   Bluesky  : BSKY_IDENTIFIER + BSKY_APP_PASSWORD            (handle + app password)
 *   Mastodon : MASTODON_INSTANCE + MASTODON_TOKEN
 *   Dev.to   : DEVTO_API_KEY                                  (long-form article)
 *   Hashnode : HASHNODE_TOKEN + HASHNODE_PUBLICATION_ID        (long-form article)
 *   Reddit   : REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET + REDDIT_USERNAME + REDDIT_PASSWORD + REDDIT_SUBREDDIT
 *   Webhook  : WEBHOOK_URL  (Buffer / Typefully / Make / n8n)
 *
 * Item JSON: { "title", "text", "thread": [...], "markdown"?, "tags"?, "url"? }
 *   - short-post platforms use `text` (or the thread's first tweet)
 *   - long-form platforms (Dev.to / Hashnode) use `markdown` (fallback: `text`)
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const DRY = args.includes('--dry-run');
if (!file) { console.error('usage: node post.mjs <item.json> [--dry-run]'); process.exit(1); }
const item = JSON.parse(fs.readFileSync(file, 'utf8'));
const posts = item.thread && item.thread.length ? item.thread : [item.text || ''];
const main = item.text || posts.join('\n\n');
const markdown = item.markdown || item.text || '';
const log = (...a) => console.log('•', ...a);

// ---------- Telegram ----------
async function telegram() {
  const token = process.env.TG_TOKEN, chat = process.env.TG_CHAT_ID;
  if (!token || !chat) return log('telegram: skipped (no TG_TOKEN/TG_CHAT_ID)');
  if (DRY) return log('telegram: [dry]');
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text: main }) });
  log('telegram:', r.ok ? 'sent' : 'FAILED ' + r.status);
}

// ---------- Discord ----------
async function discord() {
  const token = process.env.DISCORD_TOKEN, ch = process.env.DISCORD_CHANNEL_ID;
  if (!token || !ch) return log('discord: skipped');
  if (DRY) return log('discord: [dry]');
  const r = await fetch(`https://discord.com/api/v10/channels/${ch}/messages`, { method: 'POST', headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ content: main.slice(0, 1990) }) });
  log('discord:', r.ok ? 'sent' : 'FAILED ' + r.status);
}

// ---------- Webhook ----------
async function webhook() {
  const url = process.env.WEBHOOK_URL; if (!url) return log('webhook: skipped');
  if (DRY) return log('webhook: [dry]');
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item, posts }) });
  log('webhook:', r.ok ? 'sent' : 'FAILED ' + r.status);
}

// ---------- X / Twitter (OAuth 1.0a) ----------
function oauth1(method, url, params, keys) {
  const oauth = { oauth_consumer_key: keys.ck, oauth_nonce: crypto.randomBytes(16).toString('hex'), oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: String(Math.floor(Date.now() / 1000)), oauth_token: keys.at, oauth_version: '1.0' };
  const enc = (s) => encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  const all = { ...params, ...oauth };
  const base = [method.toUpperCase(), enc(url), enc(Object.keys(all).sort().map((k) => `${enc(k)}=${enc(all[k])}`).join('&'))].join('&');
  oauth.oauth_signature = crypto.createHmac('sha1', `${enc(keys.cs)}&${enc(keys.as)}`).update(base).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort().map((k) => `${enc(k)}="${enc(oauth[k])}"`).join(', ');
}
async function xTwitter() {
  const keys = { ck: process.env.X_CONSUMER_KEY, cs: process.env.X_CONSUMER_SECRET, at: process.env.X_ACCESS_TOKEN, as: process.env.X_ACCESS_SECRET };
  if (!Object.values(keys).every(Boolean)) return log('x: skipped (no X_* keys)');
  if (DRY) return log('x: [dry] would post ' + posts.length + ' tweet(s)');
  let replyTo = null;
  for (const t of posts) {
    const url = 'https://api.twitter.com/2/tweets'; const payload = { text: t.slice(0, 280) };
    if (replyTo) payload.reply = { in_reply_to_tweet_id: replyTo };
    const r = await fetch(url, { method: 'POST', headers: { Authorization: oauth1('POST', url, {}, keys), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { replyTo = j.data?.id || replyTo; log('x: posted', j.data?.id || ''); } else { log('x: FAILED', r.status, JSON.stringify(j).slice(0, 160)); break; }
  }
}

// ---------- Bluesky (AT Protocol) ----------
async function bsky() {
  const id = process.env.BSKY_IDENTIFIER, pw = process.env.BSKY_APP_PASSWORD;
  if (!id || !pw) return log('bluesky: skipped (no BSKY_IDENTIFIER/BSKY_APP_PASSWORD)');
  if (DRY) return log('bluesky: [dry] would post: ' + main.slice(0, 60));
  try {
    const s = await (await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: id, password: pw }) })).json();
    if (!s.accessJwt) return log('bluesky: login failed', JSON.stringify(s).slice(0, 160));
    const text = main.slice(0, 300);
    const r = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.accessJwt },
      body: JSON.stringify({ repo: s.did, collection: 'app.bsky.feed.post', record: { $type: 'app.bsky.feed.post', text, createdAt: new Date().toISOString() } }),
    });
    log('bluesky:', r.ok ? 'posted' : 'FAILED ' + r.status);
  } catch (e) { log('bluesky: error', e.message); }
}

// ---------- Mastodon ----------
async function mastodon() {
  const inst = process.env.MASTODON_INSTANCE, token = process.env.MASTODON_TOKEN;
  if (!inst || !token) return log('mastodon: skipped (no MASTODON_INSTANCE/MASTODON_TOKEN)');
  if (DRY) return log('mastodon: [dry]');
  const host = inst.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const r = await fetch(`https://${host}/api/v1/statuses`, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: main.slice(0, 4500) }) });
  log('mastodon:', r.ok ? 'posted' : 'FAILED ' + r.status);
}

// ---------- Dev.to (long-form) ----------
async function devto() {
  const key = process.env.DEVTO_API_KEY; if (!key) return log('devto: skipped (no DEVTO_API_KEY)');
  if (DRY) return log('devto: [dry] would publish article "' + (item.title || '') + '"');
  const r = await fetch('https://dev.to/api/articles', {
    method: 'POST', headers: { 'api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ article: { title: item.title || main.split('\n')[0].slice(0, 80), body_markdown: markdown, published: true, canonical_url: item.url || undefined, tags: (item.tags || []).slice(0, 4) } }),
  });
  const j = await r.json().catch(() => ({}));
  log('devto:', r.ok ? 'published ' + (j.url || '') : 'FAILED ' + r.status + ' ' + JSON.stringify(j).slice(0, 160));
}

// ---------- Hashnode (long-form, GraphQL) ----------
async function hashnode() {
  const token = process.env.HASHNODE_TOKEN, pubId = process.env.HASHNODE_PUBLICATION_ID;
  if (!token || !pubId) return log('hashnode: skipped (no HASHNODE_TOKEN/HASHNODE_PUBLICATION_ID)');
  if (DRY) return log('hashnode: [dry]');
  const q = `mutation P($input: PublishPostInput!) { publishPost(input: $input) { post { url } } }`;
  const r = await fetch('https://gql.hashnode.com', {
    method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q, variables: { input: { title: item.title || 'Awareness', publicationId: pubId, contentMarkdown: markdown, originalArticleURL: item.url || undefined, tags: (item.tags || []).map((t) => ({ slug: t, name: t })) } } }),
  });
  const j = await r.json().catch(() => ({}));
  log('hashnode:', r.ok ? 'published ' + (j.data?.publishPost?.post?.url || '') : 'FAILED ' + r.status + ' ' + JSON.stringify(j).slice(0, 160));
}

// ---------- Reddit ----------
async function reddit() {
  const cid = process.env.REDDIT_CLIENT_ID, csec = process.env.REDDIT_CLIENT_SECRET, user = process.env.REDDIT_USERNAME, pw = process.env.REDDIT_PASSWORD, sub = process.env.REDDIT_SUBREDDIT;
  if (![cid, csec, user, pw, sub].every(Boolean)) return log('reddit: skipped (need REDDIT_CLIENT_ID/SECRET/USERNAME/PASSWORD/SUBREDDIT)');
  if (DRY) return log('reddit: [dry]');
  try {
    const auth = Buffer.from(`${cid}:${csec}`).toString('base64');
    const tok = await (await fetch('https://www.reddit.com/api/v1/access_token', { method: 'POST', headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'awareness-dist/1.0' }, body: `grant_type=password&username=${encodeURIComponent(user)}&password=${encodeURIComponent(pw)}` })).json();
    if (!tok.access_token) return log('reddit: auth failed', JSON.stringify(tok).slice(0, 160));
    const r = await fetch('https://oauth.reddit.com/api/submit', { method: 'POST', headers: { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'awareness-dist/1.0' }, body: `sr=${encodeURIComponent(sub)}&title=${encodeURIComponent(item.title || main.split('\n')[0])}&text=${encodeURIComponent(markdown)}&kind=self` });
    log('reddit:', r.ok ? 'submitted' : 'FAILED ' + r.status);
  } catch (e) { log('reddit: error', e.message); }
}

(async () => {
  log(`item="${item.title || file}" posts=${posts.length} dryRun=${DRY}`);
  await telegram();
  await discord();
  await webhook();
  await xTwitter();
  await bsky();
  await mastodon();
  await devto();
  await hashnode();
  await reddit();
  log('done.');
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
