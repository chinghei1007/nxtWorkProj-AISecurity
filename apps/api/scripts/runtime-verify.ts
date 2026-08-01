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
      accessTier: "FULL_DEMO",
      expiresAt: null,
    },
  });
  await prisma.user.deleteMany({
    where: {
      usernameNormalized: {
        in: ["verification-user", "verification-batch-active", "verification-batch-expired"],
      },
    },
  });

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

  const batchCreated = await app.inject({
    method: "POST",
    url: "/api/admin/users/batch",
    headers: { cookie, origin },
    payload: {
      rows: [
        {
          clientRowId: "active",
          username: "verification-batch-active",
          role: "USER",
          accessTier: "LIMITED",
        },
        {
          clientRowId: "expired",
          username: "verification-batch-expired",
          temporaryPassword: "ExpiredAccount123!",
          role: "USER",
          accessTier: "FULL_DEMO",
          expiresAt: new Date(Date.now() - 60_000).toISOString(),
        },
      ],
    },
  });
  assert.equal(batchCreated.statusCode, 207);
  assert.deepEqual(batchCreated.json().summary, { requested: 2, created: 2, failed: 0 });
  const activeResult = batchCreated.json().results.find(
    (result: { clientRowId: string }) => result.clientRowId === "active",
  );
  assert.ok(activeResult.temporaryPassword, "Expected a one-time generated password.");

  const expiredLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin },
    payload: { username: "verification-batch-expired", password: "ExpiredAccount123!" },
  });
  assert.equal(expiredLogin.statusCode, 403);
  assert.equal(expiredLogin.json().error.code, "ACCOUNT_EXPIRED");

  const activeLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin },
    payload: {
      username: "verification-batch-active",
      password: activeResult.temporaryPassword,
    },
  });
  assert.equal(activeLogin.statusCode, 200);
  const activeCookie = cookieFrom(activeLogin);

  const expireActive = await app.inject({
    method: "POST",
    url: "/api/admin/users/batch-actions",
    headers: { cookie, origin },
    payload: {
      userIds: [activeResult.user.id],
      action: { type: "SET_EXPIRY", expiresAt: new Date(Date.now() - 60_000).toISOString() },
    },
  });
  assert.equal(expireActive.statusCode, 207);
  assert.equal(expireActive.json().summary.succeeded, 1);

  const existingSessionContinues = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { cookie: activeCookie },
  });
  assert.equal(existingSessionContinues.statusCode, 200);

  const disableActive = await app.inject({
    method: "POST",
    url: "/api/admin/users/batch-actions",
    headers: { cookie, origin },
    payload: {
      userIds: [activeResult.user.id],
      action: { type: "SET_STATUS", status: "DISABLED" },
    },
  });
  assert.equal(disableActive.statusCode, 207);
  const disabledSession = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { cookie: activeCookie },
  });
  assert.equal(disabledSession.statusCode, 401);

  const reenableActive = await app.inject({
    method: "POST",
    url: "/api/admin/users/batch-actions",
    headers: { cookie, origin },
    payload: {
      userIds: [activeResult.user.id],
      action: { type: "SET_STATUS", status: "ACTIVE" },
    },
  });
  assert.equal(reenableActive.statusCode, 207);
  assert.ok(reenableActive.json().results[0].user.expiresAt, "Re-enable must retain expiry.");

  const stillExpiredLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin },
    payload: {
      username: "verification-batch-active",
      password: activeResult.temporaryPassword,
    },
  });
  assert.equal(stillExpiredLogin.statusCode, 403);
  assert.equal(stillExpiredLogin.json().error.code, "ACCOUNT_EXPIRED");

  const filteredUsers = await app.inject({
    method: "GET",
    url: "/api/admin/users?accessTier=LIMITED&effectiveStatus=EXPIRED&page=1&pageSize=50",
    headers: { cookie },
  });
  assert.equal(filteredUsers.statusCode, 200);
  assert.ok(filteredUsers.json().users.some(
    (user: { username: string }) => user.username === "verification-batch-active",
  ));

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
  console.log("- batch registration, generated credentials, filters, and partial-safe actions");
  console.log("- login-only expiry, retained expiry on re-enable, and disable session revocation");
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
        accessTier: "FULL_DEMO",
        expiresAt: null,
      },
    });
  }
  await prisma.user.deleteMany({
    where: {
      usernameNormalized: {
        in: ["verification-user", "verification-batch-active", "verification-batch-expired"],
      },
    },
  });
  await app.close();
  await prisma.$disconnect();
}
