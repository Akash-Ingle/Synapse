import { useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { apiFetch, apiStream } from "../lib/api";

interface AiPanelProps {
  editor: TiptapEditor | null;
  documentId: string;
  workspaceId: string | null;
}

type Tab = "assist" | "summary" | "outline" | "tasks" | "chat" | "notes" | "style" | "search";

const TABS: { key: Tab; label: string }[] = [
  { key: "assist", label: "Rewrite" },
  { key: "summary", label: "Summary" },
  { key: "outline", label: "Outline" },
  { key: "tasks", label: "Tasks" },
  { key: "chat", label: "Chat" },
  { key: "notes", label: "Notes" },
  { key: "style", label: "Style" },
  { key: "search", label: "Search" },
];

export default function AiPanel({ editor, documentId, workspaceId }: AiPanelProps) {
  const [tab, setTab] = useState<Tab>("assist");

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 p-2 text-xs">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-2 py-1.5 transition ${
              tab === t.key ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {tab === "assist" && <AssistTab editor={editor} documentId={documentId} />}
        {tab === "summary" && <SummaryTab editor={editor} documentId={documentId} />}
        {tab === "outline" && <OutlineTab editor={editor} documentId={documentId} />}
        {tab === "tasks" && <TasksTab editor={editor} documentId={documentId} />}
        {tab === "chat" && <ChatTab editor={editor} documentId={documentId} />}
        {tab === "notes" && <NotesTab editor={editor} documentId={documentId} />}
        {tab === "style" && <StyleTab editor={editor} documentId={documentId} />}
        {tab === "search" && <SearchTab workspaceId={workspaceId} />}
      </div>
    </div>
  );
}

function getSelection(editor: TiptapEditor | null): { text: string; from: number; to: number } {
  if (!editor) return { text: "", from: 0, to: 0 };
  const { from, to } = editor.state.selection;
  return { text: editor.state.doc.textBetween(from, to, " "), from, to };
}

function AiResult({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      {label && <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>}
      {children}
    </div>
  );
}

// ── Rewrite / Expand ──────────────────────────────────────

const REWRITE_MODES = ["improve", "shorten", "lengthen", "formal", "casual", "simplify", "fix_grammar"] as const;

function AssistTab({ editor, documentId }: { editor: TiptapEditor | null; documentId: string }) {
  const [mode, setMode] = useState<(typeof REWRITE_MODES)[number]>("improve");
  const [preview, setPreview] = useState("");
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function rewrite() {
    const sel = getSelection(editor);
    if (!sel.text) return setPreview("Select some text in the document first.");
    setBusy(true); setPreview(""); setRange({ from: sel.from, to: sel.to });
    try {
      await apiStream("/ai/rewrite/stream", { documentId, selection: sel.text, mode }, (d) => setPreview((p) => p + d));
    } catch (e) { setPreview(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  }

  async function expand() {
    const sel = getSelection(editor);
    if (!sel.text) return setPreview("Select some text first.");
    setBusy(true); setPreview(""); setRange({ from: sel.from, to: sel.to });
    try {
      const res = await apiFetch<{ text: string }>("/ai/expand", { method: "POST", body: JSON.stringify({ documentId, selection: sel.text, mode: "lengthen" }) });
      setPreview(res.text);
    } finally { setBusy(false); }
  }

  function accept() {
    if (!editor || !range || !preview) return;
    editor.chain().focus().insertContentAt({ from: range.from, to: range.to }, preview).run();
    setPreview(""); setRange(null);
  }

  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Rewrite mode</label>
        <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm capitalize">
          {REWRITE_MODES.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={rewrite} disabled={busy} className="flex-1 rounded-lg bg-slate-900 py-2 text-xs font-medium text-white disabled:opacity-50">
          {busy ? "Thinking…" : "Rewrite"}
        </button>
        <button onClick={expand} disabled={busy} className="flex-1 rounded-lg border border-slate-300 py-2 text-xs font-medium disabled:opacity-50">
          Expand
        </button>
      </div>
      {preview && (
        <AiResult label="preview">
          <p className="whitespace-pre-wrap text-slate-700">{preview}</p>
          {range && <button onClick={accept} className="mt-2 rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white">Accept & replace</button>}
        </AiResult>
      )}
    </div>
  );
}

// ── Summary ───────────────────────────────────────────────

function SummaryTab({ editor, documentId }: { editor: TiptapEditor | null; documentId: string }) {
  const [summary, setSummary] = useState("");
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!editor) return; setBusy(true);
    try {
      const text = getSelection(editor).text || editor.getText();
      const res = await apiFetch<{ summary: string }>("/ai/summarize", { method: "POST", body: JSON.stringify({ documentId, text, length }) });
      setSummary(res.summary);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 text-sm">
      <select value={length} onChange={(e) => setLength(e.target.value as any)} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
        <option value="short">Short (2-3 sentences)</option>
        <option value="medium">Medium (paragraph)</option>
        <option value="long">Long (detailed)</option>
      </select>
      <button onClick={run} disabled={busy} className="w-full rounded-lg bg-slate-900 py-2 text-xs font-medium text-white disabled:opacity-50">
        {busy ? "Summarizing…" : "Summarize"}
      </button>
      <p className="text-[10px] text-slate-400">Summarizes selected text, or the full document if nothing is selected.</p>
      {summary && <AiResult label="summary"><p className="whitespace-pre-wrap text-slate-700">{summary}</p></AiResult>}
    </div>
  );
}

// ── Outline ───────────────────────────────────────────────

interface OutlineData { title: string; sections: { heading: string; points: string[] }[] }

function OutlineTab({ editor, documentId }: { editor: TiptapEditor | null; documentId: string }) {
  const [outline, setOutline] = useState<OutlineData | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!editor) return; setBusy(true);
    try {
      const res = await apiFetch<OutlineData>("/ai/outline", { method: "POST", body: JSON.stringify({ documentId, text: editor.getText() }) });
      setOutline(res);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 text-sm">
      <button onClick={run} disabled={busy} className="w-full rounded-lg bg-slate-900 py-2 text-xs font-medium text-white disabled:opacity-50">
        {busy ? "Generating…" : "Generate outline"}
      </button>
      {outline && (
        <AiResult>
          <h3 className="mb-2 font-semibold">{outline.title}</h3>
          {outline.sections.map((s, i) => (
            <div key={i} className="mb-2">
              <p className="font-medium text-slate-700">{s.heading}</p>
              <ul className="ml-4 list-disc text-slate-600">
                {s.points.map((p, j) => <li key={j}>{p}</li>)}
              </ul>
            </div>
          ))}
        </AiResult>
      )}
    </div>
  );
}

