"""Batch retarget every extracted INCLUDE word into gloss_dictionary.json.

Walks kaggle-data/extracted/keypoints/*/*/*.parquet, runs the same
angle-based retargeter as retarget_include.py on each, and MERGES the
results into data/gloss_dictionary.json under a canonical GLOSS name
per word. Preserves any existing entry we hand-authored unless
--overwrite is passed (existing entries get skipped by default so a
user's hand-tuned pose isn't clobbered by a mocap retarget).

Every produced entry uses:
    provenance:     "kaggle-include-isl"
    commercial_safe: false      (Kaggle repackaging is MIT, but the
                                 underlying AI4Bharat INCLUDE dataset
                                 may carry its own terms -- see
                                 data/LICENSE-DATA.md)
    armReach:       0.55        (chest/neutral signing space by
                                 default -- see armReach in types.ts)

Usage:
    python batch_retarget_include.py
    python batch_retarget_include.py --overwrite
    python batch_retarget_include.py --limit 20    # first 20 words only
"""

import argparse
import json
import sys
from collections import OrderedDict
from pathlib import Path

# Import the single-file retargeter as a module.
sys.path.insert(0, str(Path(__file__).parent))
from retarget_include import retarget  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
EXTRACTED_ROOT = REPO_ROOT / "kaggle-data" / "extracted" / "keypoints"
DICT_PATH = REPO_ROOT / "data" / "gloss_dictionary.json"

# Words that need a nicer GLOSS than their raw folder name. Keys are
# lowercase folder names, values are the GLOSS token we'll use in the
# dictionary. Multi-word English phrases become hyphen-joined per the
# convention already established (I-LOVE-YOU, THANK-YOU).
GLOSS_OVERRIDES = {
    "howareyou": "HOW-ARE-YOU",
    "goodafternoon": "GOOD-AFTERNOON",
    "goodevening": "GOOD-EVENING",
    "goodmorning": "GOOD-MORNING",
    "goodnight": "GOOD-NIGHT",
    "biglarge": "BIG",
    "smalllittle": "SMALL",
    "storeorshop": "STORE",
    "streetorroad": "STREET",
    "raceethnicity": "RACE",
    "exmonsoon": "MONSOON",
    "secondnumber": "SECOND",  # 'second' the folder is 'second of time'; this one is the number
    "trainstation": "TRAIN-STATION",
    "trainticket": "TRAIN-TICKET",
    "thankyou": "THANK-YOU",
    "youplural": "YOU-ALL",
    "cellphone": "CELLPHONE",
    "grandfather": "GRANDFATHER",
    "grandmother": "GRANDMOTHER",
    "newspaper": "NEWSPAPER",
    "restaurant": "RESTAURANT",
}


def folder_to_gloss(folder_name: str) -> str:
    lower = folder_name.lower()
    if lower in GLOSS_OVERRIDES:
        return GLOSS_OVERRIDES[lower]
    return folder_name.upper()


def find_all_parquets():
    """Yield (gloss, parquet_path) for every word folder."""
    if not EXTRACTED_ROOT.exists():
        raise SystemExit(f"Extracted dir not found: {EXTRACTED_ROOT}")
    for cat_dir in sorted(EXTRACTED_ROOT.iterdir()):
        if not cat_dir.is_dir():
            continue
        for word_dir in sorted(cat_dir.iterdir()):
            if not word_dir.is_dir():
                continue
            parquets = sorted(word_dir.glob("*.parquet"))
            if not parquets:
                continue
            # Pick the largest one -- more frames = more source data for
            # median smoothing to remove tracking spikes.
            best = max(parquets, key=lambda p: p.stat().st_size)
            yield folder_to_gloss(word_dir.name), best


