import { useEffect, useRef, useState } from "react";
import { classifyLetter } from "../signs/handshapeClassifier";

// MediaPipe HandLandmarker gives us 21 3D landmarks per hand each frame.
// Instead of using the tiny 7-gesture built-in recognizer, we run our own
// rule-based ASL-alphabet classifier over the landmark geometry to
// identify A-Z letters (see classifyLetter). Letters are then debounced
// (held for N frames) and committed into a WORD buffer; a hand-absent
// pause commits the word to a SENTENCE list; explicit backspace/clear
// controls let the user correct mistakes.

const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

const COMMIT_FRAMES = 12;       // ~400 ms at 30 fps -- letter must be held this long
const WORD_BOUNDARY_MS = 900;   // hand absent this long -> commit current word

export function SignRecognizer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const landmarkerRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading-model" | "requesting-camera" | "ready" | "error">("loading-model");
  const [error, setError] = useState<string>("");

  // Live UI state.
  const [currentLetter, setCurrentLetter] = useState<string>(""); // what we're seeing THIS frame
  const [currentWord, setCurrentWord] = useState<string>("");     // letters committed but not yet closed into a word
  const [sentence, setSentence] = useState<string[]>([]);          // committed words

  // Refs so the animation loop can read/write without re-rendering.
  const streakRef = useRef({ letter: "", count: 0 });
  const lastHandSeenAtRef = useRef<number>(performance.now());
  const currentWordRef = useRef<string>("");
  useEffect(() => { currentWordRef.current = currentWord; }, [currentWord]);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let rafId = 0;

    async function init() {
      try {
        setStatus("loading-model");
        const vision = await import("@mediapipe/tasks-vision");
        const filesetResolver = await vision.FilesetResolver.forVisionTasks(WASM_URL);
        const landmarker = await vision.HandLandmarker.createFromOptions(filesetResolver, {
          baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });
        if (stopped) { landmarker.close(); return; }
        landmarkerRef.current = landmarker;

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
      const landmarker = landmarkerRef.current;
      if (stopped || !video || !canvas || !landmarker) return;
      if (video.readyState < 2) { rafId = requestAnimationFrame(loop); return; }

      const now = performance.now();
      try {
        const result = landmarker.detectForVideo(video, now);
        drawOverlay(canvas, video, result);

        if (result.landmarks && result.landmarks.length > 0) {
          lastHandSeenAtRef.current = now;
          const hand = result.landmarks[0];  // just the first (numHands: 1)
          const letter = classifyLetter(hand);
          setCurrentLetter(letter || "?");

          // Debounce: only commit a letter that stayed the same for
          // COMMIT_FRAMES in a row.
          const streak = streakRef.current;
          if (letter && letter === streak.letter) {
            streak.count += 1;
            if (streak.count === COMMIT_FRAMES) {
              // Commit -- but don't double-commit the same letter unless
              // the user explicitly moved out and back in (streak resets).
              setCurrentWord((prev) => prev + letter);
            }
          } else {
            streak.letter = letter || "";
            streak.count = 0;
          }
        } else {
          setCurrentLetter("");
          streakRef.current = { letter: "", count: 0 };
          // Word boundary: hand absent long enough -> commit word.
          if (now - lastHandSeenAtRef.current > WORD_BOUNDARY_MS && currentWordRef.current) {
            setSentence((prev) => [...prev, currentWordRef.current]);
            setCurrentWord("");
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
      landmarkerRef.current?.close?.();
      landmarkerRef.current = null;
    };
  }, []);

  const commitWord = () => {
    if (!currentWord) return;
    setSentence((prev) => [...prev, currentWord]);
    setCurrentWord("");
  };
  const backspace = () => setCurrentWord((w) => w.slice(0, -1));
  const clearAll = () => { setCurrentWord(""); setSentence([]); };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Camera preview + landmark overlay */}
      <div className="relative bg-slate-900 rounded-2xl overflow-hidden min-h-[300px] flex-1">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
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
          {status === "ready" && (currentLetter ? `Detected: ${currentLetter}` : "Show a hand…")}
          {status === "error" && <span className="text-red-300">Error: {error}</span>}
        </div>
        {/* Big current-letter overlay so user sees WHAT the model thinks
            they're signing right this second, and how far along the
            debounce streak is (progress bar fills as they hold the pose). */}
        {status === "ready" && currentLetter && (
          <div className="absolute top-2 right-2 bg-slate-950/80 rounded-2xl p-3 flex flex-col items-center gap-1 min-w-[110px]">
            <div className="text-5xl font-bold text-sky-300">{currentLetter}</div>
            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-400 transition-all"
                style={{ width: `${Math.min(100, (streakRef.current.count / COMMIT_FRAMES) * 100)}%` }}
              />
            </div>
            <div className="text-[10px] opacity-60">hold to commit</div>
          </div>
        )}
      </div>

      {/* Word being built + committed sentence + controls */}
      <div className="bg-slate-900 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase opacity-60 min-w-[60px]">Word</span>
          <span
            className="flex-1 text-2xl font-mono tracking-wider bg-slate-800 rounded-lg px-3 py-2 min-h-[44px]"
            aria-live="polite"
          >
            {currentWord || <span className="opacity-40 text-base font-sans">…letters you're spelling</span>}
          </span>
          <button
            onClick={backspace}
            disabled={!currentWord}
            className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-sm"
            title="Delete last letter"
            aria-label="Backspace"
          >
            ⌫
          </button>
          <button
            onClick={commitWord}
            disabled={!currentWord}
            className="px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 text-sm font-bold"
            title="Finish this word and start a new one"
          >
            Space
          </button>
        </div>

        <div className="flex items-start gap-2">
          <span className="text-xs uppercase opacity-60 min-w-[60px] mt-2">Sentence</span>
          <p
            className="flex-1 text-lg bg-slate-800 rounded-lg px-3 py-2 min-h-[44px]"
            aria-live="polite"
          >
            {sentence.length === 0
              ? <span className="opacity-40 text-sm">finished words land here — pause your hand to end a word</span>
              : sentence.join(" ")}
          </p>
          <button
            onClick={clearAll}
            disabled={!sentence.length && !currentWord}
            className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-sm"
            title="Clear everything"
          >
            Clear
          </button>
        </div>

        <p className="text-[11px] opacity-50">
          Rule-based ASL A-Z fingerspelling classifier. Hold each letter
          steady ~0.4 s to commit it; pause your hand for ~0.9 s to finish
          a word. Letters that look similar (M/N, R/U/V, S/T) may need a
          clearer pose. Not every ASL letter is distinguishable from
          landmarks alone (dynamic J and Z are best drawn with intent).
        </p>
      </div>
    </div>
  );
}

// Draw the hand landmarks + connectors so the user gets clear feedback
// that the model is seeing them.
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
  const conn = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],
    [0,17],
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
