"""Batch retarget SignMatic ASL keypoint sequences into gloss_dictionary.

SignMatic ships one .npz shard per class (data/hello.npz, data/eat.npz,
...) containing `real` and `synthetic` numpy arrays of shape
(N_sequences, 30_frames, 258_features). Feature layout (from the
shipped feature_schema.json):

    [0:132]    pose landmarks    (33 * (x, y, z, visibility))
    [132:195]  left-hand         (21 * (x, y, z))
    [195:258]  right-hand        (21 * (x, y, z))

We reuse the same angle-based finger-curl math as retarget_include.py:
compute joint angles at MCP/PIP/DIP for each finger from raw XYZ
positions, median-smooth across frames to knock out MediaPipe tracking
noise, then emit AuthoredEntry-shaped JSON.

License: CC BY 4.0 (SignMatic; Kaggle repackaged from Lebanese
International University contributors). Commercial-safe WITH
attribution -- so provenance = "signmatic-asl", commercial_safe = true
(unlike INCLUDE which we flagged unsafe due to license-chain
uncertainty). See data/LICENSE-DATA.md for the attribution note.

Usage:
    python batch_retarget_signmatic.py
    python batch_retarget_signmatic.py --overwrite
    python batch_retarget_signmatic.py --limit 5
"""

import argparse
import json
import sys
from collections import OrderedDict
from pathlib import Path

import numpy as np

# Reuse the finger-angle math from retarget_include.
sys.path.insert(0, str(Path(__file__).parent))
from retarget_include import finger_curls_for_frame  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_ROOT = REPO_ROOT / "kaggle-data" / "signmatic" / "SignMatic_ASL_Keypoint_Dataset_Kaggle" / "data"
DICT_PATH = REPO_ROOT / "data" / "gloss_dictionary.json"

# SignMatic class-label -> canonical GLOSS token in our dictionary. Most
# labels lowercase straight to their uppercased form; a handful need
# canonicalisation (ILoveYou -> I-LOVE-YOU, Thanks -> THANK-YOU, etc.).
GLOSS_OVERRIDES = {
    "iloveyou": "I-LOVE-YOU",
    "thanks": "THANK-YOU",
    "idle": None,   # skip: not a sign, just a rest-class label
    "so": None,     # skip: too generic; already covered by grammar
    "a": None,      # skip: article/letter dupe
    "is": None,     # skip: dropped in ASL gloss
    "and": None,    # keep NLP AND, don't override
    "my": None,     # already have MY hand-authored
    "i": None,      # already have ME hand-authored
    "you": None,    # already have YOU hand-authored
}


def label_to_gloss(label: str) -> str | None:
    lower = label.lower()
    if lower in GLOSS_OVERRIDES:
        return GLOSS_OVERRIDES[lower]
    # CamelCase multi-word labels -> HYPHEN-JOINED-UPPER (none in this
    # dataset except ILoveYou which is overridden above).
    return label.upper()


