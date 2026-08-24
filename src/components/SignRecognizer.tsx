import { useEffect, useRef, useState } from "react";

// MediaPipe's built-in gesture recognizer covers only 7 gestures out of
// the box: Open_Palm, Closed_Fist, Pointing_Up, Thumb_Up, Thumb_Down,
// Victory, ILoveYou. That's not a full sign-language vocabulary -- real
// 250+ sign recognition requires shipping a trained model (~10-50 MB
// ONNX weights). This tab is the SCAFFOLD (real webcam + real
// MediaPipe running in-browser, honest about the 7-gesture limit); the
// bigger-vocabulary recognition model is a follow-up.

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

// Map raw gesture labels to friendlier phrases the caption row can
// show without looking like a debug dump.
const GESTURE_LABELS: Record<string, string> = {
  Open_Palm: "Open palm (stop / five)",
  Closed_Fist: "Closed fist (A / stop / no)",
  Pointing_Up: "Pointing up (one / index)",
  Thumb_Up: "Thumbs up (good / yes)",
  Thumb_Down: "Thumbs down (bad / no)",
  Victory: "V-hand (two / peace)",
  ILoveYou: "I love you (ILY handshape)",
};

interface RecognizedGesture {
  gesture: string;
  score: number;
  hand: "Left" | "Right";
  timestamp: number;
}

export function SignRecognizer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Any because @mediapipe/tasks-vision's typings drift between minor
  // versions and dynamic import doesn't preserve them well; the runtime
  // shape (recognizeForVideo, close) is the stable public API.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognizerRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading-model" | "requesting-camera" | "ready" | "error">("loading-model");
  const [error, setError] = useState<string>("");
  const [lastRecognized, setLastRecognized] = useState<RecognizedGesture | null>(null);
  const [transcript, setTranscript] = useState<string[]>([]);
  const lastLoggedRef = useRef<{ gesture: string; at: number }>({ gesture: "", at: 0 });

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let rafId = 0;

    async function init() {
      try {
        setStatus("loading-model");
        const vision = await import("@mediapipe/tasks-vision");
        const filesetResolver = await vision.FilesetResolver.forVisionTasks(WASM_URL);
        const recognizer = await vision.GestureRecognizer.createFromOptions(filesetResolver, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 2,
        });
        if (stopped) { recognizer.close(); return; }
        recognizerRef.current = recognizer;

        setStatus("requesting-camera");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
        if (stopped) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();

        setStatus("ready");
        loop();
      } catch (e) {
        console.error("[sign-recognizer] init failed:", e);
        setError(String((e as Error).message || e));
        setStatus("error");
      }
    }

    function loop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const recognizer = recognizerRef.current;
      if (stopped || !video || !canvas || !recognizer) return;
      if (video.readyState < 2) { rafId = requestAnimationFrame(loop); return; }

      const now = performance.now();
      try {
        const result = recognizer.recognizeForVideo(video, now);
        drawOverlay(canvas, video, result);
        if (result.gestures?.length) {
          for (let i = 0; i < result.gestures.length; i++) {
            const top = result.gestures[i][0];
            if (!top || top.categoryName === "None") continue;
            const hand = result.handedness?.[i]?.[0]?.categoryName === "Left" ? "Left" : "Right";
            const recognized: RecognizedGesture = {
              gesture: top.categoryName,
              score: top.score,
              hand,
              timestamp: now,
            };
            setLastRecognized(recognized);
            // Dedupe: don't append the same gesture again within 1.2 s.
            const last = lastLoggedRef.current;
            if (last.gesture !== top.categoryName || now - last.at > 1200) {
              lastLoggedRef.current = { gesture: top.categoryName, at: now };
              setTranscript((prev) => [
                ...prev.slice(-19),
                GESTURE_LABELS[top.categoryName] ?? top.categoryName,
              ]);
            }
          }
        }
      } catch (e) {
        console.warn("[sign-recognizer] frame failed:", e);
      }
      rafId = requestAnimationFrame(loop);
    }

    init();

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
      recognizerRef.current?.close?.();
      recognizerRef.current = null;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="relative bg-slate-900 rounded-2xl overflow-hidden flex-1 min-h-[420px]">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }} // mirror so the preview reads like a mirror
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ transform: "scaleX(-1)" }}
        />
        <div className="absolute top-2 left-2 bg-slate-950/70 rounded-lg px-3 py-1 text-xs">
          {status === "loading-model" && "Loading model…"}
          {status === "requesting-camera" && "Requesting camera permission…"}
          {status === "ready" && (lastRecognized ? (
            <span>
              <span className="font-bold">{GESTURE_LABELS[lastRecognized.gesture] ?? lastRecognized.gesture}</span>
              {" · "}
              <span className="opacity-70">
                {(lastRecognized.score * 100).toFixed(0)}% · {lastRecognized.hand} hand
              </span>
            </span>
          ) : "Watching for gestures…")}
          {status === "error" && <span className="text-red-300">Error: {error}</span>}
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recognized</h2>
          <button
            onClick={() => setTranscript([])}
            className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
          >
            Clear
          </button>
        </div>
        {transcript.length === 0 ? (
          <p className="text-xs opacity-60">
            Make one of the 7 supported gestures in view of the camera. Recognized
            signs appear here.
          </p>
        ) : (
          <ol className="text-sm flex flex-wrap gap-1">
            {transcript.map((g, i) => (
              <li key={i} className="px-2 py-1 rounded bg-slate-800">{g}</li>
            ))}
          </ol>
        )}
        <p className="text-[11px] opacity-50 mt-2">
          Preview only. MediaPipe's built-in recognizer covers 7 gestures
          (Open_Palm, Closed_Fist, Pointing_Up, Thumb_Up, Thumb_Down,
          Victory, ILoveYou). Full 250+ sign vocabulary needs a larger
          model — planned follow-up.
        </p>
      </div>
    </div>
  );
}

// Draw the hand landmarks + connectors on top of the video preview so the
// user gets clear feedback that the model is actually seeing them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawOverlay(canvas: HTMLCanvasElement, video: HTMLVideoElement, result: any) {
  const w = canvas.width = video.videoWidth || 640;
  const h = canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  if (!result.landmarks) return;
  ctx.strokeStyle = "#7dd3fc";
  ctx.fillStyle = "#7dd3fc";
  ctx.lineWidth = 2;
  // MediaPipe hand topology: 21 landmarks per hand, connected as fingers.
  const conn = [
    [0,1],[1,2],[2,3],[3,4],       // thumb
    [0,5],[5,6],[6,7],[7,8],       // index
    [5,9],[9,10],[10,11],[11,12],  // middle
    [9,13],[13,14],[14,15],[15,16],// ring
    [13,17],[17,18],[18,19],[19,20],// pinky
    [0,17],                        // palm
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const hand of result.landmarks) {
    for (const [a, b] of conn) {
      const A = hand[a], B = hand[b];
      if (!A || !B) continue;
      ctx.beginPath();
      ctx.moveTo(A.x * w, A.y * h);
      ctx.lineTo(B.x * w, B.y * h);
      ctx.stroke();
    }
    for (const pt of hand) {
      ctx.beginPath();
      ctx.arc(pt.x * w, pt.y * h, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
