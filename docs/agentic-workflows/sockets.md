---
title: "Sockets Infrastructure - Nexus"
author: "Ralph Khneiffess"
---
# Task: Implement Nexus Socket.io Real-Time Infrastructure

You are working in the existing **Nexus** codebase, a NestJS/Prisma/PostgreSQL backend with a React/TypeScript frontend.

Implement the reusable Socket.io real-time infrastructure that future Tickets, Chat functionality and others will use.

The architectural rule is mandatory:

```text
Business modules
    ↓ emit internal NestJS events after successful operations
OperationsGateway
    ↓ listens with @OnEvent()
Socket.io rooms and clients
```

Tickets, Chat, and other business modules must not inject or call the WebSocket gateway directly. The gateway is the single broadcast boundary.

Do not implement Chat in this task. Build generic realtime infrastructure and use an existing Ticket operation as the integration example.

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
- `docs/week3-full-stack-delivery.md`
- relevant admin, handoff, and file-attachment documentation
- repository instructions such as `AGENTS.md`, README files, and package scripts

The architecture documentation selects WebSockets for low-latency Chat and realtime ticket updates. The current task explicitly brings WebSocket infrastructure into scope even if an earlier workflow deferred it.

The source code is the final authority for current names, modules, routes, authentication behavior, and transaction boundaries. If documentation differs from the code, preserve valid existing behavior, make the smallest compatible change, and report the discrepancy.

---

## 2. Mandatory repository inspection

Before editing, inspect the implementation end-to-end.

### Backend

Inspect:

- root/backend `package.json` and lockfile
- `src/app.module.ts` and all module registrations
- `prisma/schema.prisma` and migrations
- Prisma/database service and transaction helpers
- Tickets module/controller/service/application service/repositories
- Ticket statuses and lifecycle policies
- Ticket Events creation and retrieval
- existing internal event, notification, or WebSocket code
- Authentication module, Microsoft Entra strategy, session store, logout, expiry, and request context
- exact authenticated user/session contract
- Authorization decorators/guards and role metadata
- Ticket resource authorization policies
- CORS/configuration/environment handling
- global validation and exception handling
- all unit, integration, API E2E, and concurrency tests

### Frontend

Inspect:

- frontend `package.json`, scripts, entry point, and root providers
- Vite/React configuration and API base URL
- authentication/session state and cookie handling
- API client and `credentials` behavior
- state/cache conventions
- ticket list/details/history screens
- existing loading/error/toast conventions
- browser E2E setup

### Confirm before coding

Determine:

1. Whether authentication uses the documented HTTP-only `nexus_session` cookie or another existing credential.
2. How a server request resolves `request.user`.
3. How session expiry, logout, deactivation, and role changes invalidate sessions.
4. Which frontend origins are permitted locally and in configured environments.
5. How Ticket operations commit state and Ticket Events atomically.
6. Which Ticket operation is suitable for the initial `TICKET_UPDATED` event integration.
7. Existing room, event, ID, DTO, and error naming conventions.
8. Whether `socket.io`, `@nestjs/websockets`, `@nestjs/platform-socket.io`, `@nestjs/event-emitter`, or `socket.io-client` are already installed.

Do not begin implementation until these flows are understood.

---

## 3. Scope

Implement:

- compatible Socket.io/NestJS packages and application registration;
- `@nestjs/event-emitter` registration;
- a reusable internal realtime event contract;
- a central authenticated `OperationsGateway` under the existing source conventions;
- Socket.io namespace `operations`;
- authenticated connection/disconnection handling;
- in-memory multi-tab/multi-device socket tracking;
- session expiry/revocation handling;
- authorized room join/leave handlers;
- ticket realtime broadcast integration;
- frontend application-level Socket.io connection lifecycle;
- connection status and reconnect handling;
- tests for all of the above.

Use in-memory connection tracking because the Nexus architecture documents that scope. Do not add Redis or multi-instance infrastructure.

---

## 4. Explicit exclusions

Do not implement:

