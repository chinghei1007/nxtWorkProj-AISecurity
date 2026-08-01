import type { FastifyReply } from "fastify";
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

export function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message },
    });
  }

  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const field = issue.path.join(".") || "root";
      fieldErrors[field] ??= [];
      fieldErrors[field].push(issue.message);
    }
    return reply.status(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message: "The request contains invalid values.",
        fieldErrors,
      },
    });
  }

  const candidate = error as { code?: string };
  if (candidate?.code === "P2002") {
    return reply.status(409).send({
      error: { code: "USERNAME_TAKEN", message: "That username is already in use." },
    });
  }

  return reply.status(500).send({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong." },
  });
}
