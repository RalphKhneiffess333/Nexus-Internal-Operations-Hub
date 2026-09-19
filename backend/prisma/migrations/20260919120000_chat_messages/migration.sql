CREATE TABLE "chat_messages" (
    "message_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("message_id")
);

CREATE INDEX "chat_messages_ticket_id_created_at_idx"
ON "chat_messages"("ticket_id", "created_at");

CREATE INDEX "chat_messages_sender_id_idx"
ON "chat_messages"("sender_id");

ALTER TABLE "chat_messages"
ADD CONSTRAINT "chat_messages_ticket_id_fkey"
FOREIGN KEY ("ticket_id") REFERENCES "tickets"("ticket_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chat_messages"
ADD CONSTRAINT "chat_messages_sender_id_fkey"
FOREIGN KEY ("sender_id") REFERENCES "users"("user_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attachments"
ADD CONSTRAINT "attachments_message_id_fkey"
FOREIGN KEY ("message_id") REFERENCES "chat_messages"("message_id")
ON DELETE SET NULL ON UPDATE CASCADE;
