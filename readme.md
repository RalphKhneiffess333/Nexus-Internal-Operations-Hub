# Nexus

## What is Nexus

Nexus is an internal operations service hub. Employees submit requests to departments such as IT and HR. Those requests become tickets that can be claimed, tracked, closed, reopened, modified, or cancelled.

This repository contains a NestJS backend and a React/Vite frontend. Ticket, user, department, and identity-provider data is stored in PostgreSQL. Authentication currently uses Microsoft Entra ID with a server-side session cookie.

## Setup CLI
It is recommended to run the setup CLI to help you with installation.
To run the setup CLI, from the root, call:

```bash
npm run setup
```
If setup CLI fails to run, continue reading this file for step by step initialization.

## What do I need

- Node.js v20+
- npm
- PostgreSQL (a local database you can create and connect to)
- An identity provider organization (Microsoft Entra ID tenant for now)

Optional: an API client such as Postman for manual testing.

## How to install dependencies

Run all install commands from the repository root:

```bash
npm run install
```

This installs the root tooling, backend dependencies, and frontend dependencies. The backend install also generates the Prisma client.

If you prefer to step into each app folder, run:

```bash
npm install
cd backend
npm install
cd ../frontend/nexus
npm install
```

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

### Testing Environment
Tests use a separate database from the one used in production. Create another database in your PostgreSQL and link it in `backend/.env.integration`, use `backend/.env.integration.example` for the template.

## How to configure Microsoft Entra ID

Nexus uses Microsoft Entra ID as its third-party identity provider. Create or use an Entra app registration and add this web redirect URI:

```
http://localhost:3000/authentication/microsoft/callback
```

Then add the Microsoft configuration to `backend/.env`:
NOTICE: For Eurisko Academy instructors, check your emails for Microsoft tenant credentials.

```
MICROSOFT_ENTRA_TENANT_ID=your_tenant_id
MICROSOFT_ENTRA_CLIENT_ID=your_client_id
MICROSOFT_ENTRA_CLIENT_SECRET=your_client_secret
MICROSOFT_ENTRA_REDIRECT_URI=http://localhost:3000/authentication/microsoft/callback
MICROSOFT_ENTRA_SCOPES=openid profile email
FRONTEND_URL=http://localhost:5173
```

The seeded identity-provider record uses the code `MICROSOFT_ENTRA_ID`. Users are linked to Microsoft accounts by `identity_provider_id` and `identity_provider_user_id` after login.

In the organization-locked setup, users are checked through the configured Microsoft tenant to ensure only internal accounts can use the app. 
For current testing, the backend uses Microsoft's `common` login endpoint so any Microsoft work, school, or personal account can be used.

For the frontend, copy `frontend/nexus/.env.example` if you need to override the API origin:

```bash
cd frontend/nexus
cp .env.example .env
```

On Windows PowerShell:

```powershell
cd frontend/nexus
Copy-Item .env.example .env
```

In local Vite development you can leave this empty because `/api` is proxied to the backend:

```
VITE_API_URL=
```

Do not commit `.env`. `.env.example` is the template without real credentials.

From the repository root, apply migrations and load sample users/departments in one go:

```bash
npm run db:setup
```

That root command runs the backend Prisma migrate script and then the seed script.

You can also run the backend commands manually:

```bash
cd backend
npm run prisma:migrate
npm run prisma:seed
```

- `prisma:migrate` creates the schema. A fresh database reaches the required tables by running this once.
- `prisma:seed` upserts the identity provider, IT/HR departments, and sample users. The API does **not** seed on startup. Re-running seed is safe; it will not wipe tickets.



## How to run the app

From the repository root:

```bash
npm run start
```

That runs the NestJS backend and the Vite frontend at the same time. Run migrate and seed first, or the API will fail when it talks to PostgreSQL.

You can also run each app separately:

```bash
npm run start:backend
npm run start:frontend
```

## What URLs does the app open on

The API listens on [http://localhost:3000](http://localhost:3000)

The frontend listens on [http://localhost:5173](http://localhost:5173)

If `PORT` is set in the backend environment, that value is used instead of `3000`.

## Which folders to look at first


| Path                                                | Why                                                               |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| `docs/`                                             | Product specs, architecture, data model, and the current workflow |
| `backend/src/tickets/`                              | Ticket API: controller, service, policies, DTOs, tests            |
| `backend/src/authentication/`                       | Microsoft Entra login, session handling, and request auth         |
| `backend/src/database/`                             | Prisma connection, error mapping, and seed data                   |
| `backend/prisma/`                                   | Schema and migrations                                             |
| `frontend/nexus/src/`                               | React frontend pages, ticket views, API client, and layout        |
| `backend/src/users/` and `backend/src/departments/` | Supporting repositories used by tickets                           |


Start with `backend/src/tickets/tickets.controller.ts` to see the routes, then `tickets.service.ts` and `tickets/policies/`.

## Testing the backend with commands
To run all unit, integration and E2E tests, from the root, run `npm run test`.

To individually run the tests, from the `backend` folder:

```bash
cd backend
npm test
npm run test:integration
npm run test:e2e
```

All require `backend/.env.integration` pointing at a migrated PostgreSQL database. Tests seed sample users/departments and reset ticket rows themselves.

- `npm test` runs unit tests against PostgreSQL. Output lists each test name.
- `npm run test:integration` runs integration tests.
- `npm run test:e2e` hits the HTTP API with supertest.



## Manually testing the backend API (URLs, payloads, data to use)

Base URL: `http://localhost:3000`

Seeded data (loaded by `npm run prisma:seed`, not on every process start):

Priority must be one of: `LOW`, `MODERATE`, `HIGH`.

Use `Content-Type: application/json` on requests that have a body. Replace `:id` with the `ticketId` returned on submit.

Authenticated user session cookie needs to be included in the request.

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
