// Batch translation: send many sentences to the AI proxy in ONE request.
// Not used by the live single-sentence UI flow (that stays on textToGloss
// for low latency) — this is for bulk workflows: pre-processing a lesson's
// worth of sentences, a document, or a transcript, where a large-context
// model like LongCat-2.0 can process hundreds of sentences per call instead
// of one round-trip each.

export interface BatchGlossRequest {
  proxyUrl?: string;
  model?: "longcat-2.0";
  texts: string[];
}

export async function batchTextToGloss(
  req: BatchGlossRequest,
): Promise<string[][]> {
  const url = req.proxyUrl ?? "/api/gloss-batch";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: req.model ?? "longcat-2.0",
      texts: req.texts,
    }),
  });
  if (!res.ok) throw new Error(`Batch proxy ${res.status}`);
  const data = (await res.json()) as { results?: unknown };
  if (!Array.isArray(data.results)) throw new Error("Bad batch response");
  return data.results.map((g) => (Array.isArray(g) ? g.map(String) : []));
}
