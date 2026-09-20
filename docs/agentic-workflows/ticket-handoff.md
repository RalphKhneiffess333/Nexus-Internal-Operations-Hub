---
title: "Ticket Handoff - Nexus"
author: "Ralph Khneiffess"
---
# Task: Implement Complete Ticket Handoff Functionality in Nexus

The handoff feature is implemented. The exact current routes, query parameters, and response envelopes are maintained in [../api-contract.md](../api-contract.md). This document remains the design and integrity reference for handoffs.

You are working in the existing **Nexus** codebase, a NestJS/Prisma/PostgreSQL backend with a React frontend.

Employee and agent ticket lifecycle functionality already exists. Implement the complete ticket handoff/delegation feature described by the Nexus documentation and integrate it into the existing ticket, authorization, Ticket Events, department-membership, notification, and frontend architectures.

Do not redesign Nexus or reimplement existing ticket lifecycle behavior. Inspect the real repository first and adapt this specification to its current models, names, routes, DTOs, repositories, policies, event architecture, error conventions, frontend patterns, and tests.

The operation must be safe under concurrent requests. A handoff is a proposal, not an immediate transfer. The target agent must explicitly accept it before the ticket's current agent changes.

---

## 1. Read the documentation first

Read these authoritative documents in order:

1. `docs/product-specs.md`
2. `docs/architecture.md`
3. `docs/data-model.md`

Then read all relevant workflow documents, including:

- `docs/ticket-events.md`
- ticket lifecycle/interface documentation
- authorization workflow
- authentication workflow
- database setup workflow
- full-stack delivery/workflow documentation
- department/user/admin documentation, if present
- repository instructions (`AGENTS.md`, README files, and package scripts)

Interpret the documents as follows:

- Product specs, architecture, and data model define intended Nexus behavior.
- Workflow documents describe implementation stages and may explicitly say handoffs were deferred.
- The user has now explicitly requested handoff implementation, so handoff is in scope even if an earlier workflow marked it out of scope.
- Existing source code is the final source of truth for what already exists.
- If documentation and code differ, preserve valid existing behavior, choose the smallest compatible change, and report the discrepancy.

Do not assume a Handoff model, endpoint, event, policy, or UI exists merely because documentation mentions it.

---

## 2. Mandatory repository inspection before edits

Do not begin coding until the complete current flow is understood.

### Backend

Inspect at minimum:

- `prisma/schema.prisma` and every migration
- Prisma service/database transaction helpers
- Tickets module/controller/service/application service
- ticket repository abstraction and Prisma repository
- ticket domain models, DTOs, status enums, and response mappers
- claim, close, reopen, cancellation/deletion, and modification flows
- ticket lifecycle policies
- department and department-membership models/services/repositories
- user role, active status, identity, and department eligibility behavior
- authentication guard and authenticated `request.user` shape
- authorization decorators/guards and explicit role metadata
- ticket resource authorization policies
- Ticket Events enum/model/repository/service and history retrieval
- error handling, validation, pagination, filtering, and ID conventions
- existing integration, API E2E, browser E2E, and concurrency tests

### Frontend

Inspect at minimum:

- application shell and navigation
- authenticated user/role state
- ticket list and ticket details pages
- agent ticket pool/claimed-ticket UI
- existing action buttons and server-returned permissions
- API client and API types
- dialogs/forms/confirmation patterns
- notifications/toasts/error presentation
- cache/state invalidation conventions
- browser E2E setup and agent workflow tests

### Trace current behavior

Determine and document:

1. The actual Ticket, User, Department, DepartmentMember, TicketEvent models.
2. Whether a HandoffRequest model/table already exists, even partially.
3. Whether handoff routes or UI already exist.
4. How a ticket's current assigned agent is stored.
5. How claim updates are made atomic and concurrency-safe.
6. What status values are used (`OPEN`, `CLAIMED`, `CLOSED`, `REOPENED`, or project-specific casing).
7. How department membership and role eligibility are checked.
8. How the authenticated actor is derived; never accept requester identity from the client.
9. How ticket events are created transactionally and how their details are serialized.
10. Whether `HANDOFF` is already an event action and whether handoff actions use `DENIED` or `REJECTED`.
11. How ticket history is authorized and retrieved.
12. What happens when an agent leaves a department, is deactivated, or loses agent role.
13. What happens to pending operations when a ticket closes, is cancelled, or changes department.

