ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "two_factor_secret" TEXT,
ADD COLUMN IF NOT EXISTS "two_factor_recovery_codes" JSONB,
ADD COLUMN IF NOT EXISTS "two_factor_challenge" VARCHAR(64);
