---
title: "Ticket Events - Nexus"
author: "Ralph Khneiffess"
---

# Task: Implement Ticket Events for Nexus

The current implementation of this workflow is complete. The exact history, attachment, and lifecycle API contract is also summarized in [../api-contract.md](../api-contract.md). This document remains the design and integrity reference for Ticket Events.

You are working in the existing Nexus codebase.

Your task is to implement the **Ticket Events** feature and integrate it into the already-implemented ticket lifecycle.

Ticket Events are the immutable business-domain history of a ticket. They record what happened to a ticket over its lifetime, who performed the action, when it happened, and action-specific details.

Do NOT redesign the project or reimplement existing features. Inspect the current repository first and integrate Ticket Events into the architecture that already exists.

---

# 1. Read the documentation first

Before changing any code, read these files in this order:

1. `docs/product-specs.md`
2. `docs/architecture.md`
3. `docs/data-model.md`

These three files are the authoritative specification for the complete Nexus project.

Then inspect the existing workflow documentation to determine what has **actually already been implemented**.

In particular, inspect all relevant workflow documents such as:

- ticket lifecycle workflow
- database setup workflow
- authentication workflow
- authorization workflow
- later/full-stack workflows

Important distinction:

- `product-specs.md`, `architecture.md`, and `data-model.md` describe the intended complete system.
- Workflow documents describe implementation stages and therefore tell you which parts of the intended architecture currently exist.

Do not assume a feature exists merely because the main documentation describes it.

After reading the documentation, inspect the actual source code to confirm the current state.

The **codebase is the source of truth for implementation state**.

---

# 2. Inspect the existing implementation before coding

Do not begin implementation until you understand the existing ticket lifecycle end-to-end.

At minimum inspect:

- `prisma/schema.prisma`
- existing Prisma migrations
- database/Prisma infrastructure
- Tickets module
- Tickets controller
- Tickets service/application service
- Ticket repository abstraction
- Prisma/PostgreSQL ticket repository implementation
- ticket DTOs
- ticket domain/types/entities
- ticket policies
- authentication/request user context
- authorization decorators/guards
- existing tests
- module dependency structure

Trace the current implementations of:

- ticket submission
- ticket modification
- ticket claiming
- ticket closing
- ticket reopening
- ticket deletion/cancellation
- handoffs, if already implemented

For each operation determine:

1. Where lifecycle validation occurs.
2. Where authorization occurs.
3. Where the authenticated actor comes from.
4. Where database writes occur.
5. Whether the operation already uses a Prisma transaction.
6. Which repository/service owns the write.
7. What data is available at the moment the event needs to be generated.

Preserve the existing architecture.

Do not replace working abstractions merely to make Ticket Events easier to implement.

---

# 3. Ticket Events domain

Ticket Events represent **business-domain ticket history**.

They are NOT the same thing as Audit Logs.

Examples of Ticket Events:

- ticket submitted
- ticket modified
- ticket claimed
- ticket closed
- ticket reopened
- ticket deleted/cancelled
- ticket handoff activity

Audit Logs are for system/security/administrative activity.

Do NOT implement Audit Logs as part of this task.

Do NOT create Ticket Events for unrelated system activity.

---

# 4. Ticket Event persistence model

Implement the Ticket Event persistence model according to `data-model.md`.

Every Ticket Event must contain conceptually:

- unique event ID
- ticket ID
- actor/user ID
- action
- action-specific event details
- created timestamp
- updated timestamp if the project's common schema requires it

Follow the exact ID conventions already used by the project.

Do not invent a different identifier strategy if the existing Prisma models use UUIDs, CUIDs, generated IDs, or another established pattern.

The event must reference:

- the ticket receiving the event
- the user who performed the action

Use proper Prisma relations / foreign keys consistent with the existing schema.

The ticket-to-event relationship is:

Ticket 1:N TicketEvent

A ticket can have many events.

Each TicketEvent belongs to exactly one ticket.

The actor should reference the Nexus User responsible for the action.

---

# 5. Ticket Event actions

Support the Ticket Event action types defined by `data-model.md`:

