import argon2 from "argon2";
import type { FastifyInstance } from "fastify";
import {
  changePasswordInputSchema,
  loginInputSchema,
  updateAccountInputSchema,
} from "@secure-scan/contracts";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { AppError } from "../lib/errors.js";
import { serializeUser } from "../lib/serializers.js";
import { authenticate } from "../plugins/auth.js";
import { createSession, destroySession } from "../services/session.js";

export async function authRoutes(app: FastifyInstance) {
  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = loginInputSchema.parse(request.body);
      const user = await prisma.user.findUnique({
        where: { usernameNormalized: input.username.toLowerCase() },
      });
      const valid = user ? await argon2.verify(user.passwordHash, input.password) : false;
      if (!user || !valid) {
        throw new AppError(401, "INVALID_CREDENTIALS", "The username or password is incorrect.");
      }
      if (user.status !== "ACTIVE") {
        throw new AppError(403, "ACCOUNT_DISABLED", "This account has been disabled.");
      }
      if (user.expiresAt && user.expiresAt <= new Date()) {
        throw new AppError(403, "ACCOUNT_EXPIRED", "This account has expired. Contact an administrator.");
      }
      await createSession(user.id, reply);
      return { user: serializeUser(user) };
    },
  );

  app.post("/api/auth/logout", async (request, reply) => {
    await destroySession(request.cookies[config.SESSION_COOKIE_NAME], reply);
    return reply.status(204).send();
  });

  app.get("/api/auth/me", { preHandler: authenticate }, async (request) => ({
    user: serializeUser(request.currentUser!),
  }));

  app.patch("/api/account", { preHandler: authenticate }, async (request) => {
    const input = updateAccountInputSchema.parse(request.body);
    const user = await prisma.user.update({
      where: { id: request.currentUser!.id },
      data: {
        username: input.username,
        usernameNormalized: input.username.toLowerCase(),
      },
    });
    return { user: serializeUser(user) };
  });

  app.post("/api/account/change-password", { preHandler: authenticate }, async (request, reply) => {
    const input = changePasswordInputSchema.parse(request.body);
    const user = request.currentUser!;
    if (!await argon2.verify(user.passwordHash, input.currentPassword)) {
      throw new AppError(400, "INVALID_CURRENT_PASSWORD", "The current password is incorrect.");
    }
    if (input.currentPassword === input.newPassword) {
      throw new AppError(400, "PASSWORD_REUSED", "Choose a password different from the current one.");
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await argon2.hash(input.newPassword, { type: argon2.argon2id }),
        mustChangePassword: false,
      },
    });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await createSession(user.id, reply);
    return { user: serializeUser(updated) };
  });
}
