import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorPayload(error: unknown) {
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: { error: { code: error.code, message: error.message } },
    };
  }
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const field = issue.path.join(".") || "root";
      (fieldErrors[field] ??= []).push(issue.message);
    }
    return {
      status: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "The request contains invalid values.",
          fieldErrors,
        },
      },
    };
  }
  return {
    status: 500,
    body: { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
  };
}
