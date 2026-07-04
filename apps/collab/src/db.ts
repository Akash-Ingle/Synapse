import pg from "pg";
import { config } from "./config.js";

const pool = new pg.Pool({ connectionString: config.databaseUrl });

export interface DocAccess {
  role: "owner" | "editor" | "commenter" | "viewer" | null;
}

/**
 * Resolves a user's effective role on a document directly from Postgres
 * (mirrors the API's PermissionsService so the WS layer enforces the same rules).
 */
export async function resolveDocumentRole(
  userId: string,
  documentId: string,
): Promise<DocAccess["role"]> {
  const docRes = await pool.query<{ workspace_id: string; owner_id: string }>(
    `SELECT d.workspace_id, w.owner_id
     FROM documents d JOIN workspaces w ON w.id = d.workspace_id
     WHERE d.id = $1`,
    [documentId],
  );
  if (docRes.rowCount === 0) return null;
  const { workspace_id, owner_id } = docRes.rows[0];
  if (owner_id === userId) return "owner";

  const memberRes = await pool.query<{ role: string }>(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspace_id, userId],
  );
  if (memberRes.rows[0]?.role === "admin") return "owner";

  const permRes = await pool.query<{ role: string }>(
    `SELECT role FROM document_permissions WHERE document_id = $1 AND user_id = $2`,
    [documentId, userId],
  );
  return (permRes.rows[0]?.role as DocAccess["role"]) ?? null;
}

export async function loadYDocState(documentId: string): Promise<Uint8Array | null> {
  const res = await pool.query<{ ydoc_state: Buffer | null }>(
    `SELECT ydoc_state FROM documents WHERE id = $1`,
    [documentId],
  );
  const buf = res.rows[0]?.ydoc_state;
  return buf ? new Uint8Array(buf) : null;
}

export async function saveYDocState(
  documentId: string,
  state: Uint8Array,
  contentText: string,
): Promise<void> {
  await pool.query(
    `UPDATE documents SET ydoc_state = $2, content_text = $3, updated_at = now() WHERE id = $1`,
    [documentId, Buffer.from(state), contentText],
  );
}

export async function closePool(): Promise<void> {
  await pool.end();
}
