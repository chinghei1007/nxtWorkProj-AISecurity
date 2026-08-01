import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { config } from "./config.js";
import { sendError } from "./lib/errors.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { modelRoutes } from "./routes/models.js";
import { scanRoutes } from "./routes/scans.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function buildApp() {
  const app = Fastify({
    logger: config.NODE_ENV !== "test"
      ? {
          redact: ["req.headers.cookie", "req.headers.authorization", "res.headers.set-cookie"],
        }
      : false,
    bodyLimit: 64 * 1024,
  });

  await app.register(cookie);
  await app.register(cors, {
    origin: config.APP_ORIGIN,
    credentials: true,
  });
  await app.register(rateLimit, { global: false });

  app.addHook("onRequest", async (request) => {
    if (!MUTATING_METHODS.has(request.method)) return;
    const origin = request.headers.origin;
    if (origin && origin !== config.APP_ORIGIN) {
      const error = new Error("Cross-origin request denied.") as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 403;
      error.code = "ORIGIN_DENIED";
      throw error;
    }
  });

  app.setErrorHandler((error, request, reply) => {
    const candidate = error as Error & { statusCode?: number; code?: string };
    if (candidate.statusCode === 403 && candidate.code === "ORIGIN_DENIED") {
      return reply.status(403).send({
        error: { code: "ORIGIN_DENIED", message: "Cross-origin request denied." },
      });
    }
    if ((candidate.statusCode ?? 500) >= 500) {
      request.log.error({ err: error }, "Request failed");
    }
    return sendError(reply, error);
  });

  app.get("/api/health", async () => ({ status: "ok" }));
  await app.register(authRoutes);
  await app.register(adminRoutes);
  await app.register(modelRoutes);
  await app.register(scanRoutes);

  if (config.isProduction) {
    const currentDirectory = dirname(fileURLToPath(import.meta.url));
    const webDist = resolve(currentDirectory, "../../../web/dist");
    if (existsSync(webDist)) {
      await app.register(fastifyStatic, { root: webDist, wildcard: false });
      app.setNotFoundHandler((request, reply) => {
        if (request.url.startsWith("/api/")) {
          return reply.status(404).send({
            error: { code: "NOT_FOUND", message: "Endpoint not found." },
          });
        }
        return reply.sendFile("index.html");
      });
    }
  }

  return app;
}
