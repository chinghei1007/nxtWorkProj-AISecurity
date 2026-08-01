import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Braces, Eraser, Lock, ScanLine, Sparkles } from "lucide-react";
import { useState } from "react";
import { InlineAlert } from "../components/InlineAlert";
import { PageHeader } from "../components/PageHeader";
import { ScanResults } from "../components/ScanResults";
import { api, messageFrom } from "../lib/api";
import { useEditorStore } from "../store/editor";
import type { ModelsPayload, ScanPayload } from "../types";

export function ScanPage() {
  const { title, source, setTitle, setSource, clear } = useEditorStore();
  const [result, setResult] = useState<ScanPayload["scan"] | null>(null);
  const queryClient = useQueryClient();
  const models = useQuery({
    queryKey: ["models"],
    queryFn: () => api<ModelsPayload>("/api/models"),
  });
  const activeModel = models.data?.models.find((model) => model.selected);
  const scan = useMutation({
    mutationFn: () => api<ScanPayload>("/api/scans", {
      method: "POST",
      body: JSON.stringify({ title: title || undefined, source }),
    }),
    onSuccess: ({ scan: completed }) => {
      setResult(completed);
      queryClient.invalidateQueries({ queryKey: ["scans"] });
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow="New audit"
        title="Inspect source code"
        description="Paste code for a static AI security review. Sentinel rejects obvious prose before contacting your selected provider."
        action={
          activeModel && (
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span className="truncate">{activeModel.label}</span>
            </div>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_340px]">
        <form
          className="card overflow-hidden"
          onSubmit={(event) => {
            event.preventDefault();
            setResult(null);
            scan.mutate();
          }}
        >
          <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:flex-row sm:items-end sm:p-5">
            <div className="flex-1">
              <label className="label" htmlFor="scan-title">Scan title <span className="font-normal text-slate-400">(optional)</span></label>
              <input
                id="scan-title"
                className="input"
                placeholder="Authentication middleware review"
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn-secondary shrink-0"
              onClick={() => {
                clear();
                setResult(null);
                scan.reset();
              }}
            >
              <Eraser className="h-4 w-4" />
              Clear
            </button>
          </div>

          <div className="relative bg-[#0b1220]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-xs text-slate-400">
              <span className="inline-flex items-center gap-2 font-medium">
                <Braces className="h-3.5 w-3.5 text-blue-400" />
                Source input
              </span>
              <span>{source.length.toLocaleString()} / 50,000</span>
            </div>
            <textarea
              aria-label="Source code"
              className="min-h-[420px] w-full resize-y bg-transparent p-4 font-mono text-[13px] leading-6 text-slate-200 placeholder:text-slate-600 focus-visible:ring-inset sm:p-5"
              placeholder={"Paste source code here…\n\nconst verifyToken = async (token) => {\n  // Review this function for vulnerabilities\n};"}
              maxLength={50_000}
              value={source}
              onChange={(event) => setSource(event.target.value)}
              spellCheck={false}
              required
            />
          </div>

          <div className="space-y-3 border-t border-slate-200 bg-white p-4 sm:p-5">
            {scan.error && <InlineAlert>{messageFrom(scan.error)}</InlineAlert>}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="inline-flex items-center gap-2 text-xs leading-5 text-slate-500">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                Source is sent to the active provider but is not saved in full or executed.
              </p>
              <button className="btn-primary shrink-0" disabled={scan.isPending || source.trim().length === 0}>
                <ScanLine className="h-4 w-4" />
                {scan.isPending ? "Running audit…" : "Run security scan"}
              </button>
            </div>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Before inference
            </p>
            <ol className="mt-4 space-y-4">
              {[
                ["01", "Code gate", "Rejects prose without spending a model request."],
                ["02", "Static audit", "Analyzes text only; submitted code is never run."],
                ["03", "Validated output", "Normalizes findings into a consistent result."],
              ].map(([number, step, detail]) => (
                <li key={number} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                    {number}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{step}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          {!activeModel && !models.isLoading && (
            <InlineAlert>No configured model is currently selected. Open Settings to choose one.</InlineAlert>
          )}
        </aside>
      </div>

      {result && <div className="mt-6"><ScanResults scan={result} /></div>}
    </div>
  );
}
