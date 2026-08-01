import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { sendError } from "../lib/errors.js";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  sessionFindUnique: vi.fn(),
  sessionDelete: vi.fn(),
}));

vi.mock("../db.js", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    session: { findUnique: mocks.sessionFindUnique, delete: mocks.sessionDelete },
  },
}));
vi.mock("argon2", () => ({ default: { verify: vi.fn(async () => true), hash: vi.fn() } }));
vi.mock("../services/session.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../services/session.js")>();
  return { ...original, createSession: vi.fn(), destroySession: vi.fn() };
});

import { authenticate } from "../plugins/auth.js";
import { authRoutes } from "./auth.js";

const expiredUser = {
  id: "expired-user",
  username: "expired",
  usernameNormalized: "expired",
  passwordHash: "hash",
  role: "USER" as const,
  status: "ACTIVE" as const,
  accessTier: "LIMITED" as const,
  expiresAt: new Date(Date.now() - 60_000),
  mustChangePassword: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("account login expiry", () => {
  it("blocks creation of a new session after expiry", async () => {
    mocks.userFindUnique.mockResolvedValue(expiredUser);
    const app = Fastify({ logger: false });
    app.setErrorHandler((error, _request, reply) => sendError(reply, error));
    await app.register(authRoutes);
    const response = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "expired", password: "CorrectPassword123!" } });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("ACCOUNT_EXPIRED");
    await app.close();
  });

  it("allows an already-issued unexpired session to continue", async () => {
    mocks.sessionFindUnique.mockResolvedValue({
      id: "session-1",
      expiresAt: new Date(Date.now() + 60_000),
      user: expiredUser,
    });
    const request = { cookies: { secure_scan_session: "session-token" } } as never;
    await authenticate(request, {} as never);
    expect((request as { currentUser?: unknown }).currentUser).toEqual(expiredUser);
  });
});
