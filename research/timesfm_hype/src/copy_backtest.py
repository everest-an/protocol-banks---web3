from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd


def load_candles(path: str | Path) -> pd.DataFrame:
    frame = pd.read_csv(path)
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True)
    frame = frame.sort_values("timestamp").drop_duplicates("timestamp").reset_index(drop=True)
    frame["close"] = pd.to_numeric(frame["close"], errors="coerce")
    return frame[["timestamp", "close"]]


def wallet_signal(
    positions: pd.DataFrame,
    candles: pd.DataFrame,
    coin: str,
    mode: str,
    lag: int,
    min_delta_value: float,
) -> pd.Series:
    frame = positions[positions["coin"].astype(str).str.upper() == coin.upper()].copy()
    if frame.empty:
        return pd.Series(0.0, index=candles.index)
    frame["size"] = pd.to_numeric(frame["size"], errors="coerce").fillna(0.0)
    frame["signed_value"] = np.where(
        frame["side"] == "long",
        frame["position_value"].astype(float),
        -frame["position_value"].astype(float),
    )
    snapshot = frame.groupby("timestamp")["signed_value"].sum().sort_index().reset_index()
    merged = pd.merge_asof(
        candles[["timestamp"]].sort_values("timestamp"),
        snapshot.sort_values("timestamp"),
        on="timestamp",
        direction="backward",
    )
    exposure = merged["signed_value"].fillna(0.0)
    if mode == "change":
        delta = exposure.diff().fillna(exposure)
        signal = np.where(delta.abs() >= min_delta_value, np.sign(delta), 0.0)
    else:
        signal = np.sign(exposure)
    return pd.Series(signal, index=candles.index).shift(lag).fillna(0.0)


def metrics(signal: pd.Series, target: pd.Series, cost_per_trade: float, periods_per_year: float) -> dict:
    turnover = signal.diff().abs().fillna(signal.abs())
    pnl = signal * target - turnover * cost_per_trade
    equity = pnl.cumsum()
    peak = equity.cummax()
    drawdown = equity - peak
    traded = signal != 0
    return {
        "ic": float(signal.corr(target)) if signal.std() > 0 and target.std() > 0 else None,
        "hit_rate": float((np.sign(signal[traded]) == np.sign(target[traded])).mean()) if traded.any() else None,
        "trades": int(turnover.gt(0).sum()),
        "total_return": round(float(pnl.sum()), 6),
        "sharpe": round(float(pnl.mean() / pnl.std() * np.sqrt(periods_per_year)), 3) if pnl.std() > 0 else None,
        "max_drawdown": round(float(drawdown.min()), 6),
        "avg_exposure": round(float(signal.abs().mean()), 4),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Copy-signal research backtest. No live trading.")
    parser.add_argument("--candles", required=True)
    parser.add_argument("--positions", required=True)
    parser.add_argument("--behavior", default=None, help="Optional wallet_behavior.json filter.")
    parser.add_argument("--label", default="directional_candidate")
    parser.add_argument("--wallet", default=None, help="Only evaluate one address.")
    parser.add_argument("--coin", default="HYPE")
    parser.add_argument("--mode", choices=["level", "change"], default="level")
    parser.add_argument("--lag", type=int, default=1)
    parser.add_argument("--horizon", type=int, default=3)
    parser.add_argument("--min-delta-value", type=float, default=10_000)
    parser.add_argument("--fee-bps", type=float, default=4.5)
    parser.add_argument("--slippage-bps", type=float, default=2.0)
    parser.add_argument("--out", default="data/copy_backtest.json")
    args = parser.parse_args()

    candles = load_candles(args.candles)
    candles["target"] = np.log(candles["close"].shift(-args.horizon) / candles["close"])
    candles = candles.dropna(subset=["target"]).reset_index(drop=True)

    positions = pd.read_csv(args.positions)
    positions["timestamp"] = pd.to_datetime(positions["timestamp"], utc=True)
    positions["position_value"] = pd.to_numeric(positions["position_value"], errors="coerce").fillna(0.0)

    wallets = sorted(positions["wallet"].dropna().unique())
    if args.behavior and Path(args.behavior).exists():
        behavior = json.loads(Path(args.behavior).read_text(encoding="utf-8"))
        wanted = {
            item["wallet"]
            for item in behavior.get("wallets", [])
            if item.get("behavior") == args.label
        }
        if wanted:
            wallets = [wallet for wallet in wallets if wallet in wanted]
    if args.wallet:
        wallets = [wallet for wallet in wallets if wallet == args.wallet]

    cost_per_trade = ((args.fee_bps + args.slippage_bps) / 10_000) * 2
    interval = candles["timestamp"].diff().median()
    periods_per_year = 365 * 24 * 3600 / max(1.0, interval.total_seconds())
    per_wallet: dict[str, dict] = {}
    signals: list[pd.Series] = []

    for wallet in wallets:
        frame = positions[positions["wallet"] == wallet]
        signal = wallet_signal(frame, candles, args.coin, args.mode, args.lag, args.min_delta_value)
        per_wallet[wallet] = metrics(signal, candles["target"], cost_per_trade, periods_per_year)
        signals.append(signal)

    consensus = pd.concat(signals, axis=1).mean(axis=1) if signals else pd.Series(0.0, index=candles.index)
    consensus_signal = np.where(consensus.abs() >= 0.5, np.sign(consensus), 0.0)
    consensus_report = metrics(
        pd.Series(consensus_signal, index=candles.index),
        candles["target"],
        cost_per_trade,
        periods_per_year,
    )

    result = {
        "wallets": len(wallets),
        "coin": args.coin,
        "mode": args.mode,
        "lag_bars": args.lag,
        "horizon_bars": args.horizon,
        "cost_per_trade": cost_per_trade,
        "consensus": consensus_report,
        "per_wallet": per_wallet,
    }
    output = Path(args.out)
    if not output.is_absolute():
        output = Path(__file__).resolve().parents[1] / output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    print(f"wrote {output}")


if __name__ == "__main__":
    main()
