"""Convert a Kaggle Google ASL Signs parquet to our intermediate JSON.

Placeholder: fills in only the shape and TODO markers so a data engineer
can wire actual field mapping. The Kaggle format uses per-frame rows with
columns for pose/face/left_hand/right_hand landmarks; each sign_id maps
to a gloss via a sign-to-prediction-index CSV.

Usage:
  python convert_kaggle.py --input path/to/sign_lookup/xxx.parquet --gloss HELLO --out ../../data/glosses/HELLO.raw.json
"""

import argparse
import json
import pandas as pd


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--gloss", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    df = pd.read_parquet(args.input)
    # Kaggle schema (as of the ASL Signs competition):
    #   frame, row_id, type ("face"|"left_hand"|"pose"|"right_hand"), landmark_index, x, y, z
    if not {"frame", "type", "landmark_index", "x", "y", "z"}.issubset(df.columns):
        raise SystemExit("unexpected columns; verify Kaggle schema version")

    frames = []
    for frame_idx, g in df.groupby("frame"):
        f = {"t_ms": int(frame_idx) * 33, "right_hand": None, "left_hand": None}
        for typ in ("right_hand", "left_hand"):
            sub = g[g["type"] == typ].sort_values("landmark_index")
            if len(sub) == 21:
                f[typ] = sub[["x", "y", "z"]].values.tolist()
        frames.append(f)

    payload = {
        "gloss": args.gloss,
        "provenance": "kaggle-google-asl",
        "commercial_safe": True,  # verify latest Kaggle terms before shipping
        "duration_ms": frames[-1]["t_ms"] if frames else 0,
        "mediapipe_frames": frames,
        "notes": "Kaggle Google ASL Signs; commercial terms subject to Kaggle competition rules.",
    }
    with open(args.out, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"wrote {len(frames)} frames -> {args.out}")


if __name__ == "__main__":
    main()
