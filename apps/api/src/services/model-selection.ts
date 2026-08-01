import type { AccessTier, Prisma } from "@prisma/client";
import { config, type ModelProfile } from "../config.js";
import { prisma } from "../db.js";
import { decryptSecret } from "../lib/crypto.js";
import { AppError } from "../lib/errors.js";

export type ResolvedModel =
  | {
      source: "SERVER";
      provider: "groq" | "openai-compatible";
      profileId: string;
      model: string;
      apiKey: string;
      baseUrl: string;
      label: string;
    }
  | {
      source: "USER";
      provider: "gemini";
      credentialId: string;
      model: string;
      apiKey: string;
      label: string;
    };

function defaultProfile() {
  return config.modelProfiles.find((profile) => profile.id === config.DEFAULT_MODEL_PROFILE_ID)!;
}

function resolveServerProfile(profileId: string | null | undefined) {
  return config.modelProfiles.find((profile) => profile.id === profileId) ?? defaultProfile();
}

export function canUseServerProfile(accessTier: AccessTier, profile: ModelProfile) {
  return accessTier === "FULL_DEMO" || profile.requiredAccessTier === "LIMITED";
}

export async function reconcileRestrictedModelPreference(
  tx: Prisma.TransactionClient,
  userId: string,
  accessTier: AccessTier,
) {
  if (accessTier === "FULL_DEMO") return;
  const preference = await tx.modelPreference.findUnique({ where: { userId } });
  if (!preference || preference.source === "USER") return;
  const profile = resolveServerProfile(preference.profileId);
  if (canUseServerProfile(accessTier, profile)) return;
  const fallback = defaultProfile();
  await tx.modelPreference.update({
    where: { userId },
    data: { source: "SERVER", profileId: fallback.id, credentialId: null, model: fallback.model },
  });
}

export async function resolveModelSelection(userId: string): Promise<ResolvedModel> {
  const [preference, user] = await Promise.all([
    prisma.modelPreference.findUnique({ where: { userId }, include: { credential: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { accessTier: true } }),
  ]);
  if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found.");

  if (preference?.source === "USER" && preference.credential) {
    return {
      source: "USER",
      provider: "gemini",
      credentialId: preference.credential.id,
      model: preference.model,
      apiKey: decryptSecret(preference.credential),
      label: preference.credential.label,
    };
  }

  const selectedProfile = resolveServerProfile(preference?.profileId);
  const profile = canUseServerProfile(user.accessTier, selectedProfile) ? selectedProfile : defaultProfile();
  const apiKey = process.env[profile.apiKeyEnv];
  if (!apiKey) {
    throw new AppError(
      503,
      "MODEL_NOT_CONFIGURED",
      "The selected server model is not configured with an API key.",
    );
  }
  return {
    source: "SERVER",
    provider: profile.provider,
    profileId: profile.id,
    model: profile.model,
    apiKey,
    baseUrl: profile.baseUrl,
    label: profile.label,
  };
}

export async function listSafeModels(userId: string) {
  const [preference, user] = await Promise.all([
    prisma.modelPreference.findUnique({ where: { userId }, include: { credential: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { accessTier: true } }),
  ]);
  if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found.");
  const selectedServerProfile = preference?.source === "SERVER"
    ? resolveServerProfile(preference.profileId)
    : undefined;

  const serverModels = config.modelProfiles.map((profile) => ({
    id: profile.id,
    label: profile.label,
    provider: profile.provider,
    source: "SERVER" as const,
    model: profile.model,
    requiredAccessTier: profile.requiredAccessTier,
    locked: !canUseServerProfile(user.accessTier, profile),
    selected:
      preference?.source === "SERVER"
        ? (canUseServerProfile(user.accessTier, selectedServerProfile!)
            ? selectedServerProfile!.id === profile.id
            : defaultProfile().id === profile.id)
        : !preference && profile.id === config.DEFAULT_MODEL_PROFILE_ID,
    available: Boolean(process.env[profile.apiKeyEnv]),
  }));

  if (preference?.source === "USER" && preference.credential) {
    return [
      ...serverModels,
      {
        id: "user:" + preference.credential.id + ":" + preference.model,
        label: preference.credential.label + " · " + preference.model,
        provider: "gemini" as const,
        source: "USER" as const,
        credentialId: preference.credential.id,
        model: preference.model,
        selected: true,
        available: true,
        requiredAccessTier: "LIMITED" as const,
        locked: false,
      },
    ];
  }
  return serverModels;
}