Do not implement duplicate lifecycle paths or a second source of truth for ticket assignment.

---

## 3. Authoritative handoff behavior

Nexus handoff means:

```text
current assigned agent proposes transfer
        ↓
pending request is sent to another eligible agent
        ↓
requested agent accepts or rejects
        ↓
only acceptance transfers current ticket ownership
```

The documented handoff states are:

- `PENDING`: waiting for the requested agent to accept or reject
- `ACCEPTED`: requested agent accepted and became current ticket agent
- `REJECTED`: requested agent denied the proposal
- `CANCELLED`: requester or system cancelled the proposal

The documentation sometimes uses `DENIED` for the HANDOFF Ticket Event action and `REJECTED` for the HandoffRequest status. Inspect existing terminology and use one coherent persisted/API convention. If the current schema already uses `DENIED`, preserve it; otherwise prefer `REJECTED` for request status and map the event action consistently, documenting the choice.

### Core invariants

Enforce these on the server and, where possible, with database constraints:

1. Requester and requested agent must be different users.
2. Requester must be the ticket's current assigned agent.
3. Both users must be eligible agents/admins under the existing role policy.
4. Both users must belong to the ticket's department at the time of request.
5. A handoff can be created only for a `CLAIMED` ticket.
6. The requested agent must be an eligible member of the same department.
7. A request can transition only from `PENDING`.
8. Only the requested agent can accept or reject a pending request.
9. Only the requester can cancel a pending request, unless a documented system lifecycle rule cancels it automatically. (Ticket was closed, ticket handoff was accepted by another agent, requested agent got removed from the department,...)
10. Acceptance is valid only while the ticket is still `CLAIMED` and its current agent is still the requester.
11. Rejection and cancellation never change the ticket's current agent.
12. Acceptance changes the ticket's current agent to the requested agent while keeping the ticket `CLAIMED`.
13. No handoff may be accepted for an `OPEN`, `REOPENED`, `CLOSED`, cancelled, or inactive ticket.
14. Invalid or unauthorized operations create no state change and no successful handoff event.
15. Every successful handoff state change creates exactly one immutable `HANDOFF` TicketEvent.
16. A client cannot choose event action, actor, requester, or transition result.
17. Two handoff requests cannot be sent for the same requester and requested agent simultaneously
18. Handoff messages are optional

The current agent remains responsible for the ticket until acceptance. Request creation must not clear or change `Ticket.agentId`.

---

## 4. Handoff request persistence model

If no model exists, add a Prisma model following current naming, ID, timestamp, and soft-deletion conventions. Conceptually it contains:

- unique `handoffId`
- `ticketId` foreign key
- `requesterId` foreign key to User
- `requestedId` foreign key to User
- `status` enum
- `message` optional string
- `createdAt`
- `updatedAt` if common project convention requires it
- `dateResolved`/`resolvedAt` nullable timestamp for terminal states

Use explicit relations for the ticket, requester, and requested agent. Avoid ambiguous Prisma relation names.

The model must support multiple handoff requests for one ticket as required by the data model. Do not add a unique constraint that allows only one historical request per ticket.

At the same time, prevent meaningless duplicates according to actual product interpretation. A conservative default is to reject a second `PENDING` request from the same requester to the same requested agent for the same ticket while allowing historical requests after rejection/cancellation/acceptance. If PostgreSQL partial unique indexes are needed, create them in a migration and document the decision. If the current codebase has a different established convention, follow it and report it.

Use foreign-key delete behavior that preserves ticket/user history. Do not hard-delete users or tickets merely because a handoff references them.

Add indexes based on actual query patterns, likely:

- `(ticketId, status)` for pending requests on a ticket
- `(requestedId, status)` for the target agent's inbox
- `(requesterId, status)` for the requester's outgoing requests
- `(createdAt)` or equivalent for ordering/history if needed

Do not add meaningless indexes.

---

## 5. API operations

The implementation uses the existing Tickets and Handoffs module boundaries. The following are the actual routes:

```http
POST /tickets/:id/handoffs
```

Create a pending handoff.

Request body conceptually:

```json
{
  "requestedAgentId": "...",
  "message": "..."
}
```

The requester is derived from `request.user`, never accepted as a body field.

```http
GET /handoffs?direction=all&page=1&pageSize=25
```

List handoff requests. `direction` may be `all`, `incoming`, or `outgoing`.

```http
GET /tickets/:id/handoffs
```

