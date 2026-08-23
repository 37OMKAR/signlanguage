import { useCallback, useMemo, useState } from "react";
import { AvatarStage } from "./components/AvatarStage";
import { TextInput } from "./components/TextInput";
import { CaptionOverlay } from "./components/CaptionOverlay";
import { ControlsPanel } from "./components/ControlsPanel";
import { textToGloss } from "./nlp";
import { moodFromGloss } from "./nlp/mood";
import { speak, glossToSpeech, stopSpeaking } from "./a11y/tts";
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
  // Track the last translated sentence so the Replay button can re-fire
  // it without the user retyping.
  const [lastTranslated, setLastTranslated] = useState<string>("");
  const [settings, setSettings] = useState<PlayerSettings>({
    // Lowered from 0.7 to 0.45 after user feedback that default was
    // "too fast" -- signs blur past before they're recognisable. Still
    // adjustable via the Accessibility panel slider.
    speed: 0.45,
    fontSize: 24,
    highContrast: false,
    dyslexicFont: false,
    reducedMotion: false,
    ttsEnabled: true,
  });

  // Speak just one gloss token, gated by the TTS setting. Kept as a ref-
  // free helper so both handleTranslate (first sign) and handleSignFinished
  // (each subsequent sign) hit it at exactly the moment the sign starts
  // playing on screen -- that's what "read-out follows the sign" means.
  const speakGloss = useCallback((gloss: string) => {
    if (!settings.ttsEnabled) return;
    const phrase = glossToSpeech(gloss);
    if (!phrase) return;
    try { speak(phrase); }
    catch (e) { console.warn("[translate] tts failed:", e); }
  }, [settings.ttsEnabled]);

  const translateText = useCallback(async (text: string) => {
    console.log("[translate] text=", JSON.stringify(text));
    if (!text.trim()) {
      console.warn("[translate] empty input, bailing");
      return;
    }
    // Cancel any previous utterance -- otherwise a fast-clicking user
    // stacks up sentence-length audio that plays over the new signs.
    stopSpeaking();
    let gloss: string[] = [];
    try {
      gloss = await textToGloss(text);
      console.log("[translate] gloss=", gloss);
    } catch (e) {
      console.error("[translate] gloss failed:", e);
      return;
    }
    setLastTranslated(text);
    setGlossQueue(gloss);
    setMood(moodFromGloss(gloss));
    if (gloss.length > 0) {
      const first = gloss[0];
      setCurrentGloss(first);
      setArmReach(getEntry(first)?.armReach ?? DEFAULT_ARM_REACH);
      speakGloss(first);
      try {
        const frames = await loadSign(first);
        console.log("[translate] frames for", first, "=", frames.length);
        setCurrentFrames(frames);
      } catch (e) {
        console.error("[translate] loadSign failed:", e);
      }
    }
  }, [speakGloss]);

  const handleTranslate = useCallback(
    () => translateText(inputText),
    [inputText, translateText],
  );

  // Re-fire the most recently translated sentence without needing the user
  // to retype -- helpful for practice / re-watching a sign at a slower
  // speed. Falls back to whatever is currently in the input box if we
  // haven't translated anything yet this session.
  const handleReplay = useCallback(
    () => translateText(lastTranslated || inputText),
    [lastTranslated, inputText, translateText],
  );

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
      speakGloss(next);
      loadSign(next).then(setCurrentFrames);
      return rest;
    });
  }, [speakGloss]);

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
            onReplay={handleReplay}
            canReplay={Boolean((lastTranslated || inputText).trim())}
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
