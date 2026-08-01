import type { Scan } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildScanExport, reportFilename } from "./report-export.js";

const scan: Scan = {
  id: "scan_123",
  userId: "secret-user-id",
  title: "Auth / review",
  language: "TypeScript",
  codeHash: "abc123",
  codePreview: "const token = getToken()",
  provider: "groq",
  profileId: "internal-profile-id",
  model: "scanner-model",
  summary: "One issue.",
  findings: [{
    severity: "high",
    title: "Weak token",
    lineStart: 1,
    explanation: "The token is weak.",
    remediation: "Generate a stronger token.",
    storyPoints: 2,
    instructionsMarkdown: "## Fix\nGenerate a cryptographic token.",
    evidence: { code: "const token = getToken()", startLine: 1, endLine: 1, highlightStartLine: 1, highlightEndLine: 1 },
  }],
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-02T00:00:00.000Z"),
};

describe("scan report export", () => {
  it("returns a stable, versioned safe document", () => {
    const report = buildScanExport(scan, new Date("2025-01-03T00:00:00.000Z"));
    expect(report.schemaVersion).toBe("1.0");
    expect(report.exportedAt).toBe("2025-01-03T00:00:00.000Z");
    expect(report.scan.sourceHash).toBe("abc123");
    expect(report.fixQueue[0]).toMatchObject({ rank: 1, storyPoints: 2, remediationSummary: "Generate a stronger token." });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("secret-user-id");
    expect(serialized).not.toContain("internal-profile-id");
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("credential");
  });

  it("sanitizes attachment filenames", () => {
    expect(reportFilename("Auth / review\r\nunsafe", "scan_123")).toBe("Auth-review-unsafe-scan_123.json");
  });
});