List handoffs for a ticket only if the caller can view the ticket and is authorized to see its handoff information according to the resource policy.

```http
GET /handoffs?direction=incoming
GET /handoffs?direction=outgoing
```

Incoming requests are scoped to the authenticated requested agent; outgoing requests are scoped to the authenticated requester. The path-based `/handoffs/incoming` and `/handoffs/outgoing` aliases are not implemented.

```http
POST /handoffs/:handoffId/accept
POST /handoffs/:handoffId/reject
POST /handoffs/:handoffId/cancel
```

The list query also supports `page`, `pageSize`, `search`, `departmentId`, `requesterId`, and `requestedAgentId`, in addition to ticket and status filters. The operation must be explicit and must not let clients submit arbitrary status values.

The implementation additionally exposes `GET /handoffs/participants` and `GET /tickets/:id/handoffs/eligible-agents` for participant and target-agent selectors.

### API rules

- All routes require authentication.
- Role requirements must be explicit. Use the existing equivalent of `@Roles(Role.AGENT, Role.ADMIN)` if both roles may hand off; do not rely on implicit role hierarchy.
- Resource checks remain in the ticket/handoff policy, not in the generic Authorization module.
- Validate route IDs and requested agent IDs.
- Reject self-handoff, invalid roles, inactive users, cross-department targets, missing membership, non-claimed tickets, stale requests, and invalid transitions with the repository's existing error conventions.
- Use `409 Conflict` for validly shaped but state-conflicting commands where that matches project conventions; use `400`, `401`, `403`, and `404` appropriately.
- Return safe DTOs, not raw Prisma rows.
- Include ticket/requester/requested-agent display data only if current ticket APIs safely expose it.
- Never expose internal database errors or stack traces.
- Do not permit clients to choose `status`, `createdAt`, `resolvedAt`, actor, requester, or event action.

List responses use `{ items, page, pageSize, hasMore, pendingCount }`. List user references contain `userId` and `fullName`; mutation responses include fuller user summaries and ticket/department data. There are no generic handoff status-update routes.

---

## 6. Create-request flow

The request flow must be:

```text
authenticated current user
        ↓
validate target agent ID
        ↓
load ticket and users/memberships
        ↓
resource/lifecycle authorization
        ↓
atomic transaction
  verify ticket is CLAIMED
  verify ticket.agentId == request.user.userId
  verify requester != requested
  verify both are eligible department members
  verify no conflicting pending duplicate
  create PENDING HandoffRequest
  create HANDOFF TicketEvent with REQUESTED action
commit
```

The transaction must protect against a simultaneous close, claim, department removal, deactivation, or second handoff request. Use the existing Prisma transaction/row-lock/conditional-update strategy. Do not perform an authorization read, then assume the ticket is unchanged during a later write.

The event actor is the authenticated requester. Event details contain safe domain identifiers:

```json
{
  "requesterId": "...",
  "requestedAgentId": "...",
  "action": "REQUESTED",
  "timestamp": "..."
}
```
If handoff event details field do not include message field, add it
Do not store the client payload blindly in event JSON.

If event persistence fails, the HandoffRequest insert must roll back. If the request insert fails, no HANDOFF event may remain.

---

## 7. Accept flow and concurrency

Acceptance is the most concurrency-sensitive operation.

The flow must be:

```text
authenticated requested agent
        ↓
load pending handoff with ticket/requester/target relations
        ↓
authorize requested agent and resource
        ↓
transaction with row lock or atomic conditional updates
  verify handoff status = PENDING
  verify ticket is CLAIMED and active
  verify ticket.agentId = handoff.requesterId
  verify requester and requested agent remain eligible members
  update ticket.agentId = handoff.requestedId
  keep ticket.status = CLAIMED
  update handoff status = ACCEPTED and resolvedAt
  create HANDOFF/ACCEPTED TicketEvent
  resolve competing pending requests according to the documented/default policy
commit
```

Exactly one concurrent acceptance may succeed for a ticket/request. A request that loses the race must receive a conflict/not-found/invalid-state response according to current conventions and must create no duplicate transfer or event.

Acceptance must not:

- assign the ticket if it was closed, reopened, cancelled, or otherwise changed out of `CLAIMED`
- transfer the ticket if another operation already changed the current agent
- create two `HANDOFF/ACCEPTED` events
- leave the request `PENDING` after successful transfer
- create a second current agent

### Multiple pending requests

