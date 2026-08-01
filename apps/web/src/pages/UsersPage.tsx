import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Trash2, UserCog, UsersRound } from "lucide-react";
import { useState } from "react";
import { InlineAlert } from "../components/InlineAlert";
import { PageHeader } from "../components/PageHeader";
import { useSession } from "../hooks/use-session";
import { api, messageFrom } from "../lib/api";
import { formatDate } from "../lib/format";
import type { Role, UserStatus } from "@secure-scan/contracts";
import type { UserPayload, UsersPayload } from "../types";

export function UsersPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [role, setRole] = useState<Role>("USER");
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api<UsersPayload>("/api/admin/users"),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["session"] });
  };
  const createUser = useMutation({
    mutationFn: () => api<UserPayload>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ username, temporaryPassword, role }),
    }),
    onSuccess: () => {
      setUsername("");
      setTemporaryPassword("");
      setRole("USER");
      refresh();
    },
  });
  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: Role; status?: UserStatus } }) =>
      api<UserPayload>("/api/admin/users/" + id, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: refresh,
  });
  const resetPassword = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api<UserPayload>("/api/admin/users/" + id + "/reset-password", {
        method: "POST",
        body: JSON.stringify({ temporaryPassword: password }),
      }),
    onSuccess: refresh,
  });
  const deleteUser = useMutation({
    mutationFn: (id: string) => api<void>("/api/admin/users/" + id, { method: "DELETE" }),
    onSuccess: refresh,
  });
  const mutationError = createUser.error ?? updateUser.error ?? resetPassword.error ?? deleteUser.error;

  return (
    <div>
      <PageHeader
        eyebrow="Administrator"
        title="User access"
        description="Create private workspace accounts, assign roles, disable access, and issue temporary password resets."
      />

      {mutationError && <div className="mb-5"><InlineAlert>{messageFrom(mutationError)}</InlineAlert></div>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <UsersRound className="h-5 w-5 text-blue-600" />
              <h2 className="font-bold text-slate-950">Workspace members</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {users.data?.users.length ?? 0}
            </span>
          </div>
          <div className="divide-y divide-slate-200">
            {users.isLoading && <div className="h-40 animate-pulse bg-white" />}
            {users.data?.users.map((user) => {
              const isSelf = user.id === session.data?.user.id;
              return (
                <article key={user.id} className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                        {user.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-semibold text-slate-950">{user.username}</h3>
                          {isSelf && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">You</span>}
                          {user.mustChangePassword && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">Reset required</span>}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">Created {formatDate(user.createdAt)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                      <select
                        aria-label={"Role for " + user.username}
                        className="input py-2"
                        value={user.role}
                        onChange={(event) => updateUser.mutate({ id: user.id, data: { role: event.target.value as Role } })}
                      >
                        <option value="USER">User</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      <select
                        aria-label={"Status for " + user.username}
                        className="input py-2"
                        value={user.status}
                        disabled={isSelf}
                        onChange={(event) => updateUser.mutate({ id: user.id, data: { status: event.target.value as UserStatus } })}
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="DISABLED">Disabled</option>
                      </select>
                      <button
                        className="btn-secondary px-3"
                        onClick={() => {
                          const password = window.prompt("Enter a temporary password with at least 12 characters:");
                          if (password) resetPassword.mutate({ id: user.id, password });
                        }}
                        title="Reset password"
                      >
                        <KeyRound className="h-4 w-4" />
                        <span className="sm:hidden">Reset</span>
                      </button>
                      <button
                        className="btn-danger px-3"
                        disabled={isSelf}
                        onClick={() => {
                          if (window.confirm("Delete " + user.username + " and all of their data?")) {
                            deleteUser.mutate(user.id);
                          }
                        }}
                        title="Delete user"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sm:hidden">Delete</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="card h-fit p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-950">Create user</h2>
              <p className="text-xs text-slate-500">No invitation email is sent</p>
            </div>
          </div>
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              createUser.mutate();
            }}
          >
            <div>
              <label className="label" htmlFor="new-user-username">Username</label>
              <input id="new-user-username" className="input" minLength={3} maxLength={64} pattern="[a-zA-Z0-9._-]+" value={username} onChange={(event) => setUsername(event.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="new-user-password">Temporary password</label>
              <input id="new-user-password" className="input" type="password" minLength={12} value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} required />
              <p className="mt-2 text-xs leading-5 text-slate-500">The user must replace it on first sign-in.</p>
            </div>
            <div>
              <label className="label" htmlFor="new-user-role">Role</label>
              <select id="new-user-role" className="input" value={role} onChange={(event) => setRole(event.target.value as Role)}>
                <option value="USER">User</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </div>
            <button className="btn-primary w-full" disabled={createUser.isPending}>
              <Plus className="h-4 w-4" />
              {createUser.isPending ? "Creating user…" : "Create user"}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
