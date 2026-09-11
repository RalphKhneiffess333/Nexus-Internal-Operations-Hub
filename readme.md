# Nexus

## What is Nexus

Nexus is an internal operations service hub. Employees submit requests to departments such as IT and HR. Those requests become tickets that can be claimed, tracked, closed, reopened, modified, or cancelled.

As of now, this repository currently contains the backend only. Ticket, user, and department data is stored in PostgreSQL. Authentication, authorization, chat, attachments, handoffs, and admin features are not implemented yet.

## What do I need installed

- Node.js v20+
- npm
- PostgreSQL (a local database you can create and connect to)

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

`npm install` also generates the Prisma client.

## How to set up PostgreSQL

Create an empty PostgreSQL database (for example `nexus`). Then copy the example env file and fill in your connection details:

```bash
cd backend
cp .env.example .env
```

On Windows PowerShell:

```powershell
cd backend
Copy-Item .env.example .env
```

Edit `backend/.env`. Prisma migrate and seed use `DATABASE_URL`. The Nest app uses that URL when it is set, or builds one from the other variables.

```
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=nexus
DATABASE_USER=your_user
DATABASE_PASSWORD=your_password
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/nexus
```

Do not commit `.env`. `.env.example` is the template without real credentials.

From `backend`, apply migrations, then load sample users and departments:

```bash
cd backend
npm run prisma:migrate
npm run prisma:seed
```

- `prisma:migrate` creates the schema. A fresh database reaches the required tables by running this once.
- `prisma:seed` upserts the identity provider, IT/HR departments, and sample users. The API does **not** seed on startup. Re-running seed is safe; it will not wipe tickets.



## How to run the backend

From the repository root:

```bash
npm start
```

That runs the NestJS app. You should see `Nest application successfully started`. Run migrate and seed first, or the API will fail when it talks to PostgreSQL.

## What URL does the backend open on

The API listens on [http://localhost:3000](http://localhost:3000)

If PORT is set in the environment, that value is used instead of `3000`. There is no web UI yet.

## Which folders to look at first


| Path                                                | Why                                                               |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| `docs/`                                             | Product specs, architecture, data model, and the current workflow |
| `backend/src/tickets/`                              | Ticket API: controller, service, policies, DTOs, tests            |
| `backend/src/database/`                             | Prisma connection, error mapping, and seed data                   |
| `backend/prisma/`                                   | Schema and migrations                                             |
| `backend/src/users/` and `backend/src/departments/` | Supporting repositories used by tickets                           |


Start with `backend/src/tickets/tickets.controller.ts` to see the routes, then `tickets.service.ts` and `tickets/policies/`.

## Testing the backend with commands

From the `backend` folder:

```bash
cd backend
npm test
npm run test:e2e
```

Both require `backend/.env` pointing at a migrated PostgreSQL database. Tests seed sample users/departments and reset ticket rows themselves.

- `npm test` runs unit tests against PostgreSQL. Output lists each test name.
- `npm run test:e2e` hits the HTTP API with supertest.



## Manually testing the backend API (URLs, payloads, data to use)

Base URL: `http://localhost:3000`

Seeded data (loaded by `npm run prisma:seed`, not on every process start):


| Kind       | ID                | Notes                         |
| ---------- | ----------------- | ----------------------------- |
| Department | `dept-it`         | Information Technology        |
| Department | `dept-hr`         | Human Resources               |
| User       | `user-employee-1` | Alex (`alex@company.com`)     |
| User       | `user-employee-2` | Sam (`sam@company.com`)       |
| User       | `user-agent-1`    | Jordan (`jordan@company.com`) |
| User       | `user-agent-2`    | Taylor (`taylor@company.com`) |


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

## How to stop the app

In the terminal where `npm start` is running, press **Ctrl+C**.

Tickets, users, and departments stay in PostgreSQL after the process stops.