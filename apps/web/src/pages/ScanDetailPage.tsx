import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowLeft, Braces, Copy, FileText, Pencil, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { InlineAlert } from "../components/InlineAlert";
import { JsonReportViewer } from "../components/JsonReportViewer";
import { ScanResults } from "../components/ScanResults";
import { getRemoteReference, removeRemoteReference, saveLocalReport, saveRemoteReference } from "../lib/archive";
import { api, downloadJson, messageFrom } from "../lib/api";
import { formatDate } from "../lib/format";
import type { ScanExportPayload, ScanPayload } from "../types";

export function ScanDetailPage() {
  const { id = "" } = useParams();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [activeTab, setActiveTab] = useState<"report" | "json">("report");
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const record = useQuery({ queryKey: ["remote-reference", id], queryFn: () => getRemoteReference(id) });
  const scan = useQuery({
    queryKey: ["scan", id],
    enabled: Boolean(record.data),
    queryFn: async () => {
      if (!record.data) throw new Error("This browser does not have the access capability for that scan.");
      return api<ScanPayload>(`/api/scans/${id}`, { headers: { "X-Scan-Access-Code": record.data.accessCode } });
    },
  });
  const exportedReport = useQuery({
    queryKey: ["scan-export", id],
    enabled: activeTab === "json" && Boolean(record.data),
    queryFn: async () => {
      if (!record.data) throw new Error("Access capability unavailable.");
      return api<ScanExportPayload>(`/api/scans/${id}/export`, { headers: { "X-Scan-Access-Code": record.data.accessCode } });
    },
  });
  useEffect(() => { if (scan.data) setTitle(scan.data.scan.title); }, [scan.data]);

  const rename = useMutation({
    mutationFn: async () => {
      if (!record.data?.managementToken) throw new Error("This shared capability is read-only.");
      return api<ScanPayload>(`/api/scans/${id}`, { method: "PATCH", headers: { "X-Scan-Management-Token": record.data.managementToken }, body: JSON.stringify({ title }) });
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(["scan", id], updated);
      if (record.data) await saveRemoteReference({ ...record.data, title: updated.scan.title });
      setEditing(false);
    },
  });
  const remove = useMutation({
    mutationFn: async () => {
      if (!record.data?.managementToken) throw new Error("This shared capability is read-only.");
      return api<void>(`/api/scans/${id}`, { method: "DELETE", headers: { "X-Scan-Management-Token": record.data.managementToken } });
    },
    onSuccess: async () => { await removeRemoteReference(id); navigate("/history"); },
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!record.data) throw new Error("Access capability unavailable.");
      const report = await api<ScanExportPayload>(`/api/scans/${id}/export`, { headers: { "X-Scan-Access-Code": record.data.accessCode } });
      return saveLocalReport(report);
    },
    onSuccess: () => setSaved(true),
  });

  if (record.isLoading || scan.isLoading) return <div className="card h-72 animate-pulse bg-white" />;
  if (!record.data || scan.error || !scan.data) return <InlineAlert>{record.data ? messageFrom(scan.error) : "This browser no longer has the capability needed to open that scan."}</InlineAlert>;

  return (
    <div>
      <Link to="/history" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Back to history</Link>
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">{editing ? <form className="flex max-w-xl items-center gap-2" onSubmit={(event) => { event.preventDefault(); rename.mutate(); }}><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} autoFocus /><button className="btn-primary" disabled={rename.isPending}><Save className="h-4 w-4" />Save</button></form> : <><p className="text-sm text-slate-500">{formatDate(scan.data.scan.createdAt)} · expires {formatDate(scan.data.scan.expiresAt)}</p><button disabled={!record.data.managementToken} onClick={() => setEditing(true)} className="mt-1 flex max-w-full items-center gap-2 rounded-lg text-left text-xl font-bold text-slate-950 hover:text-blue-700 disabled:cursor-default"><span className="truncate">{scan.data.scan.title}</span>{record.data.managementToken && <Pencil className="h-4 w-4 shrink-0 text-slate-400" />}</button></>}</div>
        <div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => navigator.clipboard.writeText(record.data!.shareUrl)}><Copy className="h-4 w-4" />Copy share link</button><button className="btn-secondary" onClick={() => save.mutate()} disabled={save.isPending || saved}><Archive className="h-4 w-4" />{saved ? "Saved locally" : "Save locally"}</button>{record.data.managementToken && <button className="btn-danger" onClick={() => { if (window.confirm("Delete this server scan now?")) remove.mutate(); }}><Trash2 className="h-4 w-4" />Delete</button>}</div>
      </div>
      {(rename.error || remove.error || save.error) && <div className="mb-4"><InlineAlert>{messageFrom(rename.error ?? remove.error ?? save.error)}</InlineAlert></div>}
      <div className="mb-4 flex gap-1 rounded-xl border border-slate-200 bg-white p-1" role="tablist" aria-label="Scan report view"><button type="button" role="tab" aria-selected={activeTab === "report"} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${activeTab === "report" ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-50"}`} onClick={() => setActiveTab("report")}><FileText className="h-4 w-4" />Report</button><button type="button" role="tab" aria-selected={activeTab === "json"} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${activeTab === "json" ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-50"}`} onClick={() => setActiveTab("json")}><Braces className="h-4 w-4" />JSON</button></div>
      {activeTab === "report" ? <><ScanResults scan={scan.data.scan} /><div className="mt-4 card p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Stored source preview</p><code className="mt-2 block break-words text-sm leading-6 text-slate-600">{scan.data.scan.codePreview}</code></div></> : exportedReport.isLoading ? <div className="card h-72 animate-pulse bg-white" /> : exportedReport.error || !exportedReport.data ? <InlineAlert>{messageFrom(exportedReport.error)}</InlineAlert> : <JsonReportViewer report={exportedReport.data} onDownload={() => void downloadJson(`/api/scans/${id}/export?download=1`, `${scan.data.scan.title}.json`, { "X-Scan-Access-Code": record.data!.accessCode })} />}
    </div>
  );
}
