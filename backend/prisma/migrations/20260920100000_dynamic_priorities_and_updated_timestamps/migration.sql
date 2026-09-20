CREATE TABLE "priorities" (
    "priority_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reminder_interval_minutes" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "priorities_pkey" PRIMARY KEY ("priority_id")
);

ALTER TYPE "AuditAction" ADD VALUE 'PRIORITY_ADDITION';
ALTER TYPE "AuditAction" ADD VALUE 'PRIORITY_MODIFICATION';
ALTER TYPE "AuditAction" ADD VALUE 'PRIORITY_DELETION';
ALTER TYPE "AuditAction" ADD VALUE 'PRIORITY_REACTIVATION';

CREATE UNIQUE INDEX "priorities_code_key" ON "priorities"("code");
CREATE INDEX "priorities_active_idx" ON "priorities"("active");

INSERT INTO "priorities" (
    "priority_id",
    "code",
    "name",
    "reminder_interval_minutes",
    "active"
)
VALUES
    (
        'priority-low',
        'LOW',
        'Low',
        COALESCE((
            SELECT CASE
                WHEN "value" ~ '^[0-9]+$' THEN "value"::integer
                ELSE 240
            END
            FROM "system_configurations"
            WHERE "key" = 'REMINDER_INTERVAL_LOW_MINUTES'
        ), 240),
        true
    ),
    (
        'priority-moderate',
        'MODERATE',
        'Moderate',
        COALESCE((
            SELECT CASE
                WHEN "value" ~ '^[0-9]+$' THEN "value"::integer
                ELSE 240
            END
            FROM "system_configurations"
            WHERE "key" = 'REMINDER_INTERVAL_MODERATE_MINUTES'
        ), 240),
        true
    ),
    (
        'priority-high',
        'HIGH',
        'High',
        COALESCE((
            SELECT CASE
                WHEN "value" ~ '^[0-9]+$' THEN "value"::integer
                ELSE 240
            END
            FROM "system_configurations"
            WHERE "key" = 'REMINDER_INTERVAL_HIGH_MINUTES'
        ), 240),
        true
    );

ALTER TABLE "tickets" ADD COLUMN "priority_text" TEXT;
UPDATE "tickets" SET "priority_text" = "priority"::text;
ALTER TABLE "tickets" DROP COLUMN "priority";
ALTER TABLE "tickets" RENAME COLUMN "priority_text" TO "priority";
ALTER TABLE "tickets" ALTER COLUMN "priority" SET NOT NULL;
DROP TYPE "TicketPriority";

ALTER TABLE "tickets"
ADD CONSTRAINT "tickets_priority_fkey"
FOREIGN KEY ("priority") REFERENCES "priorities"("code")
ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "identity_providers"
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "department_members"
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "chat_read_receipts"
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "audit_logs"
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
