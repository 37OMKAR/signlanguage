"""Retarget INCLUDE/MediaPipe hand landmarks into our curl-degree sign format.

This is the angle-based retargeter described (but never implemented) in
docs/RETARGETING.md. Input: one Parquet file per take, columns
(frame, row_id, type, landmark_index, x, y, z), MediaPipe Holistic schema.
Output: an AuthoredEntry-shaped JSON fragment (curls per finger segment,
degrees) ready to paste into data/gloss_dictionary.json.

Why angle-based, not position-based: bone LENGTH varies between the
MediaPipe signer's hand and our rig's hand. Copying raw landmark positions
would only work for one specific hand size. Copying the ANGLE between
consecutive bone segments at each joint is scale-invariant -- it transfers
correctly regardless of hand proportions. This is the same principle
already used for the placeholder rig's curl format; this script just
derives real curl values from real motion instead of us guessing them.

Usage:
    python retarget_include.py <parquet_path> [--frames N] [--hand right]
"""

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# MediaPipe hand landmark indices (standard topology, both hands share it).
WRIST = 0
THUMB = [1, 2, 3, 4]          # CMC, MCP, IP, TIP
INDEX = [5, 6, 7, 8]          # MCP, PIP, DIP, TIP
MIDDLE = [9, 10, 11, 12]
RING = [13, 14, 15, 16]
PINKY = [17, 18, 19, 20]

FINGER_CHAINS = {
    "thumb": [WRIST] + THUMB,   # 5 points -> 2 curl joints (matches our 2-value thumb format)
    "index": [WRIST] + INDEX,   # 5 points -> 3 curl joints
    "middle": [WRIST] + MIDDLE,
    "ring": [WRIST] + RING,
    "pinky": [WRIST] + PINKY,
}


def joint_angle_deg(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    """Angle at point b, between segments (a->b) and (b->c), in degrees.

    0 deg = perfectly straight (a, b, c colinear). Larger = more bent.
    This is exactly what our curl format expects: 0 = extended finger,
    ~90 = fully curled joint.
    """
    v1 = b - a
    v2 = c - b
    n1 = np.linalg.norm(v1)
    n2 = np.linalg.norm(v2)
    if n1 < 1e-9 or n2 < 1e-9:
        return 0.0
    cos_angle = np.dot(v1, v2) / (n1 * n2)
    cos_angle = np.clip(cos_angle, -1.0, 1.0)
    # A straight finger has segments pointing the SAME direction (angle
    # between vectors ~0). A curled joint bends the second segment back,
    # so the angle between consecutive DIRECTION vectors grows toward 180
    # as the finger curls under. We want 0=straight, ~90=curled, so we
    # report (180 - angle_between_vectors) is wrong too -- direct angle
    # between direction vectors already gives 0 for straight; use that.
    return math.degrees(math.acos(cos_angle))


def finger_curls_for_frame(points: dict, finger: str) -> list:
    """Return curl degrees per joint for one finger, one frame.

    `points` maps landmark_index -> np.array([x,y,z]). Returns a list of
    2 values (thumb) or 3 values (others), matching our AuthoredFrame
    curls format.
    """
    chain = FINGER_CHAINS[finger]
    curls = []
    # chain = [WRIST, J1, J2, J3, J4] (thumb) or [WRIST, J1, J2, J3, J4] (others)
    # Joint angles are measured at J1, J2, J3 (skip J4/tip, no distal segment).
    for i in range(1, len(chain) - 1):
        a_idx, b_idx, c_idx = chain[i - 1], chain[i], chain[i + 1]
        if a_idx not in points or b_idx not in points or c_idx not in points:
            curls.append(0.0)
            continue
        curls.append(joint_angle_deg(points[a_idx], points[b_idx], points[c_idx]))
    # Our format: index/middle/ring/pinky = 3 values, thumb = 2 values.
    # The chain above naturally produces 3 for the 5-point chains (WRIST+4)
    # and we only keep the first 2 for thumb.
    if finger == "thumb":
        return curls[:2]
    return curls[:3]


def load_hand_frames(df: pd.DataFrame, hand: str) -> dict:
    """Return {frame_index: {landmark_index: np.array([x,y,z])}} for one hand."""
    sub = df[df["type"] == f"{hand}_hand"]
    out = {}
    for frame, g in sub.groupby("frame"):
        pts = {}
        for _, row in g.iterrows():
            if pd.isna(row["x"]):
                continue
            pts[int(row["landmark_index"])] = np.array(
                [row["x"], row["y"], row["z"]], dtype=float,
            )
        if pts:
            out[int(frame)] = pts
    return out


def pick_keyframes(frame_indices: list, n: int) -> list:
    """Evenly sample n frame indices from the available range (inclusive
    of first and last), matching our sparse-keyframe authoring style."""
    if len(frame_indices) <= n:
        return frame_indices
    idxs = np.linspace(0, len(frame_indices) - 1, n).round().astype(int)
    return [frame_indices[i] for i in sorted(set(idxs))]


def median_smooth_curl(
    hand_frames: dict, center_frame: int, finger: str, window: int = 5,
) -> list:
    """Median-filter a finger's curl values across a small window of frames
    centered on `center_frame`. MediaPipe hand tracking occasionally spikes
    on a single frame (motion blur, brief self-occlusion mid-gesture) --
    confirmed empirically: independent takes of the same sign showed
    consistent curl values at most sampled frames, but individual frames
    sometimes showed one finger jump to 60-120deg with no support from
    neighboring frames. A median over a small window removes that without
    smearing real, sustained motion.
    """
    available = sorted(hand_frames.keys())
    half = window // 2
    nearby = [f for f in available if abs(f - center_frame) <= half]
    if not nearby:
        nearby = [center_frame] if center_frame in hand_frames else []
    samples = [finger_curls_for_frame(hand_frames[f], finger) for f in nearby if f in hand_frames]
    if not samples:
        return [0.0] * (2 if finger == "thumb" else 3)
    arr = np.array(samples)
    return [round(v, 1) for v in np.median(arr, axis=0)]


def retarget(parquet_path: str, hand: str, n_frames: int) -> dict:
    df = pd.read_parquet(parquet_path)
    total_frames = int(df["frame"].max()) + 1
    hand_frames = load_hand_frames(df, hand)
    if not hand_frames:
        raise ValueError(f"No {hand}_hand landmarks found in {parquet_path}")

    available = sorted(hand_frames.keys())
    keyframes = pick_keyframes(available, n_frames)

    prefix = "R" if hand == "right" else "L"
    duration_ms = round(total_frames / 30.0 * 1000)  # dataset is ~30fps
    frames_out = []
    for fi in keyframes:
        curls = {}
        for finger in ("thumb", "index", "middle", "ring", "pinky"):
            key = f"{prefix}_{finger}"
            curls[key] = median_smooth_curl(hand_frames, fi, finger, window=5)
        t_ms = round(fi / max(total_frames - 1, 1) * duration_ms)
        frames_out.append({"t_ms": t_ms, "curls": curls})

    return {
        "duration_ms": duration_ms,
        "source_frames": total_frames,
        "keyframes_extracted": len(frames_out),
        "frames": frames_out,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("parquet_path")
    ap.add_argument("--frames", type=int, default=4, help="Number of keyframes to extract")
    ap.add_argument("--hand", choices=["right", "left"], default="right")
    args = ap.parse_args()

    result = retarget(args.parquet_path, args.hand, args.frames)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
