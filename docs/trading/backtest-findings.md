# Strategy backtest — does the shipped strategy make money?

**Answer: no, not on 120 days of out-of-sample hourly data.** Every variant tested
loses after costs, including the long-only variant in a market where BTC rose 33%.
This is the most important finding for how the product may be marketed.

## Method

`scripts/backtest.ts` replays the strategy the agent actually ships on raw
Hyperliquid 1h candles + funding history, using the production code for signals
(`strategies.ts`), sizing and exits (`risk.ts`):

- signals: `momentumZ(24)` + funding, 60/40 mix
- entries: |score| ≥ entryThreshold, ranked, max 3 concurrent
- exits: TP/SL act on PnL vs **allocated margin** (`pnlPct`), so 2.5% at 2x = a 1.25% price move
- costs: 0.04% taker both sides, 0.05% slippage both sides, hourly funding
- daily breakers: stop at 5%, kill at 8%

Same 120-day window, 12 liquid coins, $1,000 start. "Pessimistic" assumes the stop
filled first when both bands were touched inside one hourly bar; "optimistic"
assumes the target did. The truth needs finer data — both bounds are reported.

## Results

| variant | return | max DD | trades | win rate | profit factor | expectancy/trade | fees |
|---|---:|---:|---:|---:|---:|---:|---:|
| shipped (pessimistic) | **−28.0%** | 29.7% | 1117 | 46.8% | 0.72 | −$0.251 | $111 |
| shipped (optimistic) | **−5.2%** | 5.6% | 215 | 47.9% | 0.76 | −$0.243 | $25 |
| entry 0.55, bands 5% | −11.0% | 15.9% | 361 | 46.3% | 0.82 | −$0.303 | $39 |
| entry 0.55, bands 2.5% | −20.4% | 21.6% | 756 | 46.8% | 0.72 | −$0.270 | $80 |
| long-only, shipped | −12.8% | 13.9% | 548 | 48.5% | 0.77 | −$0.233 | $63 |
| **benchmark: BTC buy & hold** | **+33.4%** | — | — | — | — | — | — |

## What the numbers say

1. **The signal has no edge at this horizon.** 46–48% win rate with a payoff below
   1:1 is structurally negative; raising the entry bar or widening the bands changes
   the magnitude, not the sign.
2. **Long-only loses in a +33% market.** That is not a short-side problem — entries
   are systematically late (buying after momentum has already moved), then stop out
   on the 1.25% band.
3. **Costs are a first-order term.** 1117 round trips cost $111 on a $1,000
   account — 11% of capital in 120 days. At this turnover, fees alone ≈ the loss in
   the optimistic bound.
4. **Concentration is not the issue.** 12 coins, 3 concurrent positions, daily
   breakers on: drawdowns are controlled, returns are just negative.

## Limits of this test (honest)

- Hourly bars; intrabar path is unknown (both bounds reported).
- No order-book/queue modelling; slippage is a flat 0.05%.
- One regime (a rising market). A 2022-style window is not represented.
- Universe is today's liquid 12 — survivorship bias in the coins, not in the PnL.
- The advisor veto is not replayed (it can only remove trades, so it would not
  turn this positive).

## Consequence for the product

Do not market returns. The defensible claims are the ones the product actually
guarantees: **the AI cannot withdraw, the worst case is the budget, every trade is
public and revocable**. Selling "profit" on this strategy would be false, and the
users it attracts would churn at the first drawdown.

Before any profit claim, the strategy needs an edge demonstrated on a second,
out-of-sample window (and a bear regime) — the harness is here to test candidates.

## Candidate strategies (same harness, same costs, 12 coins)

Two 60-day windows, so a candidate has to be positive in **both** to count
(`scripts/backtest-candidates.ts`).

| strategy | last 60d (BTC +1.0%) | previous 60d (BTC +32.7%) | verdict |
|---|---:|---:|---|
| EMA50/200 cross + 3×ATR trail | −4.16% (PF 0.70) | −4.76% (PF 0.61) | rejected |
| the same, long-only | −2.67% (PF 0.62) | +0.71% (PF 1.12) | rejected — fails the other window |
| funding carry (enter > 0.003%/h, exit < 0.001%/h) | −5.74% (PF 0.76) | −2.48% (PF 0.36) | rejected |

None of the tested rules clears costs with any margin. The single positive cell is
+0.71% over 44 trades — inside noise, and it does not repeat in the other window.

This says the problem is not the parameter choice: the entry timing has no edge at
these horizons. Finding one needs a real research process (longer history across a
bear regime, walk-forward cross-validation), not more knobs.

## Re-run

```bash
BT_DAYS=120 BT_QUIET=1 npx tsx scripts/backtest.ts
BT_DAYS=120 BT_QUIET=1 BT_OPTIMISTIC=1 npx tsx scripts/backtest.ts
BT_DAYS=120 BT_RISK_JSON='{"entryThreshold":0.55,"takeProfitPct":0.05,"stopLossPct":0.05}' npx tsx scripts/backtest.ts
BT_DAYS=120 BT_SIDE=long npx tsx scripts/backtest.ts
```
