import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../store/auth";
import { useTheme } from "../store/theme";
import { useToast } from "../components/Toast";
import EditorComponent from "../components/Editor";
import AiPanel from "../components/AiPanel";
import CommentsPanel from "../components/CommentsPanel";
import DiffViewComponent from "../components/DiffView";

interface DocDetail {
  id: string;
  title: string;
  docType: string;
  workspaceId: string;
  myRole: string;
}
interface VersionItem {
  versionNo: number;
  label: string | null;
  createdAt: string;
  createdBy: { name: string };
}
interface DiffChange {
  category: string;
  description: string;
}
interface DiffTarget {
  from: number;
  to: number;
}

interface Collaborator {
  userId: string;
  role: string;
  user: { name: string; email: string };
}

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const [connected, setConnected] = useState(false);
  const [title, setTitle] = useState("");
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [diffResult, setDiffResult] = useState<{ summary: string; changes: DiffChange[] } | null>(null);
  const [diffBusy, setDiffBusy] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"ai" | "comments" | "versions">("ai");
  const [diffView, setDiffView] = useState<DiffTarget | null>(null);
  const [loading, setLoading] = useState(true);

  const [shareOpen, setShareOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState<"editor" | "commenter" | "viewer">("editor");
  const [shareBusy, setShareBusy] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  const loadCollaborators = useCallback(() => {
    if (!id) return;
    apiFetch<Collaborator[]>(`/documents/${id}/collaborators`).then(setCollaborators).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (shareOpen) loadCollaborators();
  }, [shareOpen, loadCollaborators]);

  async function handleShare() {
    if (!id || !shareEmail.trim()) return;
    setShareBusy(true);
    try {
      await apiFetch(`/documents/${id}/share`, {
        method: "POST",
        body: JSON.stringify({ email: shareEmail.trim(), role: shareRole }),
      });
      toast(`Shared with ${shareEmail}`, "success");
      setShareEmail("");
      loadCollaborators();
    } catch (err: any) {
      toast(err?.message ?? "Failed to share", "error");
    } finally {
      setShareBusy(false);
    }
  }

  async function handleRevoke(targetUserId: string) {
    if (!id) return;
    try {
      await apiFetch(`/documents/${id}/collaborators/${targetUserId}`, { method: "DELETE" });
      toast("Access revoked", "success");
      loadCollaborators();
    } catch (err: any) {
      toast(err?.message ?? "Failed to revoke", "error");
    }
  }

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch<DocDetail>(`/documents/${id}`)
      .then((d) => { setDoc(d); setTitle(d.title); })
      .finally(() => setLoading(false));
  }, [id]);

  const loadVersions = useCallback(() => {
    if (!id) return;
    apiFetch<VersionItem[]>(`/documents/${id}/versions`).then(setVersions);
  }, [id]);

  useEffect(() => loadVersions(), [loadVersions]);

  const onReady = useCallback((e: TiptapEditor) => setEditor(e), []);
  const onStatus = useCallback((c: boolean) => setConnected(c), []);

  async function saveTitle() {
    if (!id || !doc || title === doc.title) return;
    await apiFetch(`/documents/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
    setDoc({ ...doc, title });
  }

  async function saveVersion() {
    if (!id) return;
    try {
      await apiFetch(`/documents/${id}/versions`, { method: "POST", body: JSON.stringify({}) });
      toast("Version saved & indexing queued", "success");
      loadVersions();
    } catch {
      toast("Failed to save version", "error");
    }
  }

  async function restore(versionNo: number) {
    if (!id) return;
    if (!confirm(`Restore version ${versionNo}? Current state is backed up first.`)) return;
    try {
      await apiFetch(`/documents/${id}/versions/${versionNo}/restore`, { method: "POST" });
      toast("Restored — reload to see changes", "success");
    } catch {
      toast("Failed to restore version", "error");
    }
  }

  async function explainChanges(fromV: number, toV: number) {
    if (!id) return;
    setDiffBusy(true); setDiffResult(null);
    try {
      const res = await apiFetch<{ summary: string; changes: DiffChange[] }>("/ai/semantic-diff", {
        method: "POST",
        body: JSON.stringify({ documentId: id, fromVersion: fromV, toVersion: toV }),
      });
      setDiffResult(res);
    } catch {
      toast("Failed to analyze changes", "error");
    } finally { setDiffBusy(false); }
  }

  function cycleTheme() {
    const order: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  }

  if (!id || !user) return null;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center dark:bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-slate-700 dark:border-t-slate-300" />
      </div>
    );
  }

  const categoryColor: Record<string, string> = {
    added: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    removed: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    reworded: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    restructured: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    tone_change: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    factual_update: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  };

  const themeIcon = { light: "Light", dark: "Dark", system: "Auto" }[theme];

  return (
    <div className="flex h-screen flex-col dark:bg-slate-950 transition-colors">
      <header className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3">
        <button
          onClick={() => navigate("/")}
          className="text-sm text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
        >
          ← Docs
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          className="flex-1 bg-transparent text-lg font-semibold focus:outline-none dark:text-white"
          placeholder="Untitled"
        />
        <span className={`text-xs ${connected ? "text-emerald-500" : "text-slate-400 dark:text-slate-500"}`}>
          {connected ? "● Live" : "○ Connecting…"}
        </span>
        <button
          onClick={cycleTheme}
          className="rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title={`Theme: ${theme}`}
        >
          {themeIcon}
        </button>
        <button
          onClick={() => setShareOpen(true)}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition"
        >
          Share
        </button>
        <button
          onClick={saveVersion}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-300 transition"
        >
          Save version
        </button>
      </header>

      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShareOpen(false)}>
          <div
            className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold dark:text-white">Share document</h2>
              <button onClick={() => setShareOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-xl">×</button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === "Enter" && handleShare()}
              />
              <select
                value={shareRole}
                onChange={(e) => setShareRole(e.target.value as any)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-sm dark:text-white"
              >
                <option value="editor">Editor</option>
                <option value="commenter">Commenter</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={handleShare}
                disabled={shareBusy || !shareEmail.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {shareBusy ? "…" : "Invite"}
              </button>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
              <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase">People with access</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {collaborators.map((c) => (
                  <div key={c.userId} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium dark:text-white">{c.user.name}</span>
                      <span className="ml-2 text-slate-400 text-xs">{c.user.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400">
                        {c.role}
                      </span>
                      {c.role !== "owner" && (
                        <button
                          onClick={() => handleRevoke(c.userId)}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {collaborators.length === 0 && (
                  <p className="text-xs text-slate-400">Only you have access.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {diffView ? (
          <main className="flex-1 overflow-hidden bg-white dark:bg-slate-950">
            <DiffViewComponent
              documentId={id}
              fromVersion={diffView.from}
              toVersion={diffView.to}
              onClose={() => setDiffView(null)}
            />
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto bg-white dark:bg-slate-950 px-16 py-10">
            <div className="mx-auto max-w-3xl dark:text-slate-200">
              <EditorComponent documentId={id} user={user} onReady={onReady} onStatus={onStatus} />
            </div>
          </main>
        )}

        <aside className="flex w-80 flex-col border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            {(["ai", "comments", "versions"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSidebarTab(t)}
                className={`flex-1 py-2 text-xs font-medium transition ${
                  sidebarTab === t
                    ? "border-b-2 border-slate-900 dark:border-blue-500 text-slate-900 dark:text-white"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                {t === "ai" ? "AI" : t === "comments" ? "Comments" : "Versions"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden">
            {sidebarTab === "ai" && (
              <AiPanel editor={editor} documentId={id} workspaceId={doc?.workspaceId ?? null} />
            )}
            {sidebarTab === "comments" && (
              <CommentsPanel editor={editor} documentId={id} currentUserId={user.id} />
            )}
            {sidebarTab === "versions" && (
              <div className="h-full overflow-y-auto p-3">
                <div className="space-y-1">
                  {versions.map((v, i) => (
                    <div
                      key={v.versionNo}
                      className="rounded-md px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-slate-800 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 dark:text-slate-300 font-medium">
                          v{v.versionNo} · {v.label ?? v.createdBy.name}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          {new Date(v.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="mt-1 flex gap-2">
                        {i < versions.length - 1 && (
                          <>
                            <button
                              onClick={() => setDiffView({ from: versions[i + 1].versionNo, to: v.versionNo })}
                              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                              title="View text diff from previous version"
                            >
                              diff
                            </button>
                            <button
                              onClick={() => explainChanges(versions[i + 1].versionNo, v.versionNo)}
                              className="text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                              title="AI: explain what changed"
                            >
                              explain
                            </button>
                          </>
                        )}
                        {i === 0 && versions.length >= 1 && (
                          <button
                            onClick={() => setDiffView({ from: 0, to: v.versionNo })}
                            className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            title="View full diff since start"
                          >
                            full diff
                          </button>
                        )}
                        <button
                          onClick={() => restore(v.versionNo)}
                          className="text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white"
                        >
                          restore
                        </button>
                      </div>
                    </div>
                  ))}
                  {versions.length === 0 && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      No versions yet. Click "Save version" to create one.
                    </p>
                  )}
                </div>

                {diffBusy && <p className="mt-2 text-xs text-slate-400 animate-pulse">AI is analyzing changes…</p>}
                {diffResult && (
                  <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase text-slate-400">AI analysis</div>
                    <p className="mb-2 text-xs text-slate-700 dark:text-slate-300">{diffResult.summary}</p>
                    {diffResult.changes.map((c, i) => (
                      <div key={i} className="mb-1 flex gap-2 text-xs">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${categoryColor[c.category] ?? "bg-slate-100 text-slate-600"}`}>
                          {c.category}
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">{c.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
