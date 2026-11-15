# TimesFM + whale flow + LightGBM: HYPE research PoC

Offline research only. This does **not** place orders, touch wallets, or call the Protocol Bank trading engine.

It answers one narrow question: can a general time-series foundation model plus Hyperliquid flow features
beat simple baselines after realistic costs on HYPE?

## What it does

1. Fetches HYPE 1m candles and funding from Hyperliquid.
2. Optionally adds zero-shot TimesFM 2.5 forecast features.
3. Optionally aggregates large Hyperliquid trades (whale prints) into 5/15/60 minute flow features.
4. Builds a LightGBM meta-model and evaluates it with purged walk-forward folds.
5. Compares against a momentum baseline and reports IC, hit rate, Sharpe, drawdown and costs.

TimesFM is a **feature generator**, not the trading policy. The LightGBM model decides the position;
the backtest applies fees and slippage.

## Setup

Requires Python 3.11/3.12 and `uv`.

```bash
cd research/timesfm_hype
uv sync
```

TimesFM is optional and heavy:

```bash
uv sync --extra timesfm
```

TimesFM 2.5 weights are Apache-2.0. TimesFM 3.0 self-hosted weights are non-commercial; do not swap the
checkpoint in a commercial deployment without reviewing the license. Commercial 3.0 use goes through
BigQuery ML.

## 1. Fetch HYPE data

```bash
uv run python src/fetch_data.py --coin HYPE --interval 5m --days 30 --out data/hype_5m.csv
```

Writes `data/hype_5m.csv` with OHLCV, trade count and hourly funding forward-filled.

Hyperliquid's public candle endpoint returns at most roughly 5,000 candles per interval. In practice
1m covers only the most recent ~3.5 days, 5m covers ~17 days. Use a coarser interval or collect forward
for a longer study.

## 2. Collect whale prints (forward only)

Public Hyperliquid history does not expose a long archive of every trade. To get real whale flow, record
it going forward:

```bash
uv run python src/collect_whales.py --coin HYPE --min-notional 50000
```

Writes `data/whales.csv` with timestamp, side, notional, buyer and seller. `notional >= 50,000` is only a
starting definition; validate it. A large print can be a market maker hedge, not alpha.

## 3. Backtest

Without TimesFM or whales:

```bash
uv run python src/backtest.py \
  --data data/hype_5m.csv \
  --horizon 3 \
  --train-size 3000 \
  --test-size 1000 \
  --fee-bps 4.5 \
  --slippage-bps 2
```

With whale features:

```bash
uv run python src/backtest.py --data data/hype_5m.csv --whales data/whales.csv --horizon 3 --train-size 3000 --test-size 1000
```

With TimesFM 2.5 zero-shot features:

```bash
uv run python src/backtest.py --data data/hype_5m.csv --timesfm --tfm-stride 15 --horizon 3 --train-size 3000 --test-size 1000
```

Outputs `data/backtest/report.json` and `data/backtest/predictions.csv`.

## First run

A 5m HYPE sample (5,035 candles, 2 folds) with TimesFM 2.5 features produced IC ~0.035 and hit rate
~53%, but **lost money after 13 bps round-trip costs**. That is not evidence of an edge; it is the reason
the harness exists. Extend the sample, add whale/order-book features, and only then decide whether to
continue.

## How to read the result

- `model.ic`: prediction/target correlation. Near zero means no directional signal.
- `model.hit_rate`: sign accuracy on traded rows.
- `model.sharpe`: annualized from the selected horizon; overlapping labels are sampled every `horizon`.
- `model.max_drawdown`: cumulative PnL drawdown.
- `momentum_baseline`: if the model does not beat this after costs, it has no case.
- `top_features`: useful for sanity, not for causal claims.

## Known limitations

- **No historical whale archive**: `collect_whales.py` records forward from when you start it.
- **No historical order book**: Hyperliquid exposes current L2, not a long L2 archive.
- **Funding only**: historical OI is not in the candle endpoint; OI must be collected forward.
- **Single venue**: HYPE price discovery may lead/follow other venues; add cross-venue features separately.
- **No execution model**: fixed bps costs, no queue position, latency, impact or funding over the hold.
- **TimesFM pretraining is general**, not crypto microstructure. Zero-shot is the right first test; a
  LoRA fine-tune on a few thousand HYPE bars is an overfitting risk.
- **No guarantee**: this is a research harness, not an investment strategy.

## Next experiments

1. Beat the momentum baseline on 5m and 15m horizons after costs.
2. Ablate: price-only vs +whales vs +TimesFM.
3. Add cross-venue lead-lag, OI changes, liquidations and order-book imbalance.
4. Only after a stable walk-forward edge: paper-trade, then a small live budget under the existing risk
   engine. Never let the model bypass the mandate or withdrawal rules.
