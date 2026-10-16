# LLM advisor slot — VelvetFlash 4B vs the incumbent (A/B findings)

**Question.** Can a self-hostable 4B crypto model (`Velvet-Capital/VelvetFlash`,
Qwen3-4B fine-tune, Apache-2.0) hold the BYO-LLM advisor slot in
`lib/trading/llm-advisor.ts` — the conservative reviewer that may only *veto* an
entry or *shrink* its size?

**Method.** `scripts/llm-advisor-ab.ts` runs both models on live Hyperliquid
signals computed by the agent's own code (`strategies.ts` + the agent's universe
filters), with the live account state, the same system prompt, and the same
validator (`parseProposal`). Only the model varies. Every run saves its rows —
signal, prompt, raw answers — so it can be replayed.

| Run | Batch | Signals | Agreement | Notes |
|---|---|:--:|:--:|---|
| `llm-advisor-ab.json` | marginal (score ≥ 0.2, gate off) | 4 | 4/4 | both `skip` everything |
| `llm-advisor-ab-strong-batch.json` | production bar | 1 | 1/1 | ARB: both `proceed` |
| `llm-advisor-ab-strong-batch-2.json` | production bar | 2 | 1/2 | ARB both `proceed`; **INJ: incumbent `proceed`, candidate `skip`** |
| `llm-advisor-ab-strong-batch-openrouter402.json` | production bar | 5 | n/a (candidate only) | incumbent unavailable — OpenRouter out of credits |

Windows where the local model could not respond at all are recorded too: at
`num_ctx=8192` its KV cache alone wants ~1.2 GB and CUDA-OOMs on an 8 GB laptop
GPU. The harness pins `num_ctx=2048` (the prompt is ~500 tokens).

**What the numbers say**

- **Format**: 9/9 valid JSON under the advisor contract. (In the *router* prompt
  it fell back to its native command format 5/7 times — it is trained on that
  shape. See `nl-router.ts`.)
- **Latency**: 0.4–0.8 s warm vs 1.6–6.8 s for the incumbent — 3–10× faster, and
  free once a GPU host exists.
- **Agreement**: 6/7. The one disagreement is the interesting one.
- **Reasoning quality**: the incumbent consistently uses the context it is given
  (equity, open positions, max positions) and lands on a *trim* — `sizeFactor`
  0.5 / 0.6. The 4B never trims: its `sizeFactor` is always 0.0 or 1.0, i.e. it
  only ever votes skip/proceed, which is the one thing this slot can already get
  from the deterministic signal. Its rationales also cite facts that are not in
  the prompt ("recent price action contradicts momentum_z") — invented text.
- **The disagreement**: INJ long, momentum z=2.57 (very strong), incumbent
  `proceed sizeFactor 0.6` ("neutral funding and no crowding … trim size"), local
  4B `skip` ("crowded signal with low funding rate; recent price action
  contradicts"). Both "crowded" and "price action" are unsupported by the input.

**Verdict.** Not a drop-in for the decision slot today: it does not do the
quantitative trim that makes this advisor worth calling, and it fabricates the
part of its rationale that sounds most confident. Its real strength — turning an
intent into a precise command under a documented skill — is what
`lib/trading/nl-router.ts` uses it for. Revisit if the authors ship a larger
model trained for the reviewer task; the harness is ready.

**Re-run**

```bash
# incumbent (platform channels) vs the local model
AB_CANDIDATE_URL=http://localhost:11435/api/chat AB_CANDIDATE_MODEL=velvetflash \
AB_UNIVERSE=30 AB_OUT=docs/trading/llm-advisor-ab-$(date +%F-%H%M).json \
  npx tsx -r dotenv/config scripts/llm-advisor-ab.ts
# useful overrides: AB_MIN_SCORE (default 0.45), AB_GATE=0, AB_INCUMBENT=openrouter
```
