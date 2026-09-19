# Task: Implement Nexus Ticket Chat on the Existing Realtime Infrastructure

You are working in the existing **Nexus** codebase, a NestJS/Prisma/PostgreSQL backend with a React/TypeScript frontend.

Implement ticket-specific Chat using the Socket.io infrastructure that has already been implemented by the separate realtime-infrastructure task.

Do not recreate the gateway, connection provider, session handshake, or presence system. Inspect and reuse the existing implementation.

The architectural rule is mandatory:

```text
Chat application service
    ↓ persists and authorizes
internal CHAT_MESSAGE_CREATED event after commit
    ↓
central OperationsGateway listens with @OnEvent()
    ↓
authorized Socket.io chat room
```

Chat must never write directly to the gateway or broadcast directly.

---

## 1. Documentation and precedence

Read these documents first and in order:

1. `docs/product-specs.md`
2. `docs/architecture.md`
3. `docs/data-model.md`

Then read:

- `docs/authentication.md`
- `docs/authorization.md`
- `docs/ticket-events.md`
- `docs/database-setup.md`
- `docs/ticket-lifecycle-interface.md`
- `docs/file-attachments.md`
- `docs/ticket-handoff.md`
- `docs/admin-functionality.md`
- `docs/week3-full-stack-delivery.md`
- repository instructions, README files, and package scripts

The earlier file-attachment workflow may say Chat was deferred. The current task explicitly brings Chat into scope. Preserve the existing attachment infrastructure and extend it additively for Chat only where required.

The source code is the final authority for existing models, routes, policies, and conventions. Preserve valid behavior and report discrepancies.

---

## 2. Mandatory prerequisite inspection

Before editing, verify that the realtime foundation exists and understand it.

Inspect:

- `OperationsGateway` and its namespace/configuration;
- internal and external realtime event constants;
- EventEmitterModule/RealtimeModule registration;
- socket handshake authentication and session validation;
- socket/user connection maps and presence cleanup;
- ticket room join authorization;
- frontend Socket.io provider/hook;
- reconnect/resynchronization behavior;
- existing Ticket realtime event integration;
- all relevant tests.

If the prerequisite infrastructure is incomplete or violates the architecture, fix only the minimum necessary foundation before implementing Chat. Do not silently create a second gateway or second Socket.io connection system.

Also inspect:

- Prisma schema/migrations;
- Tickets module/service/repository/policies;
- Ticket statuses and lifecycle/concurrency controls;
- Users, Authentication, Authorization, Departments, and handoff behavior;
- existing File/Attachment/FileStorage implementation;
- ticket details/history frontend and API client;
- error/validation conventions.

Determine:

1. Exact ticket status enum values.
2. Exact authenticated user/session contract.
3. Exact ticket visibility and operation policy.
4. Whether ChatMessage or Chat routes already exist.
5. Whether Attachment already has `messageId` support.
6. Existing IDs, timestamps, pagination, response mappers, and migration conventions.
7. Exact frontend state/cache conventions.

Do not begin implementation until this is understood.

---

## 3. Authoritative Chat behavior

Implement the documented Nexus ticket-chat rules:

1. Every ChatMessage belongs to exactly one Ticket and one authenticated sender.
2. The server derives `senderId`; the frontend can never provide it.
3. Only authorized participants may read Chat history.
4. The employee who submitted the ticket may participate.
5. The agent currently assigned to the ticket may participate.
6. Apply the actual current role/department/resource policy; do not assume every admin can chat merely because admins can view tickets.
7. Messages cannot be created for `OPEN`, `REOPENED`, or `CLOSED` tickets.
8. Chat is writable only while the ticket is `CLAIMED`.
9. A non-claimed conversation is read-only for authorized viewers.
10. If the ticket is reopened and later claimed again, writability follows the real lifecycle policy.
11. A user cannot send merely because they know a ticket ID or joined a broad ticket room.
12. A message is successful only after its database transaction commits.
13. Socket delivery is best-effort; HTTP history synchronization is authoritative.
14. Message/event IDs must be stable so clients can deduplicate repeated delivery.

If the code and documentation differ, preserve valid current behavior and document the exact resulting authorization matrix.

---

## 4. Scope

Implement:

- ChatMessage persistence and migration;
- Chat resource authorization;
- chronological Chat history retrieval;
- durable message creation;
- optional Chat-message attachments using existing File/Attachment/FileStorage abstractions where present;
- post-commit internal `CHAT_MESSAGE_CREATED` events;
- central gateway delivery to authorized `chat:{ticketId}` rooms;
- optional thin Socket.io send-command adapter if the existing UX requires it;
- React Chat UI integrated into ticket details;
- reconnect/history synchronization and message deduplication;
- tests for authorization, persistence, transactions, concurrency, realtime delivery, and frontend behavior.

