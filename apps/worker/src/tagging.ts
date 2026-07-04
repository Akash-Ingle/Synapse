import { config } from "./config.js";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Generates topical tags for a document using Gemini. Falls back to a naive
 * keyword heuristic when no API key is present so the pipeline still produces output.
 */
export async function generateTags(text: string): Promise<string[]> {
  const snippet = text.slice(0, 6000);
  if (!config.geminiApiKey) return heuristicTags(snippet);

  const url = `${GEMINI_URL}/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text:
                `Return 3-6 short topical tags (lowercase, single or two words) for this document as a ` +
                `JSON array of strings, no prose:\n\n"""\n${snippet}\n"""`,
            },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 128 },
    }),
  });
  if (!res.ok) return heuristicTags(snippet);

  const data: any = await res.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const raw = parts.map((p: any) => p.text ?? "").join("");
  try {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    const arr = JSON.parse(raw.slice(start, end + 1));
    if (Array.isArray(arr)) return arr.map(String).slice(0, 6);
  } catch {
    /* fall through */
  }
  return heuristicTags(snippet);
}

function heuristicTags(text: string): string[] {
  const stop = new Set([
    "the", "and", "for", "with", "that", "this", "from", "have", "will", "your",
    "are", "was", "were", "our", "you", "not", "but", "all", "can", "has",
  ]);
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().match(/[a-z]{4,}/g) ?? []) {
    if (stop.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);
}
