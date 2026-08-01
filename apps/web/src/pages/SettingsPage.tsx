import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  KeyRound,
  Plus,
  Server,
  Settings2,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { InlineAlert } from "../components/InlineAlert";
import { PageHeader } from "../components/PageHeader";
import { useSession } from "../hooks/use-session";
import { api, messageFrom } from "../lib/api";
import type {
  CredentialCreatedPayload,
  CredentialsPayload,
  GeminiModelsPayload,
  ModelsPayload,
  SessionPayload,
} from "../types";
import type { Credential, SafeModel } from "@secure-scan/contracts";

function AccountSettings() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState(session.data?.user.username ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  useEffect(() => {
    if (session.data) setUsername(session.data.user.username);
  }, [session.data]);

  const updateAccount = useMutation({
    mutationFn: () => api<SessionPayload>("/api/account", {
      method: "PATCH",
      body: JSON.stringify({ username }),
    }),
    onSuccess: (updated) => queryClient.setQueryData(["session"], updated),
  });
  const changePassword = useMutation({
    mutationFn: () => api<SessionPayload>("/api/account/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["session"], updated);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
    },
  });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="card p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-950">Account identity</h2>
            <p className="text-xs text-slate-500">Used to sign in to this workspace</p>
          </div>
        </div>
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            updateAccount.mutate();
          }}
        >
          <div>
            <label className="label" htmlFor="settings-username">Username</label>
            <input
              id="settings-username"
              className="input"
              minLength={3}
              maxLength={64}
              pattern="[a-zA-Z0-9._-]+"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
          {updateAccount.error && <InlineAlert>{messageFrom(updateAccount.error)}</InlineAlert>}
          {updateAccount.isSuccess && <InlineAlert tone="success">Username updated.</InlineAlert>}
          <button
            className="btn-primary"
            disabled={updateAccount.isPending || username === session.data?.user.username}
          >
            Save username
          </button>
        </form>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-950">Change password</h2>
            <p className="text-xs text-slate-500">Closes every other active session</p>
          </div>
        </div>
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (newPassword === confirmation) changePassword.mutate();
          }}
        >
          <div>
            <label className="label" htmlFor="settings-current-password">Current password</label>
            <input id="settings-current-password" className="input" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="settings-new-password">New password</label>
            <input id="settings-new-password" className="input" type="password" minLength={12} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="settings-confirm-password">Confirm new password</label>
            <input id="settings-confirm-password" className="input" type="password" minLength={12} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
            {confirmation && confirmation !== newPassword && (
              <p className="mt-2 text-xs font-medium text-red-600">Passwords do not match.</p>
            )}
          </div>
          {changePassword.error && <InlineAlert>{messageFrom(changePassword.error)}</InlineAlert>}
          {changePassword.isSuccess && <InlineAlert tone="success">Password changed.</InlineAlert>}
          <button className="btn-primary" disabled={changePassword.isPending || newPassword !== confirmation}>
            Update password
          </button>
        </form>
      </section>
    </div>
  );
}

function CredentialCard({
  credential,
  active,
  onSelect,
  onDelete,
}: {
  credential: Credential;
  active: SafeModel | undefined;
  onSelect: (credentialId: string, model: string) => void;
  onDelete: (credentialId: string) => void;
}) {
  const available = useQuery({
    queryKey: ["credential-models", credential.id],
    queryFn: () => api<GeminiModelsPayload>("/api/credentials/" + credential.id + "/models"),
  });

  return (
    <article className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600">
          <KeyRound className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">{credential.label}</h3>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
              {credential.status}
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-slate-400">Gemini · •••• {credential.lastFour}</p>
        </div>
        <button
          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
          onClick={() => {
            if (window.confirm("Remove this API key? The secret cannot be recovered.")) {
              onDelete(credential.id);
            }
          }}
          aria-label={"Delete " + credential.label}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4">
        <label className="label" htmlFor={"gemini-model-" + credential.id}>Available model</label>
        <select
          id={"gemini-model-" + credential.id}
          className="input"
          value={active?.credentialId === credential.id ? active.model : ""}
          onChange={(event) => {
            if (event.target.value) onSelect(credential.id, event.target.value);
          }}
          disabled={available.isLoading || Boolean(available.error)}
        >
          <option value="">{available.isLoading ? "Loading models…" : "Select a Gemini model"}</option>
          {available.data?.models.map((model) => (
            <option key={model.id} value={model.id}>{model.label}</option>
          ))}
        </select>
        {available.error && <p className="mt-2 text-xs text-red-600">{messageFrom(available.error)}</p>}
      </div>
    </article>
  );
}