// ── Task Extraction ───────────────────────────────────────

interface ExtractedTask { text: string; owner?: string; dueDate?: string; priority?: string }

function TasksTab({ editor, documentId }: { editor: TiptapEditor | null; documentId: string }) {
  const [tasks, setTasks] = useState<ExtractedTask[]>([]);
  const [busy, setBusy] = useState(false);
  const [extracted, setExtracted] = useState(false);

  async function run() {
    if (!editor) return; setBusy(true);
    try {
      const res = await apiFetch<{ tasks: ExtractedTask[] }>("/ai/tasks", { method: "POST", body: JSON.stringify({ documentId, text: editor.getText() }) });
      setTasks(res.tasks); setExtracted(true);
    } finally { setBusy(false); }
  }

  const priorityColor: Record<string, string> = { high: "text-red-600 bg-red-50", medium: "text-amber-600 bg-amber-50", low: "text-slate-500 bg-slate-100" };

  return (
    <div className="space-y-3 text-sm">
      <button onClick={run} disabled={busy} className="w-full rounded-lg bg-slate-900 py-2 text-xs font-medium text-white disabled:opacity-50">
        {busy ? "Extracting…" : "Extract tasks from document"}
      </button>
      {extracted && tasks.length === 0 && <p className="text-xs text-slate-400">No action items found in this document.</p>}
      {tasks.length > 0 && (
        <div className="space-y-2">
          {tasks.map((t, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2">
              <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border border-slate-300" />
              <div className="flex-1">
                <p className="text-slate-700">{t.text}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {t.owner && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600">{t.owner}</span>}
                  {t.dueDate && <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] text-purple-600">{t.dueDate}</span>}
                  {t.priority && <span className={`rounded px-1.5 py-0.5 text-[10px] ${priorityColor[t.priority] ?? ""}`}>{t.priority}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Chat with Document (RAG) ──────────────────────────────

interface ChatMessage { role: "user" | "ai"; text: string; citations?: { content: string }[] }

function ChatTab({ editor, documentId }: { editor: TiptapEditor | null; documentId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!input.trim() || busy) return;
    const q = input.trim(); setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const text = editor?.getText() ?? "";
      const res = await apiFetch<{ answer: string; citations: { content: string; chunkIndex: number }[] }>("/ai/chat", {
        method: "POST", body: JSON.stringify({ documentId, question: q, text }),
      });
      setMessages((m) => [...m, { role: "ai", text: res.answer, citations: res.citations }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "ai", text: e instanceof Error ? e.message : "Error" }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex h-full flex-col text-sm">
      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-xs text-slate-400">Ask questions about this document. The AI uses the document content to ground its answers.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`rounded-lg p-2 ${m.role === "user" ? "bg-slate-100 text-slate-700" : "border border-slate-200 bg-white text-slate-700"}`}>
            <div className="mb-1 text-[10px] font-semibold uppercase text-slate-400">{m.role === "user" ? "You" : "Synapse"}</div>
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.citations && m.citations.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="text-[10px] font-semibold text-slate-400">SOURCES</div>
                {m.citations.map((c, j) => (
                  <p key={j} className="line-clamp-2 rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-500 italic">"{c.content.slice(0, 150)}…"</p>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="text-xs text-slate-400 animate-pulse">Thinking…</div>}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about this document…" className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        <button onClick={send} disabled={busy} className="rounded-lg bg-slate-900 px-3 text-xs font-medium text-white disabled:opacity-50">Send</button>
      </div>
    </div>
  );
}

// ── Meeting Notes → Doc ───────────────────────────────────

function NotesTab({ editor, documentId }: { editor: TiptapEditor | null; documentId: string }) {
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<{ title: string; structuredContent: string; actionItems: ExtractedTask[] } | null>(null);
  const [busy, setBusy] = useState(false);

  async function convert() {
    if (!notes.trim()) return; setBusy(true);
    try {
      const res = await apiFetch<{ title: string; structuredContent: string; actionItems: ExtractedTask[] }>("/ai/notes-to-doc", {
        method: "POST", body: JSON.stringify({ documentId, notes }),
      });
      setResult(res);
    } finally { setBusy(false); }
  }

  function insertIntoDoc() {
    if (!editor || !result) return;
    editor.chain().focus().setContent(result.structuredContent).run();
    setResult(null); setNotes("");
  }

  return (
    <div className="space-y-3 text-sm">
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste raw meeting notes here…"
        className="h-32 w-full resize-none rounded-lg border border-slate-200 p-2 text-sm" />
      <button onClick={convert} disabled={busy || !notes.trim()} className="w-full rounded-lg bg-slate-900 py-2 text-xs font-medium text-white disabled:opacity-50">
        {busy ? "Converting…" : "Convert to structured doc"}
      </button>
      {result && (
        <AiResult label={result.title}>
          <p className="whitespace-pre-wrap text-slate-700">{result.structuredContent}</p>
          {result.actionItems.length > 0 && (
            <div className="mt-2 border-t border-slate-200 pt-2">
              <div className="mb-1 text-[10px] font-semibold uppercase text-slate-400">Action Items</div>
              <ul className="list-disc pl-4 text-slate-600">
                {result.actionItems.map((t, i) => <li key={i}>{t.text}{t.owner ? ` — ${t.owner}` : ""}</li>)}
              </ul>
            </div>
          )}
          <button onClick={insertIntoDoc} className="mt-2 rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white">
            Insert into document
          </button>
        </AiResult>
      )}
    </div>
  );
}

// ── Style Adaptation ──────────────────────────────────────

const AUDIENCES = ["executive", "engineer", "customer", "casual", "academic"] as const;

function StyleTab({ editor, documentId }: { editor: TiptapEditor | null; documentId: string }) {
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]>("executive");
  const [result, setResult] = useState("");
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function adapt() {
    if (!editor) return;
    const sel = getSelection(editor);
    const text = sel.text || editor.getText();
    if (!text) return;
    setBusy(true); setResult("");
    if (sel.text) setRange({ from: sel.from, to: sel.to }); else setRange(null);
    try {
      const res = await apiFetch<{ text: string }>("/ai/style-adapt", { method: "POST", body: JSON.stringify({ documentId, text, audience }) });
      setResult(res.text);
    } finally { setBusy(false); }
  }

  function accept() {
    if (!editor || !result) return;
    if (range) {
      editor.chain().focus().insertContentAt({ from: range.from, to: range.to }, result).run();
    } else {
      editor.chain().focus().setContent(result).run();
    }
    setResult(""); setRange(null);
  }

  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Target audience</label>
        <select value={audience} onChange={(e) => setAudience(e.target.value as any)} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm capitalize">
          {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <button onClick={adapt} disabled={busy} className="w-full rounded-lg bg-slate-900 py-2 text-xs font-medium text-white disabled:opacity-50">
        {busy ? "Adapting…" : "Adapt style"}
      </button>
      <p className="text-[10px] text-slate-400">Rewrites selected text (or full doc) for the chosen audience.</p>
      {result && (
        <AiResult label={`for ${audience}`}>
          <p className="whitespace-pre-wrap text-slate-700">{result}</p>
          <button onClick={accept} className="mt-2 rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white">Accept & replace</button>
        </AiResult>
      )}
    </div>
  );
}

// ── Semantic Search ───────────────────────────────────────

interface SearchHit { documentId: string; documentTitle: string; content: string; score: number }

function SearchTab({ workspaceId }: { workspaceId: string | null }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!workspaceId || !query) return; setBusy(true);
    try {
      const res = await apiFetch<SearchHit[]>("/ai/search", { method: "POST", body: JSON.stringify({ workspaceId, query, limit: 8 }) });
      setHits(res);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Semantic search…" className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        <button onClick={run} disabled={busy} className="rounded-lg bg-slate-900 px-3 text-xs font-medium text-white disabled:opacity-50">Go</button>
      </div>
      <div className="space-y-2">
        {hits.map((h, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium text-slate-700">{h.documentTitle}</span>
              <span className="text-[10px] text-slate-400">{(h.score * 100).toFixed(0)}%</span>
            </div>
            <p className="line-clamp-3 text-xs text-slate-500">{h.content}</p>
          </div>
        ))}
        {!busy && hits.length === 0 && <p className="text-xs text-slate-400">Search across all documents using meaning, not just keywords. Save a version to index docs.</p>}
      </div>
    </div>
  );
}