---

## 5. Explicit exclusions

Do not implement:

- a second gateway or socket connection provider;
- direct gateway injection into ChatService;
- direct Prisma access from OperationsGateway;
- a second authentication system;
- JWT if Nexus uses server-side sessions;
- public/general chat rooms;
- email notifications unless an existing notification event integration naturally consumes the new internal event;
- typing indicators, read receipts, reactions, editing, deletion, search, moderation, or message versioning unless already specified/current;
- Redis or distributed Socket.io fan-out;
- a generic event-sourcing system.

Do not add unrelated ticket lifecycle behavior.

---

## 6. ChatMessage data model

Inspect the current schema first. If `ChatMessage` does not exist, add it using existing naming, ID, relation, timestamp, and migration conventions.

Conceptually:

```text
ChatMessage
-----------
id
ticketId       FK -> Ticket
senderId       FK -> User
content        nullable only if attachment-only messages are intentionally supported
createdAt
updatedAt      if project conventions require it
```

Add explicit relation names where Prisma requires them. Add inverse relations to Ticket and User.

Add an index for chronological history:

```text
(ticketId, createdAt)
```

Add other indexes only when justified by actual authorization/query patterns.

Do not hard-delete historical messages if the application uses soft deletion/history-preserving behavior.

Create a new Prisma migration. Never modify an already-applied migration. Validate the migration on a fresh database and through the project’s normal migration chain.

---

## 7. Chat attachments

If the existing File/Attachment feature is implemented, extend it rather than duplicating it.

The intended relationship is:

```text
ChatMessage 1:N Attachment
Attachment 1:1 File
```

Preserve:

- `File` metadata and uploader ownership;
- existing `FileStorage` abstraction;
- existing validation and generated storage keys;
- secure authenticated downloads;
- safe attachment DTOs;
- `eventId != null XOR messageId != null` database invariant;
- unique File-to-Attachment relationship.

Do not create `ChatMessageFile` or another parallel storage model. Do not expose file paths or bytes in Chat history events.

If the current file feature is absent despite the docs, implement only the smallest shared prerequisite required for Chat attachments and report the discrepancy. If the existing API/requirements make Chat attachments out of scope for this repository state, implement text Chat cleanly and document that decision rather than inventing a duplicate file system.

Attachment writes must be transactional with message creation, with compensating physical-file cleanup on storage/database failure.

---

## 8. Chat authorization policy

Keep resource-specific rules in Chat/Tickets policies, not in the generic Authorization module and not in FileStorage.

Implement or extend policy methods equivalent to:

```text
canViewChat(userId, ticketId)
canSendChatMessage(userId, ticketId)
```

The policy must verify:

- authenticated active user;
- ticket visibility under the existing resource policy;
- submitter/current assigned agent relationship;
- role and department eligibility;
- current ticket status;
- current assigned-agent identity at the time of send;
- any existing admin/handoff/reassignment rules.

Do not authorize from:

- socket connection existence;
- room membership alone;
- client-provided `senderId`;
- a client-provided permission flag;
- file uploader identity.

Use existing not-found/forbidden behavior consistently and avoid leaking protected ticket existence.

Document the exact employee/agent/admin matrix in the final report.

---

## 9. Chat application service and repository boundaries

Follow existing Nexus modularity. A reasonable conceptual boundary is:

```text
ChatController / Socket command adapter
        ↓
Chat application service
        ├── Chat policy
        ├── Chat repository
        ├── File/Attachment repository if needed
        └── EventEmitter2
```

The Chat application service owns:

- authorization orchestration;
- message validation;
- durable message creation;
- transaction coordination;
- emission of internal events after commit.

The Chat repository owns persistence/query details. The gateway owns only Socket.io transport, room membership, and event broadcasting.

Do not create a 700-line Chat god service.

---

## 10. HTTP API

Inspect existing route conventions first. Preserve existing routes if present. If no Chat routes exist, use the project’s established naming, conceptually:

### History

```http
GET /tickets/:ticketId/chat/messages
```

Return authorized messages chronologically, with existing pagination/cursor conventions where available.

Safe response fields may include:

```text
messageId
ticketId
senderId or approved sender summary
content
createdAt
attachments metadata, if supported
```

Do not return Prisma internals, session data, storage paths, or raw exceptions.

### Create message

Conceptually:

```http
POST /tickets/:ticketId/chat/messages
```

For text-only messages, accept validated content. If attachments are supported, accept multipart content/files using existing upload conventions.

The client must not provide:

- `senderId`;
- arbitrary ownership fields;
- a different ticket ID in the body;
- a client-selected event action.

Preserve JSON support if it already exists. Do not unnecessarily force all existing clients to multipart.

