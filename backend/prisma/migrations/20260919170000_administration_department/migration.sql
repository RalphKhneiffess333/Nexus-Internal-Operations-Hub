INSERT INTO "departments" (
    "department_id",
    "code",
    "name",
    "desc",
    "active",
    "created_at",
    "updated_at"
)
VALUES (
    'dept-administration',
    'ADMINISTRATION',
    'Administration',
    'Requests submitted to Nexus administrators',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("department_id") DO UPDATE
SET
    "code" = 'ADMINISTRATION',
    "name" = 'Administration',
    "desc" = 'Requests submitted to Nexus administrators',
    "active" = true,
    "updated_at" = CURRENT_TIMESTAMP;

DELETE FROM "department_members"
WHERE "department_id" = 'dept-administration'
  AND "user_id" IN (
    SELECT "user_id"
    FROM "users"
    WHERE "role" <> 'Admin'
  );

INSERT INTO "department_members" (
    "department_member_id",
    "user_id",
    "department_id",
    "created_at"
)
SELECT
    'dept-member-administration-' || "user_id",
    "user_id",
    'dept-administration',
    CURRENT_TIMESTAMP
FROM "users"
WHERE "role" = 'Admin'
  AND NOT EXISTS (
    SELECT 1
    FROM "department_members" AS existing
    WHERE existing."user_id" = "users"."user_id"
      AND existing."department_id" = 'dept-administration'
  );
