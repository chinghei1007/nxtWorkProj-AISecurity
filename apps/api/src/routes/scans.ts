import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import {
  createScanInputSchema,
  updateScanInputSchema,
} from "@secure-scan/contracts";
import { z } from "zod";
import { prisma } from "../db.js";
import { detectLanguage, looksLikeCode } from "../lib/code-gate.js";
import { AppError } from "../lib/errors.js";
import { serializeScan } from "../lib/serializers.js";
import { requireReady } from "../plugins/auth.js";
import { resolveModelSelection } from "../services/model-selection.js";
import { auditWithGemini, auditWithOpenAICompatible } from "../services/providers.js";

const paramsSchema = z.object({ id: z.string().min(1) });

async function ownedScan(userId: string, id: string) {
  const scan = await prisma.scan.findFirst({ where: { id, userId } });
  if (!scan) throw new AppError(404, "SCAN_NOT_FOUND", "Scan not found.");
  return scan;
}

export async function scanRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireReady);

  app.post(
    "/api/scans",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = createScanInputSchema.parse(request.body);
      if (!looksLikeCode(input.source)) {
        throw new AppError(422, "NOT_CODE", "Does not seem like code.");
      }

      const selection = await resolveModelSelection(request.currentUser!.id);
      const result = selection.provider === "gemini"
        ? await auditWithGemini({
            apiKey: selection.apiKey,
            model: selection.model,
            source: input.source,
          })
        : await auditWithOpenAICompatible({
            apiKey: selection.apiKey,
            baseUrl: selection.baseUrl,
            model: selection.model,
            source: input.source,
          });

      const language = detectLanguage(input.source);
      const scan = await prisma.scan.create({
        data: {
          userId: request.currentUser!.id,
          title: input.title || language + " security scan",
          language,
          codeHash: createHash("sha256").update(input.source).digest("hex"),
          codePreview: input.source.trim().replace(/\s+/g, " ").slice(0, 160),
          provider: selection.provider,
          profileId: selection.source === "SERVER" ? selection.profileId : null,
          model: selection.model,
          summary: result.summary,
          findings: result.findings as Prisma.InputJsonValue,
        },
      });
      return reply.status(201).send({ scan: serializeScan(scan) });
    },
  );

  app.get("/api/scans", async (request) => {
    const scans = await prisma.scan.findMany({
      where: { userId: request.currentUser!.id },
      orderBy: { createdAt: "desc" },
    });
    return { scans: scans.map(serializeScan) };
  });

  app.get("/api/scans/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    return { scan: serializeScan(await ownedScan(request.currentUser!.id, id)) };
  });

  app.patch("/api/scans/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const input = updateScanInputSchema.parse(request.body);
    await ownedScan(request.currentUser!.id, id);
    const scan = await prisma.scan.update({ where: { id }, data: { title: input.title } });
    return { scan: serializeScan(scan) };
  });

  app.delete("/api/scans/:id", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    await ownedScan(request.currentUser!.id, id);
    await prisma.scan.delete({ where: { id } });
    return reply.status(204).send();
  });
}
