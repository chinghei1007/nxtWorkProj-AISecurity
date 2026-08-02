import { z } from "zod";

export const severitySchema = z.enum(["critical", "high", "medium", "low", "info"]);
export const storyPointsSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(5),
  z.literal(8),
]);

const baseFindingSchema = z.object({
  severity: severitySchema,
  title: z.string().min(1).max(160),
  lineStart: z.number().int().positive().optional(),
  lineEnd: z.number().int().positive().optional(),
  explanation: z.string().min(1).max(4_000),
  remediation: z.string().min(1).max(4_000),
});

export const evidenceSnippetSchema = z.object({
  code: z.string().max(2_400),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  highlightStartLine: z.number().int().positive(),
  highlightEndLine: z.number().int().positive(),
});

export const providerFindingSchema = baseFindingSchema.extend({
  storyPoints: storyPointsSchema,
  instructionsMarkdown: z.string().min(1).max(12_000),
  suggestedCode: z.string().max(12_000).optional(),
});

export const storedFindingSchema = baseFindingSchema.extend({
  storyPoints: storyPointsSchema.optional(),
  instructionsMarkdown: z.string().min(1).max(12_000).optional(),
  suggestedCode: z.string().max(12_000).optional(),
  evidence: evidenceSnippetSchema.optional(),
});

export const findingSchema = baseFindingSchema.extend({
  storyPoints: storyPointsSchema,
  instructionsMarkdown: z.string().min(1).max(12_000),
  suggestedCode: z.string().max(12_000).optional(),
  evidence: evidenceSnippetSchema.optional(),
  priority: z.number().int().positive(),
  originalIndex: z.number().int().nonnegative(),
});

export const scanResultSchema = z.object({
  summary: z.string().min(1).max(4_000),
  findings: z.array(providerFindingSchema).max(100),
});

export const modelProviderSchema = z.enum(["groq", "openai-compatible", "gemini"]);

export const safeModelSchema = z.object({
  id: z.string(),
  label: z.string(),
  provider: z.enum(["groq", "openai-compatible"]),
  source: z.literal("SERVER"),
  model: z.string(),
  available: z.boolean(),
});

export const scanSelectionSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("SERVER"), profileId: z.string().min(1).max(80) }),
  z.object({
    source: z.literal("USER"),
    provider: z.literal("gemini"),
    model: z.string().min(1).max(160),
    apiKey: z.string().trim().min(10).max(512),
  }),
]);

export const createScanInputSchema = z.object({
  title: z.string().trim().max(120).optional(),
  source: z.string().min(1).max(50_000),
  turnstileToken: z.string().min(1).max(2_048),
  selection: scanSelectionSchema,
});

export const accessCodeSchema = z.string().length(12).regex(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/);
export const resolveScanInputSchema = z.object({ accessCode: accessCodeSchema });
export const updateScanInputSchema = z.object({ title: z.string().trim().min(1).max(120) });
export const validateGeminiKeyInputSchema = z.object({ apiKey: z.string().trim().min(10).max(512) });

export const scanSchema = z.object({
  id: z.string(),
  title: z.string(),
  language: z.string(),
  codePreview: z.string(),
  provider: modelProviderSchema,
  model: z.string(),
  summary: z.string(),
  findings: z.array(findingSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string(),
});

export const exportFindingSchema = z.object({
  rank: z.number().int().positive(),
  severity: severitySchema,
  storyPoints: storyPointsSchema,
  title: z.string(),
  location: z.object({
    lineStart: z.number().int().positive(),
    lineEnd: z.number().int().positive(),
  }).nullable(),
  evidence: evidenceSnippetSchema.nullable(),
  suggestedCode: z.string().nullable(),
  explanation: z.string(),
  remediationSummary: z.string(),
  instructionsMarkdown: z.string(),
});

export const scanExportSchema = z.object({
  schemaVersion: z.literal("1.0"),
  exportedAt: z.string().datetime(),
  scan: z.object({
    id: z.string(),
    title: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    language: z.string(),
    sourceHash: z.string(),
    codePreview: z.string(),
    provider: modelProviderSchema,
    model: z.string(),
    summary: z.string(),
  }),
  fixQueue: z.array(exportFindingSchema),
});

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  }),
});

export type StoryPoints = z.infer<typeof storyPointsSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type StoredFinding = z.infer<typeof storedFindingSchema>;
export type ProviderFinding = z.infer<typeof providerFindingSchema>;
export type EvidenceSnippet = z.infer<typeof evidenceSnippetSchema>;
export type ScanResult = z.infer<typeof scanResultSchema>;
export type SafeModel = z.infer<typeof safeModelSchema>;
export type ScanSelection = z.infer<typeof scanSelectionSchema>;
export type Scan = z.infer<typeof scanSchema>;
export type ScanExport = z.infer<typeof scanExportSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
