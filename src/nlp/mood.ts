import type { SentenceMood } from "../types";

const WH_TOKENS = new Set(["WHAT", "WHERE", "WHEN", "WHO", "WHY", "HOW", "WHICH"]);

// Derive the sentence-level non-manual (facial/head) grammar markers from
// the compiled gloss tokens. Called once per translation; the result is
// held for the whole sentence's playback, not re-evaluated per word —
// ASL non-manual markers span the clause.
export function moodFromGloss(gloss: string[]): SentenceMood {
  const whQuestion = gloss.some((t) => WH_TOKENS.has(t));
  const yesNoQuestion = !whQuestion && gloss.includes("QUESTION");
  const negation = gloss.includes("NO");
  return { yesNoQuestion, whQuestion, negation };
}