The data model explicitly permits multiple pending handoffs for a ticket. Since acceptance changes the current agent, other pending requests from the old agent become stale. Inspect existing requirements/code and choose a deterministic policy. Unless a stronger existing rule exists, atomically mark all other pending requests for the same ticket as `CANCELLED` with a system/superseded reason after one request is accepted, while preserving the accepted request and creating only one `HANDOFF/ACCEPTED` event for the accepted request. Do not emit misleading accepted events for the others. Document this as an implementation decision if chosen.

If the repository instead requires leaving other requests pending, implement a safe rule that prevents them from later being accepted and document why. Never allow a stale request to transfer a ticket after the original requester is no longer its current agent.

---

## 8. Reject flow

Only the requested agent can reject a pending handoff.

Use one transaction:

1. Lock or conditionally load the pending handoff.
2. Verify authenticated user is `requestedId`.
3. Verify status is `PENDING`.
4. Set status to `REJECTED` (or the established equivalent).
5. Set resolved timestamp.
6. Keep ticket status and current agent unchanged.
7. Create exactly one `HANDOFF` event with rejection/denial action.

A rejected request cannot be accepted, rejected, or cancelled again. A rejected operation must not change the ticket or create duplicate events.

---

## 9. Cancel flow

Only the requesting/current agent can cancel a pending handoff through the user-facing cancel operation.

Use one transaction:

1. Lock or conditionally load the pending handoff.
2. Verify authenticated user is `requesterId` and remains the current agent, unless current project policy explicitly permits cancellation by the original requester after reassignment.
3. Verify status is `PENDING`.
4. Set status to `CANCELLED`.
5. Set resolved timestamp.
6. Keep ticket status/current agent unchanged.
7. Create exactly one `HANDOFF/CANCELLED` event.

---

## 10. Automatic cancellation rules

The product requirements explicitly require pending handoffs to be cancelled when lifecycle context invalidates them.

### Ticket closure

When a claimed ticket is successfully closed:

- cancel all `PENDING` handoffs for that ticket in the same transaction as the close and CLOSE TicketEvent
- set their resolved timestamps
- do not allow later acceptance
- decide whether each system cancellation gets a HANDOFF/CANCELLED event based on current Ticket Event conventions; if events are required for every successful handoff state change, create one event per automatically cancelled request with a system/domain actor representation already supported by the schema
- do not create events for requests already terminal

Do not weaken close ownership/lifecycle policy.

### Department membership removal

If requester or requested agent leaves the ticket's department:

- cancel pending handoffs involving that user for tickets in the affected department
- preserve the ticket's valid current assignment rules
- if the removed user is the current assigned agent, reuse the existing department-removal policy to return the ticket to the correct pool or reject the removal if that is the established behavior
- perform membership, assignment reconciliation, handoff cancellation, and events atomically

### User deactivation or role change

If either requester or requested agent becomes inactive or loses agent/admin eligibility:

- cancel pending requests involving that user
- reconcile current assignments using existing ticket rules
- prevent acceptance after deactivation
- invalidate sessions/permissions through existing authentication behavior

### Ticket cancellation/deletion

If a ticket is soft-deleted/cancelled while handoffs are pending, cancel them transactionally if this is not already handled by the current lifecycle implementation. Preserve ticket/event history; do not hard-delete requests.

Centralize these automatic transitions to avoid one path forgetting handoffs. Do not create duplicate cancellation events when two lifecycle hooks call the same logic.

### Other handoff approval
If another ticket handoff succeeded, cancel all other ones sent from the requester
---

## 11. Ticket Events integration

Ticket Events are immutable business history, not a generic Handoff CRUD log.

Use the existing `HANDOFF` action type or add it through a new migration if missing. The backend controls the event action.

For every successful handoff transition, create exactly one event for the corresponding request:

| Handoff operation | Event action | Event details action |
|---|---|---|
| request | `HANDOFF` | `REQUESTED` |
| accept | `HANDOFF` | `ACCEPTED` |
| reject/deny | `HANDOFF` | `REJECTED` or `DENIED` according to established convention |
| requester cancel | `HANDOFF` | `CANCELLED` |
| system cancellation | `HANDOFF` | `CANCELLED` plus safe cancellation reason if schema permits |

Details conceptually include:

- requester ID
- requested agent ID
- handoff request ID if the model supports it
- Message for requested optionally
- action
- timestamp
- safe reason/source for automatic cancellation where useful

