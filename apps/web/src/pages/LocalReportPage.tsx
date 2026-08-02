import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Braces, FileText } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { InlineAlert } from "../components/InlineAlert";
import { JsonReportViewer } from "../components/JsonReportViewer";
import { ScanResults } from "../components/ScanResults";
import { getLocalReport } from "../lib/archive";
import { downloadReportValue } from "../lib/api";
import { formatDate } from "../lib/format";

export function LocalReportPage() {
  const { localId = "" } = useParams();
  const [tab, setTab] = useState<"report" | "json">("report");
  const local = useQuery({ queryKey: ["local-report", localId], queryFn: () => getLocalReport(localId) });
  if (local.isLoading) return <div className="card h-72 animate-pulse bg-white" />;
  if (!local.data) return <InlineAlert>That local report is no longer stored in this browser.</InlineAlert>;
  const report = local.data.report;
  const scan = {
    id: report.scan.id,
    title: report.scan.title,
    language: report.scan.language,
    codePreview: report.scan.codePreview,
    provider: report.scan.provider,
    model: report.scan.model,
    summary: report.scan.summary,
    findings: report.fixQueue.map((finding, originalIndex) => ({
      severity: finding.severity,
      title: finding.title,
      lineStart: finding.location?.lineStart,
      lineEnd: finding.location?.lineEnd,
      explanation: finding.explanation,
      remediation: finding.remediationSummary,
      storyPoints: finding.storyPoints,
      instructionsMarkdown: finding.instructionsMarkdown,
      suggestedCode: finding.suggestedCode ?? undefined,
      evidence: finding.evidence ?? undefined,
      priority: finding.rank,
      originalIndex,
    })),
    createdAt: report.scan.createdAt,
    updatedAt: report.scan.updatedAt,
    expiresAt: report.scan.createdAt,
  };
  return <div><Link to="/history" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Back to archive</Link><div className="mb-5"><p className="text-sm text-slate-500">Local JSON · scanned {formatDate(report.scan.createdAt)}</p><h1 className="mt-1 text-2xl font-bold text-slate-950">{report.scan.title}</h1></div><div className="mb-4 flex gap-1 rounded-xl border border-slate-200 bg-white p-1" role="tablist" aria-label="Local report view"><button role="tab" aria-selected={tab === "report"} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${tab === "report" ? "bg-slate-950 text-white" : "text-slate-500"}`} onClick={() => setTab("report")}><FileText className="h-4 w-4" />Report</button><button role="tab" aria-selected={tab === "json"} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${tab === "json" ? "bg-slate-950 text-white" : "text-slate-500"}`} onClick={() => setTab("json")}><Braces className="h-4 w-4" />JSON</button></div>{tab === "report" ? <ScanResults scan={scan} /> : <JsonReportViewer report={report} onDownload={() => downloadReportValue(`${report.scan.title}.json`, report)} />}</div>;
}
