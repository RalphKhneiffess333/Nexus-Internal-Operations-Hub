# Nexus

## 1. What is Nexus

Nexus is an internal operations service hub. Employees submit requests to departments such as IT and HR. Those requests become tickets that can be claimed, tracked, closed, reopened, modified, or cancelled.

This repository contains a NestJS backend and a React/Vite frontend. Ticket, user, department, and identity-provider data is stored in PostgreSQL. Authentication currently uses Microsoft Entra ID with a server-side session cookie.

Sections 2 to 12 cover app setup while sections 13 to 16 cover app behavior and testing workflow.

The current HTTP and Socket.io routes, query parameters, request bodies, response envelopes, and intentionally unexposed routes are documented in [docs/api-contract.md](docs/api-contract.md). The longer workflow documents in `docs/agentic-workflows/` contain historical implementation guidance where explicitly noted.

## 2. Setup CLI
It is recommended to run the setup CLI to help you with installation then skip to section 13.
To run the setup CLI, from the root, call:

```bash
npm run setup
```
If setup CLI fails to run, continue reading this file for step by step initialization.

## 3. What do I need

- Node.js v20+
- npm
- PostgreSQL (a local database you can create and connect to)
- An identity provider organization (Microsoft Entra ID tenant for now)
- A Groq API key if you want to use the AI assistant or run `npm run eval`
- An SMTP provider account if you want transactional email notifications

The Groq API key and SMTP account are optional for the core ticket application.
They are required only for their respective integrations. An API client such as
Postman is also optional for manual testing.

## 4. How to install dependencies

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

## 5. How to set up PostgreSQL

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

## 6. Testing Environment
Tests use a separate database from the one used in production. Create another database in your PostgreSQL and link it in `backend/.env.integration`, use `backend/.env.integration.example` for the template. The integration template keeps SMTP disabled by default; add a Groq key there only when you want AI responses while running `npm run start:test`.

## 7. How to configure Microsoft Entra ID

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

## 8. Optional Integrations

### Email Notifications

Nexus can send asynchronous transactional emails through Nodemailer over SMTP after successful ticket and handoff operations. Email delivery is isolated from the request path: missing configuration, provider failures, and exhausted retries are logged and dropped without failing the ticket operation.

Add these values to `backend/.env` when email delivery is needed:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password
SMTP_FROM_EMAIL=noreply@example.com
SMTP_FROM_NAME=Nexus
SMTP_ENABLED=true
SMTP_TIMEOUT_MS=10000
EMAIL_MAX_ATTEMPTS=3
EMAIL_RETRY_DELAY_MS=250
APP_BASE_URL=http://localhost:5173
```

The system emails ticket submission, claim, close, reopen, and handoff request/accept/reject events. It intentionally does not email ticket cancellation or automatic handoff-cancellation events. Email delivery has no database outbox or idempotency records; each successful domain operation schedules one best-effort notification with bounded retries.

`SMTP_HOST` and `SMTP_FROM_EMAIL` must be configured for delivery to be
enabled. Set `SMTP_ENABLED=false` when running tests or when email is not
needed. Port `465` is treated as secure automatically; otherwise set
`SMTP_SECURE=true` when your provider requires TLS.

### AI Assistant (Groq)

The Nexus assistant runs through Groq from the backend. Keep the API key in
`backend/.env`; it must never be placed in the frontend environment.

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=qwen/qwen3.8-27b
AI_RETRY_DELAY_MS=250
```

`GROQ_API_KEY` is required for live assistant responses and `npm run eval`.
`GROQ_MODEL` defaults to `qwen/qwen3.8-27b`, and
`AI_RETRY_DELAY_MS` controls the delay between retry attempts. If the key is
missing or Groq is unavailable, the rest of the application can still start,
but AI requests return a conversational fallback and the technical failure is
logged by the backend.

### Other backend settings

These settings are already included in `backend/.env.example` and can be
adjusted when needed:

```env
PORT=3000
FILE_UPLOAD_DIR=uploads
BACKGROUND_WORKERS_ENABLED=true
ORPHANED_FILE_CLEANUP_INTERVAL_MS=3600000
AUDIT_LOG_CLEANUP_INTERVAL_MS=86400000
UNCLAIMED_TICKET_REMINDER_INTERVAL_MS=300000
FILE_ORPHAN_GRACE_PERIOD_MS=3600000
```

`APP_BASE_URL` is used in email links and should point to the frontend URL in
the environment where the application is running. The complete variable
templates are [backend/.env.example](backend/.env.example),
[backend/.env.integration.example](backend/.env.integration.example), and
[frontend/nexus/.env.example](frontend/nexus/.env.example).

## 9. Frontend Optional Configuration
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

## 10. Initializing Database
From the repository root, apply migrations and load sample departments in one go:

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

### Bulk load-test data

