#!/usr/bin/env node
/**
 * make-card.mjs — render an attractive branded card (1200x675 PNG) from text.
 *
 * Usage:
 *   node make-card.mjs --eyebrow "SHIPPED" --title "Persistent memory for Claude Code" \
 *        --sub "Your agent remembers decisions across sessions." --stat "96.0% R@5 · 0 LLM calls" \
 *        --out out/card.png
 *
 * Rendering: uses Playwright Chromium if available. On a fresh server run once:
 *   npm install && npx playwright install chromium
 *
 * Also can capture a screenshot of a live page instead of the card:
 *   node make-card.mjs --shot https://awareness.market --out out/shot.png
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };

const OUT = arg('out', path.join('out', 'card.png'));
const SHOT = arg('shot', null);
const eyebrow = arg('eyebrow', 'AI AGENT MEMORY');
const title = arg('title', 'Give your coding agent a memory');
const sub = arg('sub', 'Persistent memory across sessions for Claude Code, Cursor and multi-agent teams.');
const stat = arg('stat', '<b>96.0%</b> R@5 · zero LLM calls');

fs.mkdirSync(path.dirname(path.resolve(DIR, OUT)), { recursive: true });
const outPath = path.resolve(DIR, OUT);

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { console.error('Playwright not installed. Run: npm install && npx playwright install chromium'); process.exit(2); }

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 2 });
  if (SHOT) {
    await page.goto(SHOT, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 1200, height: 675 } });
  } else {
    const plainLen = String(title).replace(/<[^>]+>/g, '').length;
    const size = plainLen > 90 ? 44 : plainLen > 64 ? 52 : plainLen > 38 ? 62 : 72;
    const maxH = size * 3 + 20;
    let html = fs.readFileSync(path.join(DIR, 'card.html'), 'utf8')
      .replace('__EYEBROW__', esc(eyebrow))
      .replace('__TITLESIZE__', String(size))
      .replace('__TITLEMAXH__', String(maxH))
      .replace('__TITLE__', title) // title allows inline markup (e.g. <span class="hl">)
      .replace('__SUB__', esc(sub))
      .replace('__STAT__', stat); // stat allows <b>
    const tmp = path.join(DIR, 'out', '_card_tmp.html');
    fs.writeFileSync(tmp, html);
    await page.goto('file://' + tmp.replace(/\\/g, '/'), { waitUntil: 'load' });
    await page.waitForTimeout(900);
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 1200, height: 675 } });
    fs.unlinkSync(tmp);
  }
  console.log('wrote ' + outPath);
} finally { await browser.close(); }
