import type { Scan } from "@secure-scan/contracts";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { FindingsViewer } from "./FindingsViewer";

export function ScanResults({ scan }: { scan: Scan }) {
  return (
    <section aria-labelledby="scan-results-title" className="card overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Audit complete</p>
            <h2 id="scan-results-title" className="mt-1.5 text-xl font-bold text-slate-950">{scan.title}</h2>
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
            <p className="mt-1 max-w-md text-sm text-emerald-800">The selected model did not identify a security issue in this submission.</p>
          </div>
        ) : (
          <FindingsViewer findings={scan.findings} />
        )}
      </div>
    </section>
  );
}
