CREATE TYPE "AuditAction" AS ENUM (
    'USER_PREPROVISIONING',
    'ROLE_MAPPING',
    'USER_ACTIVATION',
    'USER_DEACTIVATION',
    'DEPARTMENT_ADDITION',
    'DEPARTMENT_MODIFICATION',
    'DEPARTMENT_DELETION',
    'DEPARTMENT_REACTIVATION',
    'DEPARTMENT_MAPPING',
    'SYSTEM_VARIABLE_MODIFICATION'
);

CREATE TABLE "system_configurations" (
    "configuration_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "system_configurations_pkey" PRIMARY KEY ("configuration_id")
);

CREATE UNIQUE INDEX "system_configurations_key_key" ON "system_configurations"("key");

CREATE TABLE "audit_logs" (
    "audit_log_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actor_id" TEXT,
    "details" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("audit_log_id")
);

CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "users"("user_id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit logs are immutable';
END;
$$;

CREATE TRIGGER audit_logs_immutable
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
