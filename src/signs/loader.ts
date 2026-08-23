import type { SignEntry, SignFrame, AuthoredEntry } from "../types";
import rawDictionary from "../../data/gloss_dictionary.json";
import { compileDictionary } from "./compile";

const compiled: Record<string, SignEntry> = compileDictionary(
  rawDictionary as unknown as Record<string, AuthoredEntry>,
);

const cache = new Map<string, SignFrame[]>();

// Public metadata about a gloss.
export function getEntry(gloss: string): SignEntry | undefined {
  return compiled[gloss];
}

export function hasSign(gloss: string): boolean {
  return gloss in compiled;
}

// All gloss keys in the compiled dictionary. Useful for batch validation,
// long-run E2E tests, and building diagnostic UIs (e.g. a "browse the
// vocabulary" panel).
export function listGlosses(): string[] {
  return Object.keys(compiled);
}

// Get the frames for a gloss. Missing glosses fall back to fingerspelling:
// concatenate each letter's frames with time offset.
export async function loadSign(gloss: string): Promise<SignFrame[]> {
  if (cache.has(gloss)) return cache.get(gloss)!;
  const entry = compiled[gloss];
  if (entry) {
    cache.set(gloss, entry.frames);
    return entry.frames;
  }
  const letters = gloss.toUpperCase().split("").filter((c) => /[A-Z]/.test(c));
  const frames: SignFrame[] = [];
  let offset = 0;
  const gapMs = 120;
  for (const letter of letters) {
    const le = compiled[letter];
    if (!le) continue;
    for (const f of le.frames) {
      frames.push({ ...f, t_ms: f.t_ms + offset });
    }
    offset += le.duration_ms + gapMs;
  }
  if (frames.length === 0) frames.push(restFrame());
  cache.set(gloss, frames);
  return frames;
}

// Neutral rest pose — used at boot and after the queue empties.
export function restFrame(): SignFrame {
  return { t_ms: 0, bones: {} };
}

// Guard used by CI/build step — no wlasl-derived signs may ship commercially.
export function auditCommercialSafety(): { unsafeCount: number; unsafe: string[] } {
  const unsafe = Object.values(compiled)
    .filter((e) => !e.commercial_safe || e.provenance === "wlasl-derived")
    .map((e) => e.gloss);
  return { unsafeCount: unsafe.length, unsafe };
}
