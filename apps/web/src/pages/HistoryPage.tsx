import { Archive, ArrowRight, Clock3, FileJson, FileUp, KeyRound, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { InlineAlert } from "../components/InlineAlert";
import { PageHeader } from "../components/PageHeader";
import {
  listLocalReports,
  listRemoteReferences,
  parseReportFile,
  remoteReference,
  removeLocalReport,
  removeRemoteReference,
  saveLocalReport,
  saveRemoteReference,
  type LocalReportRecord,
  type RemoteReference,
} from "../lib/archive";
import { api, messageFrom } from "../lib/api";
import { formatDate } from "../lib/format";
import type { ScanPayload } from "../types";

export function HistoryPage() {
  const [tab, setTab] = useState<"recent" | "local">("recent");
  const [remote, setRemote] = useState<RemoteReference[]>([]);
  const [local, setLocal] = useState<LocalReportRecord[]>([]);
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    const [remoteItems, localItems] = await Promise.all([listRemoteReferences(), listLocalReports()]);
    setRemote(remoteItems);
    setLocal(localItems);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function openCode() {
    setBusy(true); setError(null);
    try {
      const payload = await api<ScanPayload>("/api/scans/resolve", { method: "POST", body: JSON.stringify({ accessCode }) });
      await saveRemoteReference(remoteReference(payload.scan, { code: accessCode }));
      navigate(`/history/${payload.scan.id}`);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    setError(null); setStatus(null);
    try {
      const saved = await saveLocalReport(await parseReportFile(file));
      setStatus(saved.created ? "Report saved to this browser." : "This exact report is already in the local archive.");
      await refresh();
      setTab("local");
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Browser-held history" title="History & local archive" description="Recent access capabilities stay in this browser. Imported and explicitly saved JSON reports remain local until you delete them." action={<Link to="/scan" className="btn-primary">New scan <ArrowRight className="h-4 w-4" /></Link>} />
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <form className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); void openCode(); }}>
          <div className="flex-1"><label className="label" htmlFor="access-code">Open with access code</label><input id="access-code" className="input font-mono tracking-wider" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} minLength={12} maxLength={12} placeholder="12-character code" required /></div>
          <button className="btn-secondary shrink-0" disabled={busy || accessCode.length !== 12}><KeyRound className="h-4 w-4" />{busy ? "Opening…" : "Open report"}</button>
        </form>
        <label className="card flex cursor-pointer items-center justify-center gap-3 px-5 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <FileUp className="h-5 w-5 text-blue-600" /> Import report JSON
          <input aria-label="Import report JSON" type="file" accept="application/json,.json" className="sr-only" onChange={(event) => { void importFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
        </label>
      </div>
      {error && <div className="mb-4"><InlineAlert>{error}</InlineAlert></div>}
      {status && <div className="mb-4"><InlineAlert tone="success">{status}</InlineAlert></div>}
      <div className="mb-5 flex gap-1 rounded-xl border border-slate-200 bg-white p-1" role="tablist" aria-label="History source">
        <button role="tab" aria-selected={tab === "recent"} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${tab === "recent" ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-50"}`} onClick={() => setTab("recent")}><Clock3 className="h-4 w-4" />Recent scans ({remote.length})</button>
        <button role="tab" aria-selected={tab === "local"} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${tab === "local" ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-50"}`} onClick={() => setTab("local")}><Archive className="h-4 w-4" />Local archive ({local.length})</button>
      </div>
      {tab === "recent" ? (
        remote.length === 0 ? <Empty icon={<Clock3 className="h-6 w-6" />} title="No recent capabilities" detail="Run a scan here or enter an access code. This list is never fetched from the server." /> :
        <div className="space-y-3">{remote.map((item) => {
          const expired = new Date(item.expiresAt).getTime() <= Date.now();
          return <article key={item.id} className="card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-bold text-slate-950">{item.title}</h2><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${expired ? "bg-slate-100 text-slate-500" : "bg-amber-50 text-amber-700"}`}>{expired ? "Expired" : "24-hour copy"}</span></div><p className="mt-1 text-xs text-slate-500">{formatDate(item.createdAt)} · {item.model}</p><p className="mt-2 font-mono text-xs tracking-widest text-slate-500">{item.accessCode}</p></div><div className="flex gap-2">{!expired && <Link className="btn-secondary" to={`/history/${item.id}`}>View</Link>}<button className="btn-danger" aria-label={`Remove ${item.title} from recent history`} onClick={async () => { await removeRemoteReference(item.id); await refresh(); }}><Trash2 className="h-4 w-4" />Remove</button></div></article>;
        })}</div>
      ) : (
        local.length === 0 ? <Empty icon={<FileJson className="h-6 w-6" />} title="No local reports" detail="Import a schema 1.0 JSON export or use Save JSON locally after a scan." /> :
        <div className="space-y-3">{local.map((item) => <article key={item.localId} className="card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-bold text-slate-950">{item.report.scan.title}</h2><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700">Browser only</span></div><p className="mt-1 text-xs text-slate-500">Scanned {formatDate(item.report.scan.createdAt)} · imported {formatDate(item.importedAt)}</p></div><div className="flex gap-2"><Link className="btn-secondary" to={`/archive/${item.localId}`}>View</Link><button className="btn-danger" aria-label={`Delete local ${item.report.scan.title}`} onClick={async () => { await removeLocalReport(item.localId); await refresh(); }}><Trash2 className="h-4 w-4" />Delete</button></div></article>)}</div>
      )}
    </div>
  );
}

function Empty({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="card flex flex-col items-center px-5 py-16 text-center"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600">{icon}</div><h2 className="mt-4 font-bold text-slate-950">{title}</h2><p className="mt-2 max-w-md text-sm text-slate-500">{detail}</p></div>;
}
