import assert from "node:assert/strict";
import argon2 from "argon2";

if (!process.env.DATABASE_URL?.includes("security_scanner_verify")) {
  throw new Error("Runtime verification must use the isolated security_scanner_verify database.");
}

process.env.NODE_ENV = "test";
process.env.CREDENTIAL_ENCRYPTION_KEY ??= Buffer
  .from("0123456789abcdef0123456789abcdef")
  .toString("base64");

const [{ buildApp }, { prisma }] = await Promise.all([
  import("../src/app.js"),
  import("../src/db.js"),
]);

const app = await buildApp();
const origin = "http://localhost:5173";
const temporaryPassword = process.env.SEED_ADMIN_PASSWORD ?? "Oct0puspass";

function cookieFrom(response: { headers: Record<string, string | string[] | undefined> }) {
  const value = response.headers["set-cookie"];
  const first = Array.isArray(value) ? value[0] : value;
  assert.ok(first, "Expected a session cookie.");
  return first.split(";")[0]!;
}

try {
  const admin = await prisma.user.findUnique({
    where: { usernameNormalized: "chinghei1007" },
  });
  assert.ok(admin, "Seeded administrator is missing.");

  await prisma.session.deleteMany({ where: { userId: admin.id } });
  await prisma.user.update({
    where: { id: admin.id },
    data: {
      passwordHash: await argon2.hash(temporaryPassword, { type: argon2.argon2id }),
      mustChangePassword: true,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  await prisma.user.deleteMany({ where: { usernameNormalized: "verification-user" } });

  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin },
    payload: { username: "chinghei1007", password: temporaryPassword },
  });
  assert.equal(login.statusCode, 200);
  assert.equal(login.json().user.mustChangePassword, true);
  let cookie = cookieFrom(login);

  const blockedBeforeReset = await app.inject({
    method: "GET",
    url: "/api/scans",
    headers: { cookie },
  });
  assert.equal(blockedBeforeReset.statusCode, 403);
  assert.equal(blockedBeforeReset.json().error.code, "PASSWORD_CHANGE_REQUIRED");

  const changed = await app.inject({
    method: "POST",
    url: "/api/account/change-password",
    headers: { cookie, origin },
    payload: {
      currentPassword: temporaryPassword,
      newPassword: "VerificationPass123!",
    },
  });
  assert.equal(changed.statusCode, 200);
  assert.equal(changed.json().user.mustChangePassword, false);
  cookie = cookieFrom(changed);

  const notCode = await app.inject({
    method: "POST",
    url: "/api/scans",
    headers: { cookie, origin },
    payload: { source: "This is ordinary prose and not source code." },
  });
  assert.equal(notCode.statusCode, 422);
  assert.equal(notCode.json().error.code, "NOT_CODE");
  assert.equal(notCode.json().error.message, "Does not seem like code.");

  const created = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers: { cookie, origin },
    payload: {
      username: "verification-user",
      temporaryPassword: "TemporaryPass123!",
      role: "USER",
    },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().user.mustChangePassword, true);

  const lastAdmin = await app.inject({
    method: "PATCH",
    url: "/api/admin/users/" + admin.id,
    headers: { cookie, origin },
    payload: { role: "USER" },
  });
  assert.equal(lastAdmin.statusCode, 409);
  assert.equal(lastAdmin.json().error.code, "LAST_ADMIN");

  const removed = await app.inject({
    method: "DELETE",
    url: "/api/admin/users/" + created.json().user.id,
    headers: { cookie, origin },
  });
  assert.equal(removed.statusCode, 204);

  console.log("Runtime verification passed:");
  console.log("- seeded administrator and forced password reset");
  console.log("- session enforcement and password rotation");
  console.log("- local NOT_CODE rejection before provider inference");
  console.log("- admin user create/delete and last-admin protection");
} finally {
  const admin = await prisma.user.findUnique({
    where: { usernameNormalized: "chinghei1007" },
  });
  if (admin) {
    await prisma.session.deleteMany({ where: { userId: admin.id } });
    await prisma.user.update({
      where: { id: admin.id },
      data: {
        passwordHash: await argon2.hash(temporaryPassword, { type: argon2.argon2id }),
        mustChangePassword: true,
      },
    });
  }
  await prisma.user.deleteMany({ where: { usernameNormalized: "verification-user" } });
  await app.close();
  await prisma.$disconnect();
}
