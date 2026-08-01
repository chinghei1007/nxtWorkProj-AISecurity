CREATE TYPE "AccessTier" AS ENUM ('FULL_DEMO', 'LIMITED');

ALTER TABLE "User"
ADD COLUMN "accessTier" "AccessTier" NOT NULL DEFAULT 'FULL_DEMO',
ADD COLUMN "expiresAt" TIMESTAMP(3);

ALTER TABLE "User" ALTER COLUMN "accessTier" SET DEFAULT 'LIMITED';

CREATE INDEX "User_status_expiresAt_idx" ON "User"("status", "expiresAt");
CREATE INDEX "User_role_accessTier_idx" ON "User"("role", "accessTier");
