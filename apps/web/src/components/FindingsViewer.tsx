import type { Finding, StoryPoints } from "@secure-scan/contracts";
import { AlertTriangle, ArrowDown, ArrowUp, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { severityTone } from "../lib/format";
import { CodeEvidence } from "./CodeEvidence";
import { MarkdownInstructions } from "./MarkdownInstructions";

const severities = ["critical", "high", "medium", "low", "info"] as const;
const effortOptions = [1, 2, 3, 5, 8] as const;
const severityOrder: Record<Finding["severity"], number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};
type SortField = "severity" | "effort" | "line" | "original";

function toggleValue<T>(current: Set<T>, value: T) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function FindingsViewer({ findings }: { findings: Finding[] }) {
  const [selectedSeverities, setSelectedSeverities] = useState<Set<Finding["severity"]>>(() => new Set(severities));
  const [selectedEffort, setSelectedEffort] = useState<Set<StoryPoints>>(() => new Set(effortOptions));
  const [sortField, setSortField] = useState<SortField>("severity");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const visible = useMemo(() => {
    const filtered = findings.filter((finding) => selectedSeverities.has(finding.severity) && selectedEffort.has(finding.storyPoints));
    return [...filtered].sort((a, b) => {
      let result = 0;
      if (sortField === "severity") result = severityOrder[a.severity] - severityOrder[b.severity];
      if (sortField === "effort") result = a.storyPoints - b.storyPoints;
      if (sortField === "line") result = (a.lineStart ?? Number.MAX_SAFE_INTEGER) - (b.lineStart ?? Number.MAX_SAFE_INTEGER);
      if (sortField === "original") result = a.originalIndex - b.originalIndex;
      return (direction === "asc" ? result : -result) || a.priority - b.priority;
    });
  }, [direction, findings, selectedEffort, selectedSeverities, sortField]);

  return (
    <div>
      <div className="mb-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_1fr_auto]">
        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Severity</legend>
          <div className="flex flex-wrap gap-2">
            {severities.map((severity) => (
              <label key={severity} className="cursor-pointer">
                <input
                  className="peer sr-only"
                  type="checkbox"
                  checked={selectedSeverities.has(severity)}
                  onChange={() => setSelectedSeverities((current) => toggleValue(current, severity))}
                />
                <span className="block rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 peer-checked:border-blue-200 peer-checked:bg-blue-50 peer-checked:text-blue-700 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500">
                  {severity}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Estimated effort</legend>
          <div className="flex flex-wrap gap-2">
            {effortOptions.map((points) => (
              <label key={points} className="cursor-pointer">
                <input
                  className="peer sr-only"
                  type="checkbox"
                  checked={selectedEffort.has(points)}
                  onChange={() => setSelectedEffort((current) => toggleValue(current, points))}
                />
                <span className="block rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-400 peer-checked:border-violet-200 peer-checked:bg-violet-50 peer-checked:text-violet-700 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500">
                  {points} pt{points === 1 ? "" : "s"}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-end gap-2">
          <label className="flex-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            Sort
            <select className="input mt-2 min-w-36 py-2 text-sm normal-case tracking-normal" value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}>
              <option value="severity">Severity</option>
              <option value="effort">Effort</option>
              <option value="line">Source line</option>
              <option value="original">Original order</option>
            </select>
          </label>
          <button
            className="btn-secondary h-[42px] px-3"
            type="button"
            aria-label={direction === "asc" ? "Sort ascending" : "Sort descending"}
            onClick={() => setDirection((current) => current === "asc" ? "desc" : "asc")}
          >
            {direction === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <p className="mb-3 text-xs text-slate-500" aria-live="polite">
        Showing {visible.length} of {findings.length} findings. Story points are model estimates, not guaranteed completion times.
      </p>
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
          No findings match the selected filters.
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((finding) => (
            <article key={finding.originalIndex} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-slate-950 px-2 py-1 text-[11px] font-bold text-white">#{finding.priority}</span>
                  <span className={"rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide " + severityTone(finding.severity)}>{finding.severity}</span>
                  <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700">Estimated · {finding.storyPoints} pt{finding.storyPoints === 1 ? "" : "s"}</span>
                  {finding.lineStart && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5" />
                      Line {finding.lineStart}{finding.lineEnd && finding.lineEnd !== finding.lineStart ? `–${finding.lineEnd}` : ""}
                    </span>
                  )}
                </div>
                <h3 className="mt-3 flex items-start gap-2 font-semibold text-slate-950">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  {finding.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{finding.explanation}</p>
              </div>
              <div className="space-y-5 p-4 sm:p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Remediation summary</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{finding.remediation}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Implementation instructions</p>
                  <MarkdownInstructions>{finding.instructionsMarkdown}</MarkdownInstructions>
                </div>
                <CodeEvidence finding={finding} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
