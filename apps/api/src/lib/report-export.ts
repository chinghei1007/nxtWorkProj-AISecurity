import { scanExportSchema, type ScanExport } from "@secure-scan/contracts";
import { normalizeFindings } from "./findings";
import type { StoredScanRow } from "../types";

export function buildScanExport(scan: StoredScanRow, exportedAt = new Date()): ScanExport {
  const fixQueue = normalizeFindings(JSON.parse(scan.findings_json) as unknown).map((finding) => ({
    rank: finding.priority,
    severity: finding.severity,
    storyPoints: finding.storyPoints,
    title: finding.title,
    location: finding.lineStart
      ? { lineStart: finding.lineStart, lineEnd: finding.lineEnd ?? finding.lineStart }
      : null,
    evidence: finding.evidence ?? null,
    suggestedCode: finding.suggestedCode ?? null,
    explanation: finding.explanation,
    remediationSummary: finding.remediation,
    instructionsMarkdown: finding.instructionsMarkdown,
  }));

  return scanExportSchema.parse({
    schemaVersion: "1.0",
    exportedAt: exportedAt.toISOString(),
    scan: {
      id: scan.id,
      title: scan.title,
      createdAt: scan.created_at,
      updatedAt: scan.updated_at,
      language: scan.language,
      sourceHash: scan.code_hash,
      codePreview: scan.code_preview,
      provider: scan.provider,
      model: scan.model,
      summary: scan.summary,
    },
    fixQueue,
  });
}

export function reportFilename(title: string, id: string) {
  const safeTitle = title
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "security-scan";
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
  return `${safeTitle}-${safeId || "report"}.json`;
}
