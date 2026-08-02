import type { ScanExport } from "@secure-scan/contracts";
import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";
import { downloadReportValue } from "../lib/api";

export function JsonReportViewer({ report, onDownload }: { report: ScanExport; onDownload?: () => void }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const formatted = JSON.stringify(report, null, 2);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(formatted);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2_000);
    } catch {
      setCopyState("error");
    }
  }

  return (
    <section className="card overflow-hidden" aria-labelledby="json-report-title">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
        <div>
          <h2 id="json-report-title" className="font-bold text-slate-950">Versioned JSON report</h2>
          <p className="mt-1 text-xs text-slate-500">Complete canonical report · schema {report.schemaVersion}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={copyReport}>
            {copyState === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copyState === "copied" ? "Copied" : "Copy"}
          </button>
          <button type="button" onClick={onDownload ?? (() => downloadReportValue(`${report.scan.title}.json`, report))} className="btn-primary">
            <Download className="h-4 w-4" /> Download
          </button>
        </div>
      </div>
      {copyState === "error" && <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm text-red-700">Clipboard access was unavailable. Select the JSON text to copy it manually.</p>}
      <pre className="max-h-[70vh] overflow-auto bg-slate-950 p-5 text-xs leading-5 text-slate-100 sm:p-6" tabIndex={0}><code>{formatted}</code></pre>
    </section>
  );
}