def npz_to_hand_frames(npz_path: Path) -> dict:
    """Load a SignMatic shard and return {frame_index: {landmark_index: np.array([x,y,z])}}
    for the RIGHT hand of the MEDIAN sequence in the shard.

    Picking the median-length "real" sequence (by non-zero-frame count) rather
    than the first happens to avoid any leading/trailing all-zero padding
    frames some sequences ship with.
    """
    arr = np.load(npz_path)
    if "real" not in arr:
        return {}
    real = arr["real"]  # shape (N_sequences, 30, 258)
    # Score each sequence by how many non-zero frames the right hand has.
    r_hand_slice = real[:, :, 195:258]  # (N, 30, 63)
    per_frame_norm = np.linalg.norm(r_hand_slice, axis=2)  # (N, 30)
    nonzero_frames = np.sum(per_frame_norm > 1e-6, axis=1)  # (N,)
    if nonzero_frames.max() == 0:
        return {}
    # Median non-zero-count sequence is representative -- avoids the noisiest
    # and shortest takes.
    order = np.argsort(nonzero_frames)
    idx = order[len(order) // 2]
    seq = real[idx]  # (30, 258)

    out = {}
    for f in range(seq.shape[0]):
        frame = seq[f]
        r_hand = frame[195:258].reshape(21, 3)
        # Drop frames where the whole hand is zero (tracking failure /
        # padding). Also insert a synthetic WRIST at index 0 -- the finger-
        # curl math wants a WRIST->MCP vector as the first segment.
        if np.linalg.norm(r_hand) < 1e-6:
            continue
        pts = {i: r_hand[i] for i in range(21)}
        out[f] = pts
    return out


def pick_keyframes(available_frames: list, n: int) -> list:
    if len(available_frames) <= n:
        return available_frames
    idxs = np.linspace(0, len(available_frames) - 1, n).round().astype(int)
    return [available_frames[i] for i in sorted(set(idxs))]


def median_smooth_curl(hand_frames: dict, center_frame: int, finger: str, window: int = 5):
    available = sorted(hand_frames.keys())
    half = window // 2
    nearby = [f for f in available if abs(f - center_frame) <= half]
    if not nearby:
        nearby = [center_frame] if center_frame in hand_frames else []
    samples = [finger_curls_for_frame(hand_frames[f], finger) for f in nearby if f in hand_frames]
    if not samples:
        return [0.0] * (2 if finger == "thumb" else 3)
    a = np.array(samples)
    return [round(float(v), 1) for v in np.median(a, axis=0)]


def build_entry(gloss: str, shard: Path, keyframes: int, prefix: str = "R") -> dict:
    hand_frames = npz_to_hand_frames(shard)
    if not hand_frames:
        raise ValueError(f"no right-hand frames in {shard.name}")
    available = sorted(hand_frames.keys())
    keys = pick_keyframes(available, keyframes)

    # SignMatic sequences are exactly 30 frames at ~30fps = 1000ms.
    duration_ms = 1000
    max_frame = max(30, available[-1])

    frames_out = []
    for fi in keys:
        curls = {}
        for finger in ("thumb", "index", "middle", "ring", "pinky"):
            curls[f"{prefix}_{finger}"] = median_smooth_curl(hand_frames, fi, finger, window=5)
        t_ms = round(fi / max(max_frame - 1, 1) * duration_ms)
        frames_out.append({
            "t_ms": t_ms,
            "curls": curls,
            "R_palm_deg": [0, 0, 0],
            "R_palm_pos": [0.0, 0.0, 0.0],
        })

    entry = OrderedDict()
    entry["gloss"] = gloss
    entry["duration_ms"] = duration_ms
    entry["provenance"] = "signmatic-asl"
    entry["commercial_safe"] = True
    entry["notes"] = (
        f"Finger curls retargeted from the SignMatic ASL Keypoint Dataset "
        f"(CC BY 4.0) via angle-based retargeting of MediaPipe Holistic "
        f"right-hand landmarks; median-of-shard sequence from {shard.name}. "
        f"Wrist rotation/position are placeholders (0,0,0) -- only finger "
        f"curls are real motion data. Attribution: 'SignMatic ASL Keypoint "
        f"Dataset' by Joseph Sarkis et al. (Lebanese International "
        f"University), Kaggle."
    )
    entry["frames"] = frames_out
    entry["armReach"] = 0.55
    return entry


def find_shards():
    for shard in sorted(DATA_ROOT.glob("*.npz")):
        label = shard.stem  # 'hello', 'i_love_you', etc. -- SignMatic uses lower_snake
        # Convert lowercase filename back to a "Label" the labels.txt uses so
        # our override map works. labels.txt uses CamelCase like "ILoveYou";
        # the shard filename lowercases it. Best-effort back-conversion:
        # collapse underscores and re-title-case each word.
        parts = label.replace("_", " ").split()
        display = "".join(p.capitalize() for p in parts)
        gloss = label_to_gloss(display)
        if gloss is None:
            continue
        yield gloss, shard


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--overwrite", action="store_true",
                    help="Replace even hand-authored entries (default: keep hand-authored, "
                         "but do overwrite existing signmatic entries)")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--keyframes", type=int, default=4)
    args = ap.parse_args()

    if not DATA_ROOT.exists():
        raise SystemExit(f"SignMatic data dir not found: {DATA_ROOT}")

    with DICT_PATH.open(encoding="utf-8") as f:
        dictionary = json.load(f, object_pairs_hook=OrderedDict)

    entries = list(find_shards())
    if args.limit:
        entries = entries[: args.limit]
    print(f"Processing {len(entries)} SignMatic shards")

    added = replaced = skipped = 0
    failed = []
    for i, (gloss, shard) in enumerate(entries, 1):
        existing = dictionary.get(gloss)
        if existing:
            prov = existing.get("provenance")
            # SignMatic is CC BY 4.0 -> commercial-safe, so it's a strict
            # upgrade over any INCLUDE-derived entry (commercial_safe:
            # false). Always replace those. Never touch hand-authored
            # unless --overwrite is passed explicitly.
            if prov == "hand-authored" and not args.overwrite:
                print(f"  [{i}/{len(entries)}] {gloss}: skipping (hand-authored)")
                skipped += 1
                continue
            # signmatic-asl -> signmatic-asl is a no-op re-derivation, allow it.
        try:
            entry = build_entry(gloss, shard, args.keyframes)
        except Exception as e:
            print(f"  [{i}/{len(entries)}] {gloss}: FAILED -- {e}")
            failed.append((gloss, str(e)))
            continue
        if gloss in dictionary:
            replaced += 1
            action = "replaced"
        else:
            added += 1
            action = "added"
        dictionary[gloss] = entry
        print(f"  [{i}/{len(entries)}] {gloss}: {action} ({len(entry['frames'])} keyframes)")

    with DICT_PATH.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(dictionary, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"\nDone: {added} added, {replaced} replaced, {skipped} skipped, {len(failed)} failed")
    print(f"Dictionary now has {len(dictionary)} entries")
    if failed:
        for g, e in failed:
            print(f"  {g}: {e}")


if __name__ == "__main__":
    main()