- Chat models, Chat routes, Chat UI, or Chat message sending;
- a second authentication system;
- JWT authentication if the repository uses server-side sessions;
- direct gateway injection into business modules;
- direct Prisma/database access from the gateway;
- a generic event-sourcing framework;
- Redis, Kafka, RabbitMQ, or cloud pub/sub;
- email notification delivery;
- persisted user-presence records;
- typing indicators, read receipts, reactions, or message features;
- public/global presence dashboards;
- arbitrary client-selected rooms;
- client-controlled user IDs or socket ownership.

The implementation must remain compatible with a later Chat module and more modules.

---

## 5. Packages and application setup

Inspect installed versions first. Install only missing packages compatible with the existing NestJS version:

Backend:

- `@nestjs/websockets`
- `@nestjs/platform-socket.io`
- `socket.io`
- `@nestjs/event-emitter`

Frontend:

- `socket.io-client`

Register `EventEmitterModule.forRoot()` once at the application root using the repository’s conventions. Register a `RealtimeModule` in `AppModule` without creating circular dependencies.

Do not upgrade unrelated packages. Run the actual package scripts after installation.

---

## 6. Internal event constants and envelopes

Create a dedicated location consistent with the project, such as:

```text
src/realtime/realtime-events.constants.ts
src/realtime/realtime-event.types.ts
```

Keep internal NestJS event names separate from external Socket.io event names.

Define only events needed by the current scope, likely:

```text
TICKET_UPDATED
TICKET_EVENT_CREATED
SESSION_INVALIDATED
```

Use typed payloads. A safe envelope may conceptually contain:

```ts
type RealtimeEnvelope<T> = {
  eventId: string;
  occurredAt: string;
  version: number;
  ticketId?: string;
  actorId?: string;
  payload: T;
};
```

Adapt to repository naming. Never expose Prisma objects, session IDs, cookies, storage paths, secrets, or raw exceptions.

Rules:

- emit only after the database transaction commits;
- do not emit for rejected or rolled-back operations;
- use persisted IDs as stable event identifiers;
- keep payloads small and safe;
- listener failure must not undo a committed database operation.

---

## 7. Central OperationsGateway

Create the gateway in the repository-appropriate location, conceptually:

```text
src/realtime/operations.gateway.ts
```

Use a Socket.io namespace named `operations` and configured CORS:

```ts
@WebSocketGateway({
  namespace: 'operations',
  cors: {
    origin: configuredFrontendOrigins,
    credentials: true,
  },
})
```

Never use wildcard CORS with credentials. Reuse current configuration and local origins.

Implement `OnGatewayConnection` and `OnGatewayDisconnect`.

The gateway owns only:

- Socket.io setup;
- handshake authentication through the existing Authentication service;
- connection bookkeeping;
- authorized room membership;
- internal-event listeners;
- safe broadcasts;
- presence and session-expiry disconnects.

It must not own:

- ticket mutations;
- Ticket Event creation;
- Prisma access;
- Chat business logic;
- resource policy implementation;
- file storage.

Use `@OnEvent()` to broadcast internal events. Business services must emit events through `EventEmitter2`, not call the gateway.

---

## 8. WebSocket authentication

Reuse Nexus Authentication exactly.

The documented architecture uses an opaque server-side session and HTTP-only cookie. Therefore:

- do not read the HTTP-only cookie from frontend JavaScript;
- use `withCredentials: true` in the Socket.io client where needed;
- configure backend CORS with the exact allowed origin and `credentials: true`;
- validate the handshake cookie through the existing session service;
- do not duplicate session lookup or user provisioning;
- do not trust a client-provided `userId`;
- never log cookies or tokens.

If the repository already supports a separate WebSocket token, pass it through Socket.io `auth` and validate it through the same Authentication contract. Do not invent JWT merely because Socket.io examples use tokens.

On connection, store only the authenticated context needed for lifecycle management, conceptually:

```ts
client.data.userId
client.data.sessionId
```

Reject missing, invalid, expired, revoked, inactive, or unauthorized sessions and disconnect safely.

Session expiry/revocation:

- reuse the existing Authentication session lifetime and sliding rules;
- touch sessions through Authentication when an authenticated application packet counts as activity;
- do not manipulate the session store directly from the gateway;
- listen for an internal session invalidation event if one is needed;
- disconnect affected sockets after logout, deactivation, role change, or explicit revocation;
- reconnect must perform a fresh handshake.

