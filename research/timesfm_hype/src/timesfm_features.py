from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd


def add_timesfm_features(
    frame: pd.DataFrame,
    context: int = 512,
    horizon: int = 12,
    batch_size: int = 32,
    stride: int = 15,
    checkpoint: str = "google/timesfm-2.5-200m-pytorch",
    torch_compile: bool = False,
) -> pd.DataFrame:
    try:
        import timesfm
    except ImportError as error:
        raise RuntimeError(
            "TimesFM is not installed. Run `uv sync --extra timesfm` or "
            "`pip install -e '.[timesfm]'` from research/timesfm_hype."
        ) from error

    model = timesfm.TimesFM_2p5_200M_torch.from_pretrained(checkpoint, torch_compile=torch_compile)
    model.compile(
        timesfm.ForecastConfig(
            max_context=max(context, 1024),
            max_horizon=max(horizon, 256),
            normalize_inputs=True,
            use_continuous_quantile_head=True,
            force_flip_invariance=True,
            infer_is_positive=False,
            fix_quantile_crossing=True,
        )
    )

    log_close = np.log(frame["close"].astype(float).to_numpy())
    indices = list(range(context, len(frame), max(1, stride)))
    if len(frame) - 1 not in indices:
        indices.append(len(frame) - 1)

    records: list[dict[str, float]] = []
    for start in range(0, len(indices), batch_size):
        batch_indices = indices[start : start + batch_size]
        inputs = [log_close[index - context : index] for index in batch_indices]
        point, quantiles = model.forecast(horizon=horizon, inputs=inputs)
        for row, index in enumerate(batch_indices):
            last = log_close[index - 1]
            values: dict[str, float] = {"timestamp": frame["timestamp"].iloc[index]}
            for step in (1, 3, 6, horizon):
                if step <= horizon:
                    values[f"tfm_ret_{step}"] = float(point[row, step - 1] - last)
            values[f"tfm_q10_{horizon}"] = float(quantiles[row, horizon - 1, 1] - last)
            values[f"tfm_q90_{horizon}"] = float(quantiles[row, horizon - 1, 9] - last)
            values[f"tfm_spread_{horizon}"] = values[f"tfm_q90_{horizon}"] - values[f"tfm_q10_{horizon}"]
            records.append(values)

    features = pd.DataFrame(records)
    if features.empty:
        return frame
    features["timestamp"] = pd.to_datetime(features["timestamp"], utc=True)
    return pd.merge_asof(
        frame.sort_values("timestamp"),
        features.sort_values("timestamp"),
        on="timestamp",
        direction="backward",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Add zero-shot TimesFM 2.5 forecast features to a candle CSV.")
    parser.add_argument("--data", required=True)
    parser.add_argument("--out", default="data/hype_1m_tfm.csv")
    parser.add_argument("--context", type=int, default=512)
    parser.add_argument("--horizon", type=int, default=12)
    parser.add_argument("--stride", type=int, default=15)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--checkpoint", default="google/timesfm-2.5-200m-pytorch")
    parser.add_argument("--torch-compile", action="store_true")
    args = parser.parse_args()

    frame = pd.read_csv(args.data)
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True)
    output = add_timesfm_features(
        frame,
        context=args.context,
        horizon=args.horizon,
        batch_size=args.batch_size,
        stride=args.stride,
        checkpoint=args.checkpoint,
        torch_compile=args.torch_compile,
    )
    path = Path(args.out)
    if not path.is_absolute():
        path = Path(__file__).resolve().parents[1] / path
    path.parent.mkdir(parents=True, exist_ok=True)
    output.to_csv(path, index=False)
    print(f"wrote {len(output):,} rows to {path}")


if __name__ == "__main__":
    main()
