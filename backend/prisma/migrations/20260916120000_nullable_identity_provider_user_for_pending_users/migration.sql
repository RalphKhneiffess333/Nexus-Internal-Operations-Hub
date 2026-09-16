ALTER TABLE "users" ALTER COLUMN "identity_provider_user_id" DROP NOT NULL;

UPDATE "users"
SET "identity_provider_user_id" = NULL
WHERE "has_logged" = false;

ALTER TABLE "users"
ADD CONSTRAINT "users_has_logged_identity_provider_user_id_check"
CHECK ("has_logged" = ("identity_provider_user_id" IS NOT NULL));
