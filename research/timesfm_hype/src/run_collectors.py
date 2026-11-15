from __future__ import annotations

import argparse
import os
import subprocess
import sys
import threading
import time
from pathlib import Path


def pump(name: str, process: subprocess.Popen[str]) -> None:
    if process.stdout is None:
        return
    for line in process.stdout:
        print(f"[{name}] {line.rstrip()}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run whale and market collectors together.")
    parser.add_argument("--coin", default="HYPE")
    parser.add_argument("--min-notional", type=float, default=50_000)
    parser.add_argument("--interval", type=float, default=5.0)
    parser.add_argument("--out-dir", default="data")
    parser.add_argument("--track-wallets", action="store_true", help="Also snapshot positions for discovered whales.")
    parser.add_argument("--wallet-top", type=int, default=20)
    parser.add_argument("--wallet-interval", type=float, default=30.0)
    parser.add_argument("--wallet-refresh", type=float, default=300.0)
    parser.add_argument("--max-seconds", type=float, default=0, help="0 means run until interrupted.")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    out = root / args.out_dir
    out.mkdir(parents=True, exist_ok=True)

    commands = {
        "whales": [
            sys.executable,
            str(root / "src" / "collect_whales.py"),
            "--coin", args.coin,
            "--min-notional", str(args.min_notional),
            "--out", str(out / "whales.csv"),
        ],
        "market": [
            sys.executable,
            str(root / "src" / "collect_market.py"),
            "--coin", args.coin,
            "--interval", str(args.interval),
            "--out", str(out / "market.csv"),
        ],
    }
    if args.track_wallets:
        commands["wallets"] = [
            sys.executable,
            str(root / "src" / "collect_wallets.py"),
            "--whales", str(out / "whales.csv"),
            "--top", str(args.wallet_top),
            "--interval", str(args.wallet_interval),
            "--refresh-seconds", str(args.wallet_refresh),
            "--out", str(out / "wallet_positions.csv"),
        ]

    processes: dict[str, subprocess.Popen[str]] = {}
    threads: list[threading.Thread] = []
    for name, command in commands.items():
        process = subprocess.Popen(
            command,
            cwd=root,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env={**os.environ, "PYTHONUNBUFFERED": "1", "PYTHONIOENCODING": "utf-8"},
        )
        processes[name] = process
        thread = threading.Thread(target=pump, args=(name, process), daemon=True)
        thread.start()
        threads.append(thread)

    print(f"collectors running; writing to {out}. Ctrl+C stops all.", flush=True)
    started = time.time()
    try:
        while True:
            if args.max_seconds > 0 and time.time() - started >= args.max_seconds:
                raise KeyboardInterrupt
            for name, process in processes.items():
                code = process.poll()
                if code is not None:
                    print(f"[{name}] exited with {code}; stopping the other collector", flush=True)
                    raise KeyboardInterrupt
            time.sleep(1)
    except KeyboardInterrupt:
        for process in processes.values():
            if process.poll() is None:
                process.terminate()
        for process in processes.values():
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()


if __name__ == "__main__":
    main()
