import type {
  Credential,
  SafeModel,
  Scan,
  User,
} from "@secure-scan/contracts";

export type SessionPayload = { user: User };
export type UsersPayload = { users: User[] };
export type UserPayload = { user: User };
export type ScansPayload = { scans: Scan[] };
export type ScanPayload = { scan: Scan };
export type ModelsPayload = { models: SafeModel[] };
export type CredentialsPayload = { credentials: Credential[] };
export type GeminiModel = { id: string; label: string };
export type GeminiModelsPayload = { models: GeminiModel[] };
export type CredentialCreatedPayload = {
  credential: Credential;
  models: GeminiModel[];
};
