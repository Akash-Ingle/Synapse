import { Inject, Injectable, Logger } from "@nestjs/common";
import { APP_CONFIG } from "../../config/config.module";
import type { AppConfig } from "../../config/configuration";

export interface LlmUsage {
  tokensIn: number;
  tokensOut: number;
}

export interface LlmResult {
  text: string;
  usage: LlmUsage;
}

export interface LlmGenerateOptions {
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Google Gemini provider. Falls back to a deterministic local stub when no API key is
 * configured, so the whole product runs end-to-end in dev without external calls.
 */
@Injectable()
export class LlmProvider {
  private readonly logger = new Logger(LlmProvider.name);
  private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get enabled(): boolean {
    return Boolean(this.config.GEMINI_API_KEY);
  }

  private get model(): string {
    return this.config.GEMINI_MODEL;
  }

  async generate(opts: LlmGenerateOptions): Promise<LlmResult> {
    if (!this.enabled) return this.stub(opts);

    const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.config.GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(this.buildBody(opts)),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Gemini API error ${res.status}: ${body}`);
      throw new Error(`Gemini API error: ${res.status}`);
    }

    const data: any = await res.json();
    const text = this.extractText(data);
    return {
      text,
      usage: {
        tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
        tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }

  /** Streams text deltas. Yields plain string chunks; caller handles transport (SSE). */
  async *stream(opts: LlmGenerateOptions): AsyncGenerator<string> {
    if (!this.enabled) {
      const { text } = this.stub(opts);
      for (const word of text.split(" ")) yield word + " ";
      return;
    }

    const url =
      `${this.baseUrl}/${this.model}:streamGenerateContent?alt=sse&key=${this.config.GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(this.buildBody(opts)),
    });

    if (!res.ok || !res.body) {
      const body = res.body ? await res.text() : "";
      this.logger.error(`Gemini stream error ${res.status}: ${body}`);
      throw new Error(`Gemini API stream error: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          const chunk = this.extractText(evt);
          if (chunk) yield chunk;
        } catch {
          // ignore keep-alive / non-JSON lines
        }
      }
    }
  }

  private buildBody(opts: LlmGenerateOptions): Record<string, unknown> {
    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: opts.prompt }] }],
      generationConfig: {
        maxOutputTokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.4,
      },
    };
    if (opts.system) {
      body.systemInstruction = { parts: [{ text: opts.system }] };
    }
    return body;
  }

  private extractText(data: any): string {
    const candidates = data.candidates ?? [];
    if (candidates.length === 0) return "";
    const parts = candidates[0]?.content?.parts ?? [];
    return parts
      .filter((p: any) => typeof p.text === "string")
      .map((p: any) => p.text)
      .join("");
  }

  /** Deterministic offline stub — keeps the product demoable without an API key. */
  private stub(opts: LlmGenerateOptions): LlmResult {
    const preview = opts.prompt.replace(/\s+/g, " ").slice(0, 220);
    const text =
      `[AI stub — set GEMINI_API_KEY to enable Gemini]\n\n` +
      `Request context: ${preview}${opts.prompt.length > 220 ? "…" : ""}`;
    return { text, usage: { tokensIn: 0, tokensOut: 0 } };
  }
}
