import type { Finding } from "@secure-scan/contracts";

export function CodeEvidence({ finding }: { finding: Finding }) {
  const lines = finding.evidence?.code.split("\n") ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Affected source</p>
        {finding.evidence ? (
          <div className="overflow-x-auto rounded-xl border border-red-200 bg-slate-950 text-xs leading-5 text-slate-100">
            <table className="w-full border-collapse font-mono">
              <tbody>
                {lines.map((line, index) => {
                  const lineNumber = finding.evidence!.startLine + index;
                  const affected = lineNumber >= finding.evidence!.highlightStartLine
                    && lineNumber <= finding.evidence!.highlightEndLine;
                  return (
                    <tr key={lineNumber} className={affected ? "bg-red-950/70" : "bg-transparent"}>
                      <th className={"select-none border-r px-3 py-0.5 text-right font-normal " + (affected ? "border-red-800 text-red-300" : "border-slate-800 text-slate-500")}>
                        {lineNumber}
                      </th>
                      <td className="whitespace-pre px-3 py-0.5">{line || " "}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            Source snippet unavailable
          </div>
        )}
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Suggested replacement</p>
        {finding.suggestedCode ? (
          <pre className="overflow-x-auto rounded-xl border border-emerald-300 bg-emerald-950 p-4 text-xs leading-5 text-emerald-50"><code>{finding.suggestedCode}</code></pre>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            No replacement code was supplied. Follow the remediation instructions.
          </div>
        )}
      </div>
    </div>
  );
}