def build_entry(gloss: str, parquet_path: Path, keyframes: int) -> dict:
    result = retarget(str(parquet_path), hand="right", n_frames=keyframes)
    # retarget() gives us frames with just curls; we still need to wrap
    # into the AuthoredEntry shape (gloss, duration, provenance, ...).
    duration_ms = result["duration_ms"]
    # Cap absurdly long takes -- some INCLUDE takes run 6+ seconds which
    # feels sluggish in the app. Clamp to a max, but proportionally
    # squish the keyframe times to match.
    max_duration = 1800
    scale = 1.0
    if duration_ms > max_duration:
        scale = max_duration / duration_ms
        duration_ms = max_duration
    frames_scaled = []
    for f in result["frames"]:
        frames_scaled.append({
            "t_ms": round(f["t_ms"] * scale),
            "curls": f["curls"],
        })
    # Attach a default wrist rotation + position offset at each frame so
    # the entry has the same shape as our hand-authored ones. Kept
    # identical across frames so the wrist doesn't jitter -- retargeting
    # the wrist orientation from landmarks is a separate not-yet-done
    # step (see docs/RETARGETING.md).
    for f in frames_scaled:
        f["R_palm_deg"] = [0, 0, 0]
        f["R_palm_pos"] = [0.0, 0.0, 0.0]
    entry = OrderedDict()
    entry["gloss"] = gloss
    entry["duration_ms"] = duration_ms
    entry["provenance"] = "kaggle-include-isl"
    entry["commercial_safe"] = False
    entry["notes"] = (
        f"Finger curls retargeted from AI4Bharat INCLUDE dataset "
        f"(repackaged as MediaPipe landmarks on Kaggle by 'swaptr'), "
        f"source take: {parquet_path.name}, right hand, via angle-based "
        f"retargeting with 5-frame median smoothing "
        f"(scripts/data-prep/retarget_include.py). Wrist rotation/position "
        f"are placeholders (0,0,0) -- only finger curls are real motion "
        f"data. Not commercial-safe until license chain to AI4Bharat "
        f"original is verified (see data/LICENSE-DATA.md)."
    )
    entry["frames"] = frames_scaled
    entry["armReach"] = 0.55
    return entry


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--overwrite", action="store_true",
                    help="Replace existing dictionary entries (default: skip)")
    ap.add_argument("--limit", type=int, default=None,
                    help="Only process the first N words (for testing)")
    ap.add_argument("--keyframes", type=int, default=4,
                    help="Keyframes to extract per sign (default 4)")
    args = ap.parse_args()

    with DICT_PATH.open(encoding="utf-8") as f:
        dictionary = json.load(f, object_pairs_hook=OrderedDict)

    added = 0
    replaced = 0
    skipped = 0
    failed = []
    entries = list(find_all_parquets())
    if args.limit:
        entries = entries[: args.limit]
    print(f"Found {len(entries)} candidate word folders")

    for i, (gloss, parquet_path) in enumerate(entries, 1):
        existing = dictionary.get(gloss)
        if existing and not args.overwrite:
            # Only skip if it's a hand-authored entry -- kaggle-include-isl
            # is safe to overwrite because it means we already produced it
            # here.
            if existing.get("provenance") != "kaggle-include-isl":
                skipped += 1
                print(f"  [{i}/{len(entries)}] {gloss}: skipping (hand-authored exists)")
                continue
        try:
            entry = build_entry(gloss, parquet_path, args.keyframes)
        except Exception as e:  # pragma: no cover -- data-quality issues
            failed.append((gloss, str(e)))
            print(f"  [{i}/{len(entries)}] {gloss}: FAILED -- {e}")
            continue
        if gloss in dictionary:
            replaced += 1
            action = "replaced"
        else:
            added += 1
            action = "added"
        dictionary[gloss] = entry
        print(f"  [{i}/{len(entries)}] {gloss}: {action} "
              f"({entry['duration_ms']}ms, {len(entry['frames'])} keyframes)")

    with DICT_PATH.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(dictionary, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print()
    print(f"Done: {added} added, {replaced} replaced, {skipped} skipped, {len(failed)} failed")
    if failed:
        print("Failures:")
        for g, e in failed:
            print(f"  {g}: {e}")
    print(f"Dictionary now has {len(dictionary)} entries")


if __name__ == "__main__":
    main()
