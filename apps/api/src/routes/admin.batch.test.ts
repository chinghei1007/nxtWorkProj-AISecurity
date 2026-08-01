import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendError } from "../lib/errors.js";

const mocks = vi.hoisted(() => {
  const tx = {
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    session: { deleteMany: vi.fn() },
  };
  return {
    tx,
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(async (work: (value: typeof tx) => unknown) => work(tx)),
    reconcile: vi.fn(),
  };
});

vi.mock("../db.js", () => ({
  prisma: {
    user: {
      findMany: mocks.findMany,
      count: mocks.count,
      findUnique: mocks.findUnique,
      create: mocks.create,
      update: mocks.update,
      delete: mocks.delete,
    },
    session: mocks.tx.session,
    $transaction: mocks.transaction,
  },
}));

vi.mock("../plugins/auth.js", () => ({
  requireAdmin: async (request: { currentUser?: unknown }) => {
    request.currentUser = { id: "admin-self", role: "ADMIN", accessTier: "FULL_DEMO" };
  },
}));

vi.mock("../services/model-selection.js", () => ({
  reconcileRestrictedModelPreference: mocks.reconcile,
}));

vi.mock("argon2", () => ({ default: { hash: vi.fn(async () => "hashed-password") } }));

import { adminRoutes } from "./admin.js";

const baseUser = {
  id: "user-1",
  username: "alice",
  usernameNormalized: "alice",
  passwordHash: "hash",
  role: "USER" as const,
  status: "ACTIVE" as const,
  accessTier: "LIMITED" as const,
  expiresAt: null,
  mustChangePassword: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

async function makeApp() {
  const app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) => sendError(reply, error));
  await app.register(adminRoutes);
  return app;
}

describe("admin batch accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    mocks.tx.user.findUnique.mockResolvedValue(baseUser);
    mocks.tx.user.count.mockResolvedValue(2);
    mocks.tx.user.update.mockImplementation(async ({ data }: { data: object }) => ({ ...baseUser, ...data, updatedAt: new Date() }));
  });

  it("returns partial registration results and a generated password", async () => {
    mocks.create
      .mockResolvedValueOnce(baseUser)
      .mockRejectedValueOnce({ code: "P2002" });
    const app = await makeApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/users/batch",
      payload: { rows: [
        { clientRowId: "one", username: "alice", role: "USER", accessTier: "LIMITED" },
        { clientRowId: "invalid", username: "!", role: "USER", accessTier: "LIMITED" },
        { clientRowId: "duplicate", username: "alice-2", temporaryPassword: "TemporaryPass123!", role: "USER", accessTier: "LIMITED" },
      ] },
    });
    expect(response.statusCode).toBe(207);
    const payload = response.json();
    expect(payload.summary).toEqual({ requested: 3, created: 1, failed: 2 });
    expect(payload.results[0].temporaryPassword).toHaveLength(24);
    expect(payload.results[1].error.code).toBe("VALIDATION_ERROR");
    expect(payload.results[2].error.code).toBe("USERNAME_TAKEN");
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ mustChangePassword: true, accessTier: "LIMITED" }) }));
    await app.close();
  });

  it("applies safe rows while reporting a protected last administrator", async () => {
    mocks.tx.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => where.id === "last-admin"
      ? { ...baseUser, id: "last-admin", username: "last-admin", usernameNormalized: "last-admin", role: "ADMIN" }
      : baseUser);
    mocks.tx.user.count.mockResolvedValue(1);
    const app = await makeApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/users/batch-actions",
      payload: { userIds: ["user-1", "last-admin"], action: { type: "SET_STATUS", status: "DISABLED" } },
    });
    expect(response.statusCode).toBe(207);
    expect(response.json().summary).toEqual({ requested: 2, succeeded: 1, failed: 1 });
    expect(response.json().results[1].error.code).toBe("LAST_ADMIN");
    expect(mocks.tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    await app.close();
  });

  it("reconciles a restricted model preference after a tier downgrade", async () => {
    const app = await makeApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/users/batch-actions",
      payload: { userIds: ["user-1"], action: { type: "SET_ACCESS_TIER", accessTier: "LIMITED" } },
    });
    expect(response.statusCode).toBe(207);
    expect(mocks.reconcile).toHaveBeenCalledWith(mocks.tx, "user-1", "LIMITED");
    await app.close();
  });
});