- `SUBMISSION`
- `CLAIM`
- `CLOSE`
- `REOPEN`
- `DELETE`
- `MODIFICATION`
- `HANDOFF`

Use a Prisma enum if consistent with the existing schema.

Do not represent actions as arbitrary client-provided strings.

The backend controls the event action.

Clients must NEVER be allowed to choose which Ticket Event action gets recorded.

---

# 6. Event details

Each event contains action-specific details.

Persist the event details as JSON/JSONB through Prisma/PostgreSQL unless the existing schema/documentation establishes another representation.

Do not simply use `any` everywhere.

Create strongly typed TypeScript representations for the supported event-detail structures where practical.

Conceptually use a discriminated structure such as:

```ts
type TicketEvent =
  | {
      action: 'SUBMISSION';
      details: SubmissionEventDetails;
    }
  | {
      action: 'CLAIM';
      details: ClaimEventDetails;
    }
  | ...
```

Adapt this to the project's existing conventions rather than forcing this exact shape.

---

# 7. SUBMISSION event

When a ticket is successfully submitted, create:

`SUBMISSION`

Its details must contain the documented submission snapshot:

- title
- target department
- priority
- description
- submitter ID

The important principle is that this event captures the ticket **as it existed when it was submitted**.

Do not reconstruct historical submission information later from the current Ticket row.

For example, if the title later changes:

Ticket current title:
`VPN access issue`

Submission event title:
`Cannot connect remotely`

The submission event must preserve the original title.

The submitter ID must come from the authenticated/server-established ticket submission flow.

Do not trust a frontend-supplied actor identity if authentication has already established the user.

---

# 8. CLAIM event

When a ticket is successfully claimed, create:

`CLAIM`

Details:

- agent ID
- timestamp

Use the authenticated agent who actually performed the successful claim.

Do not accept the event actor or agent identity from arbitrary client input where the server already derives it from authentication.

The event must only be created if the claim actually succeeds.

A failed claim must produce **no CLAIM event**.

This is particularly important for concurrent claims.

---

# 9. CLOSE event

When a ticket is successfully closed, create:

`CLOSE`

Details:

- agent ID
- completion notes

The event must preserve the completion notes.

This is important because Ticket Events are used to retrieve ticket opening/completion notes historically.

The actor must be the authenticated user performing the close operation.

A rejected close operation must not create an event.

---

# 10. REOPEN event

When a ticket is successfully reopened, create:

`REOPEN`

Details:

- priority
- description
- submitter ID

These values represent the ticket/reopening information at the time the ticket was reopened.

Use the actual authenticated actor / ticket owner according to the existing reopen implementation and documented policies.

Do not allow a client to forge the actor stored in the event.

---

# 11. DELETE event

When a ticket is successfully deleted/cancelled through the existing soft-delete lifecycle operation, create:

`DELETE`

Details:

- employee/user who deleted it

Use the authenticated actor.

Nexus tickets are soft deleted; do not physically delete the Ticket row merely because the event is named DELETE.

Preserve the existing soft-delete behavior.

---

# 12. MODIFICATION event

When an allowed ticket modification succeeds, create:

`MODIFICATION`

The event must record the before/after values documented in `data-model.md`:

- old title
- new title
- old target department
- new target department
- old priority
- new priority
- old description
- new description

The old values must come from the persisted ticket before modification.

The new values must reflect the successful resulting ticket state.

Do not generate fake changes for fields that were omitted from a partial update.

If the API supports PATCH semantics, make sure the resulting event accurately represents old versus final values.

Do not derive the "old" values after the update has already overwritten them.

A rejected modification must not create an event.

If the existing application considers a no-op PATCH successful, inspect existing conventions and avoid inventing new lifecycle behavior. Prefer not to create misleading history entries where nothing actually changed unless existing requirements clearly expect an event for every accepted modification request.

---

# 13. HANDOFF event

If handoffs are currently implemented, integrate their lifecycle with Ticket Events.

Use:

`HANDOFF`

Details:

- requester ID
- requested agent ID
- handoff action
- timestamp

Supported handoff actions from the documentation are conceptually:

- `REQUESTED`
- `ACCEPTED`
- `DENIED`
- `CANCELLED`

