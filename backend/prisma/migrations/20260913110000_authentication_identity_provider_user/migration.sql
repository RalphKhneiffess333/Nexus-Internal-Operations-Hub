ALTER TABLE "users" ADD COLUMN "identity_provider_user_id" TEXT;

UPDATE "users"
SET "identity_provider_user_id" = "user_id"
WHERE "identity_provider_user_id" IS NULL;

ALTER TABLE "users" ALTER COLUMN "identity_provider_user_id" SET NOT NULL;

CREATE UNIQUE INDEX "users_identity_provider_id_identity_provider_user_id_key"
ON "users"("identity_provider_id", "identity_provider_user_id");
