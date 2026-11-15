from __future__ import annotations

import argparse
import csv
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HL_INFO = "https://api.hyperliquid.xyz/info"


def post_info(payload: dict[str, Any]) -> Any:
    response = requests.post(HL_INFO, json=payload, timeout=10)
    response.raise_for_status()
    return response.json()


def hyperliquid(coin: str) -> dict[str, Any]:
    meta, contexts = post_info({"type": "metaAndAssetCtxs"})
    universe = meta["universe"]
    index = next((i for i, asset in enumerate(universe) if asset["name"] == coin), None)
    if index is None:
        raise RuntimeError(f"{coin} not in Hyperliquid universe")
    ctx = contexts[index]
    book = post_info({"type": "l2Book", "coin": coin})
    bids = book.get("levels", [[], []])[0]
    asks = book.get("levels", [[], []])[1]

    def depth(levels: list[dict[str, Any]], count: int) -> float:
        return sum(float(level["px"]) * float(level["sz"]) for level in levels[:count])

    bid5, ask5 = depth(bids, 5), depth(asks, 5)
    bid20, ask20 = depth(bids, 20), depth(asks, 20)
    best_bid = float(bids[0]["px"]) if bids else None
    best_ask = float(asks[0]["px"]) if asks else None
    mid = (best_bid + best_ask) / 2 if best_bid and best_ask else None

    return {
        "hl_mark": float(ctx["markPx"]),
        "hl_mid": mid,
        "hl_oracle": float(ctx["oraclePx"]),
        "hl_funding": float(ctx["funding"]),
        "hl_open_interest": float(ctx["openInterest"]),
        "hl_day_volume": float(ctx["dayNtlVlm"]),
        "hl_premium": float(ctx["premium"]) if ctx.get("premium") is not None else None,
        "hl_best_bid": best_bid,
        "hl_best_ask": best_ask,
        "hl_spread_bps": ((best_ask - best_bid) / mid * 10_000) if mid else None,
        "hl_bid_depth_5": bid5,
        "hl_ask_depth_5": ask5,
        "hl_imbalance_5": (bid5 - ask5) / (bid5 + ask5) if bid5 + ask5 else None,
        "hl_bid_depth_20": bid20,
        "hl_ask_depth_20": ask20,
        "hl_imbalance_20": (bid20 - ask20) / (bid20 + ask20) if bid20 + ask20 else None,
    }


def binance() -> dict[str, Any]:
    response = requests.get(
        "https://api.binance.com/api/v3/ticker/bookTicker",
        params={"symbol": "HYPEUSDT"},
        timeout=10,
    )
    response.raise_for_status()
    body = response.json()
    bid, ask = float(body["bidPrice"]), float(body["askPrice"])
    return {"binance_mid": (bid + ask) / 2, "binance_spread_bps": (ask - bid) / ((ask + bid) / 2) * 10_000}


def bybit() -> dict[str, Any]:
    response = requests.get(
        "https://api.bybit.com/v5/market/tickers",
        params={"category": "linear", "symbol": "HYPEUSDT"},
        timeout=10,
    )
    response.raise_for_status()
    item = response.json()["result"]["list"][0]
    return {
        "bybit_mid": float(item["lastPrice"]),
        "bybit_mark": float(item["markPrice"]),
        "bybit_index": float(item["indexPrice"]),
        "bybit_open_interest": float(item["openInterest"]),
        "bybit_funding": float(item["fundingRate"]),
        "bybit_turnover_24h": float(item["turnover24h"]),
    }


def okx() -> dict[str, Any]:
    response = requests.get(
        "https://www.okx.com/api/v5/market/ticker",
        params={"instId": "HYPE-USDT-SWAP"},
        timeout=10,
    )
    response.raise_for_status()
    item = response.json()["data"][0]
    return {"okx_mid": (float(item["bidPx"]) + float(item["askPx"])) / 2}


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect HYPE OI, L2 book and cross-venue mids.")
    parser.add_argument("--coin", default="HYPE")
    parser.add_argument("--interval", type=float, default=5.0)
    parser.add_argument("--iterations", type=int, default=0, help="0 means run until interrupted.")
    parser.add_argument("--out", default="data/market.csv")
    parser.add_argument("--no-cross-venue", action="store_true")
    args = parser.parse_args()

    output = Path(args.out)
    if not output.is_absolute():
        output = Path(__file__).resolve().parents[1] / output
    output.parent.mkdir(parents=True, exist_ok=True)
    new_file = not output.exists()
    handle = output.open("a", newline="", encoding="utf-8")
    writer = csv.writer(handle)
    columns = [
        "timestamp", "hl_mark", "hl_mid", "hl_oracle", "hl_funding", "hl_open_interest",
        "hl_day_volume", "hl_premium", "hl_best_bid", "hl_best_ask", "hl_spread_bps",
        "hl_bid_depth_5", "hl_ask_depth_5", "hl_imbalance_5", "hl_bid_depth_20",
        "hl_ask_depth_20", "hl_imbalance_20", "binance_mid", "binance_spread_bps",
        "bybit_mid", "bybit_mark", "bybit_index", "bybit_open_interest", "bybit_funding",
        "bybit_turnover_24h", "okx_mid",
    ]
    if new_file:
        writer.writerow(columns)
        handle.flush()

    print(f"collecting {args.coin} every {args.interval}s to {output}")
    iterations = 0
    while args.iterations <= 0 or iterations < args.iterations:
        iterations += 1
        row: dict[str, Any] = {"timestamp": datetime.now(timezone.utc).isoformat()}
        try:
            row.update(hyperliquid(args.coin))
        except Exception as error:
            print(f"hyperliquid error: {error}")
        if not args.no_cross_venue:
            for name, fetch in (("binance", binance), ("bybit", bybit), ("okx", okx)):
                try:
                    row.update(fetch())
                except Exception as error:
                    print(f"{name} error: {error}")
        writer.writerow([row.get(column) for column in columns])
        handle.flush()
        print(" ".join(f"{column}={row.get(column)}" for column in ["hl_mid", "hl_imbalance_5", "bybit_mid", "okx_mid"]))
        try:
            time.sleep(max(1.0, args.interval))
        except KeyboardInterrupt:
            break
    handle.close()


if __name__ == "__main__":
    main()
