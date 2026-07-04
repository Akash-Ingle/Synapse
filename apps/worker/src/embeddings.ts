import { createHash } from "node:crypto";
import { config } from "./config.js";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export async function embed(texts: string[]): Promise<number[][]> {
  if (config.embeddingsProvider === "gemini" && config.geminiApiKey) {
    return embedGemini(texts);
  }
  return texts.map(stubVector);
}

async function embedGemini(texts: string[]): Promise<number[][]> {
  const model = config.embeddingsModel;
  const url = `${GEMINI_URL}/${model}:batchEmbedContents?key=${config.geminiApiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${model}`,
        content: { parts: [{ text }] },
      })),
    }),
  });
  if (!res.ok) throw new Error(`Gemini embeddings API error: ${res.status}`);
  const data: any = await res.json();
  return (data.embeddings ?? []).map((e: any) => e.values as number[]);
}

function stubVector(text: string): number[] {
  const dim = config.embeddingsDim;
  const vec = new Array<number>(dim);
  const seed = createHash("sha256").update(text).digest();
  for (let i = 0; i < dim; i++) {
    const b = seed[i % seed.length];
    vec[i] = (b / 127.5 - 1) * (1 + (i % 7) * 0.01);
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export function chunkText(text: string, size = 1500): string[] {
  const clean = text.trim();
  if (!clean) return [];
  const paras = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";
  for (const p of paras) {
    if ((current + "\n\n" + p).length > size && current) {
      chunks.push(current.trim());
      current = p;
    } else {
      current = current ? current + "\n\n" + p : p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
