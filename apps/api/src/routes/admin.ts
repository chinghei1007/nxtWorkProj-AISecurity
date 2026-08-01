import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { Prisma, type AccessTier, type Role, type UserStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import {
  batchCreateUserRowSchema,
  batchCreateUsersInputSchema,
  batchUserActionInputSchema,
  createUserInputSchema,
  resetPasswordInputSchema,
  updateUserInputSchema,
  userListQuerySchema,
} from "@secure-scan/contracts";
import { z } from "zod";
import { prisma } from "../db.js";
import { AppError } from "../lib/errors.js";
import { serializeUser } from "../lib/serializers.js";
import { requireAdmin } from "../plugins/auth.js";
import { reconcileRestrictedModelPreference } from "../services/model-selection.js";

const paramsSchema = z.object({ id: z.string().min(1) });

type AdminChange = {
  role?: Role;
  status?: UserStatus;
  expiresAt?: Date | null;
  deleting?: boolean;
};

function isCurrentlyAccessibleAdmin(user: {
  role: Role;
  status: UserStatus;
  expiresAt: Date | null;
}, now: Date) {
  return user.role === "ADMIN"
    && user.status === "ACTIVE"
    && (!user.expiresAt || user.expiresAt > now);
}

async function assertAdminChangeIsSafe(
  tx: Prisma.TransactionClient,
  targetId: string,
  change: AdminChange,
) {
  const target = await tx.user.findUnique({ where: { id: targetId } });
  if (!target) throw new AppError(404, "USER_NOT_FOUND", "User not found.");
  const now = new Date();
  const remainsAccessible = !change.deleting && isCurrentlyAccessibleAdmin({
    role: change.role ?? target.role,
    status: change.status ?? target.status,
    expiresAt: change.expiresAt === undefined ? target.expiresAt : change.expiresAt,
  }, now);
  if (isCurrentlyAccessibleAdmin(target, now) && !remainsAccessible) {
    const accessibleAdmins = await tx.user.count({
      where: {
        role: "ADMIN",
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    if (accessibleAdmins <= 1) {
      throw new AppError(409, "LAST_ADMIN", "The last active administrator cannot be removed.");
    }
  }
  return target;
}

async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if ((error as { code?: string }).code !== "P2034" || attempt === 2) throw error;
    }
  }
  throw new Error("Unreachable transaction retry state.");
}

function validationFields(error: z.ZodError) {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".") || "root";
    fields[field] ??= [];
    fields[field].push(issue.message);
  }
  return fields;
}

function batchError(error: unknown) {
  if (error instanceof AppError) return { code: error.code, message: error.message };
  if ((error as { code?: string }).code === "P2002") {
    return { code: "USERNAME_TAKEN", message: "That username is already in use." };
  }
  return { code: "INTERNAL_ERROR", message: "The account could not be processed." };
}

function generatedTemporaryPassword() {
  return randomBytes(18).toString("base64url");
}

function userWhere(input: z.infer<typeof userListQuerySchema>): Prisma.UserWhereInput {
  const now = new Date();
  const within7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000);
  const within30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1_000);
  const and: Prisma.UserWhereInput[] = [];
  if (input.q) and.push({ usernameNormalized: { contains: input.q.toLowerCase() } });
  if (input.role) and.push({ role: input.role });
  if (input.accessTier) and.push({ accessTier: input.accessTier });
  if (input.effectiveStatus === "DISABLED") and.push({ status: "DISABLED" });
  if (input.effectiveStatus === "EXPIRED") {
    and.push({ status: "ACTIVE", expiresAt: { lte: now } });
  }
  if (input.effectiveStatus === "ACTIVE") {
    and.push({ status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });
  }
  if (input.expiry === "NONE") and.push({ expiresAt: null });
  if (input.expiry === "EXPIRED") and.push({ expiresAt: { lte: now } });
  if (input.expiry === "NEXT_7_DAYS") and.push({ expiresAt: { gt: now, lte: within7 } });
  if (input.expiry === "NEXT_30_DAYS") and.push({ expiresAt: { gt: now, lte: within30 } });
  if (input.expiry === "LATER") and.push({ expiresAt: { gt: within30 } });
  return and.length ? { AND: and } : {};
}

