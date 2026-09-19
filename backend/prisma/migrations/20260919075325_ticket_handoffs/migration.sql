-- CreateEnum
CREATE TYPE "HandoffStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "handoff_requests" (
    "handoff_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "requested_agent_id" TEXT NOT NULL,
    "status" "HandoffStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "handoff_requests_pkey" PRIMARY KEY ("handoff_id")
);

-- CreateIndex
CREATE INDEX "handoff_requests_ticket_id_status_idx" ON "handoff_requests"("ticket_id", "status");

-- CreateIndex
CREATE INDEX "handoff_requests_requested_agent_id_status_idx" ON "handoff_requests"("requested_agent_id", "status");

-- CreateIndex
CREATE INDEX "handoff_requests_requester_id_status_idx" ON "handoff_requests"("requester_id", "status");

-- CreateIndex
CREATE INDEX "handoff_requests_created_at_idx" ON "handoff_requests"("created_at");

-- Prevent duplicate pending proposals while allowing historical requests after resolution.
CREATE UNIQUE INDEX "handoff_requests_pending_pair_key"
ON "handoff_requests"("ticket_id", "requester_id", "requested_agent_id")
WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "handoff_requests" ADD CONSTRAINT "handoff_requests_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("ticket_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoff_requests" ADD CONSTRAINT "handoff_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoff_requests" ADD CONSTRAINT "handoff_requests_requested_agent_id_fkey" FOREIGN KEY ("requested_agent_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