If both content and attachments are optional, reject a message with neither unless the current contract explicitly allows empty messages. Centralize and document any chosen message length, file count, or size defaults.

---

## 11. Socket command adapter and event delivery

Prefer HTTP for durable message creation, especially when attachments are involved. Socket.io should primarily deliver committed events.

If the current Chat UX requires a socket send command, implement it only as a thin adapter:

```text
socket `send_message`
        ↓
Chat application service
        ↓
same policy/validation/transaction path as HTTP
        ↓
CHAT_MESSAGE_CREATED after commit
```

The socket handler must not write Prisma records or broadcast directly. The frontend must choose exactly one send path per message to avoid duplicates.

Extend the existing realtime constants/types with an internal event such as:

```text
CHAT_MESSAGE_CREATED
```

Use a safe envelope containing:

- stable `eventId`/`messageId`;
- `ticketId`;
- persisted sender identity/approved summary;
- persisted content;
- created timestamp;
- attachment metadata only;
- version if the realtime system uses versions.

Emit exactly once after the transaction commits. If no clients are connected, the message remains available through history retrieval.

Extend the existing `OperationsGateway` with `@OnEvent()` handling. Broadcast only to the authorized `chat:{ticketId}` room. Do not create a second gateway.

---

## 12. Chat room membership

Reuse the existing gateway’s authentication and room authorization infrastructure.

Implement or extend:

- join chat room;
- leave chat room.

The server must resolve the ticket and apply Chat read policy before joining. A ticket room membership must not automatically grant Chat membership.

Use constants/builders such as:

```text
chat:{ticketId}
```

Do not let the client provide an arbitrary room string. Return acknowledgement errors using existing Socket.io conventions without leaking protected resource existence.

When a ticket becomes closed/non-claimed, the backend must prevent further sends even if a socket remains connected and joined. Existing authorized users may remain able to read history.

---

## 13. Transaction and concurrency requirements

For a text-only message:

```text
BEGIN
  safely read/lock the Ticket using current concurrency conventions
  verify current status is CLAIMED
  verify sender is authorized and current agent has not changed
  create ChatMessage
COMMIT
emit CHAT_MESSAGE_CREATED
```

For attachments, include Message/File/Attachment database writes in the same transaction and compensate physical storage writes on failure.

Required invariants:

- no successful response before commit;
- no event for a rolled-back message;
- no partial message/attachment persistence;
- no orphaned newly-written physical files where synchronous cleanup is possible;
- exactly one ChatMessage per accepted command;
- server-controlled sender identity.

### Close/send race

Preserve or add locking/conditional-update behavior so:

- if close commits first, a later send is rejected;
- if send commits first, that message exists before close;
- no message is accepted against an already-closed ticket;
- no rejected message is broadcast.

Do not weaken existing claim, close, reopen, handoff, or Ticket Event concurrency guarantees.

---

## 14. Frontend Chat integration

Reuse the existing realtime provider/hook and API client. Do not create a second socket connection.

Integrate Chat into the existing ticket details screen.

Implement, following current UI conventions:

- authorized Chat history panel;
- chronological messages;
- sender/time display;
- loading, empty, error, and reconnecting states;
- composer for writable participants;
- server-driven read-only state for `OPEN`, `REOPENED`, and `CLOSED` tickets;
- send loading/error state;
- duplicate-safe message merging;
- optional attachment selection/removal/upload using existing file UI;
- authenticated backend file retrieval, never public file URLs.

Do not rely solely on local ticket state to decide whether the user may send.

---

## 15. Reconnect and synchronization

After socket reconnect:

1. rejoin the visible authorized Chat room;
2. retrieve authoritative Chat history through HTTP or the current cursor-sync mechanism;
3. merge by stable `messageId`;
4. sort chronologically according to server data;
5. clear stale sending/reconnect state;
6. avoid duplicate messages caused by an event arriving near the history response.

Socket events are delivery hints, not the database source of truth.

Validate incoming payloads at the client boundary. Never trust TypeScript types alone.

---

## 16. Errors and security

Follow existing backend/frontend error conventions. Convert database, policy, validation, and storage failures into safe application/protocol errors.

Do not expose:

- Prisma/PostgreSQL exceptions;
- stack traces;
- socket session IDs or tokens;
- filesystem paths;
- private messages to unauthorized rooms;
- raw storage errors.

Validate message length/content, multipart fields, attachments, and socket payloads at runtime.

---

## 17. Tests

Follow existing tests and use real Prisma/PostgreSQL integration where appropriate.

### Schema/database

- ChatMessage migration works on a fresh database;
- relations and indexes are correct;
- Attachment message relation preserves exactly-one-resource invariant;
- existing File/Attachment behavior remains intact.

### Authorization