The actor must be:

- authenticated requester for request/cancel
- requested agent for accept/reject
- authenticated lifecycle actor for close-triggered cancellation if supported
- a valid system actor/null according to the existing event actor schema for automatic membership/deactivation cancellation

Do not invent a fake user or violate a non-null actor constraint. Inspect the existing schema and choose the smallest valid representation.

Rejected, unauthorized, stale, and invalid operations create no event. Events must be appended in the same database transaction as the HandoffRequest/ticket mutation.

Do not expose update/delete/PATCH/DELETE endpoints for Ticket Events.

Ticket history should show HANDOFF events in chronological order using the existing event DTO and authorization rules. Do not put mutable request state in event details as the source of truth; HandoffRequest remains the current request-state record.

---

## 12. Authorization model

Keep the generic Authorization module resource-agnostic. It may enforce roles; the Handoff/Ticket policies enforce ticket ownership, department, request ownership, and state.

### Roles

Use explicit route metadata. If admins inherit agent behavior in the current product, list both roles explicitly. Do not assume role hierarchy automatically grants agent endpoints to admins.

Conceptually:

- create handoff: `AGENT`, `ADMIN` if admins can act as agents
- accept/reject: `AGENT`, `ADMIN` if requested admin can act as agent
- cancel: `AGENT`, `ADMIN` if requester is acting as agent
- list incoming/outgoing: authenticated eligible agent/admin, scoped to own requests
- list ticket handoffs: existing ticket visibility plus safe role/resource policy

### Resource policies

Create focused policies or extend existing ticket policies for:

- can request handoff for this ticket
- can view this handoff
- can accept this handoff
- can reject this handoff
- can cancel this handoff

Checks must include:

- authenticated actor identity
- ticket visibility/ownership
- requester/requested identity
- ticket current agent
- ticket department
- department membership at operation time
- role and active status
- ticket/request state

Never trust `requesterId`, `actorId`, `requestedAgentId`, or `status` from client input when it can be derived or checked server-side.

An unrelated employee must not list, accept, reject, cancel, or infer sensitive handoff details. A department agent must not hand off across departments. A non-current agent must not create a handoff merely because they once claimed the ticket.

---

## 13. Notifications

The product specifications require:

- destination agent notification when a handoff is proposed
- employee notification when the ticket's agent changes after acceptance
- sensible notification to requester on rejection/cancellation where notification conventions support it

Inspect whether Nexus already has an email, in-app, event bus, or notification module.

- If it exists, integrate handoff notifications through its existing provider/queue abstraction.
- Do not make a notification provider failure roll back the core handoff transaction unless existing architecture explicitly requires synchronous notification success.
- Do not send notifications to unrelated users.
- Do not leak ticket details beyond the recipient's ticket permissions.
- Ensure notification dispatch is idempotent or tied to the committed domain event so retries cannot duplicate user-visible messages.
- The current repository has in-app/realtime notification integration for handoffs. External email delivery is not implemented; do not describe it as complete or add it as an undocumented handoff API.

---

## 14. Frontend handoff experience

Implement the handoff UI using existing React patterns and server-returned permissions.

### Ticket details / current agent

For a claimed ticket where the current user is the assigned agent:

- show a “Propose handoff” action when policy allows
- load eligible agents from the same ticket department through a safe API
- exclude the current user
- exclude inactive/non-agent/non-member users
- display enough identity information to choose accurately
- require confirmation before creating the request

Do not let the frontend manufacture eligible-agent lists from untrusted ticket data. The backend remains authoritative.

### Outgoing requests

Show the current agent's pending outgoing requests, with:

- target agent
- ticket
- creation time
- `PENDING` status
- cancel action only when permitted

### Incoming requests

Provide an agent inbox or clearly accessible panel showing requests targeted to the authenticated user, with:

- requester
- ticket
- department
- creation time
- accept and reject actions
- pending/terminal state

After accept, refresh the ticket, request lists, current assignment, permissions, and history. The new agent must see the ticket as assigned; the old agent must no longer see accept/cancel controls for that request.

After reject/cancel, update state without pretending the assignment changed.

### Ticket history

Render HANDOFF events alongside existing ticket history:

- proposed to agent
- accepted by agent
- rejected/denied
- cancelled

Use safe display names from API DTOs. Do not render raw event JSON or internal IDs unless existing UI conventions require them.

### Errors and races

Handle:

