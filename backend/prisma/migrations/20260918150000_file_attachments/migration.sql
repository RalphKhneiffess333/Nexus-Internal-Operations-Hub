CREATE TABLE "files" (
    "file_id" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("file_id")
);

CREATE UNIQUE INDEX "files_storage_key_key" ON "files"("storage_key");

CREATE INDEX "files_uploaded_by_idx" ON "files"("uploaded_by");

CREATE TABLE "attachments" (
    "attachment_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "event_id" TEXT,
    "message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("attachment_id")
);

CREATE UNIQUE INDEX "attachments_file_id_key" ON "attachments"("file_id");

CREATE INDEX "attachments_event_id_idx" ON "attachments"("event_id");

CREATE INDEX "attachments_message_id_idx" ON "attachments"("message_id");

ALTER TABLE "files"
ADD CONSTRAINT "files_uploaded_by_fkey"
FOREIGN KEY ("uploaded_by") REFERENCES "users"("user_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attachments"
ADD CONSTRAINT "attachments_file_id_fkey"
FOREIGN KEY ("file_id") REFERENCES "files"("file_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attachments"
ADD CONSTRAINT "attachments_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "ticket_events"("ticket_event_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attachments"
ADD CONSTRAINT "attachments_single_resource_check"
CHECK (("event_id" IS NOT NULL) <> ("message_id" IS NOT NULL));
