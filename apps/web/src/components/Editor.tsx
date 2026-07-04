import { useEffect, useMemo } from "react";
import { EditorContent, useEditor, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { tokens } from "../lib/api";
import type { User } from "../store/auth";
import CommentMark from "./CommentMark";

const COLLAB_URL = import.meta.env.VITE_COLLAB_URL ?? "ws://localhost:4001";

const CURSOR_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

interface EditorProps {
  documentId: string;
  user: User;
  onReady: (editor: TiptapEditor) => void;
  onStatus: (connected: boolean) => void;
}

export default function Editor({ documentId, user, onReady, onStatus }: EditorProps) {
  const ydoc = useMemo(() => new Y.Doc(), [documentId]);

  const provider = useMemo(() => {
    return new WebsocketProvider(COLLAB_URL, documentId, ydoc, {
      params: { token: tokens.access ?? "", doc: documentId },
    });
  }, [documentId, ydoc]);

  useEffect(() => {
    const handler = (event: { status: string }) => onStatus(event.status === "connected");
    provider.on("status", handler);
    return () => {
      provider.off("status", handler);
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc, onStatus]);

  const color = useMemo(
    () => CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)],
    [],
  );

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: false }),
        Placeholder.configure({ placeholder: "Start writing, or select text and ask the AI…" }),
        Collaboration.configure({ document: ydoc }),
        CollaborationCursor.configure({
          provider,
          user: { name: user.name, color },
        }),
        CommentMark,
      ],
      editorProps: {
        attributes: { class: "prose max-w-none focus:outline-none" },
      },
    },
    [provider, ydoc],
  );

  useEffect(() => {
    if (editor) onReady(editor);
  }, [editor, onReady]);

  return <EditorContent editor={editor} />;
}
