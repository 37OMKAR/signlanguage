import nlp from "compromise";

// Words dropped in ASL-style gloss.
const DROP = new Set([
  "a", "an", "the",
  "is", "am", "are", "was", "were", "be", "been", "being",
  "do", "does", "did",
  "of", "to", "for", "at", "on", "in",
  "very",
]);

// Pronoun / word substitutions to canonical gloss forms.
const REMAP: Record<string, string> = {
  "i": "ME",
  "my": "MY",
  "me": "ME",
  "mine": "MINE",
  "you": "YOU",
  "your": "YOUR",
  "he": "HE",
  "she": "SHE",
  "we": "WE",
  "us": "US",
  "they": "THEY",
  "thanks": "THANK-YOU",
  "thank": "THANK-YOU",
};

// Time expressions we push to the front (ASL topicalization).
const TIME_WORDS = new Set([
  "yesterday", "today", "tomorrow", "now", "later", "before", "after",
  "morning", "evening", "night", "week", "month", "year",
]);

// Wh-question words that go to the end in ASL.
const WH_WORDS = new Set([
  "what", "where", "when", "who", "why", "how", "which",
]);

// Negation markers get lifted after the verb in ASL.
const NEG_WORDS = new Set(["not", "no", "never", "none", "cannot", "can't", "don't", "doesn't", "didn't", "won't"]);

export function ruleBasedGloss(text: string): string[] {
  const clean = text.trim();
  if (!clean) return [];

  const isQuestion = /\?\s*$/.test(clean);
  const doc = nlp(clean.toLowerCase());
  const rawTokens: string[] = doc
    .terms()
    .out("array")
    .map((t: string) => t.replace(/[^a-z0-9']/g, ""))
    .filter(Boolean);

  const remapped = rawTokens
    .filter((t) => !DROP.has(t))
    .map((t) => REMAP[t] ?? t);

  // Split by category so we can reorder.
  const times: string[] = [];
  const negations: string[] = [];
  const whs: string[] = [];
  const rest: string[] = [];
  for (const t of remapped) {
    const lower = t.toLowerCase();
    if (TIME_WORDS.has(lower)) times.push(t);
    else if (NEG_WORDS.has(lower)) negations.push("NO");
    else if (WH_WORDS.has(lower)) whs.push(t);
    else rest.push(t);
  }

  // ASL order: [TIME] [SUBJECT ...] [VERB] [NEG] [OBJECT ...] [WH]
  // The rule-based pass can't reliably tag subj/verb/obj, so we keep the
  // remaining word order but move times to front, negations after rest,
  // wh-words to the end. Question sentences that had no explicit wh-word
  // still get a "QUESTION" marker appended for the caption/face layer.
  const ordered = [...times, ...rest, ...negations, ...whs];
  if (isQuestion && whs.length === 0 && !ordered.includes("QUESTION")) {
    ordered.push("QUESTION");
  }

  return ordered
    .map((t) => (t.startsWith("THANK") ? t : t.toUpperCase()))
    .filter(Boolean);
}