First inspect the existing handoff implementation and use its established terminology. If the existing implementation uses `REJECTED` rather than `DENIED`, reconcile this with the authoritative documentation and existing database/API conventions instead of blindly creating incompatible duplicate terminology.

Every successful handoff state change should produce the appropriate HANDOFF event.

A rejected/invalid handoff operation must not create an event.

Handoffs are implemented in the current repository, so HANDOFF event integration is active. The conditional guidance below applies only to an earlier repository state in which HandoffRequest did not yet exist.

In that case:

- define the Ticket Event action/type so the schema can support HANDOFF
- leave integration for the future handoff workflow
- document that HANDOFF emission is intentionally not wired because the underlying feature does not yet exist

---

# 14. Ticket Events must be append-only

Ticket Events are immutable history records.

Application code must NOT provide:

- updateTicketEvent()
- deleteTicketEvent()
- PATCH ticket-event endpoint
- DELETE ticket-event endpoint
- arbitrary event replacement

There should be no public CRUD API for manipulating history.

Ticket Events are generated by successful domain operations.

The client must never be allowed to create arbitrary historical events.

Do NOT expose:

`POST /ticket-events`

as a generic endpoint where clients choose an event type/details.

Instead:

```text
ticket lifecycle command
        ↓
validate + authorize
        ↓
perform ticket state transition
        ↓
append corresponding TicketEvent
```

Event creation is an internal consequence of a successful ticket-domain operation.

---

# 15. Transactional integrity — critical requirement

Ticket state and ticket history must never disagree.

Every lifecycle operation that changes the Ticket and creates a TicketEvent must perform both writes atomically.

Conceptually:

```text
BEGIN

update/create Ticket

create TicketEvent

COMMIT
```

If TicketEvent creation fails:

```text
ROLLBACK Ticket change
```

If the Ticket change fails:

```text
no TicketEvent
```

Examples:

### Submission

```text
BEGIN

create ticket
create SUBMISSION event

COMMIT
```

### Claim

```text
BEGIN

atomically claim ticket
create CLAIM event

COMMIT
```

### Modification

```text
BEGIN

read/retain old state as required
update ticket
create MODIFICATION event

COMMIT
```

### Close

```text
BEGIN

close ticket
create CLOSE event

COMMIT
```

### Reopen

```text
BEGIN

reopen ticket
create REOPEN event

COMMIT
```

### Delete

```text
BEGIN

soft-delete ticket
create DELETE event

COMMIT
```

Use Prisma transactions following the existing database architecture.

Do not place transaction management in controllers.

The transaction boundary belongs in the appropriate service/repository/application persistence layer based on the existing project architecture.

---

# 16. Preserve claim concurrency guarantees

The existing ticket claim operation is concurrency-sensitive.

Do NOT weaken its atomic claim semantics while adding events.

Two agents claiming the same ticket concurrently must still result in exactly:

```text
Agent A -> successful claim
           -> one CLAIM event

Agent B -> rejected claim
           -> zero CLAIM events
```

Never produce:

```text
Ticket assigned to Agent A

CLAIM event for Agent A
CLAIM event for Agent B
```

The Ticket update and corresponding CLAIM event must participate in the same successful atomic operation.

Preserve whatever atomic conditional update / row locking / transaction strategy the existing implementation currently uses.

---

# 17. Ticket Events repository/service boundary

Inspect the current project architecture and introduce the smallest appropriate abstraction.

A likely structure could be:

```text
tickets/
  events/
    ticket-event.types.ts
    ticket-events.repository.ts
    prisma-ticket-events.repository.ts
```

or:

```text
ticket-events/
    ticket-events.service.ts
    ticket-events.repository.ts
    ...
```

But DO NOT mechanically create either structure.

First inspect the existing codebase.

Prefer keeping Ticket Events close to the Tickets domain because they represent ticket-domain history.

The important separation is:

```text
Tickets application/service layer
        ↓
Ticket persistence
+
Ticket Event persistence
        ↓
Prisma
        ↓
PostgreSQL
```

Controllers should not directly create Ticket Events.

Policies should not create Ticket Events.

Authorization guards should not create Ticket Events.

