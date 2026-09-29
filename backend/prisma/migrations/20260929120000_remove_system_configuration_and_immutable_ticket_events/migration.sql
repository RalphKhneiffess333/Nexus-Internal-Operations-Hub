DROP TABLE IF EXISTS "system_configurations";

CREATE OR REPLACE FUNCTION prevent_ticket_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'ticket events are immutable';
END;
$$;

CREATE TRIGGER ticket_events_immutable
BEFORE UPDATE OR DELETE ON "ticket_events"
FOR EACH ROW EXECUTE FUNCTION prevent_ticket_event_mutation();
