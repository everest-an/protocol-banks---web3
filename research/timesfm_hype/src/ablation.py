from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

from backtest import walk_forward
from features import build_features, load_candles


def main() -> None:
    parser = argparse.ArgumentParser(description="Ablate price, TimesFM, whale and market features.")
    parser.add_argument("--data", required=True)
    parser.add_argument("--whales", default=None)
    parser.add_argument("--market", default=None)
    parser.add_argument("--timesfm", action="store_true")
    parser.add_argument("--tfm-data", default=None, help="Precomputed CSV with tfm_* columns.")
    parser.add_argument("--tfm-context", type=int, default=512)
    parser.add_argument("--tfm-horizon", type=int, default=12)
    parser.add_argument("--tfm-stride", type=int, default=15)
    parser.add_argument("--horizon", type=int, default=3)
    parser.add_argument("--train-size", type=int, default=3000)
    parser.add_argument("--test-size", type=int, default=1000)
    parser.add_argument("--fee-bps", type=float, default=4.5)
    parser.add_argument("--slippage-bps", type=float, default=2.0)
    parser.add_argument("--out", default="data/ablation.json")
    args = parser.parse_args()

    candles = load_candles(args.data)
    candles_tfm = candles
    if args.tfm_data:
        candles_tfm = pd.read_csv(args.tfm_data)
        candles_tfm["timestamp"] = pd.to_datetime(candles_tfm["timestamp"], utc=True)
        candles_tfm = candles_tfm.sort_values("timestamp").reset_index(drop=True)
        args.timesfm = True
    elif args.timesfm:
        try:
            from timesfm_features import add_timesfm_features

            candles_tfm = add_timesfm_features(
                candles,
                context=args.tfm_context,
                horizon=args.tfm_horizon,
                stride=args.tfm_stride,
            )
        except Exception as error:
            print(f"TimesFM unavailable; skipping its variants: {error}")
            args.timesfm = False

    variants: dict[str, tuple[pd.DataFrame, list[str]]] = {}
    variants["price"] = build_features(candles, horizon=args.horizon)
    if args.whales:
        variants["price_whales"] = build_features(candles, horizon=args.horizon, whale_csv=args.whales)
    if args.market:
        variants["price_market"] = build_features(candles, horizon=args.horizon, market_csv=args.market)
    if args.timesfm:
        variants["timesfm"] = build_features(candles_tfm, horizon=args.horizon)
        if args.whales:
            variants["timesfm_whales"] = build_features(
                candles_tfm, horizon=args.horizon, whale_csv=args.whales
            )
        if args.market:
            variants["timesfm_market"] = build_features(
                candles_tfm, horizon=args.horizon, market_csv=args.market
            )
        if args.whales and args.market:
            variants["all"] = build_features(
                candles_tfm, horizon=args.horizon, whale_csv=args.whales, market_csv=args.market
            )

    results: dict[str, object] = {}
    for name, (frame, columns) in variants.items():
        try:
            report, _, _ = walk_forward(
                frame,
                columns,
                horizon=args.horizon,
                train_size=args.train_size,
                test_size=args.test_size,
                fee_bps=args.fee_bps,
                slippage_bps=args.slippage_bps,
            )
            results[name] = report
            print(f"{name}: IC={report['model']['ic']} return={report['model']['total_return']}")
        except Exception as error:
            results[name] = {"error": str(error)}
            print(f"{name}: failed: {error}")

    output = Path(args.out)
    if not output.is_absolute():
        output = Path(__file__).resolve().parents[1] / output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"wrote {output}")


if __name__ == "__main__":
    main()
