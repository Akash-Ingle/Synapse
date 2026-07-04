import { Injectable, Logger } from "@nestjs/common";
import { createHash } from "node:crypto";
import {
  DocumentRole,
  OutlineSchema,
  TaskExtractionResultSchema,
  type Outline,
  type RewriteRequest,
  type SemanticSearchHit,
  type SemanticSearchRequest,
  type SummarizeRequest,
  type TaskExtractionResult,
  type ChatDocResponse,
  type NotesToDocResponse,
  type SemanticDiffResponse,
  type StyleAudience,
} from "@synapse/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionsService } from "../permissions/permissions.service";
import { LlmProvider, type LlmGenerateOptions, type LlmUsage } from "./providers/llm.provider";
import { EmbeddingsProvider } from "./providers/embeddings.provider";
import {
  SYSTEM_WRITING_ASSISTANT,
  expandPrompt,
  outlinePrompt,
  reduceSummariesPrompt,
  rewritePrompt,
  summarizePrompt,
  taskExtractionPrompt,
  chatDocPrompt,
  notesToDocPrompt,
  styleAdaptPrompt,
  semanticDiffPrompt,
} from "./prompts";

// Gemini 2.5 Flash free tier has no per-token cost; paid tier is $0.15/$0.60 per 1M tokens.
// We track $0 for free-tier use but the ledger infrastructure is in place for a paid switch.
const COST_PER_INPUT_TOKEN = 0;
const COST_PER_OUTPUT_TOKEN = 0;
const MAP_REDUCE_THRESHOLD = 8000; // chars before we chunk + map-reduce summarize

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly llm: LlmProvider,
    private readonly embeddings: EmbeddingsProvider,
  ) {}

  // ── Rewrite / expand ─────────────────────────────────────────
  async rewrite(userId: string, req: RewriteRequest): Promise<{ text: string }> {
    const docType = await this.docTypeIfPermitted(userId, req.documentId, DocumentRole.EDITOR);
    const prompt = rewritePrompt({
      selection: req.selection,
      mode: req.mode,
      instruction: req.instruction,
      docType,
    });
    const text = await this.run("rewrite", req.documentId, {
      system: SYSTEM_WRITING_ASSISTANT,
      prompt,
      temperature: 0.5,
    });
    return { text };
  }

  buildRewritePrompt(req: RewriteRequest, docType?: string): LlmGenerateOptions {
    return {
      system: SYSTEM_WRITING_ASSISTANT,
      prompt: rewritePrompt({
        selection: req.selection,
        mode: req.mode,
        instruction: req.instruction,
        docType,
      }),
      temperature: 0.5,
    };
  }

  async expand(userId: string, documentId: string | undefined, selection: string) {
    const docType = await this.docTypeIfPermitted(userId, documentId, DocumentRole.EDITOR);
    const text = await this.run("expand", documentId, {
      system: SYSTEM_WRITING_ASSISTANT,
      prompt: expandPrompt(selection, docType),
      temperature: 0.6,
    });
    return { text };
  }

  // ── Summarize (map-reduce for long docs) ─────────────────────
  async summarize(userId: string, req: SummarizeRequest): Promise<{ summary: string }> {
    await this.docTypeIfPermitted(userId, req.documentId, DocumentRole.VIEWER);

    if (req.text.length <= MAP_REDUCE_THRESHOLD) {
      const summary = await this.run("summarize", req.documentId, {
        system: SYSTEM_WRITING_ASSISTANT,
        prompt: summarizePrompt(req.text, req.length),
      });
      return { summary };
    }

    // Map: summarize each chunk; Reduce: combine partial summaries.
    const chunks = this.chunk(req.text, 6000);
    const partials: string[] = [];
    for (const c of chunks) {
      partials.push(
        await this.run("summarize", req.documentId, {
          system: SYSTEM_WRITING_ASSISTANT,
          prompt: summarizePrompt(c, "short"),
        }),
      );
    }
    const summary = await this.run("summarize", req.documentId, {
      system: SYSTEM_WRITING_ASSISTANT,
      prompt: reduceSummariesPrompt(partials, req.length),
    });
    return { summary };
  }

  // ── Outline (structured output + schema validation + repair) ──
  async outline(userId: string, documentId: string | undefined, text: string): Promise<Outline> {
    await this.docTypeIfPermitted(userId, documentId, DocumentRole.VIEWER);
    const raw = await this.run("outline", documentId, {
      system: SYSTEM_WRITING_ASSISTANT,
      prompt: outlinePrompt(text),
    });
    return this.parseOutline(raw);
  }

  private parseOutline(raw: string): Outline {
    const jsonText = this.extractJson(raw);
    const parsed = OutlineSchema.safeParse(safeJson(jsonText));
    if (parsed.success) return parsed.data;
    this.logger.warn("Outline schema validation failed; returning minimal fallback");
    return { title: "Outline", sections: [] };
  }

  // ── Task extraction ───────────────────────────────────────────
  async extractTasks(userId: string, documentId: string, text: string): Promise<TaskExtractionResult> {
    await this.permissions.requireRole(userId, documentId, DocumentRole.VIEWER);
    const raw = await this.run("task_extraction", documentId, {
      system: SYSTEM_WRITING_ASSISTANT,
      prompt: taskExtractionPrompt(text),
    });
    const jsonText = this.extractJson(raw);
    const parsed = TaskExtractionResultSchema.safeParse(safeJson(jsonText));
    if (parsed.success) return parsed.data;
    this.logger.warn("Task extraction schema validation failed");
    return { tasks: [] };
  }

  // ── Chat with document (RAG) ─────────────────────────────────
  async chatWithDoc(userId: string, documentId: string, question: string, editorText?: string): Promise<ChatDocResponse> {
    await this.permissions.requireRole(userId, documentId, DocumentRole.VIEWER);

    let context = "";
    let citations: { content: string; chunkIndex: number }[] = [];

    // Try RAG retrieval via embeddings first
    try {
      const [queryVec] = await this.embeddings.embed([question]);
      const literal = `[${queryVec.join(",")}]`;
      const rows = await this.prisma.$queryRawUnsafe<
        { chunk_index: number; content: string; score: number }[]
      >(
        `SELECT chunk_index, content, 1 - (embedding <=> $1::vector) AS score
         FROM embeddings
         WHERE document_id = $2::uuid AND version_no IS NULL
         ORDER BY embedding <=> $1::vector
         LIMIT 5`,
        literal,
        documentId,
      );

      if (rows.length > 0) {
        context = rows.map((r) => r.content).join("\n\n---\n\n");
        citations = rows.map((r) => ({ content: r.content, chunkIndex: r.chunk_index }));
      }
    } catch (err) {
      this.logger.warn(`Embedding retrieval failed, falling back to full text: ${err}`);
    }

    // Fallback: use editor text sent from frontend, or contentText from DB
    if (!context) {
      if (editorText?.trim()) {
        context = editorText.slice(0, 8000);
      } else {
        const doc = await this.prisma.document.findUnique({
          where: { id: documentId },
          select: { contentText: true },
        });
        context = (doc?.contentText ?? "").slice(0, 8000);
      }
    }

    const answer = await this.run("chat_doc", documentId, {
      system: SYSTEM_WRITING_ASSISTANT,
      prompt: chatDocPrompt(question, context),
      temperature: 0.3,
    });

    return { answer, citations };
  }

  // ── Meeting notes → structured doc ───────────────────────────
  async notesToDoc(userId: string, documentId: string | undefined, notes: string): Promise<NotesToDocResponse> {
    if (documentId) await this.permissions.requireRole(userId, documentId, DocumentRole.EDITOR);

    const raw = await this.run("notes_to_doc", documentId, {
      system: SYSTEM_WRITING_ASSISTANT,
      prompt: notesToDocPrompt(notes),
      maxTokens: 4096,
    });

    const jsonText = this.extractJson(raw);
    const parsed = safeJson(jsonText) as any;
    if (parsed && typeof parsed.title === "string" && typeof parsed.structuredContent === "string") {
      return {
        title: parsed.title,
        structuredContent: parsed.structuredContent,
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      };
    }
    return { title: "Untitled", structuredContent: raw, actionItems: [] };
  }

  // ── Style adaptation ─────────────────────────────────────────
  async adaptStyle(userId: string, documentId: string | undefined, text: string, audience: StyleAudience) {
    if (documentId) await this.permissions.requireRole(userId, documentId, DocumentRole.VIEWER);
    const result = await this.run("style_adapt", documentId, {
      system: SYSTEM_WRITING_ASSISTANT,
      prompt: styleAdaptPrompt(text, audience),
      temperature: 0.5,
    });
    return { text: result };
  }

  // ── Semantic diff (explain changes between versions) ─────────
  async semanticDiff(userId: string, documentId: string, fromVersion: number, toVersion: number): Promise<SemanticDiffResponse> {
    await this.permissions.requireRole(userId, documentId, DocumentRole.VIEWER);

    const [fromV, toV] = await Promise.all([
      this.prisma.version.findUnique({
        where: { documentId_versionNo: { documentId, versionNo: fromVersion } },
        select: { contentText: true },
      }),
      this.prisma.version.findUnique({
        where: { documentId_versionNo: { documentId, versionNo: toVersion } },
        select: { contentText: true },
      }),
    ]);

    const oldText = fromVersion === 0 ? "" : (fromV?.contentText ?? "");
    const newText = toV?.contentText ?? "";

    if (oldText === newText) {
      return { summary: "No changes detected between these versions.", changes: [] };
    }

    const raw = await this.run("semantic_diff", documentId, {
      system: SYSTEM_WRITING_ASSISTANT,
      prompt: semanticDiffPrompt(oldText.slice(0, 6000), newText.slice(0, 6000)),
    });

    const jsonText = this.extractJson(raw);
    const parsed = safeJson(jsonText) as any;
    if (parsed && typeof parsed.summary === "string" && Array.isArray(parsed.changes)) {
      return { summary: parsed.summary, changes: parsed.changes };
    }
    return { summary: raw, changes: [] };
  }

  // ── Semantic search (pgvector) ───────────────────────────────
  async indexDocument(documentId: string, contentText: string, versionNo?: number): Promise<number> {
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM embeddings WHERE document_id = $1::uuid AND version_no IS NOT DISTINCT FROM $2`,
      documentId,
      versionNo ?? null,
    );
    const chunks = this.chunk(contentText, 1500);
    if (chunks.length === 0) return 0;
    const vectors = await this.embeddings.embed(chunks);

    for (let i = 0; i < chunks.length; i++) {
      const literal = `[${vectors[i].join(",")}]`;
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO embeddings (id, document_id, version_no, chunk_index, content, embedding, created_at)
         VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5::vector, now())`,
        documentId,
        versionNo ?? null,
        i,
        chunks[i],
        literal,
      );
    }
    return chunks.length;
  }

  async semanticSearch(
    userId: string,
    req: SemanticSearchRequest,
  ): Promise<SemanticSearchHit[]> {
    await this.permissions.requireWorkspaceMember(userId, req.workspaceId);

    // Restrict to documents in the workspace the user can actually read.
    const docs = await this.prisma.document.findMany({
      where: {
        workspaceId: req.workspaceId,
        OR: [
          { workspace: { ownerId: userId } },
          { permissions: { some: { userId } } },
          { workspace: { members: { some: { userId, role: "admin" } } } },
        ],
      },
      select: { id: true, title: true },
    });
    if (docs.length === 0) return [];
    const titleById = new Map(docs.map((d) => [d.id, d.title]));

    const [queryVec] = await this.embeddings.embed([req.query]);
    const literal = `[${queryVec.join(",")}]`;
    const idList = docs.map((d) => `'${d.id}'::uuid`).join(",");

    const rows = await this.prisma.$queryRawUnsafe<
      { document_id: string; chunk_index: number; content: string; score: number }[]
    >(
      `SELECT document_id, chunk_index, content,
              1 - (embedding <=> $1::vector) AS score
       FROM embeddings
       WHERE version_no IS NULL AND document_id IN (${idList})
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      literal,
      req.limit,
    );

    return rows.map((r) => ({
      documentId: r.document_id,
      documentTitle: titleById.get(r.document_id) ?? "Untitled",
      chunkIndex: r.chunk_index,
      content: r.content,
      score: Number(r.score),
    }));
  }

  // ── Core runner: cache + cost tracking around every model call ─
  private async run(
    feature: string,
    documentId: string | undefined,
    opts: LlmGenerateOptions,
  ): Promise<string> {
    const inputHash = this.hash(feature + "|" + (opts.system ?? "") + "|" + opts.prompt);

    const cached = await this.prisma.aiCache.findUnique({
      where: { feature_inputHash: { feature, inputHash } },
    });
    if (cached) return (cached.response as { text: string }).text;

    const job = await this.prisma.aiJob.create({
      data: { type: feature, documentId: documentId ?? null, status: "running" },
    });

    try {
      const { text, usage } = await this.llm.generate(opts);
      await this.finishJob(job.id, text, usage);
      await this.prisma.aiCache.create({
        data: { feature, inputHash, response: { text } },
      });
      return text;
    } catch (err: any) {
      await this.prisma.aiJob.update({
        where: { id: job.id },
        data: { status: "failed", error: String(err?.message ?? err), completedAt: new Date() },
      });
      throw err;
    }
  }

  private async finishJob(jobId: string, text: string, usage: LlmUsage) {
    const cost = usage.tokensIn * COST_PER_INPUT_TOKEN + usage.tokensOut * COST_PER_OUTPUT_TOKEN;
    await this.prisma.aiJob.update({
      where: { id: jobId },
      data: {
        status: "done",
        result: { chars: text.length },
        tokensIn: usage.tokensIn,
        tokensOut: usage.tokensOut,
        costUsd: cost,
        completedAt: new Date(),
      },
    });
  }

  // ── Helpers ──────────────────────────────────────────────────
  async docTypeIfPermitted(
    userId: string,
    documentId: string | undefined,
    required: DocumentRole,
  ): Promise<string | undefined> {
    if (!documentId) return undefined;
    await this.permissions.requireRole(userId, documentId, required);
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { docType: true },
    });
    return doc?.docType;
  }

  private chunk(text: string, size: number): string[] {
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

  private hash(input: string): string {
    return createHash("sha256").update(input).digest("hex");
  }

  private extractJson(raw: string): string {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) return raw.slice(start, end + 1);
    return raw;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
