import { z } from "zod";
import { DocumentRole } from "./roles.js";

/** ── Auth ───────────────────────────────────────────────── */
export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
});
export type RegisterDto = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof LoginSchema>;

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshDto = z.infer<typeof RefreshSchema>;

/** ── Workspaces ─────────────────────────────────────────── */
export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(120),
});
export type CreateWorkspaceDto = z.infer<typeof CreateWorkspaceSchema>;

/** ── Documents ──────────────────────────────────────────── */
export const DocType = {
  DOC: "doc",
  PRD: "prd",
  RFC: "rfc",
  MEETING_NOTES: "meeting_notes",
  BLOG: "blog",
  OTHER: "other",
} as const;
export type DocType = (typeof DocType)[keyof typeof DocType];

export const CreateDocumentSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().min(1).max(200).default("Untitled"),
  docType: z.nativeEnum(DocType).default(DocType.DOC),
});
export type CreateDocumentDto = z.infer<typeof CreateDocumentSchema>;

export const UpdateDocumentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  docType: z.nativeEnum(DocType).optional(),
  isArchived: z.boolean().optional(),
});
export type UpdateDocumentDto = z.infer<typeof UpdateDocumentSchema>;

export const ShareDocumentSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(DocumentRole),
});
export type ShareDocumentDto = z.infer<typeof ShareDocumentSchema>;

/** ── Comments ───────────────────────────────────────────── */
export const CreateCommentSchema = z.object({
  body: z.string().min(1).max(4000),
  threadId: z.string().uuid().optional(),
  anchor: z.record(z.any()).optional(),
  quotedText: z.string().max(2000).optional(),
});
export type CreateCommentDto = z.infer<typeof CreateCommentSchema>;

/** ── Versions ───────────────────────────────────────────── */
export const CreateVersionSchema = z.object({
  label: z.string().min(1).max(120).optional(),
});
export type CreateVersionDto = z.infer<typeof CreateVersionSchema>;
