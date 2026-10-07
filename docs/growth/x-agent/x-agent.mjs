#!/usr/bin/env node
/**
 * Daily X (Twitter) content agent — COMPLIANT, draft-only.
 *
 * It gathers industry news, then drafts: (a) reply angles with source links and
 * (b) original post drafts. A HUMAN reviews and posts. It never auto-posts,
 * auto-replies, or simulates browsing (that violates X's rules).
 *
 * Usage:  node x-agent.mjs            -> writes out/digest-YYYY-MM-DD.md
 * Env:    LLM_API_KEY, LLM_BASE_URL, LLM_MODEL   (+ optional TG_TOKEN/TG_CHAT_ID to deliver)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8'));
const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || '';
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1/chat/completions';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek/deepseek-v4-flash';
const OUT_DIR = path.join(DIR, 'out');

const j = async (u, h = {}) => { const r = await fetch(u, { headers: h }); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); };

async function hnNews() {
  try {
    const ids = (await j('https://hacker-news.firebaseio.com/v0/topstories.json')).slice(0, 40);
    const items = [];
    for (const id of ids) {
      const it = await j(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      if (!it || !it.title) continue;
      items.push({ title: it.title, url: it.url || `https://news.ycombinator.com/item?id=${id}`, hn: `https://news.ycombinator.com/item?id=${id}`, score: it.score || 0 });
      if (items.length >= cfg.hn.max) break;
    }
    return items;
  } catch (e) { return [{ error: 'hn: ' + e.message }]; }
}

async function arxivNews() {
  try {
    const r = await fetch(`http://export.arxiv.org/api/query?search_query=${encodeURIComponent(cfg.arxiv.query)}&sortBy=submittedDate&sortOrder=descending&max_results=${cfg.arxiv.max}`);
    const xml = await r.text();
    const out = [];
    for (const m of xml.matchAll(/<entry>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<id>([\s\S]*?)<\/id>/g)) {
      out.push({ title: m[1].replace(/\s+/g, ' ').trim(), url: m[2].trim() });
    }
    return out;
  } catch (e) { return [{ error: 'arxiv: ' + e.message }]; }
}

function ghTrending() {
  const out = [];
  for (const q of cfg.github.queries) {
    try {
      const r = JSON.parse(execFileSync('gh', ['api', `search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=3`], { encoding: 'utf8' }));
      for (const it of r.items || []) out.push({ title: `${it.full_name} — ${it.description || ''}`, url: it.html_url, stars: it.stargazers_count });
    } catch { /* gh optional */ }
  }
  return out.slice(0, cfg.github.max);
}

async function llm(system, user) {
  const r = await fetch(LLM_BASE_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_API_KEY}` },
    body: JSON.stringify({ model: LLM_MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.6 }),
  });
  if (!r.ok) throw new Error('LLM ' + r.status);
  const jj = await r.json();
  return jj.choices?.[0]?.message?.content || '';
}

(async () => {
  if (!LLM_API_KEY) { console.error('Missing LLM_API_KEY'); process.exit(1); }
  console.log('gathering news...');
  const [hn, arxiv, gh] = [await hnNews(), await arxivNews(), ghTrending()];
  const today = new Date().toISOString().slice(0, 10);

  const news = [
    ...hn.filter((x) => !x.error).map((x) => `- [HN ${x.score}] ${x.title} — ${x.url} (讨论: ${x.hn})`),
    ...gh.map((x) => `- [GH ${x.stars}⭐] ${x.title} — ${x.url}`),
    ...arxiv.map((x) => `- [arXiv] ${x.title} — ${x.url}`),
  ].join('\n');

  console.log(`drafting (${news.split('\n').length} items)...`);
  const system = `You are ${cfg.product ? 'the social lead for Protocol Bank' : 'a social lead'}. Voice: ${cfg.voice}\nProduct: ${cfg.product}\nTopics: ${cfg.topics.join(', ')}`;
  const user = `Here is today's industry news:\n\n${news}\n\nProduce a Markdown digest with EXACTLY these sections (reply in the same language as the majority of the product brief; default 中文):\n\n## 今日行业动态\nTop 5 most relevant items (title + one-line "为什么相关").\n\n## 可评论的点（人工发送）\nFor 3 items: the source link, a suggested reply (<=280 chars, adds real value, NOT salesy, no links unless the post already has one). Include one line on why this earns engagement.\n\n## 原创推文草稿（3 条）\nThree original posts (<=280 chars) that are useful on their own AND mention the product naturally at most once across all three. Vary angle: (1) pain point, (2) technical deep-dive, (3) honest benchmark/comparison.\n\n## 建议话题标签\n2-4 hashtags.`;

  const digest = await llm(system, user);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `digest-${today}.md`);
  fs.writeFileSync(out, `# X daily digest — ${today}\n\n> draft only — a human reviews & posts. Never auto-post.\n\n${digest}\n`, 'utf8');
  console.log('wrote ' + out);

  if (process.env.TG_TOKEN && process.env.TG_CHAT_ID) {
    await fetch(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TG_CHAT_ID, text: digest.slice(0, 3900) || '(empty)' , disable_web_page_preview: true }),
    }).then(() => console.log('delivered to Telegram')).catch((e) => console.log('tg deliver failed', e.message));
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
