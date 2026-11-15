from __future__ import annotations

import argparse
import asyncio
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

import websockets

WS_URL = "wss://api.hyperliquid.xyz/ws"


async def run(coin: str, min_notional: float, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    new_file = not output.exists()
    handle = output.open("a", newline="", encoding="utf-8")
    writer = csv.writer(handle)
    if new_file:
        writer.writerow(["timestamp", "coin", "side", "px", "sz", "notional", "buyer", "seller", "hash"])
        handle.flush()

    while True:
        try:
            async with websockets.connect(WS_URL, ping_interval=20) as socket:
                await socket.send(json.dumps({
                    "method": "subscribe",
                    "subscription": {"type": "trades", "coin": coin},
                }))
                print(f"subscribed to {coin} trades; writing prints >= ${min_notional:,.0f}")
                async for raw in socket:
                    message = json.loads(raw)
                    if message.get("channel") != "trades":
                        continue
                    for trade in message.get("data", []):
                        try:
                            px = float(trade["px"])
                            sz = float(trade["sz"])
                        except (KeyError, TypeError, ValueError):
                            continue
                        notional = px * sz
                        if notional < min_notional:
                            continue
                        users = trade.get("users") or [None, None]
                        timestamp = datetime.fromtimestamp(int(trade["time"]) / 1000, tz=timezone.utc).isoformat()
                        writer.writerow([
                            timestamp,
                            trade.get("coin", coin),
                            trade.get("side", ""),
                            px,
                            sz,
                            round(notional, 2),
                            users[0],
                            users[1],
                            trade.get("hash", ""),
                        ])
                        handle.flush()
                        print(f"{timestamp} {trade.get('side')} ${notional:,.0f} {users[0]} / {users[1]}")
        except KeyboardInterrupt:
            break
        except Exception as error:
            print(f"websocket error: {error}; reconnecting in 5s")
            await asyncio.sleep(5)
    handle.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect large Hyperliquid trades (whale prints) to CSV.")
    parser.add_argument("--coin", default="HYPE")
    parser.add_argument("--min-notional", type=float, default=50_000)
    parser.add_argument("--out", default="data/whales.csv")
    args = parser.parse_args()
    output = Path(args.out)
    if not output.is_absolute():
        output = Path(__file__).resolve().parents[1] / output
    asyncio.run(run(args.coin, args.min_notional, output))


if __name__ == "__main__":
    main()
