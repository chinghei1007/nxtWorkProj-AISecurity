import type { Scan } from "@prisma/client";
import { scanExportSchema, type ScanExport } from "@secure-scan/contracts";
import { normalizeFindings } from "./findings.js";

export function buildScanExport(scan: Scan, exportedAt = new Date()): ScanExport {
  const fixQueue = normalizeFindings(scan.findings).map((finding) => ({
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
      createdAt: scan.createdAt.toISOString(),
      updatedAt: scan.updatedAt.toISOString(),
      language: scan.language,
      sourceHash: scan.codeHash,
      codePreview: scan.codePreview,
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
