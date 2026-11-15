from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from features import build_features, load_candles


def make_model():
    try:
        from lightgbm import LGBMRegressor

        return LGBMRegressor(
            n_estimators=300,
            learning_rate=0.03,
            num_leaves=31,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=-1,
        )
    except ImportError:
        from sklearn.ensemble import HistGradientBoostingRegressor

        return HistGradientBoostingRegressor(max_iter=300, learning_rate=0.03, random_state=42)


def metrics(prediction: np.ndarray, target: np.ndarray, position: np.ndarray, horizon: int, cost_per_trade: float) -> dict:
    pnl = position * target - np.abs(position) * cost_per_trade
    equity = np.cumsum(pnl)
    peak = np.maximum.accumulate(equity)
    drawdown = equity - peak
    tradable = np.abs(position) > 0
    return {
        "ic": float(np.corrcoef(prediction, target)[0, 1]) if len(prediction) > 2 else None,
        "hit_rate": float(np.mean(np.sign(prediction[tradable]) == np.sign(target[tradable]))) if tradable.any() else None,
        "trades": int(tradable.sum()),
        "total_return": float(pnl.sum()),
        "sharpe": float(np.mean(pnl) / np.std(pnl) * np.sqrt(365 * 24 * 60 / horizon)) if np.std(pnl) > 0 else None,
        "max_drawdown": float(drawdown.min()),
        "avg_prediction": float(prediction.mean()),
        "avg_target": float(target.mean()),
    }


def walk_forward(
    frame: pd.DataFrame,
    feature_columns: list[str],
    horizon: int,
    train_size: int,
    test_size: int,
    fee_bps: float,
    slippage_bps: float,
) -> tuple[dict, pd.DataFrame, pd.Series]:
    cost_per_trade = ((fee_bps + slippage_bps) / 10_000) * 2
    predictions: list[pd.DataFrame] = []
    importances = pd.Series(dtype=float)
    start = train_size
    fold = 0

    while start < len(frame) - horizon:
        end = min(start + test_size, len(frame) - horizon)
        train = frame.iloc[max(0, start - train_size) : start - horizon]
        test = frame.iloc[start:end]
        if len(train) < 500 or len(test) < 10:
            break
        model = make_model()
        model.fit(train[feature_columns], train["target"])
        prediction = model.predict(test[feature_columns])
        selected = test.iloc[::horizon].copy()
        selected_prediction = prediction[::horizon]
        selected["prediction"] = selected_prediction
        selected["position"] = np.where(
            selected_prediction > cost_per_trade,
            1.0,
            np.where(selected_prediction < -cost_per_trade, -1.0, 0.0),
        )
        selected["pnl"] = selected["position"] * selected["target"] - np.abs(selected["position"]) * cost_per_trade
        selected["fold"] = fold
        if "ret_5" in test:
            selected["ret_5"] = test["ret_5"].iloc[::horizon].to_numpy()
        columns = ["timestamp", "close", "target", "prediction", "position", "pnl", "fold"]
        if "ret_5" in selected:
            columns.append("ret_5")
        predictions.append(selected[columns])
        if hasattr(model, "feature_importances_"):
            importances = pd.Series(model.feature_importances_, index=feature_columns)
        fold += 1
        start = end

    if not predictions:
        raise SystemExit("Not enough rows for walk-forward. Fetch more data or lower --train-size/--test-size.")

    out = pd.concat(predictions, ignore_index=True)
    reported = metrics(
        out["prediction"].to_numpy(),
        out["target"].to_numpy(),
        out["position"].to_numpy(),
        horizon,
        cost_per_trade,
    )

    momentum_position = np.sign(out["ret_5"].to_numpy()) if "ret_5" in out else np.zeros(len(out))
    baseline = metrics(
        out["ret_5"].to_numpy() if "ret_5" in out else np.zeros(len(out)),
        out["target"].to_numpy(),
        momentum_position,
        horizon,
        cost_per_trade,
    )
    report = {
        "rows": int(len(frame)),
        "folds": int(out["fold"].nunique()),
        "train_size": train_size,
        "test_size": test_size,
        "horizon": horizon,
        "cost_per_trade": cost_per_trade,
        "model": reported,
        "momentum_baseline": baseline,
        "top_features": importances.sort_values(ascending=False).head(15).round(2).to_dict() if len(importances) else {},
    }
    return report, out, importances


def main() -> None:
    parser = argparse.ArgumentParser(description="Offline walk-forward PoC for HYPE. No live trading.")
    parser.add_argument("--data", required=True)
    parser.add_argument("--whales", default=None)
    parser.add_argument("--timesfm", action="store_true", help="Add TimesFM 2.5 zero-shot features.")
    parser.add_argument("--tfm-context", type=int, default=512)
    parser.add_argument("--tfm-horizon", type=int, default=12)
    parser.add_argument("--tfm-stride", type=int, default=15)
    parser.add_argument("--horizon", type=int, default=5)
    parser.add_argument("--train-size", type=int, default=8000)
    parser.add_argument("--test-size", type=int, default=2000)
    parser.add_argument("--fee-bps", type=float, default=4.5)
    parser.add_argument("--slippage-bps", type=float, default=2.0)
    parser.add_argument("--out", default="data/backtest")
    args = parser.parse_args()

    candles = load_candles(args.data)
    if args.timesfm:
        try:
            from timesfm_features import add_timesfm_features

            candles = add_timesfm_features(
                candles,
                context=args.tfm_context,
                horizon=args.tfm_horizon,
                stride=args.tfm_stride,
            )
            print("TimesFM features added.")
        except Exception as error:
            print(f"TimesFM unavailable, continuing without it: {error}")

    frame, feature_columns = build_features(candles, horizon=args.horizon, whale_csv=args.whales)
    report, predictions, _ = walk_forward(
        frame,
        feature_columns,
        horizon=args.horizon,
        train_size=args.train_size,
        test_size=args.test_size,
        fee_bps=args.fee_bps,
        slippage_bps=args.slippage_bps,
    )
    report["features"] = feature_columns

    output = Path(args.out)
    if not output.is_absolute():
        output = Path(__file__).resolve().parents[1] / output
    output.mkdir(parents=True, exist_ok=True)
    (output / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    predictions.to_csv(output / "predictions.csv", index=False)
    print(json.dumps(report, indent=2))
    print(f"wrote {output / 'report.json'} and {output / 'predictions.csv'}")


if __name__ == "__main__":
    main()
