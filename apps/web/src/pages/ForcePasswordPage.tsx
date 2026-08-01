import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { InlineAlert } from "../components/InlineAlert";
import { api, messageFrom } from "../lib/api";
import type { SessionPayload } from "../types";

export function ForcePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mismatch = confirmation.length > 0 && newPassword !== confirmation;
  const change = useMutation({
    mutationFn: () => api<SessionPayload>("/api/account/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
    onSuccess: (session) => {
      queryClient.setQueryData(["session"], session);
      navigate("/scan", { replace: true });
    },
  });

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-5 py-10">
      <div className="card w-full max-w-lg p-6 sm:p-9">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-slate-950">Secure your account</p>
            <p className="text-xs text-slate-500">Required before accessing Sentinel</p>
          </div>
        </div>
        <div className="mt-8">
          <KeyRound className="h-7 w-7 text-blue-600" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
            Replace your temporary password
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Choose a unique password with at least 12 characters. Your other sessions will be
            closed automatically.
          </p>
        </div>
        <form
          className="mt-7 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!mismatch) change.mutate();
          }}
        >
          <div>
            <label className="label" htmlFor="current-password">Temporary password</label>
            <input
              id="current-password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="new-password">New password</label>
            <input
              id="new-password"
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
            />
            {mismatch && <p className="mt-2 text-xs font-medium text-red-600">Passwords do not match.</p>}
          </div>
          {change.error && <InlineAlert>{messageFrom(change.error)}</InlineAlert>}
          <button className="btn-primary mt-2 w-full" disabled={change.isPending || mismatch}>
            {change.isPending ? "Updating password…" : "Continue to scanner"}
          </button>
        </form>
      </div>
    </div>
  );
}
