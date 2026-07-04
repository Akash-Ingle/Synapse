import * as Y from "yjs";

/**
 * Flattens the TipTap/ProseMirror Y.XmlFragment ("default") into plain text.
 * Used to keep `documents.content_text` in sync for full-text search, embeddings, and diffing.
 */
export function extractPlainText(doc: Y.Doc): string {
  const fragment = doc.getXmlFragment("default");
  const parts: string[] = [];
  walk(fragment, parts);
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function walk(node: Y.XmlFragment | Y.XmlElement | Y.XmlText, out: string[]): void {
  if (node instanceof Y.XmlText) {
    out.push(node.toString());
    return;
  }
  const isBlock =
    node instanceof Y.XmlElement &&
    /^(paragraph|heading|listItem|blockquote|codeBlock|bulletList|orderedList)$/.test(
      node.nodeName ?? "",
    );
  const buffer: string[] = [];
  node.forEach((child) => walk(child as Y.XmlElement | Y.XmlText, buffer));
  if (isBlock) {
    out.push(buffer.join(""));
  } else {
    out.push(...buffer);
  }
}
