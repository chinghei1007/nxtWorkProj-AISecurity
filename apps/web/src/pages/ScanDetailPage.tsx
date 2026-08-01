import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { InlineAlert } from "../components/InlineAlert";
import { ScanResults } from "../components/ScanResults";
import { api, messageFrom } from "../lib/api";
import { formatDate } from "../lib/format";
import type { ScanPayload } from "../types";

export function ScanDetailPage() {
  const { id = "" } = useParams();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const scan = useQuery({
    queryKey: ["scan", id],
    queryFn: () => api<ScanPayload>("/api/scans/" + id),
  });
  useEffect(() => {
    if (scan.data) setTitle(scan.data.scan.title);
  }, [scan.data]);
  const rename = useMutation({
    mutationFn: () => api<ScanPayload>("/api/scans/" + id, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["scan", id], updated);
      queryClient.invalidateQueries({ queryKey: ["scans"] });
      setEditing(false);
    },
  });
  const remove = useMutation({
    mutationFn: () => api<void>("/api/scans/" + id, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scans"] });
      navigate("/history");
    },
  });

  if (scan.isLoading) return <div className="card h-72 animate-pulse bg-white" />;
  if (scan.error || !scan.data) {
    return <InlineAlert>{messageFrom(scan.error)}</InlineAlert>;
  }

  return (
    <div>
      <Link to="/history" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to history
      </Link>
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              className="flex max-w-xl items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                rename.mutate();
              }}
            >
              <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} autoFocus />
              <button className="btn-primary" disabled={rename.isPending}><Save className="h-4 w-4" /> Save</button>
            </form>
          ) : (
            <>
              <p className="text-sm text-slate-500">{formatDate(scan.data.scan.createdAt)}</p>
              <button
                onClick={() => setEditing(true)}
                className="mt-1 flex max-w-full items-center gap-2 rounded-lg text-left text-xl font-bold text-slate-950 hover:text-blue-700"
              >
                <span className="truncate">{scan.data.scan.title}</span>
                <Pencil className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            </>
          )}
        </div>
        <button
          className="btn-danger"
          onClick={() => {
            if (window.confirm("Delete this scan permanently?")) remove.mutate();
          }}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>
      {(rename.error || remove.error) && (
        <div className="mb-4"><InlineAlert>{messageFrom(rename.error ?? remove.error)}</InlineAlert></div>
      )}
      <ScanResults scan={scan.data.scan} />
      <div className="mt-4 card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Stored source preview</p>
        <code className="mt-2 block break-words text-sm leading-6 text-slate-600">{scan.data.scan.codePreview}</code>
      </div>
    </div>
  );
}
