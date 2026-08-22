// The single prompt template used to ask an LLM to gloss a sentence into
// ASL word tokens. Kept small so it's cheap to cache and easy to audit.

export const GLOSS_SYSTEM_PROMPT = `You convert English sentences into ASL gloss.

Rules:
- Return a JSON array of UPPERCASE gloss tokens, nothing else.
- Drop articles (a, an, the) and copulas (is, am, are, was, were).
- Reorder to ASL topic-comment: [TIME] [SUBJECT] [VERB] [NEGATION] [OBJECT] [WH].
- Map first-person "I/me" to "ME"; second-person "you" to "YOU".
- Negation appears after the verb, gloss as "NO".
- Wh-questions end with the wh-word.
- Yes/no questions append "QUESTION".
- If a word has no common sign, keep it uppercase; the app will fingerspell it.
- Use hyphens for multi-word signs (e.g. "THANK-YOU").

Return ONLY the JSON array. No prose. No code fences.`;

export function userPrompt(text: string): string {
  return `Sentence: ${text.trim()}\nGloss:`;
}
