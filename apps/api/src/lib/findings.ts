import {
  storedFindingSchema,
  type Finding,
  type ProviderFinding,
  type StoredFinding,
  type StoryPoints,
} from "@secure-scan/contracts";

const CONTEXT_LINES = 2;
const MAX_SNIPPET_LINES = 25;
const MAX_SNIPPET_CHARS = 2_400;
const MAX_TOTAL_SNIPPET_CHARS = 30_000;

export const severityRank = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
} as const;

function deriveStoryPoints(remediation: string): StoryPoints {
  const length = remediation.trim().length;
  if (length <= 160) return 1;
  if (length <= 400) return 2;
  if (length <= 900) return 3;
  if (length <= 1_800) return 5;
  return 8;
}

function compareCanonical(a: Finding, b: Finding) {
  return severityRank[b.severity] - severityRank[a.severity]
    || a.storyPoints - b.storyPoints
    || (a.lineStart ?? Number.MAX_SAFE_INTEGER) - (b.lineStart ?? Number.MAX_SAFE_INTEGER)
    || a.originalIndex - b.originalIndex;
}

export function normalizeFindings(value: unknown): Finding[] {
  if (!Array.isArray(value)) return [];

  const normalized = value.flatMap((candidate, originalIndex) => {
    const parsed = storedFindingSchema.safeParse(candidate);
    if (!parsed.success) return [];

    const finding = parsed.data;
    const lineEnd = finding.lineStart && finding.lineEnd
      ? Math.max(finding.lineStart, finding.lineEnd)
      : finding.lineEnd;

    return [{
      ...finding,
      lineEnd,
      storyPoints: finding.storyPoints ?? deriveStoryPoints(finding.remediation),
      instructionsMarkdown: finding.instructionsMarkdown ?? finding.remediation,
      priority: 1,
      originalIndex,
    } satisfies Finding];
  });

  normalized.sort(compareCanonical);
  return normalized.map((finding, index) => ({ ...finding, priority: index + 1 }));
}

export function enrichFindingsWithEvidence(
  findings: ProviderFinding[],
  source: string,
): StoredFinding[] {
  const sourceLines = source.split(/\r?\n/);
  let retainedCharacters = 0;

  return findings.map((finding) => {
    if (!finding.lineStart || finding.lineStart > sourceLines.length) return finding;

    const affectedEnd = Math.min(
      Math.max(finding.lineStart, finding.lineEnd ?? finding.lineStart),
      sourceLines.length,
    );
    let startLine = Math.max(1, finding.lineStart - CONTEXT_LINES);
    let endLine = Math.min(sourceLines.length, affectedEnd + CONTEXT_LINES);
    endLine = Math.min(endLine, startLine + MAX_SNIPPET_LINES - 1);

    let snippetLines = sourceLines.slice(startLine - 1, endLine);
    while (snippetLines.length > 1 && snippetLines.join("\n").length > MAX_SNIPPET_CHARS) {
      snippetLines = snippetLines.slice(0, -1);
      endLine -= 1;
    }

    const code = snippetLines.join("\n").slice(0, MAX_SNIPPET_CHARS);
    if (!code || retainedCharacters + code.length > MAX_TOTAL_SNIPPET_CHARS) return finding;

    retainedCharacters += code.length;
    return {
      ...finding,
      evidence: {
        code,
        startLine,
        endLine,
        highlightStartLine: finding.lineStart,
        highlightEndLine: Math.min(affectedEnd, endLine),
      },
    };
  });
}

export const evidenceLimits = {
  contextLines: CONTEXT_LINES,
  maxSnippetLines: MAX_SNIPPET_LINES,
  maxSnippetCharacters: MAX_SNIPPET_CHARS,
  maxTotalSnippetCharacters: MAX_TOTAL_SNIPPET_CHARS,
} as const;
