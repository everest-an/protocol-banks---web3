from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import requests

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

INFO_URL = "https://api.hyperliquid.xyz/info"
FIELDS = [
    "timestamp",
    "wallet",
    "account_value",
    "withdrawable",
    "coin",
    "side",
    "size",
    "entry_px",
    "position_value",
    "unrealized_pnl",
    "margin_used",
    "liquidation_px",
    "leverage",
    "cum_funding",
]


def info(payload: dict[str, Any]) -> Any:
    response = requests.post(INFO_URL, json=payload, timeout=10)
    response.raise_for_status()
    return response.json()


def discover(wallets: str | None, whales_path: str | None, top: int) -> list[str]:
    found: list[str] = []
    if wallets:
        found.extend(part.strip() for part in wallets.split(",") if part.strip())
    if whales_path and Path(whales_path).exists():
        whales = pd.read_csv(whales_path)
        if {"buyer", "seller", "notional"} <= set(whales.columns):
            whales["notional"] = pd.to_numeric(whales["notional"], errors="coerce")
            buyers = whales.groupby("buyer")["notional"].sum()
            sellers = whales.groupby("seller")["notional"].sum()
            ranked = (buyers.add(sellers, fill_value=0)).sort_values(ascending=False)
            found.extend(str(address) for address in ranked.head(top).index if str(address).startswith("0x"))
    return list(dict.fromkeys(found))


def snapshot(wallet: str) -> list[dict[str, Any]]:
    state = info({"type": "clearinghouseState", "user": wallet})
    account_value = float(state.get("marginSummary", {}).get("accountValue", 0))
    withdrawable = float(state.get("withdrawable", 0))
    timestamp = datetime.now(timezone.utc).isoformat()
    positions = state.get("assetPositions", [])
    if not positions:
        return [{
            "timestamp": timestamp,
            "wallet": wallet,
            "account_value": account_value,
            "withdrawable": withdrawable,
            "coin": "",
            "side": "",
            "size": 0,
            "entry_px": None,
            "position_value": 0,
            "unrealized_pnl": 0,
            "margin_used": 0,
            "liquidation_px": None,
            "leverage": None,
            "cum_funding": None,
        }]
    rows = []
    for item in positions:
        position = item.get("position", {})
        size = float(position.get("szi", 0))
        rows.append({
            "timestamp": timestamp,
            "wallet": wallet,
            "account_value": account_value,
            "withdrawable": withdrawable,
            "coin": position.get("coin"),
            "side": "long" if size > 0 else "short",
            "size": abs(size),
            "entry_px": float(position["entryPx"]) if position.get("entryPx") else None,
            "position_value": float(position.get("positionValue") or 0),
            "unrealized_pnl": float(position.get("unrealizedPnl") or 0),
            "margin_used": float(position.get("marginUsed") or 0),
            "liquidation_px": float(position["liquidationPx"]) if position.get("liquidationPx") else None,
            "leverage": (position.get("leverage") or {}).get("value"),
            "cum_funding": (position.get("cumFunding") or {}).get("allTime"),
        })
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Snapshot Hyperliquid whale positions.")
    parser.add_argument("--wallets", default=None, help="Comma-separated addresses.")
    parser.add_argument("--whales", default="data/whales.csv", help="Discover addresses from whale prints.")
    parser.add_argument("--top", type=int, default=20)
    parser.add_argument("--interval", type=float, default=30.0)
    parser.add_argument("--refresh-seconds", type=float, default=300.0)
    parser.add_argument("--iterations", type=int, default=0)
    parser.add_argument("--out", default="data/wallet_positions.csv")
    args = parser.parse_args()

    output = Path(args.out)
    if not output.is_absolute():
        output = Path(__file__).resolve().parents[1] / output
    output.parent.mkdir(parents=True, exist_ok=True)
    new_file = not output.exists()
    handle = output.open("a", newline="", encoding="utf-8")
    writer = csv.DictWriter(handle, fieldnames=FIELDS)
    if new_file:
        writer.writeheader()
        handle.flush()

    addresses: list[str] = []
    last_refresh = 0.0
    print(f"tracking wallets every {args.interval}s -> {output}")
    iterations = 0
    try:
        while args.iterations <= 0 or iterations < args.iterations:
            iterations += 1
            if not addresses or time.monotonic() - last_refresh >= args.refresh_seconds:
                addresses = discover(args.wallets, args.whales, args.top)
                last_refresh = time.monotonic()
                print(f"watchlist refreshed: {len(addresses)} wallets")

            if not addresses:
                print("waiting for whale prints or --wallets")
            for wallet in addresses:
                try:
                    rows = snapshot(wallet)
                    writer.writerows(rows)
                    handle.flush()
                    print(f"{wallet} positions={len(rows)}")
                except Exception as error:
                    print(f"{wallet} error: {error}")
                time.sleep(0.15)
            if args.iterations <= 0 or iterations < args.iterations:
                time.sleep(max(1.0, args.interval))
    except KeyboardInterrupt:
        pass
    handle.close()


if __name__ == "__main__":
    main()
