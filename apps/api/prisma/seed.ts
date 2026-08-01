import { existsSync } from "node:fs";
import { resolve } from "node:path";
import argon2 from "argon2";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

for (const candidate of [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
]) {
  if (existsSync(candidate)) {
    loadEnv({ path: candidate, quiet: true });
    break;
  }
}

const prisma = new PrismaClient();

const username = process.env.SEED_ADMIN_USERNAME ?? "chinghei1007";
const password = process.env.SEED_ADMIN_PASSWORD ?? "Oct0puspass";

try {
  const existing = await prisma.user.findUnique({
    where: { usernameNormalized: username.toLowerCase() },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        username,
        usernameNormalized: username.toLowerCase(),
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        role: "ADMIN",
        accessTier: "FULL_DEMO",
        expiresAt: null,
        mustChangePassword: true,
      },
    });
    console.log(`Seeded administrator: ${username}`);
  } else {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: "ADMIN", status: "ACTIVE", accessTier: "FULL_DEMO", expiresAt: null },
    });
    console.log(`Administrator already exists: ${username}`);
  }
} finally {
  await prisma.$disconnect();
}
