import type { Scan } from "@secure-scan/contracts";
import { ChevronDown, Clock3, Download, ExternalLink, ShieldAlert, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate, severityTone } from "../lib/format";
import { FindingsViewer } from "./FindingsViewer";

export function HistoryScanRow({
  scan,
  expanded,
  onToggle,
  onDelete,
}: {
  scan: Scan;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const panelId = `scan-report-${scan.id}`;

  return (
    <article className="card overflow-hidden transition hover:border-slate-300">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <button
          type="button"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={(expanded ? "Collapse " : "Expand ") + scan.title}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <ChevronDown className={"h-5 w-5 transition-transform " + (expanded ? "rotate-180" : "")} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-slate-400" />
            <h2 className="truncate font-semibold text-slate-950">{scan.title}</h2>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{scan.language}</span>
          </div>
          <p className="mt-1.5 line-clamp-1 text-sm text-slate-500">{scan.summary}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{formatDate(scan.createdAt)}</span>
            <span>{scan.model}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          {scan.findings.slice(0, 3).map((finding) => (
            <span key={finding.originalIndex} title={finding.severity} className={"h-2.5 w-2.5 rounded-full border " + severityTone(finding.severity)} />
          ))}
          <span className="mr-2 text-xs font-medium text-slate-500">{scan.findings.length} finding{scan.findings.length === 1 ? "" : "s"}</span>
          <button className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600" aria-label={"Delete " + scan.title} onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {expanded && (
        <div id={panelId} className="border-t border-slate-200 bg-slate-50/60 p-4 sm:p-6">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Prioritized remediation report</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{scan.summary}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <a href={`/api/scans/${scan.id}/export?download=1`} className="btn-secondary"><Download className="h-4 w-4" /> JSON</a>
              <Link to={`/history/${scan.id}`} className="btn-primary">View full report <ExternalLink className="h-4 w-4" /></Link>
            </div>
          </div>
          {scan.findings.length > 0 ? (
            <FindingsViewer findings={scan.findings} />
          ) : (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">No findings were reported for this scan.</p>
          )}
        </div>
      )}
    </article>
  );
}
