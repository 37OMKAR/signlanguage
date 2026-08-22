import { useCallback, useMemo, useState } from "react";
import { AvatarStage } from "./components/AvatarStage";
import { TextInput } from "./components/TextInput";
import { CaptionOverlay } from "./components/CaptionOverlay";
import { ControlsPanel } from "./components/ControlsPanel";
import { textToGloss } from "./nlp";
import { moodFromGloss } from "./nlp/mood";
import { speak } from "./a11y/tts";
import type { PlayerSettings, SignFrame, SentenceMood } from "./types";
import { NEUTRAL_MOOD } from "./types";
import { loadSign, getEntry } from "./signs/loader";

// Default reach when a sign doesn't specify one (fingerspelling, and any
// sign not yet categorized). Chest/neutral signing-space height — NOT the
// same as a full head-height reach. See armReach's doc comment in types.ts
// for why this field exists at all: without it, every sign's hand lands
// at the exact same world position regardless of whether it's meant to
// touch the forehead, chin, or chest.
const DEFAULT_ARM_REACH = 0.55;

export default function App() {
  const [inputText, setInputText] = useState("");
  const [glossQueue, setGlossQueue] = useState<string[]>([]);
  const [currentGloss, setCurrentGloss] = useState<string>("");
  const [currentFrames, setCurrentFrames] = useState<SignFrame[]>([]);
  const [armReach, setArmReach] = useState<number>(DEFAULT_ARM_REACH);
  const [mood, setMood] = useState<SentenceMood>(NEUTRAL_MOOD);
  const [settings, setSettings] = useState<PlayerSettings>({
    speed: 0.7,
    fontSize: 24,
    highContrast: false,
    dyslexicFont: false,
    reducedMotion: false,
    ttsEnabled: true,
  });

  const handleTranslate = useCallback(async () => {
    console.log("[translate] click, text=", JSON.stringify(inputText));
    if (!inputText.trim()) {
      console.warn("[translate] empty input, bailing");
      return;
    }
    try {
      if (settings.ttsEnabled) speak(inputText);
    } catch (e) {
      console.warn("[translate] tts failed:", e);
    }
    let gloss: string[] = [];
    try {
      gloss = await textToGloss(inputText);
      console.log("[translate] gloss=", gloss);
    } catch (e) {
      console.error("[translate] gloss failed:", e);
      return;
    }
    setGlossQueue(gloss);
    setMood(moodFromGloss(gloss));
    if (gloss.length > 0) {
      const first = gloss[0];
      setCurrentGloss(first);
      setArmReach(getEntry(first)?.armReach ?? DEFAULT_ARM_REACH);
      try {
        const frames = await loadSign(first);
        console.log("[translate] frames for", first, "=", frames.length);
        setCurrentFrames(frames);
      } catch (e) {
        console.error("[translate] loadSign failed:", e);
      }
    }
  }, [inputText, settings.ttsEnabled]);

  const handleSignFinished = useCallback(async () => {
    setGlossQueue((prev) => {
      const [, ...rest] = prev;
      if (rest.length === 0) {
        setCurrentGloss("");
        setCurrentFrames([]);
        setMood(NEUTRAL_MOOD);
        return rest;
      }
      const next = rest[0];
      setCurrentGloss(next);
      setArmReach(getEntry(next)?.armReach ?? DEFAULT_ARM_REACH);
      loadSign(next).then(setCurrentFrames);
      return rest;
    });
  }, []);

  const rootClass = useMemo(
    () =>
      [
        "app-root h-full min-h-screen flex flex-col",
        settings.highContrast ? "high-contrast" : "",
        settings.dyslexicFont ? "font-dyslexic" : "",
      ]
        .filter(Boolean)
        .join(" "),
    [settings.highContrast, settings.dyslexicFont],
  );

  return (
    <div className={rootClass}>
      <header className="p-4 border-b border-slate-800">
        <h1 className="text-2xl font-bold">Text → Sign Language</h1>
        <p className="text-sm opacity-70">
          Type a sentence. The avatar will sign it. Fully accessible.
        </p>
      </header>

      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 p-4 overflow-hidden">
        <section className="relative bg-slate-900 rounded-2xl overflow-hidden min-h-[420px] lg:min-h-0">
          <AvatarStage
            frames={currentFrames}
            speed={settings.speed}
            reducedMotion={settings.reducedMotion}
            mood={mood}
            armReach={armReach}
            onFinished={handleSignFinished}
          />
          <CaptionOverlay
            currentGloss={currentGloss}
            upcoming={glossQueue.slice(1)}
            fontSize={settings.fontSize}
          />
        </section>

        <aside className="flex flex-col gap-4 overflow-auto">
          <TextInput
            value={inputText}
            onChange={setInputText}
            onSubmit={handleTranslate}
            fontSize={settings.fontSize}
          />
          <ControlsPanel settings={settings} onChange={setSettings} />
        </aside>
      </main>

      <footer className="p-2 text-xs text-center opacity-60 border-t border-slate-800">
        v0.1 dev — hands+head architecture. No video playback anywhere.
      </footer>
    </div>
  );
}
