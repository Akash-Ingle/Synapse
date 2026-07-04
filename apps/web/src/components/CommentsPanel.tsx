import { useCallback, useEffect, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { apiFetch } from "../lib/api";

interface CommentAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface Comment {
  id: string;
  threadId: string;
  body: string;
  quotedText: string | null;
  anchor: Record<string, unknown> | null;
  resolved: boolean;
  createdAt: string;
  authorId: string;
  author: CommentAuthor;
}

interface Thread {
  threadId: string;
  comments: Comment[];
  resolved: boolean;
  quotedText: string | null;
  anchor: Record<string, unknown> | null;
}

interface CommentsPanelProps {
  editor: TiptapEditor | null;
  documentId: string;
  currentUserId: string;
}

export default function CommentsPanel({ editor, documentId, currentUserId }: CommentsPanelProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  const [newBody, setNewBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [busy, setBusy] = useState(false);

  const loadComments = useCallback(async () => {
    try {
      const raw = await apiFetch<Comment[]>(`/documents/${documentId}/comments`);
      const byThread = new Map<string, Comment[]>();
      for (const c of raw) {
        const list = byThread.get(c.threadId) ?? [];
        list.push(c);
        byThread.set(c.threadId, list);
      }
      const threadList: Thread[] = [];
      for (const [threadId, comments] of byThread) {
        const first = comments[0];
        threadList.push({
          threadId,
          comments,
          resolved: first.resolved,
          quotedText: first.quotedText,
          anchor: first.anchor,
        });
      }
      threadList.sort(
        (a, b) =>
          new Date(a.comments[0].createdAt).getTime() -
          new Date(b.comments[0].createdAt).getTime(),
      );
      setThreads(threadList);
    } catch {
      /* ignore load failures */
    }
  }, [documentId]);

  useEffect(() => {
    loadComments();
    const interval = setInterval(loadComments, 10000);
    return () => clearInterval(interval);
  }, [loadComments]);

  function getSelectedText(): { text: string; from: number; to: number } {
    if (!editor) return { text: "", from: 0, to: 0 };
    const { from, to } = editor.state.selection;
    return { text: editor.state.doc.textBetween(from, to, " "), from, to };
  }

  function startNewComment() {
    const sel = getSelectedText();
    if (!sel.text) {
      setAddingComment(true);
      return;
    }
    setAddingComment(true);
  }

  async function submitNewComment() {
    if (!newBody.trim()) return;
    setBusy(true);
    try {
      const sel = getSelectedText();
      const payload: Record<string, unknown> = { body: newBody.trim() };

      if (sel.text) {
        payload.quotedText = sel.text.slice(0, 2000);
        payload.anchor = { from: sel.from, to: sel.to };
      }

      const created = await apiFetch<Comment>(`/documents/${documentId}/comments`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (sel.text && editor) {
        editor.chain().focus().setComment(created.threadId).run();
      }

      setNewBody("");
      setAddingComment(false);
      await loadComments();
    } catch (e) {
      console.error("Failed to create comment:", e);
    } finally {
      setBusy(false);
    }
  }

  async function submitReply(threadId: string) {
    if (!replyBody.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/documents/${documentId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: replyBody.trim(), threadId }),
      });
      setReplyBody("");
      setReplyTo(null);
      await loadComments();
    } catch (e) {
      console.error("Failed to reply:", e);
    } finally {
      setBusy(false);
    }
  }

  async function resolveThread(threadId: string) {
    await apiFetch(`/documents/${documentId}/comments/threads/${threadId}/resolve`, {
      method: "PATCH",
    });
    await loadComments();
  }

  async function reopenThread(threadId: string) {
    await apiFetch(`/documents/${documentId}/comments/threads/${threadId}/reopen`, {
      method: "PATCH",
    });
    await loadComments();
  }

  async function deleteComment(commentId: string, threadId: string) {
    await apiFetch(`/documents/${documentId}/comments/${commentId}`, {
      method: "DELETE",
    });
    const thread = threads.find((t) => t.threadId === threadId);
    if (thread && thread.comments.length <= 1 && editor) {
      editor.chain().focus().unsetComment(threadId).run();
    }
    await loadComments();
  }

  function scrollToAnchor(anchor: Record<string, unknown> | null) {
    if (!editor || !anchor || typeof anchor.from !== "number") return;
    const from = anchor.from as number;
    const docSize = editor.state.doc.content.size;
    if (from < docSize) {
      editor.chain().focus().setTextSelection(from).scrollIntoView().run();
    }
  }

  const openThreads = threads.filter((t) => !t.resolved);
  const resolvedThreads = threads.filter((t) => t.resolved);
  const visibleThreads = showResolved ? threads : openThreads;

  return (
    <div className="flex h-full flex-col text-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Comments{" "}
          <span className="font-normal text-slate-300">
            ({openThreads.length} open{resolvedThreads.length > 0 ? `, ${resolvedThreads.length} resolved` : ""})
          </span>
        </h3>
        <button
          onClick={startNewComment}
          className="rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-slate-800"
          title="Add a comment (select text first to anchor it)"
        >
          + Comment
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {addingComment && (
          <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-2">
            {getSelectedText().text && (
              <div className="mb-2 rounded bg-white px-2 py-1 text-[11px] text-slate-500 italic border border-slate-200">
                "{getSelectedText().text.slice(0, 100)}{getSelectedText().text.length > 100 ? "…" : ""}"
              </div>
            )}
            {!getSelectedText().text && (
              <p className="mb-2 text-[10px] text-blue-500">
                Tip: Select text in the editor first to anchor this comment to a specific passage.
              </p>
            )}
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Write your comment…"
              className="w-full resize-none rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
              rows={3}
              autoFocus
            />
            <div className="mt-1.5 flex gap-2">
              <button
                onClick={submitNewComment}
                disabled={busy || !newBody.trim()}
                className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50 hover:bg-blue-700"
              >
                {busy ? "Posting…" : "Post"}
              </button>
              <button
                onClick={() => { setAddingComment(false); setNewBody(""); }}
                className="text-[11px] text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {resolvedThreads.length > 0 && (
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="text-[11px] text-slate-400 hover:text-slate-600"
          >
            {showResolved ? "Hide resolved" : `Show ${resolvedThreads.length} resolved`}
          </button>
        )}

        {visibleThreads.length === 0 && !addingComment && (
          <p className="text-xs text-slate-400 py-4 text-center">
            No comments yet. Select text and click "+ Comment" to start a discussion.
          </p>
        )}

        {visibleThreads.map((thread) => (
          <ThreadView
            key={thread.threadId}
            thread={thread}
            currentUserId={currentUserId}
            replyTo={replyTo}
            replyBody={replyBody}
            busy={busy}
            onReplyToChange={setReplyTo}
            onReplyBodyChange={setReplyBody}
            onSubmitReply={submitReply}
            onResolve={resolveThread}
            onReopen={reopenThread}
            onDelete={deleteComment}
            onClickAnchor={scrollToAnchor}
          />
        ))}
      </div>
    </div>
  );
}

