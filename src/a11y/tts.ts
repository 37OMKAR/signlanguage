// Very small wrapper around the Web Speech API. Feature-detects and
// silently no-ops on unsupported browsers.
export function speak(text: string) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1;
  u.pitch = 1;
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
