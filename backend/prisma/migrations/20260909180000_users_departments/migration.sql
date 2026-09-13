CREATE TYPE "UserRole" AS ENUM ('Employee', 'Agent', 'Admin');

CREATE TABLE "identity_providers" (
    "identity_provider_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_providers_pkey" PRIMARY KEY ("identity_provider_id")
);

CREATE TABLE "departments" (
    "department_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("department_id")
);

CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

CREATE TABLE "users" (
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone_number" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'Employee',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "has_logged" BOOLEAN NOT NULL,
    "identity_provider_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

ALTER TABLE "users"
ADD CONSTRAINT "users_identity_provider_id_fkey"
FOREIGN KEY ("identity_provider_id") REFERENCES "identity_providers"("identity_provider_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

DELETE FROM "tickets";

ALTER TABLE "tickets"
ADD CONSTRAINT "tickets_department_id_fkey"
FOREIGN KEY ("department_id") REFERENCES "departments"("department_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tickets"
ADD CONSTRAINT "tickets_submitted_by_fkey"
FOREIGN KEY ("submitted_by") REFERENCES "users"("user_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tickets"
ADD CONSTRAINT "tickets_agent_id_fkey"
FOREIGN KEY ("agent_id") REFERENCES "users"("user_id")
ON DELETE SET NULL ON UPDATE CASCADE;
