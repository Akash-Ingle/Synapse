/**
 * Role & permission model shared between the API, collab service, and web client.
 * Document-level roles are ordered by capability so we can do numeric comparisons.
 */

export const WorkspaceRole = {
  ADMIN: "admin",
  MEMBER: "member",
} as const;
export type WorkspaceRole = (typeof WorkspaceRole)[keyof typeof WorkspaceRole];

export const DocumentRole = {
  OWNER: "owner",
  EDITOR: "editor",
  COMMENTER: "commenter",
  VIEWER: "viewer",
} as const;
export type DocumentRole = (typeof DocumentRole)[keyof typeof DocumentRole];

/** Higher number = more capable. Used for "at least this role" checks. */
export const DOCUMENT_ROLE_RANK: Record<DocumentRole, number> = {
  [DocumentRole.VIEWER]: 0,
  [DocumentRole.COMMENTER]: 1,
  [DocumentRole.EDITOR]: 2,
  [DocumentRole.OWNER]: 3,
};

export function hasAtLeastDocumentRole(
  actual: DocumentRole | null | undefined,
  required: DocumentRole,
): boolean {
  if (!actual) return false;
  return DOCUMENT_ROLE_RANK[actual] >= DOCUMENT_ROLE_RANK[required];
}

export function canEditDocument(role: DocumentRole | null | undefined): boolean {
  return hasAtLeastDocumentRole(role, DocumentRole.EDITOR);
}

export function canCommentOnDocument(role: DocumentRole | null | undefined): boolean {
  return hasAtLeastDocumentRole(role, DocumentRole.COMMENTER);
}

export function canManageDocument(role: DocumentRole | null | undefined): boolean {
  return hasAtLeastDocumentRole(role, DocumentRole.OWNER);
}