---

# 18. Event creation API inside the backend

Provide an internal, strongly typed way for the Tickets application layer to append events.

Conceptually:

```ts
ticketEventsRepository.create({
  ticketId,
  userId,
  action: TicketEventAction.SUBMISSION,
  details,
});
```

or an equivalent abstraction consistent with the project.

Prefer action-specific typing so invalid combinations are difficult to create.

For example, avoid allowing:

```ts
{
  action: 'CLAIM',
  details: {
    completionNotes: '...'
  }
}
```

if reasonable within the existing TypeScript architecture.

Do not overengineer this into an event-sourcing framework.

Nexus is NOT being converted to event sourcing.

The Ticket table remains the source of the current ticket state.

Ticket Events are the immutable historical timeline.

---

# 19. Prisma schema

Extend the existing Prisma schema with the Ticket Event model.

Use naming conventions already present in the codebase.

Conceptually the model requires:

```text
TicketEvent
----------------
id
ticket_id
user_id
action
details JSON
created_at
updated_at
```

with relations to:

```text
Ticket
User
```

Do not blindly copy these exact field names if the existing Prisma schema uses camelCase fields with `@map(...)` or another naming convention.

Follow existing conventions.

Add the inverse relations where Prisma requires them.

---

# 20. Database indexes

Implement the documented indexes:

```text
(ticket_id, created_at)
```

for efficient per-ticket chronological history retrieval.

Also add:

```text
(created_at)
```

for global chronological Ticket Event queries if appropriate to the current implementation/schema.

Do not add speculative indexes unrelated to documented/current queries.

---

# 21. Migration

Create a proper Prisma migration.

Do not manually modify the database.

The migration must reproducibly create:

- Ticket Events table
- action enum/type if required by Prisma/PostgreSQL
- foreign keys
- JSON/JSONB details column
- timestamps
- required indexes

A fresh development database must be able to reach the new schema using the normal project migration process.

Do not destroy existing ticket/user data as part of the migration.

---

# 22. Historical event retrieval

Implement ticket-history retrieval.

The important query is:

> Retrieve the complete event history of a ticket in chronological order.

Use:

```text
ticket_id + created_at
```

and return events ordered chronologically.

Unless the existing API conventions strongly establish descending timelines, use oldest → newest so the result represents the ticket lifecycle naturally.

Ordering should be deterministic. If two events could theoretically share the same timestamp, use a stable secondary ordering such as the event ID if appropriate.

---

# 23. Ticket history endpoint

Inspect the existing Tickets controller conventions.

Add a ticket-owned history endpoint consistent with the API structure.

Implemented route:

```http
GET /tickets/:id/events?page=1&pageSize=50
```

Do not create a generic administrative Ticket Events CRUD controller.

The endpoint should retrieve the history of a specific ticket.

Use the existing authentication and authorization architecture.

At the endpoint level, use the existing role metadata conventions.

At the resource level, viewing a ticket's history should follow the same visibility/access rules as viewing that ticket unless product specifications explicitly say otherwise.

Conceptually:

```text
GET /tickets/:id/events?page=1&pageSize=50
        ↓
Authentication
        ↓
Role authorization
        ↓
Tickets module
        ↓
ViewTicket/resource policy
        ↓
Ticket Events repository
        ↓
chronological events
```

Do NOT duplicate ticket-visibility rules inside the Ticket Events repository.

Do NOT put ticket-specific resource authorization inside the central Authorization module.

Reuse the existing ticket viewing policy/authorization behavior where possible.

Additionally, in the returned response containing ticket events, each event should have its id.
Each individual event can also be viewed through its id specific endpoint inside its authorization and authenticated boundaries of course.

---

# 24. Do not expose sensitive/internal information unnecessarily

The history response should contain domain information needed by the Nexus UI.

Do not expose:

- Prisma internals
- raw database objects if the application normally maps responses
- database errors
- authentication/session information
- Microsoft identity-provider tokens
- unrelated User information

If relations are included, expose only the information consistent with existing API patterns.

Do not accidentally serialize entire User entities merely because a TicketEvent has a user relation.

---

# 25. Existing tickets

