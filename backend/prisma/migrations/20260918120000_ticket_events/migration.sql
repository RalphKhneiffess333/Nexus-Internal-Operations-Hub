CREATE TYPE "TicketEventAction" AS ENUM (
    'SUBMISSION',
    'CLAIM',
    'CLOSE',
    'REOPEN',
    'DELETE',
    'MODIFICATION',
    'HANDOFF'
);

CREATE TABLE "ticket_events" (
    "ticket_event_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" "TicketEventAction" NOT NULL,
    "details" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_events_pkey" PRIMARY KEY ("ticket_event_id")
);

CREATE INDEX "ticket_events_ticket_id_created_at_idx"
ON "ticket_events"("ticket_id", "created_at");

CREATE INDEX "ticket_events_created_at_idx"
ON "ticket_events"("created_at");

ALTER TABLE "ticket_events"
ADD CONSTRAINT "ticket_events_ticket_id_fkey"
FOREIGN KEY ("ticket_id") REFERENCES "tickets"("ticket_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ticket_events"
ADD CONSTRAINT "ticket_events_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
ON DELETE RESTRICT ON UPDATE CASCADE;
