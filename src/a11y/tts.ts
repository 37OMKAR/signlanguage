// Very small wrapper around the Web Speech API. Feature-detects and
// silently no-ops on unsupported browsers.
//
// The default voice on nearly every OS/browser combo is the harshest-
// sounding one available. Users have described the app's TTS as "raw".
// pickBestEnglishVoice() enumerates the installed voices and prefers,
// in order: neural/natural voices (Windows "Natural", Google Chrome's
// "Google" prefix, Mac "Enhanced"/"Premium"), then any local English
// voice, then any English voice, then whatever the browser defaults to.
// This alone lifts most systems out of the SAPI-5-era robot voice.
let _cachedVoice: SpeechSynthesisVoice | null | undefined;

function pickBestEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined") return null;
  if (_cachedVoice !== undefined) return _cachedVoice;
  const voices = window.speechSynthesis?.getVoices() ?? [];
  if (voices.length === 0) return null; // getVoices sometimes returns [] before onvoiceschanged; caller re-tries later
  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const pool = english.length ? english : voices;
  // Score each candidate; higher is better.
  const score = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase();
    let s = 0;
    if (/natural|neural/.test(n)) s += 100;             // Windows 11 "Microsoft ... Natural"
    if (/enhanced|premium/.test(n)) s += 90;             // macOS "Samantha (Enhanced)"
    if (n.startsWith("google")) s += 80;                 // Chrome's built-in Google voices
    if (/wavenet/.test(n)) s += 80;                      // Google WaveNet-branded
    if (/^microsoft (aria|jenny|guy|davis)/.test(n)) s += 60;  // Windows 11 modern voices
    if (v.lang?.toLowerCase() === "en-us") s += 5;
    if (v.localService) s += 2;                          // network voices can lag on first use
    return s;
  };
  pool.sort((a, b) => score(b) - score(a));
  _cachedVoice = pool[0] ?? null;
  return _cachedVoice;
}

// Re-select if the voice list arrives asynchronously (Chrome does this).
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    _cachedVoice = undefined;
    pickBestEnglishVoice();
  };
}

export function speak(text: string) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1;
  u.pitch = 1;
  const v = pickBestEnglishVoice();
  if (v) {
    u.voice = v;
    u.lang = v.lang;
  }
  synth.speak(u);
}

// Convert a single gloss token (e.g. "HELLO", "I-LOVE-YOU", "THANK-YOU",
// "QUESTION") into a phrase suitable for spoken output that syncs with a
// single sign playing. Returns null for tokens that are pure grammatical
// markers with no spoken counterpart (e.g. "QUESTION" is a facial marker,
// not a word to read aloud).
export function glossToSpeech(gloss: string): string | null {
  if (!gloss) return null;
  if (gloss === "QUESTION") return null;
  // Hyphenated idioms (I-LOVE-YOU, THANK-YOU) are one sign but multiple
  // spoken words -- expand hyphens back to spaces and lowercase so the
  // TTS says "i love you" instead of spelling out "I-LOVE-YOU".
  return gloss.replace(/-/g, " ").toLowerCase();
}

// Cancel any in-flight speech. Useful when the caller wants to start
// a new utterance without letting the previous one keep talking over it.
export function stopSpeaking() {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}