---

## 9. Connection and presence lifecycle

Use structures that support multiple tabs/devices:

```ts
Map<socketId, { userId: string; sessionId?: string }>
Map<userId, Set<socketId>>
```

On connection:

1. Authenticate the socket.
2. Store mappings.
3. Join a private user room such as `user:{userId}`.
4. Ensure cleanup is possible if later initialization fails.

On disconnect:

1. Capture relevant room memberships before cleanup.
2. Remove the socket from all mappings.
3. Mark the user offline only when their last socket disappears.
4. Broadcast transient presence only to relevant authorized rooms if the current UI uses it.
5. Make cleanup idempotent.

Do not persist a presence table. The product documents in-memory tracking only. Do not invent a durable “away” state; expose frontend connection states such as `connected`, `reconnecting`, and `offline` instead.

Document the single-process limitation in the final report.

---

## 10. Authorized rooms and socket handlers

Use room builders/constants rather than scattered strings. A reasonable model is:

```text
user:{userId}
ticket:{ticketId}
```

Chat rooms are intentionally deferred to the Chat prompt.

Implement authenticated acknowledgement-based handlers for:

- join ticket room;
- leave ticket room.

The client may submit a ticket ID, but the server must:

1. resolve the ticket;
2. apply the existing Ticket visibility/resource policy;
3. join only after authorization succeeds;
4. return a safe success/error acknowledgement.

Do not let a client submit an arbitrary room string. Joining a ticket room must not grant permission to mutate or operate on the ticket.

Use current not-found/forbidden semantics without leaking protected ticket existence.

---

## 11. Ticket integration example

Extend the existing Tickets application/service layer.

For at least one existing successful operation, preferably all relevant ticket mutations, do this:

1. authenticate and authorize through the existing paths;
2. perform the existing concurrency-safe transaction;
3. create the existing Ticket Event where required;
4. commit;
5. emit a typed `TICKET_UPDATED` and/or `TICKET_EVENT_CREATED` internal event.

Inspect and consider:

- submission;
- claim;
- close;
- reopen;
- modification/cancellation;
- handoff operations if already implemented.

Do not alter existing lifecycle semantics or claim locking. Do not create a new Ticket Event solely for realtime delivery.

The gateway should broadcast safe updates to `ticket:{ticketId}`. The frontend must treat the API/database as authoritative and refresh or merge state when the event arrives.

If event delivery fails, the committed ticket operation must remain valid and the next fetch/reconnect must resynchronize it.

---

## 12. Frontend connection lifecycle

Create one application-level React provider or hook following current conventions, conceptually:

```text
src/realtime/OperationsSocketProvider.tsx
src/realtime/useOperationsSocket.ts
```

Do not create a separate Socket.io connection per component.

Use an equivalent of:

```ts
io(`${API_BASE_URL}/operations`, {
  autoConnect: false,
  withCredentials: true,
});
```

Only pass an `auth` token if the existing Authentication implementation explicitly requires one. Never copy an HTTP-only cookie into JavaScript state or local storage.

Requirements:

- connect when the authenticated application shell mounts;
- disconnect and remove listeners on unmount/logout;
- avoid duplicate connections/listeners under React Strict Mode;
- expose `connecting`, `connected`, `reconnecting`, `disconnected`, and `error` states as appropriate;
- handle `connect`, `disconnect`, `connect_error`, and reconnect events;
- show a subtle status indicator consistent with the existing UI;
- do not block normal HTTP ticket use when realtime is unavailable;
- reconnect with fresh authentication after login/session changes.

---

## 13. Reconnect behavior

Socket delivery is not the source of truth.

After reconnect:

1. rejoin authorized ticket rooms currently needed by the UI;
2. refetch or synchronize the affected ticket data/history through HTTP;
3. merge by stable event/ticket IDs;
4. avoid duplicate state updates;
5. clear stale connection errors when synchronization succeeds.

Incoming events must be runtime-validated and treated as untrusted input. Do not append blindly or assume local state is authoritative.

