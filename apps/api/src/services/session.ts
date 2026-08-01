import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply } from "fastify";
import { config } from "../config.js";
import { prisma } from "../db.js";

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, reply: FastifyReply) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.SESSION_TTL_DAYS * 24 * 60 * 60 * 1_000);
  await prisma.session.create({
    data: { userId, tokenHash: hashSessionToken(token), expiresAt },
  });
  reply.setCookie(config.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(token: string | undefined, reply: FastifyReply) {
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }
  reply.clearCookie(config.SESSION_COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "strict",
  });
}
