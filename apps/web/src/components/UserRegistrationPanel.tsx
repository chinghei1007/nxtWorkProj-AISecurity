import type { AccessTier, Role } from "@secure-scan/contracts";
import { Download, FileUp, Plus, TableProperties, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { api, messageFrom } from "../lib/api";
import {
  batchTemplateCsv,
  credentialsCsv,
  downloadText,
  parseBatchCsv,
  toIsoOrOriginal,
  type EditableBatchRow,
} from "../lib/users-csv";
import type { BatchCreatePayload, BatchCreateRowInput, UserPayload } from "../types";
import { InlineAlert } from "./InlineAlert";
import { useMutation } from "@tanstack/react-query";

export function UserRegistrationPanel({ onChanged }: { onChanged: () => void }) {
  const [tab, setTab] = useState<"single" | "batch">("single");
  return (
    <aside className="card h-fit overflow-hidden">
      <div className="flex border-b border-slate-200 p-1">
        <button type="button" className={"flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold " + (tab === "single" ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-50")} onClick={() => setTab("single")}>
          <UserPlus className="h-4 w-4" /> Single
        </button>
        <button type="button" className={"flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold " + (tab === "batch" ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-50")} onClick={() => setTab("batch")}>
          <TableProperties className="h-4 w-4" /> Batch
        </button>
      </div>
      {tab === "single" ? <SingleRegistration onChanged={onChanged} /> : <BatchRegistration onChanged={onChanged} />}
    </aside>
  );
}

function SingleRegistration({ onChanged }: { onChanged: () => void }) {
  const [username, setUsername] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [role, setRole] = useState<Role>("USER");
  const [accessTier, setAccessTier] = useState<AccessTier>("LIMITED");
  const [expiresAt, setExpiresAt] = useState("");
  const create = useMutation({
    mutationFn: () => api<UserPayload>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        username,
        temporaryPassword,
        role,
        accessTier,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      }),
    }),
    onSuccess: () => {
      setUsername("");
      setTemporaryPassword("");
      setRole("USER");
      setAccessTier("LIMITED");
      setExpiresAt("");
      onChanged();
    },
  });

  return (
    <form className="space-y-4 p-5 sm:p-6" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
      <div>
        <h2 className="font-bold text-slate-950">Create one account</h2>
        <p className="mt-1 text-xs text-slate-500">The temporary password must be changed at first sign-in.</p>
      </div>
      <div><label className="label" htmlFor="new-user-username">Username</label><input id="new-user-username" className="input" minLength={3} maxLength={64} pattern="[a-zA-Z0-9._-]+" value={username} onChange={(event) => setUsername(event.target.value)} required /></div>
      <div><label className="label" htmlFor="new-user-password">Temporary password</label><input id="new-user-password" className="input" type="password" minLength={12} value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="new-user-role">Security role</label><select id="new-user-role" className="input" value={role} onChange={(event) => setRole(event.target.value as Role)}><option value="USER">User</option><option value="ADMIN">Administrator</option></select></div>
        <div><label className="label" htmlFor="new-user-tier">Access tier</label><select id="new-user-tier" className="input" value={accessTier} onChange={(event) => setAccessTier(event.target.value as AccessTier)}><option value="LIMITED">Limited</option><option value="FULL_DEMO">Full demo</option></select></div>
      </div>
      <div><label className="label" htmlFor="new-user-expiry">Expires at (optional)</label><input id="new-user-expiry" className="input" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></div>
      {create.error && <InlineAlert>{messageFrom(create.error)}</InlineAlert>}
      {create.isSuccess && <InlineAlert tone="success">Account created.</InlineAlert>}
      <button className="btn-primary w-full" disabled={create.isPending}><Plus className="h-4 w-4" />{create.isPending ? "Creating…" : "Create account"}</button>
    </form>
  );
}

function BatchRegistration({ onChanged }: { onChanged: () => void }) {
  const [csv, setCsv] = useState("");
  const [rows, setRows] = useState<EditableBatchRow[]>([]);
  const [defaultRole, setDefaultRole] = useState<Role>("USER");
  const [defaultTier, setDefaultTier] = useState<AccessTier>("LIMITED");
  const [defaultExpiry, setDefaultExpiry] = useState("");
  const [result, setResult] = useState<BatchCreatePayload | null>(null);
  const create = useMutation({
    mutationFn: () => {
      const payloadRows: BatchCreateRowInput[] = rows.map((row) => ({
        clientRowId: row.clientRowId,
        username: row.username,
        ...(row.temporaryPassword ? { temporaryPassword: row.temporaryPassword } : {}),
        role: row.role || defaultRole,
        accessTier: row.accessTier || defaultTier,
        expiresAt: toIsoOrOriginal(row.expiresAt || defaultExpiry),
      }));
      return api<BatchCreatePayload>("/api/admin/users/batch", { method: "POST", body: JSON.stringify({ rows: payloadRows }) });
    },
    onSuccess: (data) => { setResult(data); onChanged(); },
  });

  function updateRow(index: number, field: keyof EditableBatchRow, value: string) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }

  const credentials = result?.results.flatMap((item) => item.status === "created" ? [{
    username: item.user.username,
    temporaryPassword: item.temporaryPassword,
    role: item.user.role,
    accessTier: item.user.accessTier,
    expiresAt: item.user.expiresAt,
  }] : []) ?? [];

  return (
    <div className="space-y-5 p-5 sm:p-6">
      <div>
        <h2 className="font-bold text-slate-950">Batch registration</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Paste or upload up to 200 CSV rows. Blank passwords are generated securely and returned once.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="btn-secondary cursor-pointer"><FileUp className="h-4 w-4" /> Upload CSV<input className="sr-only" type="file" accept=".csv,text/csv" onChange={async (event) => { const file = event.target.files?.[0]; if (file) { const text = await file.text(); setCsv(text); setRows(parseBatchCsv(text)); setResult(null); } }} /></label>
        <button type="button" className="btn-secondary" onClick={() => downloadText("sentinel-user-template.csv", batchTemplateCsv())}><Download className="h-4 w-4" /> Template</button>
      </div>
      <div>
        <label className="label" htmlFor="batch-users-csv">CSV data</label>
        <textarea id="batch-users-csv" className="input min-h-32 font-mono text-xs" value={csv} onChange={(event) => setCsv(event.target.value)} placeholder="username,temporaryPassword,role,accessTier,expiresAt" />
        <button type="button" className="btn-secondary mt-2" onClick={() => { setRows(parseBatchCsv(csv)); setResult(null); }}>Parse and preview</button>
      </div>
      <fieldset className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">Defaults for blank cells</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <select aria-label="Default security role" className="input py-2" value={defaultRole} onChange={(event) => setDefaultRole(event.target.value as Role)}><option value="USER">User</option><option value="ADMIN">Admin</option></select>
          <select aria-label="Default access tier" className="input py-2" value={defaultTier} onChange={(event) => setDefaultTier(event.target.value as AccessTier)}><option value="LIMITED">Limited</option><option value="FULL_DEMO">Full demo</option></select>
          <input aria-label="Default expiry" className="input py-2" type="datetime-local" value={defaultExpiry} onChange={(event) => setDefaultExpiry(event.target.value)} />
        </div>
      </fieldset>
      {rows.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold text-slate-700">Preview</p><span className="text-xs text-slate-500">{rows.length} rows</span></div>
          <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
            {rows.map((row, index) => (
              <div key={row.clientRowId} className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold text-slate-400">Row {index + 1}</span><button type="button" aria-label={`Remove row ${index + 1}`} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}><X className="h-4 w-4" /></button></div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input aria-label={`Username row ${index + 1}`} className="input py-2" placeholder="Username" value={row.username} onChange={(event) => updateRow(index, "username", event.target.value)} />
                  <input aria-label={`Temporary password row ${index + 1}`} className="input py-2" type="password" placeholder="Generate password" value={row.temporaryPassword} onChange={(event) => updateRow(index, "temporaryPassword", event.target.value)} />
                  <select aria-label={`Role row ${index + 1}`} className="input py-2" value={row.role} onChange={(event) => updateRow(index, "role", event.target.value)}><option value="">Default role</option><option value="USER">User</option><option value="ADMIN">Admin</option>{row.role && !["USER", "ADMIN"].includes(row.role) && <option value={row.role}>Invalid: {row.role}</option>}</select>
                  <select aria-label={`Tier row ${index + 1}`} className="input py-2" value={row.accessTier} onChange={(event) => updateRow(index, "accessTier", event.target.value)}><option value="">Default tier</option><option value="LIMITED">Limited</option><option value="FULL_DEMO">Full demo</option>{row.accessTier && !["LIMITED", "FULL_DEMO"].includes(row.accessTier) && <option value={row.accessTier}>Invalid: {row.accessTier}</option>}</select>
                  <input aria-label={`Expiry row ${index + 1}`} className="input py-2 sm:col-span-2" placeholder="ISO expiry or blank" value={row.expiresAt} onChange={(event) => updateRow(index, "expiresAt", event.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {rows.length > 200 && <InlineAlert>Batch registration is limited to 200 rows.</InlineAlert>}
      {create.error && <InlineAlert>{messageFrom(create.error)}</InlineAlert>}
      {result && (
        <div className="space-y-3">
          <InlineAlert tone={result.summary.failed ? "error" : "success"}>{`${result.summary.created} created · ${result.summary.failed} failed`}</InlineAlert>
          {result.results.some((item) => item.status === "error") && <ul className="space-y-1 text-xs text-red-700">{result.results.filter((item) => item.status === "error").map((item) => <li key={item.clientRowId}><strong>{item.clientRowId}:</strong> {item.status === "error" ? item.error.message : ""}</li>)}</ul>}
          {credentials.length > 0 && <button type="button" className="btn-primary w-full" onClick={() => downloadText("sentinel-temporary-credentials.csv", credentialsCsv(credentials))}><Download className="h-4 w-4" /> Download one-time credentials</button>}
        </div>
      )}
      <button type="button" className="btn-primary w-full" disabled={!rows.length || rows.length > 200 || create.isPending} onClick={() => create.mutate()}><Plus className="h-4 w-4" />{create.isPending ? "Registering…" : `Register ${rows.length || ""} accounts`}</button>
    </div>
  );
}
