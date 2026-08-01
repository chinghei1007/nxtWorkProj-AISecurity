import { config } from "../config.js";
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

export async function resolveModelSelection(userId: string): Promise<ResolvedModel> {
  const preference = await prisma.modelPreference.findUnique({
    where: { userId },
    include: { credential: true },
  });

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

  const profile = resolveServerProfile(preference?.profileId);
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
  const preference = await prisma.modelPreference.findUnique({
    where: { userId },
    include: { credential: true },
  });

  const serverModels = config.modelProfiles.map((profile) => ({
    id: profile.id,
    label: profile.label,
    provider: profile.provider,
    source: "SERVER" as const,
    model: profile.model,
    selected:
      preference?.source === "SERVER"
        ? preference.profileId === profile.id
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
      },
    ];
  }
  return serverModels;
}
