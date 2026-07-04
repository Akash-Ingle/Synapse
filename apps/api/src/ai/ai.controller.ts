import { Body, Controller, Param, ParseUUIDPipe, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import {
  DocumentRole,
  OutlineRequestSchema,
  RewriteRequestSchema,
  SemanticSearchRequestSchema,
  SummarizeRequestSchema,
  TaskExtractionRequestSchema,
  ChatDocRequestSchema,
  NotesToDocRequestSchema,
  StyleAdaptRequestSchema,
  SemanticDiffRequestSchema,
  type OutlineRequest,
  type RewriteRequest,
  type SemanticSearchRequest,
  type SummarizeRequest,
  type TaskExtractionRequest,
  type ChatDocRequest,
  type NotesToDocRequest,
  type StyleAdaptRequest,
  type SemanticDiffRequest,
} from "@synapse/shared";
import { AiService } from "./ai.service";
import { LlmProvider } from "./providers/llm.provider";
import { PrismaService } from "../prisma/prisma.service";
import { QueueService } from "../queue/queue.service";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

@Controller("ai")
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly llm: LlmProvider,
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  @Post("rewrite")
  rewrite(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(RewriteRequestSchema)) dto: RewriteRequest,
  ) {
    return this.ai.rewrite(user.id, dto);
  }

  /** Server-Sent Events streaming rewrite for a snappy in-editor experience. */
  @Post("rewrite/stream")
  async rewriteStream(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(RewriteRequestSchema)) dto: RewriteRequest,
    @Res() res: Response,
  ) {
    const docType = await this.ai.docTypeIfPermitted(user.id, dto.documentId, DocumentRole.EDITOR);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
      for await (const delta of this.llm.stream(this.ai.buildRewritePrompt(dto, docType))) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
      res.write(`event: done\ndata: {}\n\n`);
    } catch (err: any) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: String(err?.message ?? err) })}\n\n`);
    } finally {
      res.end();
    }
  }

  @Post("expand")
  expand(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(RewriteRequestSchema)) dto: RewriteRequest,
  ) {
    return this.ai.expand(user.id, dto.documentId, dto.selection);
  }

  @Post("summarize")
  summarize(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(SummarizeRequestSchema)) dto: SummarizeRequest,
  ) {
    return this.ai.summarize(user.id, dto);
  }

  @Post("outline")
  outline(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(OutlineRequestSchema)) dto: OutlineRequest,
  ) {
    return this.ai.outline(user.id, dto.documentId, dto.text);
  }

  @Post("search")
  search(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(SemanticSearchRequestSchema)) dto: SemanticSearchRequest,
  ) {
    return this.ai.semanticSearch(user.id, dto);
  }

  // ── Phase 3 AI endpoints ───────────────────────────────────

  @Post("tasks")
  extractTasks(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(TaskExtractionRequestSchema)) dto: TaskExtractionRequest,
  ) {
    return this.ai.extractTasks(user.id, dto.documentId, dto.text);
  }

  @Post("chat")
  chatWithDoc(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(ChatDocRequestSchema)) dto: ChatDocRequest,
  ) {
    return this.ai.chatWithDoc(user.id, dto.documentId, dto.question, dto.text);
  }

  @Post("notes-to-doc")
  notesToDoc(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(NotesToDocRequestSchema)) dto: NotesToDocRequest,
  ) {
    return this.ai.notesToDoc(user.id, dto.documentId, dto.notes);
  }

  @Post("style-adapt")
  styleAdapt(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(StyleAdaptRequestSchema)) dto: StyleAdaptRequest,
  ) {
    return this.ai.adaptStyle(user.id, dto.documentId, dto.text, dto.audience);
  }

  @Post("semantic-diff")
  semanticDiff(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(SemanticDiffRequestSchema)) dto: SemanticDiffRequest,
  ) {
    return this.ai.semanticDiff(user.id, dto.documentId, dto.fromVersion, dto.toVersion);
  }

  /** Re-index a document's current content into the vector store. */
  @Post("documents/:id/index")
  async index(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    await this.ai.docTypeIfPermitted(user.id, id, DocumentRole.EDITOR);
    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: { contentText: true },
    });
    const chunks = await this.ai.indexDocument(id, doc?.contentText ?? "");
    return { indexedChunks: chunks };
  }

  /** Enqueue background embedding + tagging for a document (async pipeline). */
  @Post("documents/:id/process")
  async process(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    await this.ai.docTypeIfPermitted(user.id, id, DocumentRole.EDITOR);
    await this.queue.enqueueDocumentProcessing(id);
    return { queued: true };
  }
}