Use the bulk seed commands when you want to exercise pagination, filtering, ticket history, chat history, and the UI with a larger dataset:

```bash
# Uses backend/.env
npm run seed:bulk

# Uses backend/.env.integration
npm run seed:bulk:test
```

The test bulk seed refuses to run if `backend/.env.integration` points to the normal application database. Both commands apply pending migrations, preserve non-bulk data, and replace only the synthetic rows generated by the same profile when rerun.

By default, the seed creates 30 employees, 15 agents, 5 admins, tickets for every active user across every active department and all four ticket states, 3 tickets per user/state/department combination, and 20 chat messages per ticket. Claimed tickets also receive synthetic handoff requests distributed across Pending, Accepted, Rejected, and Cancelled states. Synthetic ticket events and chat read receipts are created in batches as well.

Adjust the volume before running a command with these environment variables:

```text
BULK_EMPLOYEES=30
BULK_AGENTS=15
BULK_ADMINS=5
BULK_TICKETS_PER_USER_STATE_DEPARTMENT=3
BULK_CHAT_MESSAGES_PER_TICKET=20
BULK_BATCH_SIZE=500
```

The setup wizard asks whether to bulk seed the normal database, the test database, both, or neither immediately before starting the app. If one selected database fails, the wizard reports the error, attempts the remaining target, and asks whether to continue startup or cancel.

## 11. Managing users and roles

When someone signs in with Microsoft Entra ID and no matching Nexus user exists yet, Nexus automatically creates a local user record with the `Employee` role.

Use the interactive users CLI when you need to preconfigure users, promote a user to `Agent` or `Admin`, or assign an agent/admin to departments:

```bash
npm run seed:users
```

The CLI uses `backend/.env`, connects to the configured `DATABASE_URL`, and can:

- Add a new user before their first login.
- Modify an existing user.
- Change a user's role between `Employee`, `Agent`, and `Admin`.
- Assign departments to `Agent` and `Admin` users.

This is especially useful for manual testing because ticket pool and department views depend on the signed-in user's role and department memberships.

## 12. Testing with commands

To run all unit, integration, API E2E, and browser E2E tests, from the root, run:

```bash
npm run test
```

To individually run the tests, from the `backend` folder:

```bash
cd backend
npm test
npm run test:integration
npm run test:api:e2e
npm run test:browser:e2e
npm run test:e2e
```

All require `backend/.env.integration` pointing at a separate PostgreSQL database. Test startup applies Prisma migrations to that database, then seeds sample users/departments and resets ticket rows.

- `npm test` runs Jest unit tests and any `.spec.ts` tests in `backend/src`.
- `npm run test:integration` runs the Jest integration suite.
- `npm run test:api:e2e` runs Playwright API E2E tests against a built Nest app.
- `npm run test:browser:e2e` runs Playwright browser E2E tests against the backend and frontend.
- `npm run test:e2e` runs both API E2E and browser E2E tests.

### Model-backed AI evaluations

Run the representative AI evaluations from the repository root:

```bash
npm run eval
```

This command runs only the model-backed AI eval runner. It uses the existing Groq provider, so `backend/.env` must contain `GROQ_API_KEY`; `GROQ_MODEL` is optional. The runner uses fixed in-memory departments, priorities, and ticket-access results, so it does not require PostgreSQL or a running Nexus server. It makes real Groq requests and reports the clear, thin, ambiguous, trusted-context, conditional-prefill, supplied-evidence, damage-prevention, and repeatability cases separately.

NOTICE: If you're on a limited tier, only a select number of evals may pass before getting hit with a rate limit failure.

## 13. How to run the app

From the repository root:

```bash
npm run start
```

That runs the NestJS backend and the Vite frontend at the same time. Run migrate and seed first, or the API will fail when it talks to PostgreSQL.

Conversely you can also run
```bash
npm run start:test
```
To run the server in test mode allowing you to bypass third party authentication.

### Start in local test-authentication mode

Use test mode when you want to exercise authenticated browser or API behavior
without signing in through Microsoft Entra. First configure
`backend/.env.integration` with a PostgreSQL database reserved for testing. You
can create it from `backend/.env.integration.example` if it does not exist yet.

From the repository root, run:

```bash
npm run start:test
```

The command starts the backend and frontend together, just like `npm run start`,
but the backend uses `backend/.env.integration` instead of the normal
`backend/.env` database configuration. During startup it:

1. Verifies that the integration and normal `DATABASE_URL` values do not target
   the same PostgreSQL database and schema.
2. Applies pending Prisma migrations to the integration database.
3. Creates or updates the seven test users and their department memberships.
4. Starts test-only authentication endpoints.
5. Creates an in-memory session for every test user and prints a directly usable
   `Cookie` header value for each one.

The seeded users are:

