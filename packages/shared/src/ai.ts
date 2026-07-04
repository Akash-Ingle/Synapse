import { z } from "zod";

/** AI feature identifiers — used for prompt routing, caching keys, and cost tracking. */
export const AiFeature = {
  REWRITE: "rewrite",
  EXPAND: "expand",
  SUMMARIZE: "summarize",
  OUTLINE: "outline",
  SEMANTIC_SEARCH: "semantic_search",
  TASK_EXTRACTION: "task_extraction",
  TAGGING: "tagging",
  NOTES_TO_DOC: "notes_to_doc",
  STYLE_ADAPT: "style_adapt",
  SEMANTIC_DIFF: "semantic_diff",
  CHAT_DOC: "chat_doc",
  INSIGHTS: "insights",
} as const;
export type AiFeature = (typeof AiFeature)[keyof typeof AiFeature];

/** Rewrite modes drive tone/intent of the rewrite prompt. */
export const RewriteMode = {
  IMPROVE: "improve",
  SHORTEN: "shorten",
  LENGTHEN: "lengthen",
  FORMAL: "formal",
  CASUAL: "casual",
  SIMPLIFY: "simplify",
  FIX_GRAMMAR: "fix_grammar",
} as const;
export type RewriteMode = (typeof RewriteMode)[keyof typeof RewriteMode];

export const RewriteRequestSchema = z.object({
  documentId: z.string().uuid().optional(),
  selection: z.string().min(1).max(20000),
  mode: z.nativeEnum(RewriteMode).default(RewriteMode.IMPROVE),
  instruction: z.string().max(1000).optional(),
});
export type RewriteRequest = z.infer<typeof RewriteRequestSchema>;

export const SummarizeRequestSchema = z.object({
  documentId: z.string().uuid().optional(),
  text: z.string().min(1),
  length: z.enum(["short", "medium", "long"]).default("medium"),
});
export type SummarizeRequest = z.infer<typeof SummarizeRequestSchema>;

export const OutlineRequestSchema = z.object({
  documentId: z.string().uuid().optional(),
  text: z.string().min(1),
});
export type OutlineRequest = z.infer<typeof OutlineRequestSchema>;

/** Structured output schema for outline generation (validated after the model call). */
export const OutlineSchema = z.object({
  title: z.string(),
  sections: z.array(
    z.object({
      heading: z.string(),
      points: z.array(z.string()),
    }),
  ),
});
export type Outline = z.infer<typeof OutlineSchema>;

export const SemanticSearchRequestSchema = z.object({
  workspaceId: z.string().uuid(),
  query: z.string().min(1).max(1000),
  limit: z.number().int().min(1).max(50).default(10),
});
export type SemanticSearchRequest = z.infer<typeof SemanticSearchRequestSchema>;

export interface SemanticSearchHit {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  score: number;
}

/** ── Phase 3 AI features ──────────────────────────────── */

// Task extraction
export const TaskExtractionRequestSchema = z.object({
  documentId: z.string().uuid(),
  text: z.string().min(1),
});
export type TaskExtractionRequest = z.infer<typeof TaskExtractionRequestSchema>;

export const ExtractedTaskSchema = z.object({
  text: z.string(),
  owner: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
});
export type ExtractedTask = z.infer<typeof ExtractedTaskSchema>;

export const TaskExtractionResultSchema = z.object({
  tasks: z.array(ExtractedTaskSchema),
});
export type TaskExtractionResult = z.infer<typeof TaskExtractionResultSchema>;

// Chat with document (RAG)
export const ChatDocRequestSchema = z.object({
  documentId: z.string().uuid(),
  question: z.string().min(1).max(2000),
  text: z.string().max(50000).optional(),
});
export type ChatDocRequest = z.infer<typeof ChatDocRequestSchema>;

export interface ChatDocResponse {
  answer: string;
  citations: { content: string; chunkIndex: number }[];
}

// Meeting notes → structured doc
export const NotesToDocRequestSchema = z.object({
  documentId: z.string().uuid().optional(),
  notes: z.string().min(1),
});
export type NotesToDocRequest = z.infer<typeof NotesToDocRequestSchema>;

export interface NotesToDocResponse {
  title: string;
  structuredContent: string;
  actionItems: ExtractedTask[];
}

// Style adaptation
export const StyleAudience = {
  EXECUTIVE: "executive",
  ENGINEER: "engineer",
  CUSTOMER: "customer",
  CASUAL: "casual",
  ACADEMIC: "academic",
} as const;
export type StyleAudience = (typeof StyleAudience)[keyof typeof StyleAudience];

export const StyleAdaptRequestSchema = z.object({
  documentId: z.string().uuid().optional(),
  text: z.string().min(1),
  audience: z.nativeEnum(StyleAudience),
});
export type StyleAdaptRequest = z.infer<typeof StyleAdaptRequestSchema>;

// Semantic diff (explain changes between versions)
export const SemanticDiffRequestSchema = z.object({
  documentId: z.string().uuid(),
  fromVersion: z.number().int().min(0),
  toVersion: z.number().int().min(1),
});
export type SemanticDiffRequest = z.infer<typeof SemanticDiffRequestSchema>;

export interface SemanticDiffResponse {
  summary: string;
  changes: { category: string; description: string }[];
}
