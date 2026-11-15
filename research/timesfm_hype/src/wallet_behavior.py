from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd


def classify(row: dict) -> str:
    if (
        row["avg_positions"] >= 4
        and row["turnover"] > 0.5
        and abs(row["net_bias"]) < 0.35
    ):
        return "market_maker_candidate"
    if row["concentration"] > 0.6 and row["persistence"] > 0.55 and row["avg_positions"] <= 3:
        return "directional_candidate"
    if row["turnover"] < 0.2 and row["avg_positions"] >= 2 and abs(row["net_bias"]) < 0.6:
        return "carry_or_hedge_candidate"
    return "unclassified"


def profile(wallet: str, frame: pd.DataFrame) -> dict:
    frame = frame.copy()
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True)
    frame["signed_value"] = np.where(
        frame["side"] == "long",
        frame["position_value"],
        -frame["position_value"],
    )
    by_snapshot = frame.groupby("timestamp").agg(
        gross=("signed_value", lambda values: float(np.abs(values).sum())),
        net=("signed_value", "sum"),
        positions=("coin", lambda values: int((values != "").sum())),
        account_value=("account_value", "last"),
    )
    gross_sum = float(by_snapshot["gross"].sum())
    signed = frame.pivot_table(
        index="timestamp",
        columns="coin",
        values="signed_value",
        aggfunc="sum",
        fill_value=0.0,
    ).sort_index()
    changes = signed.diff().abs().sum().sum()
    signs = np.sign(signed).replace(0, np.nan)
    persistence = float(
        (signs == signs.shift()).sum().sum() / max(1, signs.notna().sum().sum() - len(signs.columns))
    )
    concentration = float((by_snapshot["gross"].replace(0, np.nan).pipe(
        lambda gross: signed.abs().max(axis=1) / gross
    )).mean())
    row = {
        "wallet": wallet,
        "snapshots": int(by_snapshot.shape[0]),
        "avg_account_value": round(float(by_snapshot["account_value"].mean()), 2),
        "last_account_value": round(float(by_snapshot["account_value"].iloc[-1]), 2),
        "avg_gross": round(float(by_snapshot["gross"].mean()), 2),
        "max_gross": round(float(by_snapshot["gross"].max()), 2),
        "avg_positions": round(float(by_snapshot["positions"].mean()), 2),
        "net_bias": round(float(by_snapshot["net"].sum() / gross_sum), 4) if gross_sum else 0.0,
        "turnover": round(float(changes / gross_sum), 4) if gross_sum else 0.0,
        "concentration": round(concentration, 4) if np.isfinite(concentration) else 0.0,
        "persistence": round(persistence, 4) if np.isfinite(persistence) else 0.0,
    }
    row["behavior"] = classify(row)
    return row


def main() -> None:
    parser = argparse.ArgumentParser(description="Heuristic behavior profile for Hyperliquid wallets.")
    parser.add_argument("--positions", default="data/wallet_positions.csv")
    parser.add_argument("--out", default="data/wallet_behavior.json")
    args = parser.parse_args()

    path = Path(args.positions)
    if not path.is_absolute():
        path = Path(__file__).resolve().parents[1] / path
    if not path.exists():
        raise SystemExit(f"No position snapshots at {path}")

    frame = pd.read_csv(path)
    for column in ("position_value", "account_value"):
        frame[column] = pd.to_numeric(frame[column], errors="coerce").fillna(0.0)
    frame["coin"] = frame["coin"].fillna("").astype(str)
    frame["side"] = frame["side"].fillna("").astype(str)

    rows = [profile(str(wallet), group) for wallet, group in frame.groupby("wallet")]
    rows.sort(key=lambda row: row["avg_gross"], reverse=True)
    result = {"wallets": rows, "note": "Heuristic labels only; not proof of a strategy."}

    output = Path(args.out)
    if not output.is_absolute():
        output = Path(__file__).resolve().parents[1] / output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    print(f"wrote {output}")


if __name__ == "__main__":
    main()
