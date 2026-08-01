import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { InlineAlert } from "../components/InlineAlert";
import { api, messageFrom } from "../lib/api";
import type { SessionPayload } from "../types";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const login = useMutation({
    mutationFn: () => api<SessionPayload>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
    onSuccess: (session) => {
      queryClient.setQueryData(["session"], session);
      navigate(session.user.mustChangePassword ? "/change-password" : "/scan", { replace: true });
    },
  });

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 top-24 h-72 w-72 rounded-full border border-blue-400/20" />
        <div className="absolute -right-8 top-40 h-40 w-40 rounded-full border border-blue-400/20" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-500">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <span className="text-lg font-bold tracking-tight">Sentinel</span>
        </div>

        <div className="relative max-w-xl pb-12">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.22em] text-blue-300">
            Private security workspace
          </p>
          <h1 className="text-5xl font-bold leading-[1.08] tracking-tight">
            Inspect code with the model you trust.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">
            Run structured AI security audits, keep source out of persistent storage, and switch
            providers without exposing shared credentials.
          </p>
        </div>

        <p className="relative text-xs text-slate-500">
          Source is analyzed in memory and is never executed.
        </p>
      </section>

      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="font-bold text-slate-950">Sentinel</span>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
            Welcome back
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Sign in to your workspace
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Accounts are created by your administrator. Public registration is disabled.
          </p>

          <form
            className="mt-8 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              login.mutate();
            }}
          >
            <div>
              <label className="label" htmlFor="username">Username</label>
              <input
                id="username"
                className="input"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-semibold text-slate-700" htmlFor="password">
                  Password
                </label>
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <LockKeyhole className="h-3 w-3" />
                  Encrypted
                </span>
              </div>
              <input
                id="password"
                type="password"
                className="input"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {login.error && <InlineAlert>{messageFrom(login.error)}</InlineAlert>}
            <button className="btn-primary w-full" disabled={login.isPending}>
              {login.isPending ? "Signing in…" : "Sign in"}
              {!login.isPending && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