---

## 14. Tests

Follow current testing conventions and preserve existing tests.

Cover:

### Setup

- compatible package versions;
- EventEmitterModule and RealtimeModule registration;
- namespace and configured CORS;
- backend/frontend builds.

### Authentication

- valid session connects;
- missing/invalid/expired/revoked/inactive session is rejected;
- client-supplied user identity cannot impersonate another user;
- session invalidation disconnects affected sockets;
- reconnect performs a fresh authentication check.

### Presence

- first socket is tracked;
- multiple tabs remain online;
- one of two sockets disconnecting does not mark the user offline;
- last socket disconnecting does;
- cleanup is idempotent;
- no presence database records are created.

### Rooms

- authorized ticket room join succeeds;
- unauthorized join fails;
- arbitrary room names cannot be joined;
- leave/reconnect behavior is correct.

### Internal events

- a committed Ticket operation emits the expected event;
- a rolled-back/rejected operation emits none;
- the gateway broadcasts only to the correct room;
- payloads do not leak private data;
- business services do not inject the gateway.

### Frontend

- provider connects on mount and disconnects on cleanup;
- listeners are not duplicated under Strict Mode;
- connection status/errors render safely;
- reconnect rejoins/synchronizes rooms;
- stale or duplicate events do not corrupt state.

Use Socket.io integration tests where configured and add one meaningful browser flow if the existing browser infrastructure supports it.

---

## 15. Repository-wide verification search

Search for:

```text
socket
Socket.io
WebSocket
gateway
EventEmitter
OnEvent
connect
disconnect
reconnect
presence
session
TICKET_UPDATED
TicketEvent
```

Ensure there is one central broadcast path and no alternate gateway/direct-Prisma paths.

---

## 16. Before coding: output an implementation plan

Before making edits, provide a concise repository-grounded plan covering:

1. Current packages and missing dependencies.
2. Current AppModule and module graph.
3. Current session/cookie authentication transport.
4. Socket handshake authentication strategy.
5. Current authorization and ticket visibility policy.
6. Ticket transaction/event architecture.
7. Proposed internal/external event constants.
8. Proposed namespace and rooms.
9. Connection/presence maps and session revalidation.
10. Frontend provider location and reconnect strategy.
11. Files to create/modify.
12. Documentation/code discrepancies.

Then implement the feature. Do not stop after the plan unless a genuine blocker exists.

---

## 17. Final implementation report

Report:

### Files created and modified

List every file.

### Packages/setup

Explain dependencies, module registration, namespace, CORS, and environment configuration.

### Events

Document internal constants, external Socket.io events, envelope shape, and post-commit emission timing.

### Gateway

Explain authentication, room authorization, listeners, broadcasts, errors, and session invalidation.

### Presence

Explain maps, multi-tab behavior, cleanup, visibility scope, and single-process limitations.

### Ticket integration

Explain which successful Ticket operations emit realtime events and how existing transactions/concurrency were preserved.

### Frontend

Explain provider/hook, credentials, connection states, cleanup, reconnect, and synchronization.

### Tests and verification

List commands run and results. Distinguish passed, failed, skipped, and blocked checks.

### Defaults/deferred work

Document implementation defaults that were not specified by the docs, and explicitly state that Chat functionality, distributed presence, Redis fan-out, and unrelated notification features remain deferred.

---

## 18. Definition of Done

- packages are compatible and installed;
- EventEmitterModule is registered once;
- central authenticated `operations` gateway exists;
- business modules emit events instead of calling the gateway;
- events are emitted only after successful commits;
- ticket room joins are authorized;
- invalid/revoked sessions cannot use sockets;
- multi-tab/multi-device tracking is correct;
- disconnect cleanup is safe;
- frontend connection lifecycle is mounted once and cleaned up;
- reconnect performs room rejoin and authoritative synchronization;
- ticket updates broadcast safely;
- existing Ticket Events, authentication, authorization, and concurrency behavior remains intact;
- builds/tests/migrations relevant to this scope pass;
- Chat was not implemented in this task;
- final report documents all changes, defaults, limitations, and verification results.
