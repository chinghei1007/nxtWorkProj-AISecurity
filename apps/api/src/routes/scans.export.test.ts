import type { Scan } from "@prisma/client";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendError } from "../lib/errors.js";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("../db.js", () => ({
  prisma: { scan: { findFirst: mocks.findFirst } },
}));

vi.mock("../plugins/auth.js", () => ({
  requireReady: async (request: { currentUser?: unknown }) => {
    request.currentUser = { id: "owner-1" };
  },
}));

import { scanRoutes } from "./scans.js";

const scan: Scan = {
  id: "scan-1",
  userId: "owner-1",
  title: "Export report",
  language: "TypeScript",
  codeHash: "hash",
  codePreview: "const value = true",
  provider: "groq",
  profileId: "private-profile",
  model: "model",
  summary: "Safe.",
  findings: [],
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
};

async function makeApp() {
  const app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) => sendError(reply, error));
  await app.register(scanRoutes);
  return app;
}

describe("GET /api/scans/:id/export", () => {
  beforeEach(() => mocks.findFirst.mockResolvedValue(scan));
  afterEach(() => vi.clearAllMocks());

  it("returns the owner-scoped inline JSON report", async () => {
    const app = await makeApp();
    const response = await app.inject({ method: "GET", url: "/api/scans/scan-1/export" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.headers["content-disposition"]).toBeUndefined();
    expect(response.json()).toMatchObject({ schemaVersion: "1.0", scan: { id: "scan-1", sourceHash: "hash" } });
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: "scan-1", userId: "owner-1" } });
    await app.close();
  });

  it("adds a safe attachment header for downloads", async () => {
    const app = await makeApp();
    const response = await app.inject({ method: "GET", url: "/api/scans/scan-1/export?download=1" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-disposition"]).toBe('attachment; filename="Export-report-scan-1.json"');
    await app.close();
  });

  it("does not reveal a scan outside the current owner scope", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const app = await makeApp();
    const response = await app.inject({ method: "GET", url: "/api/scans/another-users-scan/export" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: "SCAN_NOT_FOUND", message: "Scan not found." } });
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: "another-users-scan", userId: "owner-1" } });
    await app.close();
  });
});
