import type { ErrorResponse } from "@secure-scan/contracts";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
  });

  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null) as T | ErrorResponse | null;
  if (!response.ok) {
    const error = (payload as ErrorResponse | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "REQUEST_FAILED",
      error?.message ?? "The request could not be completed.",
      error?.fieldErrors,
    );
  }
  return payload as T;
}

export async function downloadJson(path: string, filename: string, headers?: HeadersInit) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...(headers ? { headers } : {}),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as ErrorResponse | null;
    throw new ApiError(
      response.status,
      payload?.error.code ?? "DOWNLOAD_FAILED",
      payload?.error.message ?? "The report could not be downloaded.",
    );
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadReportValue(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
