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
