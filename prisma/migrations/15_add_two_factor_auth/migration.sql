ALTER TABLE "user"
ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "two_factor_secret" TEXT,
ADD COLUMN "two_factor_recovery_codes" JSONB,
ADD COLUMN "two_factor_challenge" VARCHAR(64);
