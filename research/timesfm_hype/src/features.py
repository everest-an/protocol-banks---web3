from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


def load_candles(path: str | Path) -> pd.DataFrame:
    frame = pd.read_csv(path)
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True)
    frame = frame.sort_values("timestamp").drop_duplicates("timestamp").reset_index(drop=True)
    numeric = ["open", "high", "low", "close", "volume", "trades", "funding"]
    for column in numeric:
        if column not in frame:
            frame[column] = 0.0
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame["funding"] = frame["funding"].fillna(0.0)
    return frame


def _normalise_side(value: object) -> str:
    text = str(value).strip().lower()
    if text in {"b", "buy", "bid"}:
        return "buy"
    if text in {"a", "sell", "ask"}:
        return "sell"
    return text


def build_whale_features(candles: pd.DataFrame, path: str | Path) -> pd.DataFrame:
    trades = pd.read_csv(path)
    required = {"timestamp", "side", "notional"}
    missing = required - set(trades.columns)
    if missing:
        raise ValueError(f"whale CSV missing columns: {sorted(missing)}")
    trades["timestamp"] = pd.to_datetime(trades["timestamp"], utc=True)
    if "coin" in trades.columns:
        trades = trades[trades["coin"].astype(str).str.upper() == "HYPE"]
    trades["notional"] = pd.to_numeric(trades["notional"], errors="coerce")
    trades = trades.dropna(subset=["notional"])
    trades["side"] = trades["side"].map(_normalise_side)
    trades["minute"] = trades["timestamp"].dt.floor("min")
    trades["buy"] = np.where(trades["side"] == "buy", trades["notional"], 0.0)
    trades["sell"] = np.where(trades["side"] == "sell", trades["notional"], 0.0)

    grouped = trades.groupby("minute").agg(
        buy=("buy", "sum"),
        sell=("sell", "sum"),
        count=("notional", "size"),
        max_print=("notional", "max"),
    )
    grouped["net"] = grouped["buy"] - grouped["sell"]
    index = candles["timestamp"]
    grouped = grouped.reindex(index, fill_value=0.0)
    out = pd.DataFrame(index=candles.index)
    for window in (5, 15, 60):
        out[f"whale_buy_{window}"] = grouped["buy"].rolling(window, min_periods=1).sum().to_numpy()
        out[f"whale_sell_{window}"] = grouped["sell"].rolling(window, min_periods=1).sum().to_numpy()
        out[f"whale_net_{window}"] = grouped["net"].rolling(window, min_periods=1).sum().to_numpy()
        out[f"whale_count_{window}"] = grouped["count"].rolling(window, min_periods=1).sum().to_numpy()
    out["whale_max_print_15"] = grouped["max_print"].rolling(15, min_periods=1).max().to_numpy()
    return out


def build_market_features(candles: pd.DataFrame, path: str | Path) -> pd.DataFrame:
    market = pd.read_csv(path)
    market["timestamp"] = pd.to_datetime(market["timestamp"], utc=True)
    numeric = [column for column in market.columns if column != "timestamp"]
    for column in numeric:
        market[column] = pd.to_numeric(market[column], errors="coerce")
    market = market.sort_values("timestamp").drop_duplicates("timestamp")
    merged = pd.merge_asof(
        candles[["timestamp"]].sort_values("timestamp"),
        market.sort_values("timestamp"),
        on="timestamp",
        direction="backward",
    ).reset_index(drop=True)

    out = pd.DataFrame(index=candles.index)
    basis_pairs = [
        ("hl_mid", "binance_mid", "basis_binance_bps"),
        ("hl_mid", "bybit_mid", "basis_bybit_bps"),
        ("hl_mid", "okx_mid", "basis_okx_bps"),
    ]
    for left, right, name in basis_pairs:
        if left in merged and right in merged:
            out[name] = (merged[left] - merged[right]) / merged[right] * 10_000
    for column in ("hl_spread_bps", "hl_imbalance_5", "hl_imbalance_20", "hl_premium"):
        if column in merged:
            out[column] = merged[column]
    if "hl_bid_depth_5" in merged and "hl_ask_depth_5" in merged:
        out["hl_depth_5"] = merged["hl_bid_depth_5"] + merged["hl_ask_depth_5"]
    if "hl_open_interest" in merged:
        for window in (5, 15, 60):
            out[f"oi_change_{window}"] = merged["hl_open_interest"].pct_change(window)
    if "bybit_open_interest" in merged:
        for window in (5, 15):
            out[f"bybit_oi_change_{window}"] = merged["bybit_open_interest"].pct_change(window)
    if "bybit_funding" in merged:
        out["bybit_funding"] = merged["bybit_funding"]
    mids = [merged[column] for column in ("hl_mid", "binance_mid", "bybit_mid", "okx_mid") if column in merged]
    if len(mids) >= 2:
        out["cross_venue_dispersion"] = pd.concat(mids, axis=1).std(axis=1)
    return out


def build_features(
    candles: pd.DataFrame,
    horizon: int = 5,
    whale_csv: str | Path | None = None,
    market_csv: str | Path | None = None,
) -> tuple[pd.DataFrame, list[str]]:
    frame = candles.copy()
    close = frame["close"].astype(float)
    high = frame["high"].astype(float)
    low = frame["low"].astype(float)
    volume = frame["volume"].astype(float)
    log_close = np.log(close)

    frame["ret_1"] = log_close.diff()
    for window in (5, 15, 60):
        frame[f"ret_{window}"] = log_close.diff(window)
        frame[f"vol_{window}"] = frame["ret_1"].rolling(window).std()
    volume_mean = volume.rolling(60).mean()
    volume_std = volume.rolling(60).std().replace(0, np.nan)
    frame["volume_z_60"] = (volume - volume_mean) / volume_std
    frame["range_pct"] = (high - low) / close
    frame["funding"] = frame["funding"].astype(float)
    frame["funding_diff"] = frame["funding"].diff()

    feature_columns = [
        "ret_1",
        "ret_5",
        "ret_15",
        "ret_60",
        "vol_15",
        "vol_60",
        "volume_z_60",
        "range_pct",
        "funding",
        "funding_diff",
    ]

    if whale_csv:
        whale = build_whale_features(frame, whale_csv)
        frame = pd.concat([frame, whale], axis=1)
        feature_columns.extend([column for column in whale.columns if column not in feature_columns])

    if market_csv:
        market = build_market_features(frame, market_csv)
        frame = pd.concat([frame, market], axis=1)
        feature_columns.extend([column for column in market.columns if column not in feature_columns])

    tfm_columns = [column for column in frame.columns if column.startswith("tfm_")]
    feature_columns.extend([column for column in tfm_columns if column not in feature_columns])

    frame["target"] = (log_close.shift(-horizon) - log_close).astype(float)
    frame = frame.dropna(subset=feature_columns + ["target"]).reset_index(drop=True)
    return frame, feature_columns