async function updateUserInTransaction(
  tx: Prisma.TransactionClient,
  id: string,
  data: { role?: Role; status?: UserStatus; accessTier?: AccessTier; expiresAt?: Date | null },
) {
  await assertAdminChangeIsSafe(tx, id, data);
  const user = await tx.user.update({ where: { id }, data });
  if (data.status === "DISABLED") await tx.session.deleteMany({ where: { userId: id } });
  if (data.accessTier) await reconcileRestrictedModelPreference(tx, id, data.accessTier);
  return user;
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  app.get("/api/admin/users", async (request) => {
    const input = userListQuerySchema.parse(request.query);
    const where = userWhere(input);
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      prisma.user.count({ where }),
    ]);
    return {
      users: users.map(serializeUser),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      },
    };
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
        accessTier: input.accessTier,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        mustChangePassword: true,
      },
    });
    return reply.status(201).send({ user: serializeUser(user) });
  });

  app.post("/api/admin/users/batch", async (request, reply) => {
    const input = batchCreateUsersInputSchema.parse(request.body);
    const results = [];
    for (const [index, candidate] of input.rows.entries()) {
      const parsed = batchCreateUserRowSchema.safeParse(candidate);
      const fallbackId = typeof candidate === "object" && candidate && "clientRowId" in candidate
        && typeof candidate.clientRowId === "string"
        ? candidate.clientRowId
        : `row-${index + 1}`;
      if (!parsed.success) {
        results.push({
          clientRowId: fallbackId,
          status: "error" as const,
          error: {
            code: "VALIDATION_ERROR",
            message: "The row contains invalid values.",
            fieldErrors: validationFields(parsed.error),
          },
        });
        continue;
      }
      const row = parsed.data;
      const temporaryPassword = row.temporaryPassword ?? generatedTemporaryPassword();
      try {
        const user = await prisma.user.create({
          data: {
            username: row.username,
            usernameNormalized: row.username.toLowerCase(),
            passwordHash: await argon2.hash(temporaryPassword, { type: argon2.argon2id }),
            role: row.role,
            accessTier: row.accessTier,
            expiresAt: row.expiresAt ? new Date(row.expiresAt) : null,
            mustChangePassword: true,
          },
        });
        results.push({
          clientRowId: row.clientRowId,
          status: "created" as const,
          user: serializeUser(user),
          temporaryPassword,
        });
      } catch (error) {
        request.log.error({ err: error, clientRowId: row.clientRowId }, "Batch user row failed");
        results.push({ clientRowId: row.clientRowId, status: "error" as const, error: batchError(error) });
      }
    }
    const created = results.filter((result) => result.status === "created").length;
    return reply.status(207).send({
      results,
      summary: { requested: results.length, created, failed: results.length - created },
    });
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
      ...(input.accessTier ? { accessTier: input.accessTier } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } : {}),
    };
    const user = await serializable((tx) => updateUserInTransaction(tx, id, data));
    return { user: serializeUser(user) };
  });

  app.post("/api/admin/users/batch-actions", async (request, reply) => {
    const input = batchUserActionInputSchema.parse(request.body);
    const results = await serializable(async (tx) => {
      const outcomes = [];
      for (const id of input.userIds) {
        try {
          if (input.action.type === "DELETE") {
            if (id === request.currentUser!.id) {
              throw new AppError(409, "SELF_DELETE", "You cannot delete your own account.");
            }
            await assertAdminChangeIsSafe(tx, id, { deleting: true });
            await tx.user.delete({ where: { id } });
            outcomes.push({ userId: id, status: "deleted" as const });
            continue;
          }
          if (input.action.type === "SET_STATUS" && id === request.currentUser!.id && input.action.status === "DISABLED") {
            throw new AppError(409, "SELF_DISABLE", "You cannot disable your own account.");
          }
          const data = input.action.type === "SET_ROLE"
            ? { role: input.action.role }
            : input.action.type === "SET_ACCESS_TIER"
              ? { accessTier: input.action.accessTier }
              : input.action.type === "SET_EXPIRY"
                ? { expiresAt: input.action.expiresAt ? new Date(input.action.expiresAt) : null }
                : { status: input.action.status };
          const user = await updateUserInTransaction(tx, id, data);
          outcomes.push({ userId: id, status: "updated" as const, user: serializeUser(user) });
        } catch (error) {
          if (!(error instanceof AppError)) throw error;
          outcomes.push({ userId: id, status: "error" as const, error: batchError(error) });
        }
      }
      return outcomes;
    });
    const succeeded = results.filter((result) => result.status !== "error").length;
    return reply.status(207).send({
      results,
      summary: { requested: results.length, succeeded, failed: results.length - succeeded },
    });
  });

  app.post("/api/admin/users/:id/reset-password", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const input = resetPasswordInputSchema.parse(request.body);
    const user = await serializable(async (tx) => {
      await assertAdminChangeIsSafe(tx, id, {});
      const updated = await tx.user.update({
        where: { id },
        data: {
          passwordHash: await argon2.hash(input.temporaryPassword, { type: argon2.argon2id }),
          mustChangePassword: true,
        },
      });
      await tx.session.deleteMany({ where: { userId: id } });
      return updated;
    });
    return { user: serializeUser(user) };
  });

  app.delete("/api/admin/users/:id", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    if (id === request.currentUser!.id) {
      throw new AppError(409, "SELF_DELETE", "You cannot delete your own account.");
    }
    await serializable(async (tx) => {
      await assertAdminChangeIsSafe(tx, id, { deleting: true });
      await tx.user.delete({ where: { id } });
    });
    return reply.status(204).send();
  });
}
