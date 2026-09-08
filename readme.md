# Nexus

## What is Nexus

Nexus is an internal operations service hub. Employees submit requests to departments such as IT and HR. Those requests become tickets that can be claimed, tracked, closed, reopened, modified, or cancelled.

As of now, this repository currently contains the backend only. Data is stored in memory (no database). Authentication, authorization, chat, attachments, handoffs, and admin features are not implemented yet.

## What do I need installed

- Node.js v20+
- npm

Optional: an API client such as Postman for manual testing.

## How to install dependencies

From the repository root:

```bash
npm --prefix backend install
```

Or from the backend folder:

```bash
cd backend
npm install
```

## How to run the backend

From the repository root:

```bash
npm start
```

That runs the NestJS app. You should see `Nest application successfully started`.

## What URL does the backend open on

The API listens on http://localhost:3000

If PORT is set in the environment, that value is used instead of `3000`. There is no web UI yet.

## Which folders to look at first

| Path | Why |
| --- | --- |
| `docs/` | Product specs, architecture, data model, and the current workflow |
| `backend/src/tickets/` | Ticket API: controller, service, policies, DTOs, tests |
| `backend/src/database/` | In-memory store and seed users/departments |
| `backend/src/users/` and `backend/src/departments/` | Supporting entities used by tickets |

Start with `backend/src/tickets/tickets.controller.ts` to see the routes, then `tickets.service.ts` and `tickets/policies/`.

## Testing the backend with commands

From the `backend` folder:

```bash
cd backend
npm test
npm run test:e2e
```

- `npm test` runs unit tests. Output lists each test name.
- `npm run test:e2e` hits the HTTP API with supertest.

## Manually testing the backend API (URLs, payloads, data to use)

Base URL: `http://localhost:3000`

Seeded data (reset every time the process restarts):

| Kind | ID | Notes |
| --- | --- | --- |
| Department | `dept-it` | Information Technology |
| Department | `dept-hr` | Human Resources |
| User | `user-employee-1` | Alex (`alex@company.com`) |
| User | `user-employee-2` | Sam (`sam@company.com`) |
| User | `user-agent-1` | Jordan (`jordan@company.com`) |
| User | `user-agent-2` | Taylor (`taylor@company.com`) |

Priority must be one of: `LOW`, `MODERATE`, `HIGH`.

Use `Content-Type: application/json` on requests that have a body. Replace `:id` with the `ticketId` returned on submit.

### List tickets

`GET /tickets`

### Submit a ticket (status becomes `OPEN`, no agent)

`POST /tickets`

```json
{
  "title": "Laptop will not start",
  "description": "Black screen on boot",
  "priority": "HIGH",
  "departmentId": "dept-it",
  "submittedBy": "user-employee-1"
}
```

### Get one ticket

`GET /tickets/:id`

### Modify an OPEN ticket

`PATCH /tickets/:id`

```json
{
  "title": "VPN access request",
  "description": "Need VPN for remote work",
  "priority": "LOW",
  "departmentId": "dept-hr"
}
```

All fields are optional, but at least one is required. Only `OPEN` tickets can be modified.

### Claim (OPEN or REOPENED → CLAIMED)

`POST /tickets/:id/claim`

```json
{
  "agentId": "user-agent-1"
}
```

### Close (CLAIMED → CLOSED, agent is cleared)

`POST /tickets/:id/close`

```json
{
  "completionNotes": "Replaced the power adapter"
}
```

`completionNotes` is optional.

### Reopen (CLOSED → REOPENED, no agent)

`POST /tickets/:id/reopen`

```json
{
  "description": "The issue came back after a day"
}
```

`description` is optional. If sent, it replaces the ticket description.

### Cancel

`POST /tickets/:id/cancel`


## What to ignore

- `backend/node_modules/` — installed packages
- `backend/dist/` — compiled output
- `backend/coverage/` — test coverage reports

## How to stop the app

In the terminal where `npm start` is running, press **Ctrl+C**.

In-memory tickets are lost when the process stops.