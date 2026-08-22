"""Extract MediaPipe holistic keypoints from a video and emit our JSON.

Usage:
  python extract_mediapipe.py --input signer_hello.mp4 --gloss HELLO --out ../../data/glosses/HELLO.json

Note: this is a starter. It writes a MediaPipe-shaped intermediate file.
The full runtime format (curl degrees per finger) requires an additional
pass that maps hand landmarks to per-joint bend angles; see
docs/RETARGETING.md.
"""

import argparse
import json
import cv2
import mediapipe as mp


def extract(video_path: str) -> list[dict]:
    hol = mp.solutions.holistic.Holistic(
        static_image_mode=False,
        model_complexity=2,
        refine_face_landmarks=False,
    )
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"cannot open {video_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frames = []
    idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        r = hol.process(rgb)
        t_ms = int(round(idx * 1000.0 / fps))
        frames.append({
            "t_ms": t_ms,
            "right_hand": _lm_to_list(r.right_hand_landmarks),
            "left_hand": _lm_to_list(r.left_hand_landmarks),
            "pose_upper": _lm_to_list_upper(r.pose_landmarks),
        })
        idx += 1
    cap.release()
    hol.close()
    return frames


def _lm_to_list(lm):
    if lm is None:
        return None
    return [[p.x, p.y, p.z] for p in lm.landmark]


def _lm_to_list_upper(lm):
    if lm is None:
        return None
    # keep shoulders, elbows, wrists (11..16)
    return [[lm.landmark[i].x, lm.landmark[i].y, lm.landmark[i].z] for i in range(11, 17)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--gloss", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    frames = extract(args.input)
    payload = {
        "gloss": args.gloss,
        "provenance": "self-recorded",
        "commercial_safe": True,
        "duration_ms": frames[-1]["t_ms"] if frames else 0,
        "mediapipe_frames": frames,
        "notes": "Extracted with MediaPipe holistic; convert to bone curls via retargeter.",
    }
    with open(args.out, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"wrote {len(frames)} frames -> {args.out}")


if __name__ == "__main__":
    main()
