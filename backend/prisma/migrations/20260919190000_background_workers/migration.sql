ALTER TABLE "tickets"
ADD COLUMN "unclaimed_since" TIMESTAMP(3),
ADD COLUMN "last_reminder_at" TIMESTAMP(3);

UPDATE "tickets"
SET "unclaimed_since" = "created_at"
WHERE "active" = true
  AND "agent_id" IS NULL
  AND "status" IN ('OPEN', 'REOPENED');

CREATE INDEX "tickets_status_agent_id_unclaimed_since_idx"
ON "tickets"("status", "agent_id", "unclaimed_since");

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE'
       AND OLD."created_at" < CURRENT_TIMESTAMP - INTERVAL '2 years'
       AND current_setting('nexus.audit_cleanup', true) = 'on' THEN
        RETURN OLD;
    END IF;

    RAISE EXCEPTION 'audit logs are immutable';
END;
$$;
