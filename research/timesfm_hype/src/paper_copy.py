from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from copy_backtest import load_candles, wallet_signal


def select_wallets(positions: pd.DataFrame, behavior_path: str | None, label: str) -> list[str]:
    wallets = sorted(positions["wallet"].dropna().unique())
    if behavior_path and Path(behavior_path).exists():
        behavior = json.loads(Path(behavior_path).read_text(encoding="utf-8"))
        wanted = {
            item["wallet"]
            for item in behavior.get("wallets", [])
            if item.get("behavior") == label
        }
        if wanted:
            wallets = [wallet for wallet in wallets if wallet in wanted]
    return wallets


def simulate(
    candles: pd.DataFrame,
    signal: pd.Series,
    fee_bps: float,
    slippage_bps: float,
    max_position_usd: float,
    horizon: int,
    starting_cash: float,
) -> tuple[list[dict], pd.DataFrame]:
    fee = fee_bps / 10_000
    slip = slippage_bps / 10_000
    cash = starting_cash
    position = 0
    entry_price = 0.0
    entry_time = None
    entry_index = 0
    entry_notional = 0.0
    trades: list[dict] = []
    equity_rows: list[dict] = []

    def close_position(index: int, reason: str) -> None:
        nonlocal cash, position, entry_price, entry_time, entry_index, entry_notional
        price = float(candles["close"].iloc[index])
        exit_price = price * (1 - slip) if position > 0 else price * (1 + slip)
        gross = position * entry_notional * (exit_price - entry_price) / entry_price
        exit_fee = abs(position) * entry_notional * fee
        net = gross - exit_fee
        cash += net
        trades.append({
            "entry_time": entry_time,
            "exit_time": candles["timestamp"].iloc[index].isoformat(),
            "side": "long" if position > 0 else "short",
            "entry_price": round(entry_price, 6),
            "exit_price": round(exit_price, 6),
            "notional_usd": round(entry_notional, 2),
            "gross_pnl": round(gross, 2),
            "fees": round(exit_fee, 2),
            "net_pnl": round(net, 2),
            "bars_held": index - entry_index,
            "exit_reason": reason,
        })
        position = 0
        entry_price = 0.0
        entry_time = None
        entry_index = 0
        entry_notional = 0.0

    for index in range(len(candles)):
        current_signal = int(signal.iloc[index])
        price = float(candles["close"].iloc[index])
        closed_this_bar = False

        if position != 0:
            held = index - entry_index
            time_exit = horizon > 0 and held >= horizon
            if current_signal != position or current_signal == 0 or time_exit:
                reason = "signal_flip" if current_signal != position else "time_exit"
                close_position(index, reason)
                closed_this_bar = True

        if position == 0 and current_signal != 0 and not closed_this_bar:
            entry_notional = min(max_position_usd, max(0.0, cash) * 0.95)
            if entry_notional < 1:
                equity_rows.append({
                    "timestamp": candles["timestamp"].iloc[index].isoformat(),
                    "price": round(price, 6),
                    "signal": current_signal,
                    "position": 0,
                    "cash": round(cash, 2),
                    "unrealized": 0.0,
                    "equity": round(cash, 2),
                })
                continue
            position = current_signal
            entry_index = index
            entry_time = candles["timestamp"].iloc[index].isoformat()
            entry_price = price * (1 + slip) if position > 0 else price * (1 - slip)
            cash -= entry_notional * fee

        unrealized = 0.0
        if position != 0:
            unrealized = position * entry_notional * (price - entry_price) / entry_price
        equity_rows.append({
            "timestamp": candles["timestamp"].iloc[index].isoformat(),
            "price": round(price, 6),
            "signal": current_signal,
            "position": position,
            "cash": round(cash, 2),
            "unrealized": round(unrealized, 2),
            "equity": round(cash + unrealized, 2),
        })

    if position != 0:
        close_position(len(candles) - 1, "end_of_data")
        equity_rows[-1]["cash"] = round(cash, 2)
        equity_rows[-1]["equity"] = round(cash, 2)

    return trades, pd.DataFrame(equity_rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Replay a whale copy strategy as a paper portfolio.")
    parser.add_argument("--candles", required=True)
    parser.add_argument("--positions", required=True)
    parser.add_argument("--behavior", default=None)
    parser.add_argument("--label", default="directional_candidate")
    parser.add_argument("--wallet", default=None)
    parser.add_argument("--coin", default="HYPE")
    parser.add_argument("--mode", choices=["level", "change"], default="level")
    parser.add_argument("--lag", type=int, default=1)
    parser.add_argument("--horizon", type=int, default=0, help="0 means hold until the signal flips.")
    parser.add_argument("--fee-bps", type=float, default=4.5)
    parser.add_argument("--slippage-bps", type=float, default=2.0)
    parser.add_argument("--max-position-usd", type=float, default=10_000)
    parser.add_argument("--starting-cash", type=float, default=10_000)
    parser.add_argument("--out-dir", default="data/paper")
    args = parser.parse_args()

    candles = load_candles(args.candles)
    positions = pd.read_csv(args.positions)
    positions["timestamp"] = pd.to_datetime(positions["timestamp"], utc=True)
    positions["position_value"] = pd.to_numeric(positions["position_value"], errors="coerce").fillna(0.0)

    wallets = select_wallets(positions, args.behavior, args.label)
    if args.wallet:
        wallets = [wallet for wallet in wallets if wallet == args.wallet]
    signals = [
        wallet_signal(
            positions[positions["wallet"] == wallet],
            candles,
            args.coin,
            args.mode,
            args.lag,
            10_000,
        )
        for wallet in wallets
    ]
    consensus = pd.concat(signals, axis=1).mean(axis=1) if signals else pd.Series(0.0, index=candles.index)
    signal = pd.Series(np.where(consensus.abs() >= 0.5, np.sign(consensus), 0.0), index=candles.index)

    trades, equity = simulate(
        candles,
        signal,
        args.fee_bps,
        args.slippage_bps,
        args.max_position_usd,
        args.horizon,
        args.starting_cash,
    )

    output = Path(args.out_dir)
    if not output.is_absolute():
        output = Path(__file__).resolve().parents[1] / output
    output.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(trades).to_csv(output / "paper_trades.csv", index=False)
    equity.to_csv(output / "paper_equity.csv", index=False)

    returns = equity["equity"].pct_change().dropna()
    interval = candles["timestamp"].diff().median()
    periods_per_year = 365 * 24 * 3600 / max(1.0, interval.total_seconds())
    report = {
        "wallets": len(wallets),
        "coin": args.coin,
        "mode": args.mode,
        "lag_bars": args.lag,
        "horizon_bars": args.horizon,
        "trades": len(trades),
        "starting_cash": args.starting_cash,
        "ending_equity": round(float(equity["equity"].iloc[-1]), 2) if len(equity) else args.starting_cash,
        "total_return": round(float(equity["equity"].iloc[-1] / args.starting_cash - 1), 6) if len(equity) else 0,
        "max_drawdown": round(float((equity["equity"] - equity["equity"].cummax()).min()), 2) if len(equity) else 0,
        "win_rate": round(float((pd.DataFrame(trades)["net_pnl"] > 0).mean()), 4) if trades else None,
        "sharpe": round(float(returns.mean() / returns.std() * np.sqrt(periods_per_year)), 3) if len(returns) and returns.std() > 0 else None,
        "note": "Paper replay only. No orders, no wallet, no exchange execution.",
    }
    (output / "paper_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"wrote {output}")


if __name__ == "__main__":
    main()
