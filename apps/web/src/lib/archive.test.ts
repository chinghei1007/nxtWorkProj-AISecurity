import "fake-indexeddb/auto";
import type { ScanExport } from "@secure-scan/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_IMPORT_BYTES,
  clearArchiveForTests,
  listLocalReports,
  listRemoteReferences,
  parseReportFile,
  saveLocalReport,
  saveRemoteReference,
} from "./archive";

const report: ScanExport = {
  schemaVersion: "1.0",
  exportedAt: "2026-08-02T00:00:00.000Z",
  scan: {
    id: "scan-1",
    title: "Imported report",
    createdAt: "2026-08-02T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
    language: "typescript",
    sourceHash: "a".repeat(64),
    codePreview: "const token = input;",
    provider: "groq",
    model: "test-model",
    summary: "One issue.",
  },
  fixQueue: [{
    rank: 1,
    severity: "high",
    storyPoints: 3,
    title: "Unsafe input",
    location: { lineStart: 1, lineEnd: 1 },
    evidence: null,
    suggestedCode: null,
    explanation: "Input is trusted.",
    remediationSummary: "Validate the value.",
    instructionsMarkdown: "## Fix\n\nValidate the value.",
  }],
};

function jsonFile(contents: string, name = "report.json") {
  const file = new File([contents], name, { type: "application/json" });
  Object.defineProperty(file, "text", { value: async () => contents });
  return file;
}

beforeEach(async () => clearArchiveForTests());

describe("browser-local report archive", () => {
  it("deduplicates exact schema 1.0 reports by canonical SHA-256 fingerprint", async () => {
    const first = await saveLocalReport(report);
    const second = await saveLocalReport(structuredClone(report));
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.record.localId).toBe(first.record.localId);
    expect(await listLocalReports()).toHaveLength(1);
  });

  it("parses compatible files entirely in the browser and rejects invalid or oversized files", async () => {
    await expect(parseReportFile(jsonFile(JSON.stringify(report))))
      .resolves.toEqual(report);
    await expect(parseReportFile(jsonFile("not json", "bad.json"))).rejects.toThrow("not valid JSON");
    await expect(parseReportFile(jsonFile(JSON.stringify({ ...report, schemaVersion: "2.0" }), "future.json")))
      .rejects.toThrow("schema 1.0");
    await expect(parseReportFile(new File([new Uint8Array(MAX_IMPORT_BYTES + 1)], "huge.json")))
      .rejects.toThrow("5 MB or smaller");
  });

  it("keeps access and management capabilities out of localStorage", async () => {
    await saveRemoteReference({
      id: "scan-1",
      title: "Remote report",
      createdAt: "2026-08-02T00:00:00.000Z",
      expiresAt: "2026-08-03T00:00:00.000Z",
      provider: "groq",
      model: "test-model",
      accessCode: "AbCd2345EfGh",
      managementToken: "management-secret",
      shareUrl: "https://scanner.example/open#AbCd2345EfGh",
    });

    expect(await listRemoteReferences()).toMatchObject([{ accessCode: "AbCd2345EfGh" }]);
    const stored = Object.values(localStorage).join(" ");
    expect(stored).not.toContain("AbCd2345EfGh");
    expect(stored).not.toContain("management-secret");
  });
});
