from __future__ import annotations

import argparse
import time
from pathlib import Path
from typing import Any

import pandas as pd
import requests

INFO_URL = "https://api.hyperliquid.xyz/info"
INTERVAL_MS = {
    "1m": 60_000,
    "3m": 180_000,
    "5m": 300_000,
    "15m": 900_000,
    "30m": 1_800_000,
    "1h": 3_600_000,
    "4h": 14_400_000,
    "1d": 86_400_000,
}


def info(payload: dict[str, Any]) -> Any:
    response = requests.post(INFO_URL, json=payload, timeout=30)
    response.raise_for_status()
    return response.json()


def fetch_candles(coin: str, interval: str, start_ms: int, end_ms: int) -> pd.DataFrame:
    step = INTERVAL_MS[interval] * 4_500
    rows: list[dict[str, Any]] = []
    cursor = start_ms
    while cursor < end_ms:
        chunk_end = min(cursor + step, end_ms)
        data = info({
            "type": "candleSnapshot",
            "req": {
                "coin": coin,
                "interval": interval,
                "startTime": cursor,
                "endTime": chunk_end,
            },
        })
        if not data:
            cursor = chunk_end + 1
            continue
        rows.extend(data)
        last = max(int(row["t"]) for row in data)
        if last <= cursor:
            break
        cursor = last + 1
        time.sleep(0.08)
    if not rows:
        return pd.DataFrame()
    frame = pd.DataFrame(rows)
    frame = frame.drop_duplicates(subset=["t"]).sort_values("t").reset_index(drop=True)
    frame["timestamp"] = pd.to_datetime(frame["t"], unit="ms", utc=True)
    for column in ["o", "h", "l", "c", "v", "n"]:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    return frame[["timestamp", "o", "h", "l", "c", "v", "n"]].rename(
        columns={"o": "open", "h": "high", "l": "low", "c": "close", "v": "volume", "n": "trades"}
    )


def fetch_funding(coin: str, start_ms: int, end_ms: int) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    cursor = start_ms
    step = 30 * 24 * 60 * 60 * 1000
    while cursor < end_ms:
        chunk_end = min(cursor + step, end_ms)
        data = info({
            "type": "fundingHistory",
            "coin": coin,
            "startTime": cursor,
            "endTime": chunk_end,
        })
        if not data:
            cursor = chunk_end + 1
            continue
        rows.extend(data)
        last = max(int(row["time"]) for row in data)
        if last <= cursor:
            break
        cursor = last + 1
        time.sleep(0.08)
    if not rows:
        return pd.DataFrame(columns=["timestamp", "funding"])
    frame = pd.DataFrame(rows).drop_duplicates(subset=["time"]).sort_values("time")
    frame["timestamp"] = pd.to_datetime(frame["time"], unit="ms", utc=True)
    frame["funding"] = pd.to_numeric(frame["fundingRate"], errors="coerce")
    return frame[["timestamp", "funding"]]


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch HYPE candles and funding from Hyperliquid.")
    parser.add_argument("--coin", default="HYPE")
    parser.add_argument("--interval", default="1m", choices=sorted(INTERVAL_MS))
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--out", default="data/hype_1m.csv")
    parser.add_argument("--no-funding", action="store_true")
    args = parser.parse_args()

    end = int(time.time() * 1000)
    start = end - args.days * 86_400_000
    candles = fetch_candles(args.coin, args.interval, start, end)
    if candles.empty:
        raise SystemExit("No candles returned. Check the coin and interval.")

    if not args.no_funding:
        funding = fetch_funding(args.coin, start, end)
        if not funding.empty:
            candles = pd.merge_asof(candles, funding, on="timestamp", direction="backward")
        else:
            candles["funding"] = 0.0
    else:
        candles["funding"] = 0.0

    output = Path(args.out)
    if not output.is_absolute():
        output = Path(__file__).resolve().parents[1] / output
    output.parent.mkdir(parents=True, exist_ok=True)
    candles.to_csv(output, index=False)
    print(f"wrote {len(candles):,} rows to {output}")
    print(f"range: {candles['timestamp'].min()} -> {candles['timestamp'].max()}")


if __name__ == "__main__":
    main()
