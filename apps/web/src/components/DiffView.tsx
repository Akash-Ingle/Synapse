import { useEffect, useState } from "react";
import { diffLines, diffWords } from "diff";
import { apiFetch } from "../lib/api";

interface VersionContent {
  versionNo: number;
  label: string | null;
  contentText: string;
  createdAt: string;
}

interface DiffViewProps {
  documentId: string;
  fromVersion: number;
  toVersion: number;
  onClose: () => void;
}

type DiffMode = "unified" | "side-by-side";

export default function DiffView({ documentId, fromVersion, toVersion, onClose }: DiffViewProps) {
  const [oldText, setOldText] = useState<string | null>(null);
  const [newText, setNewText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<DiffMode>("unified");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const fetchOld =
      fromVersion === 0
        ? Promise.resolve("")
        : apiFetch<VersionContent>(`/documents/${documentId}/versions/${fromVersion}`).then(
            (v) => v.contentText,
          );

    const fetchNew = apiFetch<VersionContent>(
      `/documents/${documentId}/versions/${toVersion}`,
    ).then((v) => v.contentText);

    Promise.all([fetchOld, fetchNew])
      .then(([o, n]) => {
        setOldText(o);
        setNewText(n);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load versions"))
      .finally(() => setLoading(false));
  }, [documentId, fromVersion, toVersion]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-400 animate-pulse">Loading versions…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-700">
          Go back
        </button>
      </div>
    );
  }

  const old = oldText ?? "";
  const cur = newText ?? "";

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-700">
            {fromVersion === 0 ? "Initial" : `v${fromVersion}`} → v{toVersion}
          </h3>
          <DiffStats oldText={old} newText={cur} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-slate-200 text-[11px]">
            <button
              onClick={() => setMode("unified")}
              className={`px-2.5 py-1 ${mode === "unified" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"} rounded-l-md`}
            >
              Unified
            </button>
            <button
              onClick={() => setMode("side-by-side")}
              className={`px-2.5 py-1 ${mode === "side-by-side" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"} rounded-r-md`}
            >
              Side by side
            </button>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕ Close
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto font-mono text-xs leading-relaxed">
        {mode === "unified" ? (
          <UnifiedDiff oldText={old} newText={cur} />
        ) : (
          <SideBySideDiff oldText={old} newText={cur} />
        )}
      </div>
    </div>
  );
}

function DiffStats({ oldText, newText }: { oldText: string; newText: string }) {
  const changes = diffLines(oldText, newText);
  let added = 0;
  let removed = 0;
  for (const c of changes) {
    const lines = (c.value.match(/\n/g) ?? []).length || 1;
    if (c.added) added += lines;
    if (c.removed) removed += lines;
  }
  return (
    <div className="flex gap-2 text-[11px]">
      {added > 0 && <span className="text-emerald-600">+{added}</span>}
      {removed > 0 && <span className="text-red-500">-{removed}</span>}
      {added === 0 && removed === 0 && <span className="text-slate-400">No changes</span>}
    </div>
  );
}

function UnifiedDiff({ oldText, newText }: { oldText: string; newText: string }) {
  const changes = diffLines(oldText, newText);

  if (oldText === newText) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 text-sm">
        No differences between these versions.
      </div>
    );
  }

  let lineNo = 0;

  return (
    <div className="min-w-0">
      {changes.map((change, i) => {
        const lines = change.value.split("\n");
        if (lines[lines.length - 1] === "") lines.pop();

        return lines.map((line, j) => {
          if (!change.added && !change.removed) lineNo++;
          const bg = change.added
            ? "bg-emerald-50"
            : change.removed
              ? "bg-red-50"
              : "";
          const textColor = change.added
            ? "text-emerald-800"
            : change.removed
              ? "text-red-700"
              : "text-slate-600";
          const prefix = change.added ? "+" : change.removed ? "-" : " ";
          const gutterBg = change.added
            ? "bg-emerald-100 text-emerald-600"
            : change.removed
              ? "bg-red-100 text-red-500"
              : "bg-slate-50 text-slate-400";

          return (
            <div key={`${i}-${j}`} className={`flex ${bg}`}>
              <div className={`w-10 flex-shrink-0 select-none px-2 py-0.5 text-right ${gutterBg}`}>
                {!change.added && !change.removed ? lineNo : ""}
              </div>
              <div className={`w-6 flex-shrink-0 select-none px-1 py-0.5 text-center font-bold ${gutterBg}`}>
                {prefix}
              </div>
              <div className={`flex-1 px-2 py-0.5 ${textColor} whitespace-pre-wrap break-all`}>
                {change.added || change.removed ? (
                  <WordHighlight line={line} isAdded={!!change.added} otherLines={
                    change.added
                      ? findMatchingLines(changes, i, false)
                      : findMatchingLines(changes, i, true)
                  } />
                ) : (
                  line || "\u00A0"
                )}
              </div>
            </div>
          );
        });
      })}
    </div>
  );
}