| User       | Role       | Department             |
| ---------- | ---------- | ---------------------- |
| Employee 1 | `Employee` | None                   |
| Employee 2 | `Employee` | None                   |
| IT Agent 1 | `Agent`    | Information Technology |
| IT Agent 2 | `Agent`    | Information Technology |
| HR Agent 1 | `Agent`    | Human Resources        |
| HR Agent 2 | `Agent`    | Human Resources        |
| Admin      | `Admin`    | Information Technology |

#### Sign in through the frontend

Open [http://localhost:5173](http://localhost:5173). When the test backend is
running, the landing page automatically detects it and displays a **Test mode**
user selector. Select a user and choose **Sign in as test user**. The backend
creates a fresh session, sets the normal secure HTTP-only `nexus_session`
cookie, and the rest of the application uses the regular authentication and
authorization flow.

#### Authenticate an API client

The backend prints an entry like this for every seeded user:

```text
IT Agent 1 (Agent)
Cookie: nexus_session=SESSION_ID
```

Copy the complete key-value pair into an API client's `Cookie` header:

```http
Cookie: nexus_session=SESSION_ID
```

The printed sessions are stored in memory. Restarting the backend invalidates
them and prints new values. Restarting test mode does not clear existing test
tickets from the integration database.

## 14. What URLs does the app open on

The API listens on [http://localhost:3000](http://localhost:3000)

The frontend listens on [http://localhost:5173](http://localhost:5173)

If `PORT` is set in the backend environment, that value is used instead of `3000`.

## 15. Which folders to look at first


| Path                                                | Why                                                               |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| `docs/`                                             | Product specs, architecture, data model, and the current workflow |
| `backend/src/tickets/`                              | Ticket API: controller, service, policies, DTOs, tests            |
| `backend/src/authentication/`                       | Microsoft Entra login, session handling, and request auth         |
| `backend/src/authorization/`                        | Global authorization guard, public routes, and role decorators    |
| `backend/src/database/`                             | Prisma connection, error mapping, and seed data                   |
| `backend/prisma/`                                   | Schema and migrations                                             |
| `frontend/nexus/src/`                               | React frontend pages, ticket views, API client, and layout        |
| `backend/src/users/` and `backend/src/departments/` | Supporting repositories used by tickets                           |


Start with `backend/src/tickets/tickets.controller.ts` to see the routes, then `tickets.service.ts` and `tickets/policies/`.

## 16. Manual production browser testing flow

For a simple end-to-end manual test covering microsoft authentication, start with two Microsoft accounts:

1. Configure an employee user.
   - Either let the first account sign in normally, which creates an `Employee` record automatically, or preconfigure it with `npm run seed:users`.
2. Configure an agent user.
   - Run `npm run seed:users`.
   - Add or modify the second account.
   - Set its role to `Agent`.
   - Assign it to a department, for example `Information Technology (IT)`.
3. Start the app with `npm run start`.
4. Sign in as the employee account.
5. Submit a ticket to the agent's department.
6. Sign out.
7. Sign in as the agent account.
8. Open the ticket pool or department tickets view.
9. Claim the employee's ticket, then try closing it with completion notes.

This flow verifies Microsoft login, local user resolution, role-based navigation, department-based ticket visibility, ticket submission, claiming, and closing.

## 17. Manually testing the backend API (URLs, payloads, data to use)

Base URL: `http://localhost:3000`

Seeded data (loaded by `npm run prisma:seed`, not on every process start):

Priority must be one of: `LOW`, `MODERATE`, `HIGH`.

Use `Content-Type: application/json` on requests that have a body. Replace `:id` with the `ticketId` returned on submit.

Authenticated routes require the `nexus_session` cookie created by signing in through Microsoft.

### Authenticate Postman requests

To query authenticated endpoints in Postman:
1. Run the app in test mode with `npm run start:test`
2. Copy the cookie value for the specific user you want to send requests as
3. **Notice:** Postman needs the cookie in this format:

```text
nexus_session=SESSION_CODE; Path=/; Expires=Thu, 24 Sep 2026 09:06:43 GMT; HttpOnly; Secure; SameSite=Lax;
```

Replace `SESSION_CODE` with the value of the `nexus_session` cookie from DevTools. The expiration date should match the cookie currently issued by the backend (7 days after interaction).

Conversely, if you want to use third party provider accounts: 
1. Log in to the app normally using the browser.
2. While logged in, open the browser DevTools and copy the `nexus_session` cookie information.
3. In Postman, add the cookie to the cookie jar for `localhost` so Postman sends it with every request.

### List tickets

`GET /tickets`

### Submit a ticket (status becomes `OPEN`, no agent)

`POST /tickets`

```json
{
  "title": "Laptop will not start",
  "description": "Black screen on boot",
  "priority": "HIGH",
  "departmentId": "dept-it"
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

No request body is required. The ticket is assigned to the authenticated agent/admin.



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
