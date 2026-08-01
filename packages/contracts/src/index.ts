import { z } from "zod";

export const roleSchema = z.enum(["ADMIN", "USER"]);
export const userStatusSchema = z.enum(["ACTIVE", "DISABLED"]);
export const severitySchema = z.enum(["critical", "high", "medium", "low", "info"]);

export const findingSchema = z.object({
  severity: severitySchema,
  title: z.string().min(1).max(160),
  lineStart: z.number().int().positive().optional(),
  lineEnd: z.number().int().positive().optional(),
  explanation: z.string().min(1).max(4_000),
  remediation: z.string().min(1).max(4_000),
});

export const scanResultSchema = z.object({
  summary: z.string().min(1).max(4_000),
  findings: z.array(findingSchema).max(100),
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

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  }),
});

export type Role = z.infer<typeof roleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type ScanResult = z.infer<typeof scanResultSchema>;
export type User = z.infer<typeof userSchema>;
export type SafeModel = z.infer<typeof safeModelSchema>;
export type Credential = z.infer<typeof credentialSchema>;
export type Scan = z.infer<typeof scanSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
