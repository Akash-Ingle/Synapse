import pg from "pg";
import { config } from "./config.js";

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export async function getDocumentText(documentId: string): Promise<string | null> {
  const res = await pool.query<{ content_text: string }>(
    `SELECT content_text FROM documents WHERE id = $1`,
    [documentId],
  );
  return res.rows[0]?.content_text ?? null;
}

export async function replaceEmbeddings(
  documentId: string,
  chunks: string[],
  vectors: number[][],
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM embeddings WHERE document_id = $1 AND version_no IS NULL`,
      [documentId],
    );
    for (let i = 0; i < chunks.length; i++) {
      const literal = `[${vectors[i].join(",")}]`;
      await client.query(
        `INSERT INTO embeddings (id, document_id, version_no, chunk_index, content, embedding, created_at)
         VALUES (gen_random_uuid(), $1, NULL, $2, $3, $4::vector, now())`,
        [documentId, i, chunks[i], literal],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function replaceAiTags(documentId: string, tags: string[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM document_tags WHERE document_id = $1 AND source = 'ai'`, [
      documentId,
    ]);
    for (const tag of tags) {
      await client.query(
        `INSERT INTO document_tags (document_id, tag, source, created_at)
         VALUES ($1, $2, 'ai', now())
         ON CONFLICT (document_id, tag) DO NOTHING`,
        [documentId, tag],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