There may already be Ticket rows created before Ticket Events existed.

Do NOT fabricate historical events for old tickets unless there is reliable historical data available.

Do not create fake SUBMISSION timestamps/details by pretending the current Ticket state necessarily equals the original state.

Existing tickets may therefore initially have an empty or incomplete event history.

If a safe migration/backfill is obvious from actual existing data and explicitly justified, document it before doing it. Otherwise do not backfill fabricated history.

New lifecycle actions after this implementation must be recorded correctly.

---

# 26. Event details validation

Although details are stored as JSON, the application must control their shape.

The frontend/client must not send an arbitrary TicketEvent details object.

Event details should be constructed server-side from:

- validated lifecycle DTOs
- authenticated actor
- existing Ticket state
- successful resulting Ticket state

For example:

```text
PATCH ticket
        ↓
validated UpdateTicketDto
        +
existing ticket
        +
authenticated user
        ↓
server constructs MODIFICATION details
```

Do not accept:

```json
{
  "event": {
    "action": "MODIFICATION",
    "details": { "...": "..." }
  }
}
```

from clients.

The summary request has no body and returns a pagination envelope:
`GET /tickets/:id/events?page=1&pageSize=50`
```json
{
  "items": [
    {
      "ticketEventId": "event-uuid",
      "ticketId": "ticket-uuid",
      "action": "CLAIM",
      "createdAt": "2026-09-18T10:00:00.000Z",
      "updatedAt": "2026-09-18T10:00:00.000Z",
      "hasAttachments": false
    }
  ],
  "page": 1,
  "pageSize": 50,
  "hasMore": false
}
```

The summary endpoint intentionally does not return full `user` or `details` objects. Use the event-specific endpoint for the complete event.

`GET /tickets/:id/events/:eventId` with no body, response:
```json
{
  "ticketEventId": "event-uuid",
  "ticketId": "ticket-uuid",
  "action": "CLAIM",
  "user": {
    "userId": "user-uuid",
    "fullName": "IT Agent 1",
    "email": "jordan@company.com",
    "role": "Agent"
  },
  "details": {
    "agent": {
      "userId": "user-uuid",
      "fullName": "IT Agent 1",
      "email": "jordan@company.com",
      "role": "Agent"
    },
    "timestamp": "2026-09-18T10:00:00.000Z"
  },
  "attachments": [],
  "createdAt": "2026-09-18T10:00:00.000Z",
  "updatedAt": "2026-09-18T10:00:00.000Z"
}
```
---

# 27. Error handling

Follow the application's existing NestJS error conventions.

Database errors must not leak raw Prisma/PostgreSQL details.

If event persistence fails during a lifecycle transaction:

- rollback the lifecycle operation
- return the appropriate application/server error

Do not silently swallow event persistence errors.

History is part of the integrity of the ticket lifecycle.

A ticket mutation must not be reported as successful when its required history record failed.

---

# 28. Testing

Add thorough automated tests.

Do not consider the feature complete merely because Prisma migration succeeds.

At minimum test the following.

## Submission

Successful ticket submission:

```text
Ticket created
+
exactly one SUBMISSION event
```

Verify:

- correct ticket ID
- correct actor
- correct title
- correct department
- correct priority
- correct description
- correct submitter ID

## Claim

Successful claim:

```text
ticket -> CLAIMED
+
exactly one CLAIM event
```

Failed claim:

```text
no CLAIM event
```

Concurrent claim attempts:

```text
exactly one succeeds
exactly one CLAIM event exists
```

## Modification

Successful modification creates one MODIFICATION event.

Verify old and new values.

Test partial updates.

Ensure unchanged/omitted fields are represented correctly according to the chosen event contract.

Rejected modification must produce no event.

## Close

Successful close creates CLOSE event containing:

- actor/agent
- completion notes

Rejected close creates no event.

## Reopen

Successful reopen creates REOPEN event with the documented snapshot.

Rejected reopen creates no event.

## Delete/cancel

Successful soft deletion creates DELETE event.

Ticket remains stored according to the existing soft-delete design.

Rejected deletion creates no event.

## Handoff

