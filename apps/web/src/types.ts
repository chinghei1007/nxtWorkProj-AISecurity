import type { SafeModel, Scan, ScanExport } from "@secure-scan/contracts";

export type ScanPayload = { scan: Scan };
export type CreateScanPayload = ScanPayload & {
  access: {
    code: string;
    managementToken: string;
    expiresAt: string;
    shareUrl: string;
  };
};
export type ScanExportPayload = ScanExport;
export type ModelsPayload = { models: SafeModel[]; defaultProfileId: string };
export type GeminiModel = { id: string; label: string };
export type GeminiModelsPayload = { models: GeminiModel[] };
