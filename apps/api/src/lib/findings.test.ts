import { describe, expect, it } from "vitest";
import { enrichFindingsWithEvidence, evidenceLimits, normalizeFindings } from "./findings.js";

const providerFinding = {
  severity: "high" as const,
  title: "Unsafe evaluation",
  lineStart: 4,
  lineEnd: 5,
  explanation: "User input reaches an evaluator.",
  remediation: "Replace dynamic evaluation with explicit parsing.",
  storyPoints: 3 as const,
  instructionsMarkdown: "1. Remove `eval`.\n2. Parse an allowed shape.",
};

describe("finding evidence", () => {
  it("extracts context from source and records affected line offsets", () => {
    const source = ["one", "two", "three", "four", "five", "six", "seven"].join("\n");
    const [finding] = enrichFindingsWithEvidence([providerFinding], source);
    expect(finding?.evidence).toEqual({
      code: ["two", "three", "four", "five", "six", "seven"].join("\n"),
      startLine: 2,
      endLine: 7,
      highlightStartLine: 4,
      highlightEndLine: 5,
    });
  });

  it("does not retain evidence for an invalid model line", () => {
    const [finding] = enrichFindingsWithEvidence([{ ...providerFinding, lineStart: 99 }], "const safe = true;");
    expect(finding?.evidence).toBeUndefined();
  });

  it("bounds individual and aggregate retained snippets", () => {
    const source = Array.from({ length: 500 }, (_, index) => `${index} ${"x".repeat(500)}`).join("\n");
    const findings = Array.from({ length: 100 }, (_, index) => ({
      ...providerFinding,
      lineStart: index * 4 + 1,
      lineEnd: index * 4 + 1,
    }));
    const enriched = enrichFindingsWithEvidence(findings, source);
    const retained = enriched.flatMap((finding) => finding.evidence ? [finding.evidence.code] : []);
    expect(Math.max(...retained.map((snippet) => snippet.length))).toBeLessThanOrEqual(evidenceLimits.maxSnippetCharacters);
    expect(retained.reduce((total, snippet) => total + snippet.length, 0)).toBeLessThanOrEqual(evidenceLimits.maxTotalSnippetCharacters);
  });
});

describe("legacy finding normalization", () => {
  it("derives enhanced fields and produces a canonical fix queue", () => {
    const normalized = normalizeFindings([
      { severity: "low", title: "Low", lineStart: 2, explanation: "Low issue", remediation: "Short fix" },
      { severity: "critical", title: "Later critical", lineStart: 20, explanation: "Critical issue", remediation: "Short fix" },
      { severity: "critical", title: "Earlier critical", lineStart: 4, explanation: "Critical issue", remediation: "Short fix" },
    ]);
    expect(normalized.map((finding) => finding.title)).toEqual(["Earlier critical", "Later critical", "Low"]);
    expect(normalized.map((finding) => finding.priority)).toEqual([1, 2, 3]);
    expect(normalized[0]?.storyPoints).toBe(1);
    expect(normalized[0]?.instructionsMarkdown).toBe("Short fix");
    expect(normalized[0]?.evidence).toBeUndefined();
  });

  it("orders equal severities by effort, line, and original position", () => {
    const base = { severity: "high", explanation: "Issue", remediation: "Fix", instructionsMarkdown: "Fix" } as const;
    const normalized = normalizeFindings([
      { ...base, title: "Five points", storyPoints: 5, lineStart: 1 },
      { ...base, title: "Two points later", storyPoints: 2, lineStart: 9 },
      { ...base, title: "Two points earlier", storyPoints: 2, lineStart: 3 },
    ]);
    expect(normalized.map((finding) => finding.title)).toEqual(["Two points earlier", "Two points later", "Five points"]);
  });
});
