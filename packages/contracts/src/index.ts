import { z } from "zod";

export const roleSchema = z.enum(["ADMIN", "USER"]);
export const userStatusSchema = z.enum(["ACTIVE", "DISABLED"]);
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

export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: roleSchema,
  status: userStatusSchema,
  mustChangePassword: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const sessionResponseSchema = z.object({ user: userSchema });

export const loginInputSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});

export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(12).max(256),
});

export const updateAccountInputSchema = z.object({
  username: z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/),
});

export const createUserInputSchema = z.object({
  username: z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/),
  temporaryPassword: z.string().min(12).max(256),
  role: roleSchema.default("USER"),
});

export const updateUserInputSchema = z.object({
  role: roleSchema.optional(),
  status: userStatusSchema.optional(),
}).refine((value) => value.role !== undefined || value.status !== undefined, {
  message: "At least one field is required.",
});

export const resetPasswordInputSchema = z.object({
  temporaryPassword: z.string().min(12).max(256),
});

export const modelProviderSchema = z.enum(["groq", "openai-compatible", "gemini"]);

export const safeModelSchema = z.object({
  id: z.string(),
  label: z.string(),
  provider: modelProviderSchema,
  source: z.enum(["SERVER", "USER"]),
  credentialId: z.string().optional(),
  model: z.string(),
  selected: z.boolean(),
  available: z.boolean().default(true),
});

export const credentialSchema = z.object({
  id: z.string(),
  label: z.string(),
  provider: z.literal("gemini"),
  lastFour: z.string(),
  status: z.enum(["VALID", "INVALID"]),
  createdAt: z.string(),
});

export const createCredentialInputSchema = z.object({
  label: z.string().trim().min(1).max(64),
  apiKey: z.string().trim().min(10).max(512),
});

export const updateModelPreferenceInputSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("SERVER"), profileId: z.string().min(1) }),
  z.object({
    source: z.literal("USER"),
    credentialId: z.string().min(1),
    model: z.string().min(1).max(160),
  }),
]);

export const createScanInputSchema = z.object({
  title: z.string().trim().max(120).optional(),
  source: z.string().min(1).max(50_000),
});

export const updateScanInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

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
  exportedAt: z.string(),
  scan: z.object({
    id: z.string(),
    title: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
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

export type Role = z.infer<typeof roleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type StoryPoints = z.infer<typeof storyPointsSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type StoredFinding = z.infer<typeof storedFindingSchema>;
export type ProviderFinding = z.infer<typeof providerFindingSchema>;
export type EvidenceSnippet = z.infer<typeof evidenceSnippetSchema>;
export type ScanResult = z.infer<typeof scanResultSchema>;
export type User = z.infer<typeof userSchema>;
export type SafeModel = z.infer<typeof safeModelSchema>;
export type Credential = z.infer<typeof credentialSchema>;
export type Scan = z.infer<typeof scanSchema>;
export type ScanExport = z.infer<typeof scanExportSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