- authorized submitter can read;
- authorized current agent can read/send;
- unrelated employee cannot read/send;
- non-current department agent cannot send;
- admin behavior matches the discovered policy;
- open/reopened/closed tickets reject sends;
- claimed tickets allow only authorized sends;
- room join policy matches HTTP Chat policy;
- client-provided sender identity is ignored/rejected.

### Persistence/events

- one valid request creates exactly one message;
- message is chronological in history;
- event is emitted only after commit;
- rejected/rolled-back operations emit nothing;
- event payload contains stable IDs and no private internals;
- authorized clients receive the event in the correct room only.

### Attachments

- optional message attachments reuse existing storage;
- File/Attachment/Message rows are consistent;
- storage failure rolls back the operation;
- database failure cleans newly stored files;
- invalid/oversized/unsafe files are rejected;
- attachment metadata is safe and paths are never exposed.

### Concurrency

- concurrent close/send operations produce a valid linearized result;
- concurrent sends do not create accidental duplicates under the chosen contract;
- existing Ticket lifecycle, Ticket Event, and handoff concurrency tests still pass.

### Frontend/realtime

- Chat loads history;
- message events appear without refresh;
- duplicate events do not duplicate messages;
- reconnect resynchronizes history;
- read-only state is enforced by backend response and UI;
- send errors do not create false successful messages;
- attachment selection/removal/upload works if enabled.

### Browser E2E

Where supported, cover:

```text
authorized user opens claimed ticket
    ↓
Chat history loads
    ↓
message is sent through the authoritative path
    ↓
message persists
    ↓
another authorized client receives it in realtime
    ↓
refresh/reconnect keeps exactly one copy
    ↓
closing the ticket blocks later sends
```

---

## 18. Repository-wide verification search

Search for:

```text
Chat
ChatMessage
message
chat:
CHAT_MESSAGE_CREATED
OperationsGateway
OnEvent
socket
room
claim
close
reopen
attachments
```

Ensure no alternate Chat send path bypasses authorization, transactions, stable IDs, or the central gateway.

---

## 19. Before coding: output an implementation plan

Before edits, provide a concise repository-grounded plan covering:

1. Existing realtime infrastructure and files to reuse.
2. Current Chat/schema/routes/UI status.
3. Current ticket statuses and Chat authorization matrix.
4. Current authentication actor source.
5. Current transaction/concurrency conventions.
6. Proposed ChatMessage model and migration.
7. Proposed File/Attachment extension, if needed.
8. Proposed Chat policy and repository/service boundaries.
9. Actual HTTP and optional socket command contracts.
10. Internal event payload and room delivery.
11. Frontend Chat/reconnect strategy.
12. Files to create/modify.
13. Documentation/code discrepancies.

Then implement the feature. Do not stop after the plan unless a genuine blocker exists.

---

## 20. Final implementation report

Report:

### Files created and modified

List every file.

### Database

Explain ChatMessage fields, relations, indexes, migration, and attachment constraints.

### Authorization

Document the exact read/send matrix for employees, agents, admins, submitters, current assignees, and departments.

### API

Document actual history/send routes, payloads, validation, pagination, errors, and any socket command adapter.

### Transactions/concurrency

Explain message transaction boundaries, close/send race handling, event timing, and attachment cleanup.

### Realtime

Explain internal event emission, gateway listener, room authorization, payloads, IDs, and deduplication.

### Frontend

Explain Chat UI, read-only behavior, reconnect synchronization, duplicate handling, and optional attachments.

### Tests/verification

List tests and commands run. Distinguish passing, failing, skipped, and blocked checks.

### Defaults/deferred work

Document defaults not defined by the authoritative docs, such as message length, pagination, attachment limits, or empty-message handling. Explicitly state that distributed presence, Redis fan-out, typing indicators, read receipts, and unrelated notification work remain deferred if not implemented.

---

## 21. Definition of Done

- ChatMessage persistence and migration exist;
- Chat policy is resource-aware and server-controlled;
- authorized history retrieval works;
- authorized sending works only in the allowed ticket state;
- sender identity comes from the authenticated user;
- close/send concurrency is safe;
- exactly one message is persisted per accepted command;
- internal Chat events emit only after commit;
- the existing central gateway broadcasts only to authorized Chat rooms;
- reconnect resynchronizes authoritative history;
- frontend Chat is integrated into ticket details;
- optional Chat attachments reuse existing File/Attachment/FileStorage infrastructure;
- no duplicate gateway, auth, storage, or message path exists;
- existing ticket lifecycle, Ticket Events, handoff, attachments, authentication, authorization, and concurrency behavior remains intact;
- builds, migrations, tests, and relevant E2E checks pass or are explicitly reported as blocked;
- final implementation report documents all changes, decisions, defaults, and limitations.