- request creates HANDOFF/REQUESTED
- acceptance creates HANDOFF/ACCEPTED
- rejection creates corresponding event
- cancellation creates HANDOFF/CANCELLED
- invalid transitions create no event

If handoffs do not exist, do not implement these integration tests yet.

## History retrieval

Given:

```text
SUBMISSION
MODIFICATION
CLAIM
CLOSE
REOPEN
CLAIM
CLOSE
```

history retrieval must return all persisted events in deterministic chronological order.

## Authorization

Test that users who cannot view a ticket cannot bypass that restriction using:

```http
GET /tickets/:id/events?page=1&pageSize=50
```

Test the roles/resources according to the actual existing authorization implementation.

## Immutability

Verify there is no API path for clients to:

- create arbitrary events
- modify events
- delete events

## Transaction rollback

Explicitly test transaction integrity where practical.

Simulate/fake TicketEvent persistence failure and verify the corresponding ticket mutation does not remain committed.

---

# 29. Review all existing ticket lifecycle paths

Do a repository-wide search for every place that changes Ticket state.

Do not assume the controller methods you initially find are the only mutation paths.

Search for operations involving:

```text
status
agentId
active
priority
departmentId
title
description
completionNotes
claim
close
reopen
cancel
delete
modify
update
handoff
```

Every legitimate ticket-domain lifecycle mutation covered by the documented Ticket Event types should create its event exactly once.

Avoid duplicate event creation.

There should be one authoritative integration point per successful operation.

---

# 30. Avoid duplicate history events

Pay special attention to service/repository layering.

Do not accidentally do:

```text
controller creates event
service creates event
repository creates event
```

which produces duplicates.

Choose one clear architectural ownership point.

Prefer the application/service transaction orchestration layer, adapted to how the current codebase already handles transactions.

A single successful domain action must produce exactly one corresponding event unless the action inherently represents multiple documented events.

---

# 31. Do not change existing lifecycle behavior

Ticket Events are an observability/history addition to the existing lifecycle.

Do NOT alter existing rules merely to make event recording easier.

Preserve the documented/current ticket invariants, including:

- priorities are LOW, MODERATE, HIGH
- lifecycle semantics
- claimed-ticket agent rules
- department restrictions
- modification/deletion restrictions
- soft deletion
- authorization rules
- concurrency-safe claiming

Existing ticket APIs should remain backward compatible unless a change is strictly necessary.

---

# 32. Keep scope bounded

Do NOT implement unrelated future functionality.

Specifically do NOT implement as part of this task:

- Audit Logs
- file attachments
- file storage
- chat
- WebSockets
- notifications
- email
- analytics
- AI
- additional identity providers
- new administration functionality
- event sourcing
- CQRS
- Kafka
- RabbitMQ
- Redis
- generic event bus infrastructure
- generic system-wide event framework

If one of these features already exists, do not remove or redesign it. Simply avoid expanding it unnecessarily.

Ticket Events should remain a small, understandable feature.

---

# 33. File attachments were outside the original event workflow

The complete data model allows Attachments to reference Ticket Events, particularly for ticket opening and completion notes.

This exclusion applied when the Ticket Events workflow was originally written. File attachments are now implemented in the current repository and are integrated with ticket lifecycle events. Their current routes and metadata are documented in [../api-contract.md](../api-contract.md).

Ticket Events still must not place file bytes or storage paths in event JSON; attachment metadata is exposed through the mapped event response and files are downloaded through authorized nested routes.

---

# 34. Documentation/code comments

Use comments only where they clarify non-obvious behavior, especially:

- why lifecycle + event writes share a transaction
- why Ticket Events are append-only
- why historical event details are snapshots rather than reconstructed from Ticket
- concurrency-sensitive claim behavior

Do not fill straightforward code with explanatory comments.

---

# 35. Verification

After implementation run all relevant project checks.

At minimum:

```bash
npm run build
```

and the project's existing:

- test command
- lint command, if configured
- Prisma validation/generation
- migration verification

Run the actual commands defined by `package.json`; do not assume script names.

Verify:

