import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Archive, Braces, Check, Copy, Eraser, Lock, ScanLine, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { InlineAlert } from "../components/InlineAlert";
import { PageHeader } from "../components/PageHeader";
import { ScanResults } from "../components/ScanResults";
import { remoteReference, saveLocalReport, saveRemoteReference } from "../lib/archive";
import { api, messageFrom } from "../lib/api";
import { useEditorStore } from "../store/editor";
import { readSessionGeminiKey, useModelStore } from "../store/model";
import type { CreateScanPayload, ModelsPayload, ScanExportPayload } from "../types";

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

export function ScanPage() {
  const { title, source, setTitle, setSource, clear } = useEditorStore();
  const selection = useModelStore((state) => state.selection);
  const setSelection = useModelStore((state) => state.setSelection);
  const [result, setResult] = useState<CreateScanPayload | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedLocally, setSavedLocally] = useState(false);
  const turnstile = useRef<TurnstileInstance>(null);
  const models = useQuery({ queryKey: ["models"], queryFn: () => api<ModelsPayload>("/api/models") });
  useEffect(() => {
    if (models.data && selection.source === "SERVER" && !models.data.models.some((model) => model.id === selection.profileId)) {
      setSelection({ source: "SERVER", profileId: models.data.defaultProfileId });
    }
  }, [models.data, selection, setSelection]);
  const activeModel = selection.source === "SERVER"
    ? models.data?.models.find((model) => model.id === selection.profileId)
    : { label: `Personal Gemini · ${selection.model}`, available: Boolean(readSessionGeminiKey()) };

  const scan = useMutation({
    mutationFn: async () => {
      const requestSelection = selection.source === "SERVER"
        ? selection
        : { ...selection, apiKey: readSessionGeminiKey() };
      if (requestSelection.source === "USER" && !requestSelection.apiKey) throw new Error("Add and validate your Gemini key in Models first.");
      return api<CreateScanPayload>("/api/scans", {
        method: "POST",
        body: JSON.stringify({ title: title || undefined, source, turnstileToken, selection: requestSelection }),
      });
    },
    onSuccess: async (completed) => {
      setResult(completed);
      setSavedLocally(false);
      await saveRemoteReference(remoteReference(completed.scan, {
        code: completed.access.code,
        managementToken: completed.access.managementToken,
        shareUrl: completed.access.shareUrl,
      }));
    },
    onSettled: () => {
      setTurnstileToken("");
      turnstile.current?.reset();
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error("No report is available.");
      const report = await api<ScanExportPayload>(`/api/scans/${result.scan.id}/export`, {
        headers: { "X-Scan-Access-Code": result.access.code },
      });
      return saveLocalReport(report);
    },
    onSuccess: () => setSavedLocally(true),
  });

  return (
    <div>
      <PageHeader eyebrow="New anonymous audit" title="Inspect source code" description="No account is required. The server report expires after 24 hours; full submitted source is never stored." action={activeModel && <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"><Sparkles className="h-3.5 w-3.5 text-blue-600" /><span className="truncate">{activeModel.label}</span></div>} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_340px]">
        <form className="card overflow-hidden" onSubmit={(event) => { event.preventDefault(); setResult(null); scan.mutate(); }}>
          <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:flex-row sm:items-end sm:p-5">
            <div className="flex-1"><label className="label" htmlFor="scan-title">Scan title <span className="font-normal text-slate-400">(optional)</span></label><input id="scan-title" className="input" placeholder="Authentication middleware review" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></div>
            <button type="button" className="btn-secondary shrink-0" onClick={() => { clear(); setResult(null); scan.reset(); }}><Eraser className="h-4 w-4" />Clear</button>
          </div>
          <div className="relative bg-[#0b1220]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-xs text-slate-400"><span className="inline-flex items-center gap-2 font-medium"><Braces className="h-3.5 w-3.5 text-blue-400" />Source input</span><span>{source.length.toLocaleString()} / 50,000</span></div>
            <textarea aria-label="Source code" className="min-h-[420px] w-full resize-y bg-transparent p-4 font-mono text-[13px] leading-6 text-slate-200 placeholder:text-slate-600 focus-visible:ring-inset sm:p-5" placeholder={"Paste source code here…\n\nconst verifyToken = async (token) => {\n  // Review this function for vulnerabilities\n};"} maxLength={50_000} value={source} onChange={(event) => setSource(event.target.value)} spellCheck={false} required />
          </div>
          <div className="space-y-4 border-t border-slate-200 bg-white p-4 sm:p-5">
            <Turnstile ref={turnstile} siteKey={turnstileSiteKey} onSuccess={setTurnstileToken} onExpire={() => setTurnstileToken("")} options={{ action: "scan", size: "flexible" }} />
            {scan.error && <InlineAlert>{messageFrom(scan.error)}</InlineAlert>}
            {!activeModel?.available && <InlineAlert>The selected model is unavailable. Choose another model first.</InlineAlert>}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="inline-flex items-center gap-2 text-xs leading-5 text-slate-500"><Lock className="h-3.5 w-3.5 shrink-0" />Source is analyzed as text and discarded after inference.</p><button className="btn-primary shrink-0" disabled={scan.isPending || !turnstileToken || !activeModel?.available || source.trim().length === 0}><ScanLine className="h-4 w-4" />{scan.isPending ? "Running audit…" : "Run security scan"}</button></div>
          </div>
        </form>
        <aside className="space-y-4">
          <div className="card p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Retention</p><ol className="mt-4 space-y-4">{[["01", "Code gate", "Obvious prose is rejected before a model request."], ["02", "24-hour report", "The D1 record becomes unavailable exactly one day later."], ["03", "Your archive", "Export or save the JSON locally to retain it."]].map(([number, step, detail]) => <li key={number} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">{number}</span><div><p className="text-sm font-semibold text-slate-800">{step}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{detail}</p></div></li>)}</ol></div>
        </aside>
      </div>
      {result && <div className="mt-6 space-y-5">
        <section className="card border-emerald-200 bg-emerald-50/60 p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">Access code · case-sensitive</p><p className="mt-2 font-mono text-2xl font-bold tracking-[0.16em] text-slate-950">{result.access.code}</p><p className="mt-2 text-sm text-slate-600">Keep this code to reopen the report from another browser before it expires.</p></div><div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={async () => { await navigator.clipboard.writeText(result.access.shareUrl); setCopied(true); }}><Copy className="h-4 w-4" />{copied ? "Copied link" : "Copy share link"}</button><button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending || savedLocally}>{savedLocally ? <Check className="h-4 w-4" /> : <Archive className="h-4 w-4" />}{savedLocally ? "Saved locally" : "Save JSON locally"}</button></div></div>
          {save.error && <div className="mt-4"><InlineAlert>{messageFrom(save.error)}</InlineAlert></div>}
        </section>
        <ScanResults scan={result.scan} />
      </div>}
    </div>
  );
}
