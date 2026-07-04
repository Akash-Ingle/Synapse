import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../store/auth";
import { useTheme } from "../store/theme";

interface Workspace {
  id: string;
  name: string;
  _count: { documents: number };
}
interface DocItem {
  id: string;
  title: string;
  docType: string;
  updatedAt: string;
  tags: { tag: string; source: string }[];
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWs, setActiveWs] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loadingWs, setLoadingWs] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);

  useEffect(() => {
    setLoadingWs(true);
    apiFetch<Workspace[]>("/workspaces").then((ws) => {
      setWorkspaces(ws);
      if (ws[0]) setActiveWs(ws[0].id);
      setLoadingWs(false);
    });
  }, []);

  useEffect(() => {
    if (!activeWs) return;
    setLoadingDocs(true);
    apiFetch<DocItem[]>(`/documents?workspaceId=${activeWs}`).then((d) => {
      setDocs(d);
      setLoadingDocs(false);
    });
  }, [activeWs]);

  async function createDoc() {
    if (!activeWs) return;
    const doc = await apiFetch<{ id: string }>("/documents", {
      method: "POST",
      body: JSON.stringify({ workspaceId: activeWs, title: "Untitled", docType: "doc" }),
    });
    navigate(`/doc/${doc.id}`);
  }

  function cycleTheme() {
    const order: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  }

  const themeLabel = { light: "Light", dark: "Dark", system: "Auto" }[theme];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="mx-auto max-w-5xl p-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold dark:text-white">Synapse</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back, {user?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={cycleTheme}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={`Theme: ${theme}`}
            >
              {themeLabel}
            </button>
            <button
              onClick={logout}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="mb-6 flex flex-wrap gap-2">
          {loadingWs && (
            <>
              <div className="skeleton h-8 w-28 rounded-full" />
              <div className="skeleton h-8 w-24 rounded-full" />
            </>
          )}
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => setActiveWs(ws.id)}
              className={`rounded-full px-4 py-1.5 text-sm transition ${
                activeWs === ws.id
                  ? "bg-slate-900 dark:bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm dark:shadow-none border border-transparent dark:border-slate-700"
              }`}
            >
              {ws.name} · {ws._count.documents}
            </button>
          ))}
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold dark:text-white">Documents</h2>
          <button
            onClick={createDoc}
            className="rounded-lg bg-slate-900 dark:bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-blue-700 transition"
          >
            + New document
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loadingDocs && !docs.length &&
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div className="skeleton h-5 w-3/4 mb-2" />
                <div className="skeleton h-3 w-1/4 mb-3" />
                <div className="flex gap-1">
                  <div className="skeleton h-4 w-12" />
                  <div className="skeleton h-4 w-16" />
                </div>
              </div>
            ))
          }
          {docs.map((doc) => (
            <button
              key={doc.id}
              onClick={() => navigate(`/doc/${doc.id}`)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-left shadow-sm dark:shadow-none transition hover:shadow-md dark:hover:border-slate-600 group"
            >
              <div className="mb-1 font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                {doc.title || "Untitled"}
              </div>
              <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {doc.docType}
              </div>
              {doc.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {doc.tags.slice(0, 4).map((t) => (
                    <span
                      key={t.tag}
                      className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500 dark:text-slate-400"
                    >
                      {t.tag}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
          {!loadingDocs && docs.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 py-12">
              <p className="text-sm text-slate-400 dark:text-slate-500 mb-3">
                No documents yet
              </p>
              <button
                onClick={createDoc}
                className="rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Create your first document
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
