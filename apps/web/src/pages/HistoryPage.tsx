import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Clock3, FileSearch, ShieldAlert, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { InlineAlert } from "../components/InlineAlert";
import { PageHeader } from "../components/PageHeader";
import { api, messageFrom } from "../lib/api";
import { formatDate, severityTone } from "../lib/format";
import type { ScansPayload } from "../types";

export function HistoryPage() {
  const queryClient = useQueryClient();
  const scans = useQuery({
    queryKey: ["scans"],
    queryFn: () => api<ScansPayload>("/api/scans"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api<void>("/api/scans/" + id, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scans"] }),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Private archive"
        title="Scan history"
        description="Review structured findings and metadata from your previous audits. Full submitted source is not retained."
        action={
          <Link to="/scan" className="btn-primary">
            New scan <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />
      {scans.error && <InlineAlert>{messageFrom(scans.error)}</InlineAlert>}
      {remove.error && <div className="mb-4"><InlineAlert>{messageFrom(remove.error)}</InlineAlert></div>}

      {scans.isLoading ? (
        <div className="card h-48 animate-pulse bg-white" />
      ) : scans.data?.scans.length === 0 ? (
        <div className="card flex flex-col items-center px-5 py-16 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600">
            <FileSearch className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-bold text-slate-950">No scans yet</h2>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            Run your first source audit to build a private record of security findings.
          </p>
          <Link to="/scan" className="btn-primary mt-5">Start a scan</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {scans.data?.scans.map((scan) => (
            <article key={scan.id} className="card p-4 transition hover:border-slate-300 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <Link to={"/history/" + scan.id} className="min-w-0 flex-1 rounded-md">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-semibold text-slate-950">{scan.title}</h2>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {scan.language}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-1 text-sm text-slate-500">{scan.summary}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatDate(scan.createdAt)}
                    </span>
                    <span>{scan.model}</span>
                  </div>
                </Link>
                <div className="flex items-center gap-2 sm:justify-end">
                  {scan.findings.slice(0, 3).map((finding, index) => (
                    <span
                      key={index}
                      title={finding.severity}
                      className={"h-2.5 w-2.5 rounded-full border " + severityTone(finding.severity)}
                    />
                  ))}
                  <span className="mr-2 text-xs font-medium text-slate-500">
                    {scan.findings.length} finding{scan.findings.length === 1 ? "" : "s"}
                  </span>
                  <button
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    aria-label={"Delete " + scan.title}
                    onClick={() => {
                      if (window.confirm("Delete this scan permanently?")) remove.mutate(scan.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
