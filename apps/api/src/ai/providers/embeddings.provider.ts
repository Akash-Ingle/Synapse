import { Inject, Injectable, Logger } from "@nestjs/common";
import { createHash } from "node:crypto";
import { APP_CONFIG } from "../../config/config.module";
import type { AppConfig } from "../../config/configuration";

const GEMINI_EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Embedding provider abstraction. Default is Gemini gemini-embedding-001 (free tier, 768-dim).
 * Falls back to a deterministic hash-based stub when no API key is set.
 */
@Injectable()
export class EmbeddingsProvider {
  private readonly logger = new Logger(EmbeddingsProvider.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get dimension(): number {
    return this.config.EMBEDDINGS_DIM;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (this.config.EMBEDDINGS_PROVIDER === "gemini" && this.config.GEMINI_API_KEY) {
      return this.embedGemini(texts);
    }
    return texts.map((t) => this.stubVector(t));
  }

  async embedOne(text: string): Promise<number[]> {
    const [v] = await this.embed([text]);
    return v;
  }

  private async embedGemini(texts: string[]): Promise<number[][]> {
    const model = this.config.EMBEDDINGS_MODEL || "gemini-embedding-001";
    const url = `${GEMINI_EMBED_URL}/${model}:batchEmbedContents?key=${this.config.GEMINI_API_KEY}`;

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

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Gemini embeddings error ${res.status}: ${body}`);
      throw new Error(`Gemini embeddings API error: ${res.status}`);
    }

    const data: any = await res.json();
    return (data.embeddings ?? []).map((e: any) => e.values as number[]);
  }

  /** Deterministic hash-seeded unit-ish vector for offline dev. */
  private stubVector(text: string): number[] {
    const dim = this.dimension;
    const vec = new Array<number>(dim);
    const seed = createHash("sha256").update(text).digest();
    for (let i = 0; i < dim; i++) {
      const b = seed[i % seed.length];
      vec[i] = (b / 127.5 - 1) * (1 + (i % 7) * 0.01);
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}