function WordHighlight({
  line,
  isAdded: _isAdded,
  otherLines: _otherLines,
}: {
  line: string;
  isAdded: boolean;
  otherLines: string;
}) {
  return <>{line || "\u00A0"}</>;
}

function findMatchingLines(changes: ReturnType<typeof diffLines>, idx: number, findRemoved: boolean): string {
  for (let i = Math.max(0, idx - 1); i <= Math.min(changes.length - 1, idx + 1); i++) {
    if (i === idx) continue;
    if (findRemoved && changes[i].removed) return changes[i].value;
    if (!findRemoved && changes[i].added) return changes[i].value;
  }
  return "";
}

function SideBySideDiff({ oldText, newText }: { oldText: string; newText: string }) {
  const changes = diffLines(oldText, newText);

  if (oldText === newText) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 text-sm">
        No differences between these versions.
      </div>
    );
  }

  interface SideLine {
    left: { text: string; type: "unchanged" | "removed" | "empty" };
    right: { text: string; type: "unchanged" | "added" | "empty" };
  }

  const rows: SideLine[] = [];

  for (const change of changes) {
    const lines = change.value.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();

    if (!change.added && !change.removed) {
      for (const line of lines) {
        rows.push({
          left: { text: line, type: "unchanged" },
          right: { text: line, type: "unchanged" },
        });
      }
    } else if (change.removed) {
      for (const line of lines) {
        rows.push({
          left: { text: line, type: "removed" },
          right: { text: "", type: "empty" },
        });
      }
    } else if (change.added) {
      const lastRows = rows.filter((r) => r.right.type === "empty");
      let filled = 0;
      for (const line of lines) {
        if (filled < lastRows.length) {
          lastRows[filled].right = { text: line, type: "added" };
          filled++;
        } else {
          rows.push({
            left: { text: "", type: "empty" },
            right: { text: line, type: "added" },
          });
        }
      }
    }
  }

  const bgMap = {
    unchanged: "",
    removed: "bg-red-50",
    added: "bg-emerald-50",
    empty: "bg-slate-50",
  };

  const textMap = {
    unchanged: "text-slate-600",
    removed: "text-red-700",
    added: "text-emerald-800",
    empty: "",
  };

  return (
    <div className="flex min-w-0">
      <div className="flex-1 border-r border-slate-200">
        <div className="sticky top-0 border-b border-slate-200 bg-red-50 px-3 py-1.5 text-[10px] font-semibold uppercase text-red-500">
          Old
        </div>
        {rows.map((row, i) => (
          <div key={i} className={`px-3 py-0.5 whitespace-pre-wrap break-all ${bgMap[row.left.type]} ${textMap[row.left.type]}`}>
            {row.left.text || "\u00A0"}
          </div>
        ))}
      </div>
      <div className="flex-1">
        <div className="sticky top-0 border-b border-slate-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold uppercase text-emerald-600">
          New
        </div>
        {rows.map((row, i) => (
          <div key={i} className={`px-3 py-0.5 whitespace-pre-wrap break-all ${bgMap[row.right.type]} ${textMap[row.right.type]}`}>
            {row.right.text || "\u00A0"}
          </div>
        ))}
      </div>
    </div>
  );
}