- unauthorized/forbidden
- ticket no longer claimed
- request already resolved
- another agent accepted first
- target agent removed/deactivated
- network/server failure

Use existing error presentation. On conflict, refetch authoritative ticket/request state.

Do not optimistically show transfer success before the API commits.

### Navigation and responsive behavior

Keep employee UI free of handoff controls. Agents/admins acting as agents should see only actions allowed by server permissions. Preserve existing mobile/responsive layout and accessibility patterns.

---

## 15. Transactions and concurrency

Every handoff mutation must be atomic with its related ticket/request/event writes.

### Request

Create `PENDING` request plus `HANDOFF/REQUESTED` event in one transaction.

### Accept

Transfer `Ticket.agentId`, resolve request, resolve competing stale pending requests according to chosen policy, and append event(s) in one transaction.

### Reject/cancel

Resolve request and append event in one transaction.

### Close/department removal/deactivation

Integrate pending-request cancellation with the existing transaction that changes ticket/membership/account state.

Use one authoritative orchestration point per operation. Controllers must not perform separate writes such as:

```text
update handoff
then update ticket
then create event
```

without a transaction.

Preserve claim concurrency. Test race scenarios:

1. Two accepts for the same request.
2. Accept versus reject.
3. Accept versus requester cancel.
4. Accept versus ticket close.
5. Accept versus department membership removal.
6. Accept versus user deactivation.
7. Two duplicate request submissions.
8. Request creation versus ticket close.

Only one valid winner may mutate the ticket. Losing requests must leave no duplicate events or partially resolved rows.

Use conditional updates and/or row-level locks consistent with the existing Prisma/PostgreSQL strategy. Do not rely only on a pre-read followed by an unconditional update.

---

## 16. Repository/module boundaries

Follow the current modular-monolith architecture. A reasonable structure is:

```text
tickets/
  handoffs/
    handoff.types.ts
    handoff.dto.ts
    handoff.policy.ts
    handoffs.repository.ts
    prisma-handoffs.repository.ts
    handoffs.service.ts
```

Adapt names to actual repository conventions.

Responsibilities:

- Tickets module owns ticket lifecycle and current assignment.
- Handoff module/service owns proposal state and handoff commands.
- Ticket Event module owns immutable event persistence/history.
- Department/User modules own membership and identity data.
- Authorization module owns endpoint role checks only.
- Notification module owns delivery mechanics.
- Application transaction orchestration coordinates repositories.

Do not create a giant service handling HTTP, authorization, ticket persistence, notifications, and event mapping all at once. Do not duplicate Ticket assignment logic in HandoffRequest.

---

## 17. Database migration and schema

If missing, create a new Prisma migration for:

- HandoffRequest table/model
- Handoff status enum
- requester/requested/ticket foreign keys
- timestamps and resolution timestamp
- indexes for incoming/outgoing/ticket pending queries
- constraints needed for valid status/relationships
- HANDOFF TicketEvent enum/action support if missing

Never modify an already-applied historical migration.

Ensure a fresh database can run the full migration chain.

Use foreign-key deletion behavior that preserves historical integrity. Do not cascade-delete Ticket Events or user history. Soft deletion/deactivation must invoke application reconciliation.

If a partial unique pending-request index is appropriate, implement it in migration SQL and explain why.

Run Prisma format/validate/generate and migration checks afterward.

---

## 18. DTOs and response contracts

Create explicit DTOs for:

- create handoff request
- handoff summary/details
- incoming/outgoing query filters/pagination if supported
- command responses or status updates

Safe response fields may include:

- handoff ID
- ticket ID/code/title as permitted
- requester summary
- requested-agent summary
- status
- created/resolved timestamps
- current ticket status/current agent summary where useful

Do not expose raw Prisma relations, session data, provider claims, or irrelevant personal fields. Follow existing user-summary privacy conventions.

Ensure event DTOs include HANDOFF events in the existing history response without exposing database implementation details.

---

## 19. Error handling

Follow existing NestJS exceptions and frontend error conventions.

Expected categories:

- `401 Unauthorized`: no authenticated user
- `403 Forbidden`: wrong role, wrong department, wrong requester/recipient, or no ticket visibility
- `404 Not Found`: unknown ticket/handoff/agent, without leaking whether an unauthorized resource exists if current policy uses indistinguishable responses
- `409 Conflict`: stale state, duplicate pending request, already-resolved request, ticket no longer claimed, or concurrent winner
- `400 Bad Request`: malformed IDs/body/unsupported command
- `5xx`: controlled internal/database failure without raw SQL or stack traces

