import { RewriteMode, StyleAudience, type RewriteMode as RewriteModeT, type StyleAudience as StyleAudienceT } from "@synapse/shared";

/**
 * Versioned prompt templates. Keeping prompts centralized + versioned makes it easy to
 * iterate, A/B, and reason about output quality (and reads well as an "AI infra" story).
 */
export const PROMPT_VERSION = "2026-07-01";

const REWRITE_INTENT: Record<RewriteModeT, string> = {
  [RewriteMode.IMPROVE]: "Improve clarity, flow, and word choice while preserving meaning.",
  [RewriteMode.SHORTEN]: "Make it more concise without losing key information.",
  [RewriteMode.LENGTHEN]: "Expand with relevant detail, examples, and depth.",
  [RewriteMode.FORMAL]: "Rewrite in a professional, formal tone.",
  [RewriteMode.CASUAL]: "Rewrite in a friendly, casual tone.",
  [RewriteMode.SIMPLIFY]: "Simplify so a non-expert can easily understand it.",
  [RewriteMode.FIX_GRAMMAR]: "Fix grammar, spelling, and punctuation only. Keep the wording.",
};

export const SYSTEM_WRITING_ASSISTANT =
  "You are Synapse, an expert writing assistant embedded in a collaborative document editor. " +
  "Return only the requested output with no preamble, explanations, or markdown code fences.";

export function rewritePrompt(params: {
  selection: string;
  mode: RewriteModeT;
  instruction?: string;
  docType?: string;
}): string {
  const intent = REWRITE_INTENT[params.mode];
  const extra = params.instruction ? `\nAdditional instruction: ${params.instruction}` : "";
  const typeHint = params.docType ? `\nDocument type: ${params.docType}.` : "";
  return (
    `${intent}${typeHint}${extra}\n\n` +
    `Rewrite the following text and return ONLY the rewritten text:\n\n"""\n${params.selection}\n"""`
  );
}

export function expandPrompt(selection: string, docType?: string): string {
  const typeHint = docType ? ` This is part of a ${docType}.` : "";
  return (
    `Expand the following text with relevant detail and depth while matching its tone.${typeHint}\n` +
    `Return ONLY the expanded text:\n\n"""\n${selection}\n"""`
  );
}

export function summarizePrompt(text: string, length: "short" | "medium" | "long"): string {
  const target = { short: "2-3 sentences", medium: "one paragraph", long: "3-5 paragraphs" }[length];
  return (
    `Summarize the following document in ${target}. Capture the key points, decisions, and any action items.\n` +
    `Return ONLY the summary:\n\n"""\n${text}\n"""`
  );
}

/** Reduce step for map-reduce summarization of long documents. */
export function reduceSummariesPrompt(summaries: string[], length: "short" | "medium" | "long"): string {
  const target = { short: "2-3 sentences", medium: "one paragraph", long: "3-5 paragraphs" }[length];
  return (
    `The following are partial summaries of sections of one document. ` +
    `Combine them into a single coherent summary in ${target}. Return ONLY the summary:\n\n` +
    summaries.map((s, i) => `Section ${i + 1}:\n${s}`).join("\n\n")
  );
}

export function outlinePrompt(text: string): string {
  return (
    `Produce a structured outline of the following document.\n` +
    `Return ONLY valid JSON matching this TypeScript type, with no markdown fences:\n` +
    `{ "title": string, "sections": { "heading": string, "points": string[] }[] }\n\n` +
    `Document:\n"""\n${text}\n"""`
  );
}

// ── Phase 3 prompts ─────────────────────────────────────────

export function taskExtractionPrompt(text: string): string {
  return (
    `Extract all action items, tasks, and to-dos from the following document.\n` +
    `Return ONLY valid JSON matching this type, with no markdown fences:\n` +
    `{ "tasks": { "text": string, "owner"?: string, "dueDate"?: string, "priority"?: "high"|"medium"|"low" }[] }\n` +
    `If there are no tasks, return {"tasks":[]}.\n\n` +
    `Document:\n"""\n${text}\n"""`
  );
}

export function chatDocPrompt(question: string, context: string): string {
  return (
    `You are a knowledgeable assistant discussing a document with the user.\n` +
    `Use the document content below as your primary source. You may:\n` +
    `- Answer factual questions using the document\n` +
    `- Analyze, interpret, or discuss the content (tone, style, themes, meaning)\n` +
    `- Identify references, allusions, or context (e.g. song lyrics, quotes, literary works)\n` +
    `- Offer constructive feedback or observations\n` +
    `When referencing specific passages, quote them. If the question is completely unrelated to the document, say so.\n\n` +
    `Document content:\n"""\n${context}\n"""\n\n` +
    `User: ${question}`
  );
}

export function notesToDocPrompt(notes: string): string {
  return (
    `Convert the following raw meeting notes into a clean, structured document.\n` +
    `Include:\n` +
    `- A clear title\n` +
    `- Organized sections with headings\n` +
    `- Key decisions highlighted\n` +
    `- Action items listed at the end\n\n` +
    `Return ONLY valid JSON with no markdown fences:\n` +
    `{ "title": string, "structuredContent": string, "actionItems": { "text": string, "owner"?: string, "dueDate"?: string, "priority"?: "high"|"medium"|"low" }[] }\n\n` +
    `Raw notes:\n"""\n${notes}\n"""`
  );
}

const AUDIENCE_INSTRUCTION: Record<StyleAudienceT, string> = {
  [StyleAudience.EXECUTIVE]: "Rewrite for a C-suite executive: concise, focused on impact, decisions, and metrics. No jargon.",
  [StyleAudience.ENGINEER]: "Rewrite for a technical engineering audience: precise, include technical details, structured with clear specifics.",
  [StyleAudience.CUSTOMER]: "Rewrite for a customer-facing audience: friendly, clear, benefit-focused, no internal terminology.",
  [StyleAudience.CASUAL]: "Rewrite in a casual, conversational tone: approachable and easy to read, like a blog post.",
  [StyleAudience.ACADEMIC]: "Rewrite in an academic tone: formal, evidence-based, with precise language and structured argumentation.",
};

export function styleAdaptPrompt(text: string, audience: StyleAudienceT): string {
  const instruction = AUDIENCE_INSTRUCTION[audience];
  return (
    `${instruction}\n` +
    `Return ONLY the rewritten text with no preamble:\n\n` +
    `"""\n${text}\n"""`
  );
}

export function semanticDiffPrompt(oldText: string, newText: string): string {
  return (
    `Compare the two versions of a document below and explain what changed.\n` +
    `Return ONLY valid JSON with no markdown fences:\n` +
    `{ "summary": string, "changes": { "category": string, "description": string }[] }\n` +
    `Categories can be: "added", "removed", "reworded", "restructured", "tone_change", or "factual_update".\n\n` +
    `OLD VERSION:\n"""\n${oldText}\n"""\n\n` +
    `NEW VERSION:\n"""\n${newText}\n"""`
  );
}
