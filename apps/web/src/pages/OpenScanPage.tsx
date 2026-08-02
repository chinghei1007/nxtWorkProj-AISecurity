import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InlineAlert } from "../components/InlineAlert";
import { remoteReference, saveRemoteReference } from "../lib/archive";
import { api, messageFrom } from "../lib/api";
import type { ScanPayload } from "../types";

export function OpenScanPage() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const accessCode = useRef(window.location.hash.slice(1));
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    window.history.replaceState(null, "", "/open");
    if (!accessCode.current) {
      setError("The share link does not contain an access code.");
      return;
    }
    void api<ScanPayload>("/api/scans/resolve", {
      method: "POST",
      body: JSON.stringify({ accessCode: accessCode.current }),
    }).then(async (payload) => {
      await saveRemoteReference(remoteReference(payload.scan, { code: accessCode.current }));
      navigate(`/history/${payload.scan.id}`, { replace: true });
    }).catch((caught) => setError(messageFrom(caught)));
  }, [navigate]);
  return <div className="mx-auto max-w-xl"><div className="card p-8 text-center"><h1 className="text-xl font-bold text-slate-950">Opening shared report…</h1><p className="mt-2 text-sm text-slate-500">The capability is being checked without placing it in a server URL.</p>{error && <div className="mt-5 text-left"><InlineAlert>{error}</InlineAlert></div>}</div></div>;
}