- Prisma schema validates
- Prisma Client generates
- migration succeeds
- backend starts
- existing tests still pass
- new Ticket Event tests pass
- existing ticket lifecycle endpoints still behave the same
- ticket history endpoint works
- lifecycle mutations create exactly one correct event
- failed lifecycle mutations create zero events
- transaction rollback preserves consistency
- concurrent claim behavior remains safe

---

# 36. Final architecture

The resulting architecture should remain approximately:

```text
HTTP Request
      ↓
Authentication
      ↓
Authorization
      ↓
Tickets Controller
      ↓
Tickets Service / Application Layer
      ↓
Ticket resource/lifecycle policies
      ↓
Transactional persistence orchestration
      ↓
┌─────────────────────┐
│ Ticket Repository   │
│ TicketEvent Repo    │
└─────────────────────┘
      ↓
Prisma
      ↓
PostgreSQL
```

For history reads:

```text
GET /tickets/:id/events?page=1&pageSize=50
      ↓
Authentication
      ↓
Role authorization
      ↓
Ticket visibility/resource policy
      ↓
TicketEvent repository
      ↓
PostgreSQL
```

Ticket Events must not bypass the existing authentication/authorization model.

---

# 37. Important design principles

Keep these principles throughout the implementation:

### Ticket table = current state

The Ticket row answers:

> What is the ticket's state now?

### Ticket Events = historical state/actions

Ticket Events answer:

> What happened to this ticket over time?

Do NOT calculate the current Ticket state by replaying Ticket Events.

This project is not event sourced.

### Events are server generated

Clients request domain operations.

They do not create history.

Correct:

```text
POST /tickets/:id/close
        ↓
server closes ticket
        ↓
server creates CLOSE event
```

Incorrect:

```text
POST /ticket-events
{
  "action": "CLOSE"
}
```

### History must be trustworthy

A successful ticket mutation without its corresponding event is an integrity failure.

Therefore:

```text
Ticket mutation + TicketEvent creation
```

must be atomic.

---

# 38. Definition of Done

This task is complete when:

- A TicketEvent persistence model exists.
- TicketEvent actions are represented safely.
- Event details use JSON/JSONB with server-controlled typed structures.
- Proper Ticket and User relations exist.
- Prisma migration exists and succeeds.
- `(ticket_id, created_at)` is indexed.
- Ticket submission creates SUBMISSION.
- Ticket claim creates CLAIM.
- Ticket close creates CLOSE.
- Ticket reopen creates REOPEN.
- Ticket soft deletion creates DELETE.
- Ticket modification creates MODIFICATION.
- Handoff events are integrated only if handoffs already exist.
- Ticket mutations and their events are committed atomically.
- Failed mutations produce no events.
- Failed event persistence rolls back its corresponding ticket mutation.
- Concurrent claims still produce only one successful claim and one CLAIM event.
- Ticket history can be retrieved chronologically.
- Ticket history access uses the existing ticket authorization/resource policy.
- Clients cannot create arbitrary Ticket Events.
- Clients cannot modify Ticket Events.
- Clients cannot delete Ticket Events.
- Existing ticket lifecycle behavior remains intact.
- Existing tests still pass.
- New Ticket Event tests pass.
- Build succeeds.
- No unrelated features were introduced.

---

# 39. Before coding, produce a short implementation plan

After inspecting the repository but before modifying files, briefly state:

1. Current ticket architecture discovered.
2. Current Prisma models relevant to this feature.
3. Which ticket lifecycle operations already exist.
4. Which operations already use transactions.
5. Whether handoffs currently exist.
6. Where TicketEvent persistence will live.
7. Where transaction orchestration will live.
8. Which files you expect to modify/create.
9. Any discrepancies between documentation and current code.

Then implement the feature.

Do not stop after the plan unless a genuine blocking ambiguity makes implementation unsafe.

---

# 40. Final report

When finished, provide a concise implementation report containing:

- files created
- files modified
- Prisma schema/migration changes
- Ticket Event types implemented
- lifecycle operations integrated
- history endpoint added
- transaction strategy used
- authorization integration
- tests added/updated
- commands executed and their results
- any intentionally deferred behavior, especially HANDOFF or attachments
- any documentation/code discrepancy discovered

Do not claim something works unless you actually verified it.
