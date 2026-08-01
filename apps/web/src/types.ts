import type {
  AccessTier,
  Credential,
  ErrorResponse,
  Role,
  SafeModel,
  Scan,
  ScanExport,
  User,
} from "@secure-scan/contracts";

export type SessionPayload = { user: User };
export type UsersPayload = { users: User[] };
export type PaginatedUsersPayload = {
  users: User[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
export type UserPayload = { user: User };
export type ScansPayload = { scans: Scan[] };
export type ScanPayload = { scan: Scan };
export type ScanExportPayload = ScanExport;
export type ModelsPayload = { models: SafeModel[] };
export type CredentialsPayload = { credentials: Credential[] };
export type GeminiModel = { id: string; label: string };
export type GeminiModelsPayload = { models: GeminiModel[] };
export type CredentialCreatedPayload = {
  credential: Credential;
  models: GeminiModel[];
};

export type BatchCreateRowInput = {
  clientRowId: string;
  username: string;
  temporaryPassword?: string;
  role: string;
  accessTier: string;
  expiresAt?: string | null;
};
export type BatchCreateResult =
  | { clientRowId: string; status: "created"; user: User; temporaryPassword: string }
  | { clientRowId: string; status: "error"; error: ErrorResponse["error"] };
export type BatchCreatePayload = {
  results: BatchCreateResult[];
  summary: { requested: number; created: number; failed: number };
};
export type BatchActionResult =
  | { userId: string; status: "updated"; user: User }
  | { userId: string; status: "deleted" }
  | { userId: string; status: "error"; error: ErrorResponse["error"] };
export type BatchActionPayload = {
  results: BatchActionResult[];
  summary: { requested: number; succeeded: number; failed: number };
};
