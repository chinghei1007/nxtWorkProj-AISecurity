import { useMutation, useQuery } from "@tanstack/react-query";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Check, KeyRound, Server, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { InlineAlert } from "../components/InlineAlert";
import { PageHeader } from "../components/PageHeader";
import { api, messageFrom } from "../lib/api";
import { readSessionGeminiKey, useModelStore, writeSessionGeminiKey } from "../store/model";
import type { GeminiModelsPayload, ModelsPayload } from "../types";

export function SettingsPage() {
  const selection = useModelStore((state) => state.selection);
  const setSelection = useModelStore((state) => state.setSelection);
  const [apiKey, setApiKey] = useState(readSessionGeminiKey);
  const [modelsForKey, setModelsForKey] = useState<GeminiModelsPayload["models"]>([]);
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const [reply, setReply] = useState("");
  const turnstile = useRef<TurnstileInstance>(null);
  const models = useQuery({ queryKey: ["models"], queryFn: () => api<ModelsPayload>("/api/models") });
  const validate = useMutation({
    mutationFn: () => api<GeminiModelsPayload>("/api/models/gemini", {
      method: "POST",
      body: JSON.stringify({ apiKey }),
    }),
    onSuccess: (payload) => {
      writeSessionGeminiKey(apiKey);
      setModelsForKey(payload.models);
    },
  });
  const test = useMutation({
    mutationFn: () => api<{ reply: string }>("/api/models/test", {
      method: "POST",
      body: JSON.stringify({ message, turnstileToken: token, selection: selection.source === "USER" ? { ...selection, apiKey: readSessionGeminiKey() } : selection }),
    }),
    onSuccess: (data) => setReply(data.reply),
    onSettled: () => { setToken(""); turnstile.current?.reset(); },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Browser preferences"
        title="Models"
        description="Choose a shared profile or validate a personal Gemini key for this browser tab. Personal keys are never stored by the server."
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><Server className="h-5 w-5" /></div><div><h2 className="font-bold text-slate-950">Shared models</h2><p className="text-xs text-slate-500">Protected by Turnstile and a daily service quota</p></div></div>
          {models.error && <div className="mt-4"><InlineAlert>{messageFrom(models.error)}</InlineAlert></div>}
          <div className="mt-5 space-y-3">
            {models.data?.models.map((model) => {
              const selected = selection.source === "SERVER" && selection.profileId === model.id;
              return (
                <button key={model.id} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${selected ? "border-blue-300 bg-blue-50" : "border-slate-200 hover:bg-slate-50"} ${!model.available ? "cursor-not-allowed opacity-60" : ""}`} disabled={!model.available} onClick={() => setSelection({ source: "SERVER", profileId: model.id })}>
                  <span className={`grid h-5 w-5 place-items-center rounded-full border ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}>{selected && <Check className="h-3 w-3" />}</span>
                  <span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900">{model.label}</span><span className="block truncate text-xs text-slate-500">{model.model}</span></span>
                  {!model.available && <span className="text-[10px] font-bold uppercase text-slate-400">Unavailable</span>}
                </button>
              );
            })}
          </div>
          {modelsForKey.length > 0 && (
            <div className="mt-7 border-t border-slate-200 pt-5">
              <label className="label" htmlFor="personal-gemini-model">Personal Gemini model</label>
              <select id="personal-gemini-model" className="input" value={selection.source === "USER" ? selection.model : ""} onChange={(event) => setSelection({ source: "USER", provider: "gemini", model: event.target.value })}>
                <option value="">Select a Gemini model</option>
                {modelsForKey.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
              </select>
            </div>
          )}
        </section>
        <aside className="card h-fit p-5 sm:p-6">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600"><KeyRound className="h-5 w-5" /></div><div><h2 className="font-bold text-slate-950">Personal Gemini key</h2><p className="text-xs text-slate-500">Stored only in this tab session</p></div></div>
          <p className="mt-4 text-sm leading-6 text-slate-500">The key is sent only for validation and your own Gemini scans. Closing the tab clears it.</p>
          <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); validate.mutate(); }}>
            <div><label className="label" htmlFor="gemini-key">Gemini API key</label><input id="gemini-key" className="input font-mono" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} required /></div>
            {validate.error && <InlineAlert>{messageFrom(validate.error)}</InlineAlert>}
            {validate.isSuccess && <InlineAlert tone="success">Key validated for this tab.</InlineAlert>}
            <button className="btn-primary w-full" disabled={validate.isPending}>{validate.isPending ? "Validating…" : "Validate and list models"}</button>
            <button type="button" className="btn-secondary w-full" onClick={() => { setApiKey(""); setModelsForKey([]); writeSessionGeminiKey(""); if (selection.source === "USER") setSelection({ source: "SERVER", profileId: models.data?.defaultProfileId ?? "groq-default" }); }}><Trash2 className="h-4 w-4" />Forget key</button>
          </form>
        </aside>
      </div>
      <section className="card mt-5 p-5 sm:p-6">
        <h2 className="font-bold text-slate-950">Test selected model</h2>
        <p className="mt-1 text-sm text-slate-500">Send a short message to check whether the selected model responds. Shared model tests count toward the daily quota.</p>
        <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); setReply(""); test.mutate(); }}>
          <label className="label" htmlFor="model-test-message">Message</label>
          <textarea id="model-test-message" className="input" rows={2} maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Hello! Are you responding?" required />
          <Turnstile ref={turnstile} siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"} onSuccess={setToken} onExpire={() => setToken("")} options={{ action: "scan", size: "flexible" }} />
          {test.error && <InlineAlert>{messageFrom(test.error)}</InlineAlert>}
          {reply && <div className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-800" aria-live="polite">{reply}</div>}
          <button className="btn-primary" disabled={test.isPending || !token || !message.trim()}>{test.isPending ? "Waiting…" : "Send test message"}</button>
        </form>
      </section>
    </div>
  );
}