function ModelSettings() {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const models = useQuery({
    queryKey: ["models"],
    queryFn: () => api<ModelsPayload>("/api/models"),
  });
  const credentials = useQuery({
    queryKey: ["credentials"],
    queryFn: () => api<CredentialsPayload>("/api/credentials"),
  });
  const select = useMutation({
    mutationFn: (value: { source: "SERVER"; profileId: string } | { source: "USER"; credentialId: string; model: string }) =>
      api<ModelsPayload>("/api/model-preference", {
        method: "PATCH",
        body: JSON.stringify(value),
      }),
    onSuccess: (updated) => queryClient.setQueryData(["models"], updated),
  });
  const addCredential = useMutation({
    mutationFn: () => api<CredentialCreatedPayload>("/api/credentials", {
      method: "POST",
      body: JSON.stringify({ label, apiKey }),
    }),
    onSuccess: () => {
      setLabel("");
      setApiKey("");
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
    },
  });
  const removeCredential = useMutation({
    mutationFn: (id: string) => api<void>("/api/credentials/" + id, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
      queryClient.invalidateQueries({ queryKey: ["models"] });
    },
  });
  const active = models.data?.models.find((model) => model.selected);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-950">Workspace models</h2>
              <p className="text-xs text-slate-500">Shared profiles managed by the server administrator</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {models.data?.models.filter((model) => model.source === "SERVER").map((model) => (
              <button
                key={model.id}
                className={
                  "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition " +
                  (model.selected
                    ? "border-blue-300 bg-blue-50/70"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50") +
                  (!model.available || model.locked ? " cursor-not-allowed opacity-60" : "")
                }
                onClick={() => select.mutate({ source: "SERVER", profileId: model.id })}
                disabled={!model.available || model.locked || select.isPending}
              >
                <span className={
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full border " +
                  (model.selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300")
                }>
                  {model.selected && <Check className="h-3 w-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-900">{model.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{model.model}</span>
                </span>
                {model.locked && <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-bold uppercase text-violet-700">Full demo</span>}
                {!model.available && <span className="text-[10px] font-bold uppercase text-slate-400">Not configured</span>}
              </button>
            ))}
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-950">Personal Gemini keys</h2>
              <p className="text-xs text-slate-500">Encrypted at rest and never shown again</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {credentials.data?.credentials.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                No personal Gemini keys saved.
              </div>
            )}
            {credentials.data?.credentials.map((credential) => (
              <CredentialCard
                key={credential.id}
                credential={credential}
                active={active}
                onSelect={(credentialId, model) => select.mutate({ source: "USER", credentialId, model })}
                onDelete={(id) => removeCredential.mutate(id)}
              />
            ))}
          </div>
        </section>
      </div>

      <aside className="card h-fit p-5 sm:p-6">
        <h2 className="font-bold text-slate-950">Add a Gemini key</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Sentinel validates the key before encrypting it. The browser cannot retrieve it later.
        </p>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            addCredential.mutate();
          }}
        >
          <div>
            <label className="label" htmlFor="credential-label">Key label</label>
            <input id="credential-label" className="input" placeholder="Personal Gemini" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={64} required />
          </div>
          <div>
            <label className="label" htmlFor="credential-key">Gemini API key</label>
            <input id="credential-key" className="input font-mono" type="password" autoComplete="off" placeholder="Paste key" value={apiKey} onChange={(event) => setApiKey(event.target.value)} required />
          </div>
          {addCredential.error && <InlineAlert>{messageFrom(addCredential.error)}</InlineAlert>}
          {select.error && <InlineAlert>{messageFrom(select.error)}</InlineAlert>}
          {removeCredential.error && <InlineAlert>{messageFrom(removeCredential.error)}</InlineAlert>}
          <button className="btn-primary w-full" disabled={addCredential.isPending}>
            <Plus className="h-4 w-4" />
            {addCredential.isPending ? "Validating key…" : "Validate and save"}
          </button>
        </form>
      </aside>
    </div>
  );
}

export function SettingsPage() {
  const [tab, setTab] = useState<"account" | "models">("account");
  return (
    <div>
      <PageHeader
        eyebrow="Workspace preferences"
        title="Settings"
        description="Manage your account, protected provider credentials, and the model used for future scans."
      />
      <div className="mb-6 inline-flex rounded-xl border border-slate-200 bg-white p-1">
        <button
          className={"rounded-lg px-4 py-2 text-sm font-semibold transition " + (tab === "account" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900")}
          onClick={() => setTab("account")}
        >
          Account
        </button>
        <button
          className={"rounded-lg px-4 py-2 text-sm font-semibold transition " + (tab === "models" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900")}
          onClick={() => setTab("models")}
        >
          Models & keys
        </button>
      </div>
      {tab === "account" ? <AccountSettings /> : <ModelSettings />}
    </div>
  );
}