interface ThreadViewProps {
  thread: Thread;
  currentUserId: string;
  replyTo: string | null;
  replyBody: string;
  busy: boolean;
  onReplyToChange: (id: string | null) => void;
  onReplyBodyChange: (body: string) => void;
  onSubmitReply: (threadId: string) => void;
  onResolve: (threadId: string) => void;
  onReopen: (threadId: string) => void;
  onDelete: (commentId: string, threadId: string) => void;
  onClickAnchor: (anchor: Record<string, unknown> | null) => void;
}

function ThreadView({
  thread,
  currentUserId,
  replyTo,
  replyBody,
  busy,
  onReplyToChange,
  onReplyBodyChange,
  onSubmitReply,
  onResolve,
  onReopen,
  onDelete,
  onClickAnchor,
}: ThreadViewProps) {
  const isReplying = replyTo === thread.threadId;

  return (
    <div
      className={`rounded-lg border ${
        thread.resolved
          ? "border-slate-200 bg-slate-50 opacity-60"
          : "border-slate-200 bg-white"
      }`}
    >
      {thread.quotedText && (
        <button
          onClick={() => onClickAnchor(thread.anchor)}
          className="w-full border-b border-slate-100 px-3 py-1.5 text-left text-[11px] text-amber-700 bg-amber-50 rounded-t-lg hover:bg-amber-100 transition"
          title="Click to jump to this text in the document"
        >
          "{thread.quotedText.slice(0, 120)}{thread.quotedText.length > 120 ? "…" : ""}"
        </button>
      )}

      <div className="p-2 space-y-2">
        {thread.comments.map((c, i) => (
          <div key={c.id} className={i > 0 ? "border-t border-slate-100 pt-2" : ""}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600">
                  {c.author.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-[11px] font-medium text-slate-700">{c.author.name}</span>
                <span className="text-[10px] text-slate-400">
                  {formatRelative(c.createdAt)}
                </span>
              </div>
              {c.authorId === currentUserId && (
                <button
                  onClick={() => onDelete(c.id, thread.threadId)}
                  className="text-[10px] text-slate-300 hover:text-red-500"
                  title="Delete this comment"
                >
                  ×
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap">{c.body}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 px-2 py-1.5">
        {!isReplying ? (
          <>
            <button
              onClick={() => { onReplyToChange(thread.threadId); onReplyBodyChange(""); }}
              className="text-[11px] text-blue-500 hover:text-blue-700"
            >
              Reply
            </button>
            {thread.resolved ? (
              <button
                onClick={() => onReopen(thread.threadId)}
                className="text-[11px] text-amber-500 hover:text-amber-700"
              >
                Reopen
              </button>
            ) : (
              <button
                onClick={() => onResolve(thread.threadId)}
                className="text-[11px] text-emerald-500 hover:text-emerald-700"
              >
                Resolve
              </button>
            )}
          </>
        ) : (
          <div className="flex-1">
            <textarea
              value={replyBody}
              onChange={(e) => onReplyBodyChange(e.target.value)}
              placeholder="Reply…"
              className="w-full resize-none rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
              rows={2}
              autoFocus
            />
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => onSubmitReply(thread.threadId)}
                disabled={busy || !replyBody.trim()}
                className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white disabled:opacity-50"
              >
                Reply
              </button>
              <button
                onClick={() => onReplyToChange(null)}
                className="text-[10px] text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
