CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MODERATE', 'HIGH');

CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'CLAIMED', 'CLOSED', 'REOPENED');

CREATE SEQUENCE ticket_code_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE "tickets" (
    "ticket_id" TEXT NOT NULL,
    "ticket_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "department_id" TEXT NOT NULL,
    "submitted_by" TEXT NOT NULL,
    "agent_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "completion_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("ticket_id")
);

CREATE UNIQUE INDEX "tickets_ticket_code_key" ON "tickets"("ticket_code");

CREATE INDEX "tickets_submitted_by_idx" ON "tickets"("submitted_by");

CREATE INDEX "tickets_department_id_idx" ON "tickets"("department_id");

CREATE INDEX "tickets_agent_id_idx" ON "tickets"("agent_id");

CREATE INDEX "tickets_status_idx" ON "tickets"("status");

CREATE INDEX "tickets_department_id_status_created_at_idx" ON "tickets"("department_id", "status", "created_at");
