import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, FileSearch } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { HistoryScanRow } from "../components/HistoryScanRow";
import { InlineAlert } from "../components/InlineAlert";
import { PageHeader } from "../components/PageHeader";
import { api, messageFrom } from "../lib/api";
import type { ScansPayload } from "../types";

export function HistoryPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
            <HistoryScanRow
              key={scan.id}
              scan={scan}
              expanded={expandedId === scan.id}
              onToggle={() => setExpandedId((current) => current === scan.id ? null : scan.id)}
              onDelete={() => {
                if (window.confirm("Delete this scan permanently?")) remove.mutate(scan.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
