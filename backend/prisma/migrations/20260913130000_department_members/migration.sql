CREATE TABLE "department_members" (
    "department_member_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_members_pkey" PRIMARY KEY ("department_member_id")
);

CREATE UNIQUE INDEX "department_members_user_id_department_id_key"
ON "department_members"("user_id", "department_id");

CREATE INDEX "department_members_department_id_idx"
ON "department_members"("department_id");

ALTER TABLE "department_members"
ADD CONSTRAINT "department_members_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "department_members"
ADD CONSTRAINT "department_members_department_id_fkey"
FOREIGN KEY ("department_id") REFERENCES "departments"("department_id")
ON DELETE RESTRICT ON UPDATE CASCADE;
