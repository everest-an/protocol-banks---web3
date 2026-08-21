# Launch & Growth Playbook — 100 Users

Target: ~100 first users. Technical GEO foundations are live (llms.txt,
llms-full.txt, sitemap, JSON-LD, FAQPage schema). This playbook covers the
distribution actions only you can do — copy is ready to paste.

---

## 1. Product Hunt launch (highest ROI)

**When:** pick a Tuesday/Wednesday morning US time.
**Title:** Protocol Bank — Your AI trades. You keep control.
**Tagline:** An AI agent trades Hyperliquid perpetuals for you — with the
maximum loss written on the screen, and zero withdrawal rights for the AI.
**Maker comment (first comment):**

> Hey Product Hunt! I built Protocol Bank because trading takes time most
> people don't have, and "AI trading bots" are usually black boxes.
>
> What it does: connect MetaMask, set a trading budget on Hyperliquid, approve
> a trading-only agent wallet, and the AI trades momentum + funding-carry
> signals 24/7. Every trade is explained in plain language. The agent can
> NEVER withdraw — worst case is the budget you chose.
>
> Paper mode runs on real market data with simulated money — try it with
> zero risk at protocolbanks.com.
>
> Happy to answer anything about the strategy, the risk controls, or the
> Hyperliquid agent architecture.

**Topics:** AI, Fintech, Crypto, Trading.

---

## 2. X (Twitter) thread

**Tweet 1:**
Trading bots are black boxes. I built one that isn't.

Every trade is explained in plain language. The AI can trade but never
withdraw. The maximum loss is printed on the screen.

Try it free (paper mode, real markets): protocolbanks.com

**Tweet 2:**
How Protocol Bank keeps you safe while an AI trades your funds:

1/ Agent wallet = trading-only permissions on Hyperliquid
2/ Per-trade stop-loss ±2.5%, max 3 positions
3/ Daily loss circuit breaker (5% stop, 8% close all)
4/ One-click pause, emergency stop, on-chain revoke

**Tweet 3:**
The strategy is boring math, not magic:
→ 24h momentum z-score (risk-adjusted trend)
→ funding-rate carry
→ executed on the 12 most liquid Hyperliquid perps

Boring is the point. Read the whitepaper: protocolbanks.com

**Tweet 4 (CTA):**
Watch an AI trade real markets with fake money right now:
→ protocolbanks.com
→ "Try Paper Trading"
→ 3 minutes, zero risk

If it loses money, you've lost nothing. If it wins, you'll want live mode.

---

## 3. Reddit posts

**r/CryptoCurrency** (use "Trading" flair, be transparent):
Title: I built a non-custodial AI trading agent — the AI can trade but can never withdraw. Paper mode is free.

Body:
> Long-time lurker here. I've been burned by trading bots that promised
> the moon. So I built one with the opposite philosophy:
>
> - The AI holds a trading-only agent wallet on Hyperliquid. It physically
>   cannot withdraw funds.
> - Your trading budget = your maximum loss, shown on screen.
> - Every trade is logged in plain language with the reason.
> - Stop-losses and daily circuit breakers are enforced before orders.
>
> Paper mode uses real market data with simulated money — free to try.
> protocolbanks.com
>
> AMA about the architecture (SIWE auth, EIP-712 agent approval, strategy).

**r/defi / r/ethereum** (shorter, architecture-focused): highlight the
non-custodial agent design + Hyperliquid approveAgent flow.

---

## 4. AI-search (GEO) submission checklist

- [x] llms.txt + llms-full.txt live at protocolbanks.com
- [x] sitemap.xml + JSON-LD (WebSite + SoftwareApplication + FAQPage)
- [ ] Submit sitemap in Google Search Console (needs your Google login)
- [ ] List the site in the llmstxt.org directory (llmstxt.org/directory — submit form)
- [ ] Ping indexers: `https://api.indexnow.org/indexnow?url=https://protocolbanks.com&key=YOUR_KEY` (generate a key first)
- [ ] Bing Webmaster Tools: submit sitemap (free)

**GEO reality check:** AI engines cite pages with backlinks + engagement.
The single highest-leverage action is the Product Hunt launch + X thread —
those create the citations GPTs/Perplexity pull from.

---

## 5. Community & misc

- Crypto telegram/discord groups (share the paper-mode link with the
  "no withdrawal rights" hook — it's the differentiator)
- Warpcast / Farcaster: same thread as X, cast + recast circles
- Email signature: "My AI trades for me. It can't withdraw. protocolbanks.com"

---

## Honest numbers

- 100 users from cold GEO alone: unlikely. GEO gets you cited.
- Product Hunt front page: typically 300–1000 signups for a working crypto tool.
- X thread + Reddit: 20–100 each if the story lands.
- The hook that lands: **"the AI can never withdraw"** — lead with it everywhere.
