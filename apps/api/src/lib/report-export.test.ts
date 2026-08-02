import { describe, expect, it } from "vitest";
import type { StoredScanRow } from "../types";
import { buildScanExport, reportFilename } from "./report-export";

const scan: StoredScanRow = {
  id: "scan_123",
  access_code_hash: "secret-access-hash",
  management_token_hash: "secret-management-hash",
  title: "Auth / review",
  language: "TypeScript",
  code_hash: "abc123",
  code_preview: "const token = getToken()",
  provider: "groq",
  profile_id: "internal-profile-id",
  model: "scanner-model",
  summary: "One issue.",
  findings_json: JSON.stringify([{
    severity: "high",
    title: "Weak token",
    lineStart: 1,
    explanation: "The token is weak.",
    remediation: "Generate a stronger token.",
    storyPoints: 2,
    instructionsMarkdown: "## Fix\nGenerate a cryptographic token.",
    evidence: { code: "const token = getToken()", startLine: 1, endLine: 1, highlightStartLine: 1, highlightEndLine: 1 },
  }]),
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-02T00:00:00.000Z",
  expires_at: "2025-01-02T00:00:00.000Z",
};

describe("scan report export", () => {
  it("returns a stable, versioned safe document", () => {
    const report = buildScanExport(scan, new Date("2025-01-03T00:00:00.000Z"));
    expect(report.schemaVersion).toBe("1.0");
    expect(report.scan.sourceHash).toBe("abc123");
    expect(report.fixQueue[0]).toMatchObject({ rank: 1, storyPoints: 2 });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("secret-access-hash");
    expect(serialized).not.toContain("secret-management-hash");
    expect(serialized).not.toContain("internal-profile-id");
  });

  it("sanitizes attachment filenames", () => {
    expect(reportFilename("Auth / review\r\nunsafe", "scan_123")).toBe("Auth-review-unsafe-scan_123.json");
  });
});
