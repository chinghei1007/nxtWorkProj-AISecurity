import type {
  AccessTier,
  BatchUserActionInput,
  EffectiveUserStatus,
  Role,
  User,
  UserStatus,
} from "@secure-scan/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, KeyRound, Search, Trash2, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { InlineAlert } from "../components/InlineAlert";
import { PageHeader } from "../components/PageHeader";
import { UserRegistrationPanel } from "../components/UserRegistrationPanel";
import { useSession } from "../hooks/use-session";
import { api, messageFrom } from "../lib/api";
import { formatDate } from "../lib/format";
import { toLocalDateTimeValue } from "../lib/users-csv";
import type { BatchActionPayload, PaginatedUsersPayload, UserPayload } from "../types";

type ExpiryFilter = "ANY" | "NONE" | "EXPIRED" | "NEXT_7_DAYS" | "NEXT_30_DAYS" | "LATER";

function statusTone(status: EffectiveUserStatus) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700";
  if (status === "EXPIRED") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

export function UsersPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | Role>("");
  const [tierFilter, setTierFilter] = useState<"" | AccessTier>("");
  const [statusFilter, setStatusFilter] = useState<"" | EffectiveUserStatus>("");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("ANY");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [batchRole, setBatchRole] = useState<Role>("USER");
  const [batchTier, setBatchTier] = useState<AccessTier>("LIMITED");
  const [batchExpiry, setBatchExpiry] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "50", expiry: expiryFilter });
    if (q.trim()) params.set("q", q.trim());
    if (roleFilter) params.set("role", roleFilter);
    if (tierFilter) params.set("accessTier", tierFilter);
    if (statusFilter) params.set("effectiveStatus", statusFilter);
    return params.toString();
  }, [expiryFilter, page, q, roleFilter, statusFilter, tierFilter]);

  const users = useQuery({
    queryKey: ["users", queryString],
    queryFn: () => api<PaginatedUsersPayload>(`/api/admin/users?${queryString}`),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["session"] });
    queryClient.invalidateQueries({ queryKey: ["models"] });
  };
  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: Role; status?: UserStatus; accessTier?: AccessTier; expiresAt?: string | null } }) =>
      api<UserPayload>(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: refresh,
  });
  const resetPassword = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => api<UserPayload>(`/api/admin/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ temporaryPassword: password }) }),
    onSuccess: refresh,
  });
  const deleteUser = useMutation({
    mutationFn: (id: string) => api<void>(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => { setSelectedIds((current) => { const next = new Set(current); next.delete(id); return next; }); refresh(); },
  });
  const batchAction = useMutation({
    mutationFn: (action: BatchUserActionInput["action"]) => api<BatchActionPayload>("/api/admin/users/batch-actions", {
      method: "POST",
      body: JSON.stringify({ userIds: [...selectedIds], action }),
    }),
    onSuccess: (payload) => {
      const completed = new Set(payload.results.filter((item) => item.status !== "error").map((item) => item.userId));
      setSelectedIds((current) => new Set([...current].filter((id) => !completed.has(id))));
      refresh();
    },
  });

  const pageIds = users.data?.users.map((user) => user.id) ?? [];
  const pageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const mutationError = updateUser.error ?? resetPassword.error ?? deleteUser.error ?? batchAction.error;

  function setFilter(change: () => void) {
    change();
    setPage(1);
  }

  function togglePage() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (pageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administrator"
        title="User access"
        description="Register accounts in bulk, control security roles and model access, and manage login expiry."
      />
      {mutationError && <div className="mb-5"><InlineAlert>{messageFrom(mutationError)}</InlineAlert></div>}
      {batchAction.data && (
        <div className="mb-5 space-y-2">
          <InlineAlert tone={batchAction.data.summary.failed ? "error" : "success"}>{`${batchAction.data.summary.succeeded} updated · ${batchAction.data.summary.failed} failed`}</InlineAlert>
          {batchAction.data.results.some((item) => item.status === "error") && <ul className="text-sm text-red-700">{batchAction.data.results.filter((item) => item.status === "error").map((item) => <li key={item.userId}>{item.userId}: {item.status === "error" ? item.error.message : ""}</li>)}</ul>}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="min-w-0 space-y-4">
          <div className="card p-4 sm:p-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="relative md:col-span-2 xl:col-span-1">
                <span className="sr-only">Search users</span>
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input className="input pl-9" placeholder="Search username" value={q} onChange={(event) => setFilter(() => setQ(event.target.value))} />
              </label>
              <select aria-label="Filter by role" className="input" value={roleFilter} onChange={(event) => setFilter(() => setRoleFilter(event.target.value as "" | Role))}><option value="">All roles</option><option value="USER">User</option><option value="ADMIN">Admin</option></select>
              <select aria-label="Filter by access tier" className="input" value={tierFilter} onChange={(event) => setFilter(() => setTierFilter(event.target.value as "" | AccessTier))}><option value="">All tiers</option><option value="LIMITED">Limited</option><option value="FULL_DEMO">Full demo</option></select>
              <select aria-label="Filter by account state" className="input" value={statusFilter} onChange={(event) => setFilter(() => setStatusFilter(event.target.value as "" | EffectiveUserStatus))}><option value="">All states</option><option value="ACTIVE">Active</option><option value="EXPIRED">Expired</option><option value="DISABLED">Disabled</option></select>
              <select aria-label="Filter by expiry" className="input" value={expiryFilter} onChange={(event) => setFilter(() => setExpiryFilter(event.target.value as ExpiryFilter))}><option value="ANY">Any expiry</option><option value="NONE">No expiry</option><option value="EXPIRED">Past expiry</option><option value="NEXT_7_DAYS">Next 7 days</option><option value="NEXT_30_DAYS">Next 30 days</option><option value="LATER">Later</option></select>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="card border-blue-200 bg-blue-50/50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-blue-950">{selectedIds.size} account{selectedIds.size === 1 ? "" : "s"} selected</p><button type="button" className="text-sm font-semibold text-blue-700 hover:text-blue-900" onClick={() => setSelectedIds(new Set())}>Clear selection</button></div>
              <div className="flex flex-wrap gap-2">
                <select aria-label="Batch role" className="input w-auto py-2" value={batchRole} onChange={(event) => setBatchRole(event.target.value as Role)}><option value="USER">User role</option><option value="ADMIN">Admin role</option></select>
                <button type="button" className="btn-secondary" onClick={() => batchAction.mutate({ type: "SET_ROLE", role: batchRole })}>Apply role</button>
                <select aria-label="Batch access tier" className="input w-auto py-2" value={batchTier} onChange={(event) => setBatchTier(event.target.value as AccessTier)}><option value="LIMITED">Limited</option><option value="FULL_DEMO">Full demo</option></select>
                <button type="button" className="btn-secondary" onClick={() => batchAction.mutate({ type: "SET_ACCESS_TIER", accessTier: batchTier })}>Apply tier</button>
                <button type="button" className="btn-secondary" onClick={() => batchAction.mutate({ type: "SET_STATUS", status: "ACTIVE" })}>Enable</button>
                <button type="button" className="btn-secondary" onClick={() => batchAction.mutate({ type: "SET_STATUS", status: "DISABLED" })}>Disable</button>
                <input aria-label="Batch expiry" className="input w-auto py-2" type="datetime-local" value={batchExpiry} onChange={(event) => setBatchExpiry(event.target.value)} />
                <button type="button" className="btn-secondary" disabled={!batchExpiry} onClick={() => batchAction.mutate({ type: "SET_EXPIRY", expiresAt: new Date(batchExpiry).toISOString() })}>Set expiry</button>
                <button type="button" className="btn-secondary" onClick={() => batchAction.mutate({ type: "SET_EXPIRY", expiresAt: null })}>Clear expiry</button>
                <button type="button" className="btn-danger" onClick={() => { if (window.confirm(`Delete ${selectedIds.size} selected accounts and all of their data?`)) batchAction.mutate({ type: "DELETE" }); }}><Trash2 className="h-4 w-4" /> Delete</button>
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3"><UsersRound className="h-5 w-5 text-blue-600" /><h2 className="font-bold text-slate-950">Workspace members</h2></div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{users.data?.pagination.total ?? 0}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3"><input aria-label="Select current page" type="checkbox" checked={pageSelected} onChange={togglePage} /></th><th className="px-3 py-3">Account</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Access</th><th className="px-3 py-3">State</th><th className="px-3 py-3">Expiry</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-200">
                  {users.isLoading && <tr><td colSpan={7} className="h-40 animate-pulse bg-white" /></tr>}
                  {users.data?.users.map((user) => <UserRow key={user.id} user={user} isSelf={user.id === session.data?.user.id} selected={selectedIds.has(user.id)} onSelected={(selected) => setSelectedIds((current) => { const next = new Set(current); if (selected) next.add(user.id); else next.delete(user.id); return next; })} onUpdate={(data) => updateUser.mutate({ id: user.id, data })} onReset={() => { const password = window.prompt("Enter a temporary password with at least 12 characters:"); if (password) resetPassword.mutate({ id: user.id, password }); }} onDelete={() => { if (window.confirm(`Delete ${user.username} and all of their data?`)) deleteUser.mutate(user.id); }} />)}
                  {users.data?.users.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-500">No accounts match these filters.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-500">Page {users.data?.pagination.page ?? page} of {users.data?.pagination.totalPages ?? 1}</p>
              <div className="flex gap-2"><button className="btn-secondary px-3 py-2" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4" /> Previous</button><button className="btn-secondary px-3 py-2" disabled={page >= (users.data?.pagination.totalPages ?? 1)} onClick={() => setPage((current) => current + 1)}>Next <ChevronRight className="h-4 w-4" /></button></div>
            </div>
          </div>
        </section>
        <UserRegistrationPanel onChanged={refresh} />
      </div>
    </div>
  );
}

function UserRow({ user, isSelf, selected, onSelected, onUpdate, onReset, onDelete }: {
  user: User;
  isSelf: boolean;
  selected: boolean;
  onSelected: (selected: boolean) => void;
  onUpdate: (data: { role?: Role; status?: UserStatus; accessTier?: AccessTier; expiresAt?: string | null }) => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className={selected ? "bg-blue-50/40" : "bg-white"}>
      <td className="px-4 py-4 align-top"><input aria-label={`Select ${user.username}`} type="checkbox" checked={selected} onChange={(event) => onSelected(event.target.checked)} /></td>
      <td className="px-3 py-4 align-top"><div className="flex items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{user.username.slice(0, 2).toUpperCase()}</div><div><div className="flex items-center gap-2"><span className="font-semibold text-slate-950">{user.username}</span>{isSelf && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">You</span>}</div><p className="mt-1 text-xs text-slate-400">Created {formatDate(user.createdAt)}</p>{user.mustChangePassword && <span className="mt-1 inline-block text-[10px] font-bold uppercase text-amber-700">Password change required</span>}</div></div></td>
      <td className="px-3 py-4 align-top"><select aria-label={`Role for ${user.username}`} className="input py-2" value={user.role} onChange={(event) => onUpdate({ role: event.target.value as Role })}><option value="USER">User</option><option value="ADMIN">Admin</option></select></td>
      <td className="px-3 py-4 align-top"><select aria-label={`Access tier for ${user.username}`} className="input py-2" value={user.accessTier} onChange={(event) => onUpdate({ accessTier: event.target.value as AccessTier })}><option value="LIMITED">Limited</option><option value="FULL_DEMO">Full demo</option></select></td>
      <td className="px-3 py-4 align-top"><span className={"mb-2 inline-block rounded-full px-2 py-1 text-[10px] font-bold uppercase " + statusTone(user.effectiveStatus)}>{user.effectiveStatus}</span><select aria-label={`Status for ${user.username}`} className="input py-2" value={user.status} disabled={isSelf} onChange={(event) => onUpdate({ status: event.target.value as UserStatus })}><option value="ACTIVE">Enabled</option><option value="DISABLED">Disabled</option></select></td>
      <td className="px-3 py-4 align-top"><input key={user.updatedAt} aria-label={`Expiry for ${user.username}`} className="input min-w-48 py-2" type="datetime-local" defaultValue={toLocalDateTimeValue(user.expiresAt)} onBlur={(event) => { const next = event.target.value ? new Date(event.target.value).toISOString() : null; if (next !== user.expiresAt) onUpdate({ expiresAt: next }); }} /><p className="mt-1 text-[10px] text-slate-400">{user.expiresAt ? formatDate(user.expiresAt) : "No expiry"}</p></td>
      <td className="px-4 py-4 align-top"><div className="flex justify-end gap-2"><button className="btn-secondary px-3 py-2" title="Reset password" aria-label={`Reset password for ${user.username}`} onClick={onReset}><KeyRound className="h-4 w-4" /></button><button className="btn-danger px-3 py-2" disabled={isSelf} title="Delete account" aria-label={`Delete ${user.username}`} onClick={onDelete}><Trash2 className="h-4 w-4" /></button></div></td>
    </tr>
  );
}
