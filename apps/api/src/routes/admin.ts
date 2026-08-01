import argon2 from "argon2";
import type { FastifyInstance } from "fastify";
import {
  createUserInputSchema,
  resetPasswordInputSchema,
  updateUserInputSchema,
} from "@secure-scan/contracts";
import { z } from "zod";
import { prisma } from "../db.js";
import { AppError } from "../lib/errors.js";
import { serializeUser } from "../lib/serializers.js";
import { requireAdmin } from "../plugins/auth.js";

const paramsSchema = z.object({ id: z.string().min(1) });

async function assertAdminChangeIsSafe(
  targetId: string,
  change: { role?: "ADMIN" | "USER"; status?: "ACTIVE" | "DISABLED"; deleting?: boolean },
) {
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) throw new AppError(404, "USER_NOT_FOUND", "User not found.");
  const removesActiveAdmin =
    target.role === "ADMIN" &&
    target.status === "ACTIVE" &&
    (change.deleting || change.role === "USER" || change.status === "DISABLED");
  if (removesActiveAdmin) {
    const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    if (activeAdmins <= 1) {
      throw new AppError(409, "LAST_ADMIN", "The last active administrator cannot be removed.");
    }
  }
  return target;
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  app.get("/api/admin/users", async () => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
    return { users: users.map(serializeUser) };
  });

  app.get("/api/admin/users/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found.");
    return { user: serializeUser(user) };
  });

  app.post("/api/admin/users", async (request, reply) => {
    const input = createUserInputSchema.parse(request.body);
    const user = await prisma.user.create({
      data: {
        username: input.username,
        usernameNormalized: input.username.toLowerCase(),
        passwordHash: await argon2.hash(input.temporaryPassword, { type: argon2.argon2id }),
        role: input.role,
        mustChangePassword: true,
      },
    });
    return reply.status(201).send({ user: serializeUser(user) });
  });

  app.patch("/api/admin/users/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const input = updateUserInputSchema.parse(request.body);
    if (id === request.currentUser!.id && input.status === "DISABLED") {
      throw new AppError(409, "SELF_DISABLE", "You cannot disable your own account.");
    }
    const data = {
      ...(input.role ? { role: input.role } : {}),
      ...(input.status ? { status: input.status } : {}),
    };
    await assertAdminChangeIsSafe(id, data);
    const user = await prisma.user.update({ where: { id }, data });
    if (input.status === "DISABLED") {
      await prisma.session.deleteMany({ where: { userId: id } });
    }
    return { user: serializeUser(user) };
  });

  app.post("/api/admin/users/:id/reset-password", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const input = resetPasswordInputSchema.parse(request.body);
    await assertAdminChangeIsSafe(id, {});
    const user = await prisma.user.update({
      where: { id },
      data: {
        passwordHash: await argon2.hash(input.temporaryPassword, { type: argon2.argon2id }),
        mustChangePassword: true,
      },
    });
    await prisma.session.deleteMany({ where: { userId: id } });
    return { user: serializeUser(user) };
  });

  app.delete("/api/admin/users/:id", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    if (id === request.currentUser!.id) {
      throw new AppError(409, "SELF_DELETE", "You cannot delete your own account.");
    }
    await assertAdminChangeIsSafe(id, { deleting: true });
    await prisma.user.delete({ where: { id } });
    return reply.status(204).send();
  });
}
