import type { User } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { AppError } from "../lib/errors.js";
import { hashSessionToken } from "../services/session.js";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: User;
  }
}

export async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
  const token = request.cookies[config.SESSION_COOKIE_NAME];
  if (!token) throw new AppError(401, "UNAUTHENTICATED", "Please sign in to continue.");

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    throw new AppError(401, "UNAUTHENTICATED", "Your session has expired.");
  }
  request.currentUser = session.user;
}

export async function requireReady(request: FastifyRequest, reply: FastifyReply) {
  await authenticate(request, reply);
  if (request.currentUser?.mustChangePassword) {
    throw new AppError(403, "PASSWORD_CHANGE_REQUIRED", "Change your temporary password to continue.");
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await requireReady(request, reply);
  if (request.currentUser?.role !== "ADMIN") {
    throw new AppError(403, "FORBIDDEN", "Administrator access is required.");
  }
}
