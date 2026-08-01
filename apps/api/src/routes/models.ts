import type { FastifyInstance } from "fastify";
import {
  createCredentialInputSchema,
  updateModelPreferenceInputSchema,
} from "@secure-scan/contracts";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { decryptSecret, encryptSecret } from "../lib/crypto.js";
import { AppError } from "../lib/errors.js";
import { serializeCredential } from "../lib/serializers.js";
import { requireReady } from "../plugins/auth.js";
import { listSafeModels } from "../services/model-selection.js";
import { canUseServerProfile } from "../services/model-selection.js";
import { listGeminiModels } from "../services/providers.js";

const paramsSchema = z.object({ id: z.string().min(1) });

async function ownedCredential(userId: string, credentialId: string) {
  const credential = await prisma.providerCredential.findFirst({
    where: { id: credentialId, userId },
  });
  if (!credential) throw new AppError(404, "CREDENTIAL_NOT_FOUND", "API key not found.");
  return credential;
}

export async function modelRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireReady);

  app.get("/api/models", async (request) => ({
    models: await listSafeModels(request.currentUser!.id),
  }));

  app.get("/api/credentials", async (request) => {
    const credentials = await prisma.providerCredential.findMany({
      where: { userId: request.currentUser!.id },
      orderBy: { createdAt: "asc" },
    });
    return { credentials: credentials.map(serializeCredential) };
  });

  app.post("/api/credentials", async (request, reply) => {
    const input = createCredentialInputSchema.parse(request.body);
    const models = await listGeminiModels(input.apiKey);
    const encrypted = encryptSecret(input.apiKey);
    const credential = await prisma.providerCredential.create({
      data: {
        userId: request.currentUser!.id,
        provider: "gemini",
        label: input.label,
        lastFour: input.apiKey.slice(-4),
        ...encrypted,
      },
    });
    return reply.status(201).send({
      credential: serializeCredential(credential),
      models,
    });
  });

  app.get("/api/credentials/:id/models", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const credential = await ownedCredential(request.currentUser!.id, id);
    return { models: await listGeminiModels(decryptSecret(credential)) };
  });

  app.delete("/api/credentials/:id", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const credential = await ownedCredential(request.currentUser!.id, id);
    await prisma.$transaction(async (tx) => {
      const active = await tx.modelPreference.findFirst({
        where: { userId: request.currentUser!.id, credentialId: credential.id },
      });
      if (active) {
        const defaultProfile = config.modelProfiles.find(
          (profile) => profile.id === config.DEFAULT_MODEL_PROFILE_ID,
        )!;
        await tx.modelPreference.update({
          where: { userId: request.currentUser!.id },
          data: {
            source: "SERVER",
            profileId: defaultProfile.id,
            credentialId: null,
            model: defaultProfile.model,
          },
        });
      }
      await tx.providerCredential.delete({ where: { id: credential.id } });
    });
    return reply.status(204).send();
  });

  app.patch("/api/model-preference", async (request) => {
    const input = updateModelPreferenceInputSchema.parse(request.body);
    const userId = request.currentUser!.id;
    if (input.source === "SERVER") {
      const profile = config.modelProfiles.find((candidate) => candidate.id === input.profileId);
      if (!profile) throw new AppError(404, "MODEL_NOT_FOUND", "Model profile not found.");
      if (!canUseServerProfile(request.currentUser!.accessTier, profile)) {
        throw new AppError(403, "MODEL_ACCESS_DENIED", "Full Demo access is required for that shared model.");
      }
      if (!process.env[profile.apiKeyEnv]) {
        throw new AppError(503, "MODEL_NOT_CONFIGURED", "That model has no configured API key.");
      }
      await prisma.modelPreference.upsert({
        where: { userId },
        create: {
          userId,
          source: "SERVER",
          profileId: profile.id,
          model: profile.model,
        },
        update: {
          source: "SERVER",
          profileId: profile.id,
          credentialId: null,
          model: profile.model,
        },
      });
    } else {
      const credential = await ownedCredential(userId, input.credentialId);
      const available = await listGeminiModels(decryptSecret(credential));
      if (!available.some((model) => model.id === input.model)) {
        throw new AppError(400, "MODEL_NOT_AVAILABLE", "That Gemini model is not available for this key.");
      }
      await prisma.modelPreference.upsert({
        where: { userId },
        create: {
          userId,
          source: "USER",
          credentialId: credential.id,
          model: input.model,
        },
        update: {
          source: "USER",
          profileId: null,
          credentialId: credential.id,
          model: input.model,
        },
      });
    }
    return { models: await listSafeModels(userId) };
  });
}