Do not create a successful event or notification for failed commands.

---

## 20. Testing requirements

Follow existing test utilities and use real PostgreSQL/Prisma integration where the repository already does.

### Unit/policy tests

Cover:

- self-handoff rejected
- requester not current agent rejected
- requested agent not in department rejected
- requester/target inactive or wrong role rejected
- ticket not `CLAIMED` rejected
- request status transition rules
- only requested agent accepts/rejects
- only requester cancels
- event actor derives from authenticated user
- client cannot control requester/status/action

### Integration tests

Cover:

1. Create pending handoff.
2. Request row and REQUESTED event are committed together.
3. Event failure rolls request back.
4. Accept transfers ticket agent and resolves request atomically.
5. Accept creates exactly one ACCEPTED event.
6. Reject leaves current agent unchanged and creates one rejection event.
7. Cancel leaves current agent unchanged and creates one cancellation event.
8. Invalid commands create no events and no state changes.
9. Multiple pending handoffs are represented and resolved according to chosen policy.
10. Closing a ticket cancels pending requests transactionally.
11. Department removal/deactivation cancels pending requests.
12. Agent removal with claimed tickets follows existing assignment reconciliation.
13. Historical requests remain queryable.
14. Ticket history includes HANDOFF events chronologically.

### API E2E tests

Cover:

- unauthenticated create/list/accept/reject/cancel -> 401
- employee cannot use handoff commands -> 403
- agent in another department cannot target/accept
- current agent creates request
- requested agent sees incoming request
- requested agent accepts
- old agent no longer owns ticket
- employee sees new agent after acceptance
- requested agent rejects
- requester cancels
- duplicate/stale operations return correct errors
- ticket close blocks later acceptance
- no arbitrary event endpoint exists
- response does not expose raw database internals

### Concurrency tests

Run actual concurrent requests or repository-level races for all scenarios in the transaction section. Verify exactly one winner and no duplicate ticket assignment/events.

### Browser E2E

Add at least one meaningful complete flow:

```text
agent A logs in
  -> opens a claimed ticket assigned to A
  -> selects eligible agent B
  -> submits handoff
  -> B logs in/refreshes incoming requests
  -> B accepts
  -> ticket now shows B as assigned
  -> employee sees the changed agent
  -> history shows REQUESTED and ACCEPTED
```

Also cover reject/cancel and an access-denied case if the existing browser setup supports it without excessive duplication.

---

## 21. Repository-wide search before completion

Search the entire repository for all possible handoff and assignment paths:

```text
handoff
Handoff
HandoffRequest
REQUESTED
ACCEPTED
REJECTED
DENIED
CANCELLED
assignedAgent
agentId
claim
department membership
departmentMember
TicketEvent
HANDOFF
notification
```

Confirm:

- one authoritative implementation per handoff command
- no direct client-controlled ticket-agent update bypasses handoff/claim policies
- no duplicate event creation in service and repository layers
- no alternate route can accept a handoff without checking the ticket's current agent/state
- close, cancellation, department removal, deactivation, and role changes cannot leave stale pending requests accepted later
- existing claim/close/reopen flows remain intact

---

## 22. Before coding: produce a concise implementation plan

After inspection and before edits, state:

1. Current Ticket, User, Department, DepartmentMember, and TicketEvent models.
2. Whether HandoffRequest already exists and what is missing.
3. Current ticket assignment and claim transaction strategy.
4. Current authorization role/resource policy architecture.
5. Current department membership/eligibility checks.
6. Existing ticket close/cancel/department-removal/deactivation flows.
7. Existing notification architecture.
8. Existing Ticket Event action and detail format.
9. Proposed HandoffRequest model, enums, constraints, and indexes.
10. Proposed routes, DTOs, policies, repositories, and services.
11. Acceptance concurrency and competing-pending policy.
12. Automatic cancellation strategy.
13. Frontend screens/components and API changes.
14. Tests to add/update.
15. Exact files expected to change.
16. Documentation/code discrepancies and genuine blockers.

Then implement the feature. Do not stop after the plan unless a genuine blocker makes the implementation unsafe.

---

## 23. Verification commands

Inspect `package.json` and run the actual project scripts; do not invent script names.

At minimum run where configured:

