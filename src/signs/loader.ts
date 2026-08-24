import type {
  SignEntry, SignFrame, AuthoredEntry, Provenance, SignLanguage,
} from "../types";
import rawDictionary from "../../data/gloss_dictionary.json";
import { compileDictionary } from "./compile";

const compiled: Record<string, SignEntry> = compileDictionary(
  rawDictionary as unknown as Record<string, AuthoredEntry>,
);

const cache = new Map<string, SignFrame[]>();

// Derive which sign language an entry represents from its provenance.
// kaggle-include-isl is the only ISL source we have; everything else is
// ASL (hand-authored used ASL conventions, signmatic-asl explicitly,
// kaggle-google-asl/wlasl-derived explicitly). Letters A-Z are treated
// as language-agnostic since fingerspelling of English words works the
// same either way at our fidelity.
export function provenanceLanguage(p: Provenance): "ASL" | "ISL" {
  return p === "kaggle-include-isl" ? "ISL" : "ASL";
}

function entryMatchesLanguage(e: SignEntry, lang: SignLanguage): boolean {
  if (lang === "any") return true;
  // Letters stay available in either mode (fingerspelling fallback).
  if (e.gloss.length === 1 && /^[A-Z]$/.test(e.gloss)) return true;
  return provenanceLanguage(e.provenance) === lang;
}

// Public metadata about a gloss.
export function getEntry(gloss: string): SignEntry | undefined {
  return compiled[gloss];
}

export function hasSign(gloss: string, lang: SignLanguage = "any"): boolean {
  const e = compiled[gloss];
  if (!e) return false;
  return entryMatchesLanguage(e, lang);
}

// All gloss keys in the compiled dictionary. Useful for batch validation,
// long-run E2E tests, and building diagnostic UIs (e.g. a "browse the
// vocabulary" panel).
export function listGlosses(): string[] {
  return Object.keys(compiled);
}

// Get the frames for a gloss, respecting a language filter. If the sign
// exists but is in a DIFFERENT language than requested, we treat it as
// "not present" and fall back to fingerspelling -- so if the user picks
// ASL and asks for RESTAURANT (only in our ISL dict), they see the
// letter-by-letter fingerspelling of the word instead of the ISL sign.
// Missing/unavailable glosses always fingerspell.
export async function loadSign(
  gloss: string, lang: SignLanguage = "any",
): Promise<SignFrame[]> {
  const cacheKey = `${lang}:${gloss}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;
  const entry = compiled[gloss];
  if (entry && entryMatchesLanguage(entry, lang)) {
    cache.set(cacheKey, entry.frames);
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
  cache.set(cacheKey, frames);
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
