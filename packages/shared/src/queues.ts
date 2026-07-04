/** Background job queue contract shared between the API (producer) and worker (consumer). */
export const AI_QUEUE = "ai-jobs";

export const JobType = {
  EMBED_DOCUMENT: "embed_document",
  TAG_DOCUMENT: "tag_document",
} as const;
export type JobType = (typeof JobType)[keyof typeof JobType];

export interface EmbedDocumentJob {
  type: typeof JobType.EMBED_DOCUMENT;
  documentId: string;
}

export interface TagDocumentJob {
  type: typeof JobType.TAG_DOCUMENT;
  documentId: string;
}

export type AiJobData = EmbedDocumentJob | TagDocumentJob;