- Prisma format/validate/generate
- migration against test database
- fresh-database migration chain
- backend typecheck/build
- frontend typecheck/build
- lint
- unit tests
- integration tests
- API E2E tests
- concurrency tests
- browser E2E tests

Verify manually or through automated tests:

```text
create request
accept request
reject request
cancel request
multiple pending requests
close with pending requests
department membership removal
inactive/deactivated requested agent
history HANDOFF events
notification behavior
unauthorized access
concurrent acceptance
```

Do not claim success for commands that were not run.

---

## 24. Final implementation report

Report:

### Repository findings

- what handoff-related code existed before implementation
- documentation/code discrepancies

### Files created and modified

List every file.

### Database

- HandoffRequest model and enum
- relations and foreign keys
- unique constraints/indexes
- migration details
- deletion/soft-deletion behavior

### Backend/API

- exact final routes and HTTP methods
- request/response DTOs
- service/repository boundaries
- policy/authorization rules
- error/status mapping

### State machine

Document every allowed and rejected transition:

```text
PENDING -> ACCEPTED
PENDING -> REJECTED/DENIED
PENDING -> CANCELLED
terminal -> no further transitions
```

Explain how ticket assignment changes only on acceptance.

### Transactions and concurrency

- transaction boundary for each command
- locking/conditional update strategy
- competing pending-request policy
- close/removal/deactivation cancellation behavior
- claim concurrency preservation

### Ticket Events

- HANDOFF event action and detail schema
- event actor for each transition
- exactly-once behavior
- history retrieval and frontend mapping

### Notifications

- existing notification integration
- recipients and trigger timing
- failure/retry behavior
- any intentionally deferred notification behavior

### Frontend

- proposed-handoff UI
- incoming/outgoing request UI
- accept/reject/cancel controls
- ticket assignment refresh
- history display
- loading/error/conflict/access-denied states

### Tests and verification

List tests added/updated and every command run with pass/fail status.

### Defaults and decisions

Clearly identify choices not explicitly fixed by the docs, especially:

- duplicate pending request policy
- what happens to other pending requests after one acceptance
- exact HTTP conflict statuses
- automatic cancellation event policy
- notification fallback when notification infrastructure is absent
- behavior for admin handoffs if admin/agent inheritance was ambiguous

Do not present these choices as documented product requirements.

### Deferred functionality

Explicitly list handoff-adjacent functionality not implemented in the current architecture. External email delivery remains deferred; real-time WebSocket updates are implemented through the Operations gateway and must not be listed as missing.

---

## 25. Definition of Done

The task is complete only when:

- HandoffRequest persistence exists or the existing model is correctly completed.
- Request statuses support pending, accepted, rejected/denied, and cancelled.
- A handoff can be requested only by the ticket's current assigned agent.
- Target agent is a different eligible member of the same department.
- Requests are allowed only for active `CLAIMED` tickets.
- Request creation does not change current ticket assignment.
- Requested agents can view their incoming requests.
- Requesters can view/cancel their outgoing requests.
- Only the requested agent can accept/reject.
- Only the requester can cancel user-initiated cancellation.
- Acceptance atomically transfers the ticket while keeping it claimed.
- Rejection/cancellation do not transfer the ticket.
- Terminal requests cannot transition again.
- Multiple pending requests are handled deterministically and safely.
- Closing/cancelling/removing/deactivating relevant users does not leave accept-able stale requests.
- Every successful handoff transition emits exactly one appropriate HANDOFF TicketEvent.
- Invalid operations emit no handoff event.
- Ticket Events remain append-only and cannot be client-created or modified.
- Handoff mutations, ticket transfer, request state, and events are transactional.
- Concurrency tests prevent double acceptance and duplicate assignment/events.
- Existing claim concurrency guarantees remain intact.
- Authorization prevents cross-department, wrong-user, wrong-role, and unauthorized access.
- Notifications use existing infrastructure where available and target only concerned users.
- Frontend supports proposing, viewing, accepting, rejecting, cancelling, and refreshing state.
- Ticket history displays handoff events safely.
- Prisma migration works on a fresh database.
- Prisma validates and generates successfully.
- Backend/frontend builds pass.
- Existing lifecycle/authentication/authorization/Ticket Event tests still pass.
- New handoff unit, integration, API E2E, concurrency, and relevant browser tests pass.
- No unrelated features are implemented.
- The final report documents actual routes, files, decisions, discrepancies, and verification.
