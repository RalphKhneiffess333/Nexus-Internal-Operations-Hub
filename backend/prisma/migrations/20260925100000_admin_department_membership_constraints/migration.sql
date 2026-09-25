-- The Administration department is a system-owned department. Its ID is stable
-- and is deliberately used here instead of its editable display fields.
-- Repair legacy data before enabling the deferred integrity checks.
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
  "created_at",
  "updated_at"
)
SELECT
  'dept-member-administration-' || "user_id",
  "user_id",
  'dept-administration',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users"
WHERE "role" = 'Admin'
  AND NOT EXISTS (
    SELECT 1
    FROM "department_members" AS existing
    WHERE existing."user_id" = "users"."user_id"
      AND existing."department_id" = 'dept-administration'
  );

CREATE OR REPLACE FUNCTION "enforce_administration_membership"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  affected_user_id TEXT;
  affected_role "UserRole";
BEGIN
  affected_user_id := CASE
    WHEN TG_TABLE_NAME = 'users' THEN NEW."user_id"
    WHEN TG_OP = 'DELETE' THEN OLD."user_id"
    ELSE NEW."user_id"
  END;

  SELECT "role"
  INTO affected_role
  FROM "users"
  WHERE "user_id" = affected_user_id;

  -- A deleted user no longer has a role or membership obligation.
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF affected_role = 'Admin' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "department_members"
      WHERE "user_id" = affected_user_id
        AND "department_id" = 'dept-administration'
    ) THEN
      RAISE EXCEPTION
        'Administrators must belong to the Administration department'
        USING ERRCODE = '23514';
    END IF;
  ELSIF EXISTS (
    SELECT 1
    FROM "department_members"
    WHERE "user_id" = affected_user_id
      AND "department_id" = 'dept-administration'
  ) THEN
    RAISE EXCEPTION
      'Only administrators can belong to the Administration department'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "users_require_administration_membership"
AFTER INSERT OR UPDATE OF "role" ON "users"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "enforce_administration_membership"();

CREATE CONSTRAINT TRIGGER "administration_membership_requires_admin_role"
AFTER INSERT OR UPDATE OF "user_id", "department_id" OR DELETE ON "department_members"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "enforce_administration_membership"();

CREATE OR REPLACE FUNCTION "prevent_administration_department_removal"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."department_id" = 'dept-administration' THEN
    RAISE EXCEPTION
      'The Administration department cannot be deleted or deactivated'
      USING ERRCODE = '23514';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "administration_department_cannot_be_deleted"
BEFORE DELETE ON "departments"
FOR EACH ROW
EXECUTE FUNCTION "prevent_administration_department_removal"();

CREATE TRIGGER "administration_department_cannot_be_deactivated"
BEFORE UPDATE OF "active" ON "departments"
FOR EACH ROW
WHEN (OLD."department_id" = 'dept-administration' AND NEW."active" = false)
EXECUTE FUNCTION "prevent_administration_department_removal"();
