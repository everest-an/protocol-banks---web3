from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd


def read(path: str | None) -> pd.DataFrame | None:
    if not path:
        return None
    file = Path(path)
    if not file.exists():
        return None
    frame = pd.read_csv(file)
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True)
    return frame.sort_values("timestamp").reset_index(drop=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Check whether the HYPE research dataset is ready.")
    parser.add_argument("--candles", default="data/hype_5m.csv")
    parser.add_argument("--whales", default=None)
    parser.add_argument("--market", default=None)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    candles = read(args.candles)
    if candles is None or candles.empty:
        raise SystemExit(f"No candle data at {args.candles}")

    start, end = candles["timestamp"].min(), candles["timestamp"].max()
    coverage_days = (end - start).total_seconds() / 86_400
    interval = candles["timestamp"].diff().median()
    gaps = candles["timestamp"].diff() > interval * 2
    report: dict[str, object] = {
        "candles": {
            "rows": int(len(candles)),
            "first": str(start),
            "last": str(end),
            "coverage_days": round(coverage_days, 2),
            "median_interval_seconds": None if pd.isna(interval) else int(interval.total_seconds()),
            "gaps": int(gaps.sum()),
        }
    }

    warnings: list[str] = []
    if len(candles) < 5_000:
        warnings.append("fewer than 5,000 candles")
    if coverage_days < 14:
        warnings.append("less than 14 days of candles")

    whales = read(args.whales)
    if whales is not None:
        frequency = f"{max(1, int(interval.total_seconds() // 60))}min"
        minute = whales["timestamp"].dt.floor(frequency)
        candle_minutes = candles["timestamp"].dt.floor(frequency)
        overlap = minute.isin(candle_minutes).mean()
        report["whales"] = {
            "rows": int(len(whales)),
            "first": str(whales["timestamp"].min()),
            "last": str(whales["timestamp"].max()),
            "candle_overlap": round(float(overlap), 4),
            "notional_sum": round(float(pd.to_numeric(whales.get("notional"), errors="coerce").sum()), 2),
        }
        if overlap < 0.5:
            warnings.append("whale prints cover less than 50% of candle minutes")
    elif args.whales:
        warnings.append(f"whale file not found: {args.whales}")
    else:
        warnings.append("no whale file supplied")

    market = read(args.market)
    if market is not None:
        overlap = 0
        for column in ("hl_mid", "hl_open_interest", "hl_imbalance_5"):
            if column in market:
                overlap = max(overlap, 1 - float(market[column].isna().mean()))
        range_overlap = float(market["timestamp"].between(start, end).mean())
        report["market"] = {
            "rows": int(len(market)),
            "first": str(market["timestamp"].min()),
            "last": str(market["timestamp"].max()),
            "column_fill": round(float(overlap), 4),
            "candle_range_overlap": round(range_overlap, 4),
        }
        if overlap < 0.8:
            warnings.append("market columns are less than 80% filled")
    elif args.market:
        warnings.append(f"market file not found: {args.market}")
    else:
        warnings.append("no market file supplied")

    report["warnings"] = warnings
    report["ready_for_ablation"] = not warnings

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"candles: {report['candles']}")
        if "whales" in report:
            print(f"whales:  {report['whales']}")
        if "market" in report:
            print(f"market:  {report['market']}")
        print("ready:", "yes" if not warnings else "no")
        for warning in warnings:
            print(" -", warning)


if __name__ == "__main__":
    main()
