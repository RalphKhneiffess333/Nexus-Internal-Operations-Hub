# Nexus Current API Contract

This document is the current implementation reference for the Nexus HTTP and Socket.io APIs. It is intentionally based on the controllers, DTOs, response mappers, and realtime types in the repository.

The workflow documents under `docs/agentic-workflows/` describe implementation intent and historical scope. When one of those documents contains a conceptual route or an older example, this document and the source code are authoritative.

## Conventions

- The NestJS backend exposes routes directly at the paths below. It does not add a global `/api` prefix.
- The Vite development server proxies `/api/*` to the backend and removes `/api`; this is a frontend transport convention, not part of the backend route path.
- Protected routes use the HTTP-only `nexus_session` cookie and explicit `Employee`, `Agent`, or `Admin` role metadata.
- Validation uses a global whitelist pipe with unknown fields rejected. Validation failures use `400 Bad Request`.
- Errors are returned as `{ "statusCode": number, "message": string | string[] }`. Internal failures are sanitized.
- Paginated responses use one of these envelopes:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 25,
  "hasMore": false
}
```

Administration list endpoints that use counted pagination additionally return `total`. Handoff lists additionally return `pendingCount`.

## Authentication

| Method | Route | Access | Contract |
|---|---|---|---|
| GET | `/authentication/microsoft/login` | Public | Starts the Microsoft login flow and sets the temporary auth-state cookie. |
| GET | `/authentication/microsoft/callback?code=...&state=...` | Public | Completes login, creates the session cookie, and redirects to the frontend. |
| GET | `/authentication/me` | Public | Returns `{ user: AuthenticatedRequestUser | null }`. |
| POST | `/authentication/logout` | Public | Clears the current session and returns `{ loggedOut: true }`. |
| POST | `/authentication/logout-all-devices` | Authenticated | Revokes the user's sessions and returns `{ loggedOut: true }`. |

## Tickets

### Ticket creation and lifecycle

`POST /tickets` accepts JSON for text-only requests and multipart form data when files are attached.

Text fields:

```json
{
  "title": "Badge access",
  "description": "Need building access",
  "priority": "MODERATE",
  "departmentId": "dept-it"
}
```

Multipart requests use the same fields plus repeated `files` fields. `submittedBy` is not accepted from the client; the authenticated request user becomes the submitter.

| Method | Route | Access | Body/query |
|---|---|---|---|
| POST | `/tickets` | Employee, Agent, Admin | `title`, `description`, `priority`, `departmentId`, optional `files` |
| GET | `/tickets` | Employee, Agent, Admin | `scope`, `page`, `pageSize`, `search`, `status`, `departmentId`, `priority`, `includeInactive` |
| GET | `/tickets/pool/count` | Agent, Admin | No body |
| GET | `/tickets/:id` | Employee, Agent, Admin | Optional `view=chat` returns the chat ticket context |
| PATCH | `/tickets/:id` | Employee, Agent, Admin | Optional ticket fields plus optional `removedAttachmentIds` and `files` |
| POST | `/tickets/:id/claim` | Agent, Admin | No body; actor is derived from the session |
| POST | `/tickets/:id/close` | Agent, Admin | Optional `completionNotes` and `files` |
| POST | `/tickets/:id/reopen` | Employee, Agent, Admin | Optional `description` and `files` |
| POST | `/tickets/:id/cancel` | Employee, Agent, Admin | No body |

Ticket detail responses contain the current ticket fields, a nested `department`, nested `submittedBy` and `agent` profiles, and a `permissions` object. List responses use smaller user references and are wrapped in the pagination envelope.

### Ticket history and attachments

| Method | Route | Contract |
|---|---|---|
| GET | `/tickets/:id/events?page=&pageSize=` | Paginated event summaries: `items`, `page`, `pageSize`, `hasMore` |
| GET | `/tickets/:id/events/:eventId` | Full server-generated event, including safe details and attachment metadata |
| GET | `/tickets/:id/attachments` | Latest attachment-event summary for the ticket |
| GET | `/tickets/:id/events/:eventId/attachments/:attachmentId` | Authorized streamed file download |

There is no generic client-controlled `POST /ticket-events`, event update route, or event delete route. Lifecycle services create events server-side.

## Departments and priorities

| Method | Route | Access | Contract |
|---|---|---|---|
| GET | `/departments?scope=all\|mine` | Employee, Agent, Admin | Active departments as an array |
| GET | `/priorities` | Employee, Agent, Admin | Active priorities as an array |

Administrator routes for all priorities are documented below. Priority codes are administrator-managed strings; `LOW`, `MODERATE`, and `HIGH` are seeded defaults, not an exhaustive API enum.

## Handoffs

The implemented inbox/outbox API uses one route with a direction query parameter. The conceptual `/tickets/handoffs`, `/handoffs/incoming`, and `/handoffs/outgoing` aliases are not implemented.

| Method | Route | Access | Contract |
|---|---|---|---|
| GET | `/handoffs?direction=all\|incoming\|outgoing&page=&pageSize=&status=&ticketId=&search=&departmentId=&requesterId=&requestedAgentId=` | Agent, Admin | Paginated handoff list plus `pendingCount` |
| GET | `/handoffs/participants` | Agent, Admin | Participant summaries as an array |
| POST | `/handoffs/:handoffId/accept` | Agent, Admin | Accepts the pending request |
| POST | `/handoffs/:handoffId/reject` | Agent, Admin | Rejects the pending request |
| POST | `/handoffs/:handoffId/cancel` | Agent, Admin | Cancels the pending request |
| GET | `/tickets/:id/handoffs/eligible-agents` | Agent, Admin | Eligible target-agent summaries |
| GET | `/tickets/:id/handoffs?...` | Agent, Admin | Handoffs for one ticket |
| POST | `/tickets/:id/handoffs` | Agent, Admin | `{ requestedAgentId, message? }`; requester is derived from the session |

Handoff list responses use reduced requester/requested-agent references. Mutation responses include the fuller user summaries, ticket, department, status, message, and timestamps.

## Chat

| Method | Route | Access | Contract |
|---|---|---|---|
| GET | `/chats?search=&page=&pageSize=` | Employee, Agent, Admin | Paginated conversation inbox |
| POST | `/chats/:ticketId/read` | Employee, Agent, Admin | Marks the conversation read; empty success response |
| GET | `/tickets/:ticketId/chat/messages?page=&pageSize=` | Employee, Agent, Admin | Paginated chronological message history |
| POST | `/tickets/:ticketId/chat/messages` | Employee, Agent, Admin | JSON or multipart `content` plus optional `files`; sender is derived from the session |
| GET | `/tickets/:ticketId/chat/messages/:messageId/attachments/:attachmentId` | Employee, Agent, Admin | Authorized streamed file download |

Inbox search matches ticket code, ticket title, latest message content, and latest message sender name. A message must contain text or at least one attachment.

## Administration

All routes below require the `Admin` role.

| Method | Route | Contract |
|---|---|---|
| GET | `/admin/users?page=&pageSize=&search=&status=&departmentId=&hasLogged=` | Counted paginated users |
| POST | `/admin/users` | Pre-provision user: `email`, `fullName`, optional `phoneNumber`, `role` |
| PATCH | `/admin/users/:userId/role` | `{ role }` |
| PATCH | `/admin/users/:userId/status` | `{ active }` |
| POST | `/admin/users/:userId/departments/:departmentId` | Adds membership |
| DELETE | `/admin/users/:userId/departments/:departmentId` | Removes membership |
| GET | `/admin/departments?page=&pageSize=&search=` | Counted paginated departments |
| POST | `/admin/departments` | `code`, `name`, `description` |
| PATCH | `/admin/departments/:departmentId` | Optional `code`, `name`, `description` |
| DELETE | `/admin/departments/:departmentId` | Deactivates the department |
| POST | `/admin/departments/:departmentId/reactivate` | Reactivates the department |
| GET | `/admin/departments/:departmentId/members?page=&pageSize=&search=` | Counted paginated members |
| GET | `/admin/priorities` | All priorities, including inactive |
| POST | `/admin/priorities` | `code`, `name`, `reminderIntervalMinutes` |
| PATCH | `/admin/priorities/:priorityId` | Optional `name`, `reminderIntervalMinutes` |
| DELETE | `/admin/priorities/:priorityId` | Deactivates the priority |
| POST | `/admin/priorities/:priorityId/reactivate` | Reactivates the priority |
| GET | `/admin/configurations` | Supported configuration entries |
| PATCH | `/admin/configurations/:key` | `{ value }` |
| GET | `/admin/audit-logs/activity?page=&pageSize=&source=&auditAction=&ticketAction=` | Paginated combined activity feed |
| GET | `/admin/audit-logs/:auditLogId` | One audit log with details |

There are intentionally no admin audit-log update or delete routes. There are also no dedicated `GET /admin/users/:userId`, `GET /admin/users/:userId/departments`, `GET /admin/departments/:departmentId`, or `GET /admin/audit-logs` collection routes.

## Other implemented API

| Method | Route | Access | Contract |
|---|---|---|---|
| GET | `/users/:userId` | Employee, Agent, Admin | Safe user profile response |
| GET | `/dashboard/summary` | Employee, Agent, Admin | Dashboard summary for the authenticated user |

## AI assistant

| Method | Route | Access | Body/response |
|---|---|---|---|
| POST | `/ai/messages` | Employee, Agent, Admin | `{ message, conversationId? }`; returns an assistant message, optional `PREFILL_TICKET` action, and a server-issued `conversationId` |

The current AI scope is general request assistance. It provides guidance first and asks for confirmation before optionally prefilling the submission form with current department and priority configuration. It does not inspect or search tickets and never submits a ticket automatically.

## Socket.io API

The gateway uses the `operations` namespace and the HTTP-only session cookie for authentication.

Client events:

- `join ticket room` / `leave ticket room` with `{ ticketId }`
- `join chat room` / `leave chat room` with `{ ticketId }`

Room acknowledgements are `{ ok: true }` or `{ ok: false, code }`, where the error codes include `UNAUTHORIZED`, `INVALID_TICKET`, and `TICKET_UNAVAILABLE`.

Server events include `operations.connected`, `operations.error`, `ticket.updated`, `ticket.event.created`, `chat.message.created`, and `app.notification`.

Ticket and chat events use an envelope containing `eventId`, `occurredAt`, `version`, `ticketId`, `actorId`, and `payload`. Application notifications use a separate envelope with recipient user IDs and notification payload data.

The current gateway configuration uses `origin: true` with credentials. This matches the current implementation but should be restricted to configured frontend origins before production deployment.

## Not currently exposed

The following documented or conceptual interfaces are not implemented as standalone routes:

- `POST /ticket-events` or any Ticket Event mutation endpoint.
- `GET /files/:fileId` and `GET /attachments/:attachmentId/file`; downloads are resource-scoped nested routes.
- A generic admin audit-log collection endpoint at `/admin/audit-logs`.
- Date-range or actor filters on the combined administration activity endpoint.
- An email-provider HTTP API or reminder-worker endpoint.
