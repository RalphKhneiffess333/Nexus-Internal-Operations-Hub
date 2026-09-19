CREATE TABLE "chat_read_receipts" (
    "ticket_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "last_read_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_read_receipts_pkey" PRIMARY KEY ("ticket_id", "user_id")
);

CREATE INDEX "chat_read_receipts_user_id_last_read_at_idx"
ON "chat_read_receipts"("user_id", "last_read_at");

ALTER TABLE "chat_read_receipts"
ADD CONSTRAINT "chat_read_receipts_ticket_id_fkey"
FOREIGN KEY ("ticket_id") REFERENCES "tickets"("ticket_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chat_read_receipts"
ADD CONSTRAINT "chat_read_receipts_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
ON DELETE RESTRICT ON UPDATE CASCADE;
