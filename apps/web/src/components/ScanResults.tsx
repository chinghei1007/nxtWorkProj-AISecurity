import type { Scan } from "@secure-scan/contracts";
import { AlertTriangle, CheckCircle2, MapPin, ShieldCheck } from "lucide-react";
import { severityTone } from "../lib/format";

export function ScanResults({ scan }: { scan: Scan }) {
  return (
    <section aria-labelledby="scan-results-title" className="card overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
              Audit complete
            </p>
            <h2 id="scan-results-title" className="mt-1.5 text-xl font-bold text-slate-950">
              {scan.title}
            </h2>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
            {scan.model}
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">{scan.summary}</p>
      </div>

      <div className="p-5 sm:p-6">
        {scan.findings.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 px-5 py-10 text-center">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            <h3 className="mt-3 font-semibold text-emerald-950">No findings reported</h3>
            <p className="mt-1 max-w-md text-sm text-emerald-800">
              The selected model did not identify a security issue in this submission.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {scan.findings.map((finding, index) => (
              <article
                key={finding.title + index}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      "rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide " +
                      severityTone(finding.severity)
                    }
                  >
                    {finding.severity}
                  </span>
                  {(finding.lineStart || finding.lineEnd) && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5" />
                      Line {finding.lineStart ?? "?"}
                      {finding.lineEnd && finding.lineEnd !== finding.lineStart
                        ? "–" + finding.lineEnd
                        : ""}
                    </span>
                  )}
                </div>
                <h3 className="mt-3 flex items-start gap-2 font-semibold text-slate-950">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  {finding.title}
                </h3>
                <div className="mt-3 grid gap-4 text-sm leading-6 text-slate-600 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Why it matters
                    </p>
                    <p>{finding.explanation}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Recommended fix
                    </p>
                    <p>{finding.remediation}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
