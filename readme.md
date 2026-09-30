# Nexus

Nexus is an internal operations service hub. Employees submit requests to departments such as IT and HR. Those requests become tickets that can be claimed, tracked, closed, reopened, modified, or cancelled.

The repository contains a NestJS backend and a React/Vite frontend. Ticket, user, department, and identity-provider data is stored in PostgreSQL. Authentication uses Microsoft Entra ID with a server-side session cookie.

This README explains how to run, configure, test, deploy, and operate Nexus. Product and implementation details are also available in the [documentation](#live-app-and-project-evidence).

## Live app and project evidence

### Live app

- **Live URL:** [https://nexus-hub.up.railway.app](https://nexus-hub.up.railway.app/)
- **Demo access:** Demo access details and role credentials are sent to Eurisko Academy instructors in their Week 5 email.
- **Roles:** The main application roles are `Employee`, `Agent`, and `Admin`.
- **Local roles:** Local test-mode users are documented in [Local test authentication mode](#local-test-authentication-mode).
- **Critical journey:** An employee submits a ticket, a department agent retrieves and claims it, the agent closes it with completion notes, and the employee verifies the persisted closure. The manual version is documented in [Manual end-to-end browser testing](#manual-end-to-end-browser-testing).

### Evidence map

Use this map to move from product intent to implementation and release proof without searching the repository manually.

| Evidence stage | Direct documentation | What it proves | Direct proof |
| --- | --- | --- | --- |
| Week 1 — product foundation | [Product specs](docs/product-specs.md), [Architecture](docs/architecture.md), [Data model](docs/data-model.md) | Product scope, system boundaries, module responsibilities, persistence model, and core invariants | [API contract](docs/api-contract.md) |
| Week 2 — agentic workflow | [Week 2 agentic workflow](docs/week2-agentic-workflow.md) | Intended end-to-end workflow and module handoffs | [Agentic workflow documents](docs/agentic-workflows/) |
| Week 3 — full-stack delivery | [Week 3 full-stack delivery](docs/week3-full-stack-delivery.md) | Connected frontend, backend, authentication, authorization, PostgreSQL persistence, and ticket lifecycle | [Golden-path browser test](backend/test/browser/golden-path.browser.e2e-spec.ts), [restart persistence test](backend/test/api/tickets.api.e2e-spec.ts) |
| Week 4 — production AI | [Week 4 production AI](docs/week4-production-ai.md) | Bounded Groq integration, validated assistant responses, ticket-prefill safety, fallbacks, and AI evaluation | [AI service tests](backend/src/ai/ai.service.spec.ts), [AI model evaluation](backend/src/ai/ai-model.eval.ts) |
| Week 5 — release operations | [Week 5 release operations](docs/week5-release-operations.md) | Health/readiness, monitoring signals, controlled failure recovery, release decisions, and recovery verification | [Health tests](backend/src/health/health.service.spec.ts), [API smoke suite](backend/test/smoke/api/core.smoke.e2e-spec.ts), [browser smoke suite](backend/test/smoke/browser/golden-path.smoke.e2e-spec.ts) |

The longer workflow documents in `docs/agentic-workflows/` contain historical implementation guidance where explicitly noted.

## Quick start

There are three useful ways to start Nexus. Choose the one that matches what you need to test.

### Option A: Use the setup wizard

The setup wizard handles local application setup: prerequisites, dependency installation, environment files, database initialization, user setup, tests, optional bulk test data, and optional local startup. It does not replace deployment, release-gate, health, monitoring, recovery, or evidence procedures; read the rest of this README for those additional steps.

From the repository root, run:

```bash
npm run setup
```

The wizard can be skipped or cancelled at each optional stage. If it fails or you prefer manual setup, continue with the instructions below.

### Option B: Start local test-authentication mode

This is the fastest way to exercise the application locally without Microsoft accounts. It uses an isolated PostgreSQL database, fixed test users, and test-only authentication endpoints.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the integration environment file.

   macOS/Linux:

   ```bash
   cp backend/.env.integration.example backend/.env.integration
   ```

   Windows PowerShell:

   ```powershell
   Copy-Item backend/.env.integration.example backend/.env.integration
   ```

3. Edit `backend/.env.integration` and point `DATABASE_URL` at a PostgreSQL database reserved for testing.

4. Start the backend and frontend:

   ```bash
   npm run start:test
   ```

5. Open [http://localhost:5173](http://localhost:5173). The landing page displays a **Test mode** user selector. Select a user and choose **Sign in as test user**.

During startup, Nexus applies pending migrations, creates or updates seven test users, and creates an in-memory session for each user. The test users and their roles are listed in [Local test authentication](#local-test-authentication-mode).

### Option C: Run with Microsoft Entra ID

Use this path when you need to test the real authentication flow.

1. Install dependencies with `npm install`.
2. Create and configure `backend/.env` using [Backend environment configuration](#backend-environment-configuration).
3. Create a PostgreSQL database and run:

   ```bash
   npm run db:setup
   ```

4. Start the application:

   ```bash
   npm run start
   ```

5. Open [http://localhost:5173](http://localhost:5173) and sign in through Microsoft Entra ID.

Do not use the same PostgreSQL database for `backend/.env` and `backend/.env.integration`.

### Local URLs

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API: [http://localhost:3000/api](http://localhost:3000/api)
- Socket.IO namespace: `/operations` at `/socket.io`

If `PORT` is set in the backend environment, the backend uses that value instead of `3000`. In local Vite development, `/api` is proxied to the backend.

### Stop the application

In the terminal running the application, press **Ctrl+C**. Tickets, users, and departments remain in PostgreSQL after the process stops.

## Prerequisites and installation

### Required and optional services

- Node.js v20 or later
- npm
- PostgreSQL, either local or hosted
- A Microsoft Entra ID organization and app registration when using real authentication

These integrations are optional for the core ticket application:

- A Groq API key for live AI responses or `npm run eval`
- An SMTP provider account for transactional email notifications
- An API client such as Postman for manual API testing

### Install dependencies

Run the install command from the repository root:

```bash
npm install
```

This workspace install manages the root tooling, backend dependencies, and frontend dependencies with the root `package-lock.json`. The backend `postinstall` script generates the Prisma client.

Run an individual workspace script from the repository root with `--workspace`:

```bash
npm run start:dev --workspace=backend
npm run dev --workspace=@nexus/frontend
```

## Environment configuration

Nexus uses separate environment profiles for the normal application and automated/test mode.

| File | Used by | Purpose |
| --- | --- | --- |
| `backend/.env` | `npm run start`, `npm run db:setup`, `npm run seed:users`, normal deployment | Normal application database, Microsoft Entra authentication, and optional integrations |
| `backend/.env.integration` | `npm run test`, E2E tests, smoke tests, `npm run start:test` | Isolated test database and test authentication |
| `frontend/nexus/.env` | Optional frontend overrides | API origin and Vite development settings |

Copy the appropriate example file before editing it. Never commit `.env` files or real credentials.

### Backend environment configuration

The complete templates are [backend/.env.example](backend/.env.example) and [backend/.env.integration.example](backend/.env.integration.example).

#### PostgreSQL

Create an empty PostgreSQL database, for example `nexus`, then create `backend/.env`.

macOS/Linux:

```bash
cd backend
cp .env.example .env
```

Windows PowerShell:

```powershell
cd backend
Copy-Item .env.example .env
```

Edit `backend/.env` with the connection details for the normal application database:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=nexus
DATABASE_USER=your_user
DATABASE_PASSWORD=your_password
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/nexus
```

Prisma migrations and seeds use `DATABASE_URL`. The Nest application uses that URL when it is set, or builds a connection from the other database variables.

For tests, create a separate database and copy the integration template:

```powershell
Copy-Item backend/.env.integration.example backend/.env.integration
```

Set its `DATABASE_URL` to the test database. The integration template keeps SMTP disabled by default. Add a Groq key there only when you want AI responses during `npm run start:test` or external AI smoke checks.

Test mode refuses to start when the normal and integration database URLs point to the same PostgreSQL database and schema.

#### Microsoft Entra ID

Nexus uses Microsoft Entra ID as its third-party identity provider. Create or use an Entra app registration and add this web redirect URI:

```text
http://localhost:3000/api/authentication/microsoft/callback
```

Add the Microsoft configuration to `backend/.env`:

```env
MICROSOFT_ENTRA_TENANT_ID=your_tenant_id
MICROSOFT_ENTRA_CLIENT_ID=your_client_id
MICROSOFT_ENTRA_CLIENT_SECRET=your_client_secret
MICROSOFT_ENTRA_REDIRECT_URI=http://localhost:3000/api/authentication/microsoft/callback
MICROSOFT_ENTRA_SCOPES=openid profile email User.Read
FRONTEND_URL=http://localhost:5173
```

Eurisko Academy instructors should check their course email for Microsoft tenant credentials.

`User.Read` allows the backend to read the signed-in user's Microsoft Graph profile. If Microsoft returns a mobile or business phone number, Nexus saves it when creating the local user account. A missing phone number or unavailable profile lookup does not prevent login.

The seeded identity-provider record uses the code `MICROSOFT_ENTRA_ID`. After login, users are linked to Microsoft accounts by `identity_provider_id` and `identity_provider_user_id`.

In organization-locked setups, users are checked through the configured Microsoft tenant so only internal accounts can use the application.

#### Frontend configuration

The frontend normally needs no environment file for local development because Vite proxies `/api` to the backend. If you need to override the API origin, copy the example:

macOS/Linux:

```bash
cd frontend/nexus
cp .env.example .env
```

Windows PowerShell:

```powershell
cd frontend/nexus
Copy-Item .env.example .env
```

The available settings are:

```env
VITE_API_URL=
VITE_DEV_API_URL=http://localhost:3000
VITE_DEV_PORT=5173
```

`VITE_DEV_API_URL` controls the local Vite proxy target, and `VITE_DEV_PORT` controls the frontend development server port. Set `VITE_API_URL` when the browser should call a deployed backend directly rather than use the proxy. Its value must include the `/api` prefix, for example:

```env
VITE_API_URL=https://nexus.example.com/api
```

### Optional integrations

#### Email notifications

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

The system emails ticket submission, claim, close, reopen, and handoff request/accept/reject events. It intentionally does not email ticket cancellation or automatic handoff-cancellation events.

Email delivery has no database outbox or idempotency records. Each successful domain operation schedules one best-effort notification with bounded retries. Dropped messages are not automatically resent.

`SMTP_HOST` and `SMTP_FROM_EMAIL` must be configured for delivery to be enabled. Set `SMTP_ENABLED=false` when running tests or when email is not needed. Port `465` is treated as secure automatically; otherwise set `SMTP_SECURE=true` when the provider requires TLS.

#### AI assistant

The Nexus assistant runs through Groq from the backend. Keep the API key in `backend/.env`; never place it in the frontend environment.

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=qwen/qwen3.8-27b
AI_RETRY_DELAY_MS=250
```

`GROQ_API_KEY` is required for live assistant responses and `npm run eval`. `GROQ_MODEL` defaults to `qwen/qwen3.8-27b`, and `AI_RETRY_DELAY_MS` controls the delay between retry attempts.

If the key is missing or Groq is unavailable, the rest of the application can still start. AI requests return a conversational fallback, and the backend logs the technical failure.

#### Other backend settings

These settings are included in `backend/.env.example` and can be adjusted when needed:

```env
PORT=3000
FILE_UPLOAD_DIR=uploads
BACKGROUND_WORKERS_ENABLED=true
ORPHANED_FILE_CLEANUP_INTERVAL_MS=3600000
AUDIT_LOG_CLEANUP_INTERVAL_MS=86400000
UNCLAIMED_TICKET_REMINDER_INTERVAL_MS=300000
FILE_ORPHAN_GRACE_PERIOD_MS=3600000
```

`APP_BASE_URL` is used in email links and should point to the frontend URL for the environment where the application runs.

## Database and users

### Initialize the database

From the repository root, apply migrations and load the baseline departments and identity provider:

```bash
npm run db:setup
```

The root command runs the backend Prisma migration script and then the seed script.

The equivalent backend commands are:

```bash
cd backend
npm run prisma:migrate
npm run prisma:seed
```

- `prisma:migrate` creates or updates the schema. A fresh database reaches the required tables by running this once.
- `prisma:seed` upserts the identity provider, IT and HR departments, and sample users.
- The API does not seed on startup.
- Re-running the seed is safe; it does not wipe tickets.

### Manage users and roles

When someone signs in with Microsoft Entra ID and no matching Nexus user exists, Nexus automatically creates a local user with the `Employee` role.

Use the interactive users CLI to preconfigure users, promote users to `Agent` or `Admin`, or assign agents and administrators to departments:

```bash
npm run seed:users
```

The CLI uses `backend/.env`, connects to the configured `DATABASE_URL`, and can:

- Add a user before their first login
- Modify an existing user
- Change a user's role between `Employee`, `Agent`, and `Admin`
- Assign departments to `Agent` and `Admin` users

This is useful for manual testing because ticket-pool and department views depend on the signed-in user's role and department memberships.

### Generate bulk load-test data

Use the bulk seed commands to exercise pagination, filtering, ticket history, chat history, and the UI with a larger dataset:

```bash
# Uses backend/.env
npm run seed:bulk

# Uses backend/.env.integration
npm run seed:bulk:test
```

The test bulk seed refuses to run if `backend/.env.integration` points to the normal application database. Both commands apply pending migrations, preserve non-bulk data, and replace only the synthetic rows generated by the same profile when rerun.

By default, the seed creates:

- 30 employees, 15 agents, and 5 admins
- Tickets for every active user across every active department and all four ticket states
- 3 tickets per user, state, and department combination
- 20 chat messages per ticket
- Synthetic handoff requests for claimed tickets, distributed across Pending, Accepted, Rejected, and Cancelled states
- Synthetic ticket events and chat read receipts in batches

Adjust the volume before running a command with these environment variables:

```text
BULK_EMPLOYEES=30
BULK_AGENTS=15
BULK_ADMINS=5
BULK_TICKETS_PER_USER_STATE_DEPARTMENT=3
BULK_CHAT_MESSAGES_PER_TICKET=20
BULK_BATCH_SIZE=500
```

The setup wizard asks whether to bulk seed the normal database, the test database, both, or neither before starting the app. If one selected database fails, the wizard reports the error, attempts the remaining target, and asks whether to continue startup or cancel.

## Local test authentication mode

Test mode lets you exercise authenticated browser and API behavior without signing in through Microsoft Entra ID.

Before starting it, configure `backend/.env.integration` with a PostgreSQL database reserved for testing. Create it from `backend/.env.integration.example` if it does not exist.

From the repository root, run:

```bash
npm run start:test
```

The command starts the backend and frontend together. The backend uses `backend/.env.integration` instead of the normal `backend/.env`. During startup it:

1. Verifies that the integration and normal `DATABASE_URL` values do not target the same PostgreSQL database and schema.
2. Applies pending Prisma migrations to the integration database.
3. Creates or updates seven test users and their department memberships.
4. Starts test-only authentication endpoints.
5. Creates an in-memory session for every test user and prints a directly usable `Cookie` header value for each one.

Test-mode session identifiers are deterministic per user, so the printed cookie values remain stable across restarts. The sessions themselves are held in memory and recreated each time the server starts.

The seeded users are:

| User | Role | Department |
| --- | --- | --- |
| Employee 1 | `Employee` | None |
| Employee 2 | `Employee` | None |
| IT Agent 1 | `Agent` | Information Technology |
| IT Agent 2 | `Agent` | Information Technology |
| HR Agent 1 | `Agent` | Human Resources |
| HR Agent 2 | `Agent` | Human Resources |
| Admin | `Admin` | Information Technology |

### Sign in through the frontend

Open [http://localhost:5173](http://localhost:5173). When the test backend is running, the landing page detects it and displays a **Test mode** user selector. Select a user and choose **Sign in as test user**.

The backend creates a fresh session, sets the normal secure HTTP-only `nexus_session` cookie, and uses the regular authentication and authorization flow for the rest of the application.

### Authenticate an API client

The backend prints an entry like this for every seeded user:

```text
IT Agent 1 (Agent)
Cookie: nexus_session=SESSION_ID
```

Copy only the cookie name and value into the API client's `Cookie` header:

```http
Cookie: nexus_session=SESSION_ID
```

Do not copy cookie attributes such as `Path`, `Expires`, `HttpOnly`, `Secure`, or `SameSite` into the request header. If you use a browser-issued cookie instead, copy the `nexus_session` name/value pair from DevTools.

Restarting the backend invalidates in-memory sessions and prints new values. Restarting test mode does not clear existing test tickets from the integration database.

## Testing

All test commands use `backend/.env.integration` and therefore require a separate PostgreSQL database. Each command applies Prisma migrations once before its test run. Individual tests seed sample users and departments and reset ticket data for isolation.

### Expected console errors during testing

The browser or backend console may display error messages while tests are running. Some tests intentionally submit invalid, unauthorized, conflicting, or otherwise unwanted requests to verify that the application rejects them safely. These messages are expected when the test runner reports the test as passing. Investigate console errors when the corresponding test fails, the error is unexpected, or the test command exits unsuccessfully.

### Test commands

Run unit, integration, API E2E, and browser E2E tests from the repository root:

```bash
npm run test
```

Run backend test categories individually:

```bash
npm run test --workspace=backend
npm run test:integration --workspace=backend
npm run test:api:e2e --workspace=backend
npm run test:browser:e2e --workspace=backend
npm run test:e2e --workspace=backend
```

The commands mean:

- `npm test` runs Jest unit tests and `.spec.ts` files in `backend/src`.
- `npm run test:integration` runs the Jest integration suite.
- `npm run test:api:e2e` runs Playwright API E2E tests against a built Nest app.
- `npm run test:browser:e2e` runs Playwright browser E2E tests against the backend and frontend.
- `npm run test:e2e` runs both API E2E and browser E2E tests.

### Release smoke tests

The isolated release smoke suite runs a small API and browser E2E subset:

```bash
npm run test:smoke --workspace=backend
```

It uses the isolated integration database, test-mode sessions, the real NestJS API, PostgreSQL, the frontend, and Chromium. Set `SMOKE_AI=true` to enable the optional external AI smoke check. Otherwise, the suite verifies the local AI fallback when Groq is not configured.

### Model-backed AI evaluations

Run the representative AI evaluations from the repository root:

```bash
npm run eval
```

This command runs only the model-backed AI evaluation runner. It uses the existing Groq provider, so `backend/.env` must contain `GROQ_API_KEY`; `GROQ_MODEL` is optional.

The runner supplies fixed in-memory departments and priorities as assistant context, so it does not require PostgreSQL or a running Nexus server. It makes real Groq requests and reports clear, thin, ambiguous, trusted-context, conditional-prefill, supplied-evidence, and repeatability cases separately.

If Groq responds with `429`, the runner respects its `Retry-After` value and retries that model request up to three times. `AI_EVAL_MAX_RATE_LIMIT_RETRIES` and `AI_EVAL_MAX_RATE_LIMIT_WAIT_MS` can change those defaults. The runner stops instead of waiting longer than the configured maximum, which avoids hanging when a daily quota is exhausted.

### Full release verification

Run the complete release gate from the repository root:

```bash
npm run verify:release
```

It builds and type-checks both workspaces, then runs backend unit, integration, API/browser E2E, and model-backed AI evaluation checks. It exits at the first failed check; a passing exit code means all release checks passed.

The command requires the test database, Playwright browsers, and a Groq API key with enough available quota.

## Build and deployment

### Build both workspaces

From the repository root:

```bash
npm run build
```

The backend build is written to `backend/dist`. The frontend build is written to `frontend/nexus/dist`.

In bundled deployment mode, the NestJS backend serves the frontend build from the domain root and keeps HTTP API routes under `/api`.

### Interactive backend deployment

Run the interactive deployment workflow with:

```bash
npm run deploy:backend
```

Using `backend/.env`, it:

1. Builds the NestJS backend.
2. Applies pending Prisma migrations with `prisma migrate deploy`.
3. Runs the idempotent baseline seed.
4. Asks whether you want to add or modify an application user.
5. Runs the backend test suite, which uses `backend/.env.integration`.
6. Starts the compiled backend with `start:prod`.

For CI or deployment platforms that start the process separately, use:

```bash
npm run deploy:ci --workspace=backend
npm run start:prod --workspace=backend
```

### Railway single-service deployment

For one Railway service serving both applications, configure the repository root as the service root and use:

```text
Root directory: /
Build command: npm run build
Pre-deploy command: npm run prisma:migrate --workspace=backend
Start command: npm run start:prod --workspace=backend
```

The deployed site is served at `/`, while NestJS HTTP routes are served under `/api`.

### Frontend-only build and preview

Build and type-check the deployable frontend assets with:

```bash
npm run deploy:frontend
```

Preview those assets locally with:

```bash
npm run start:prod --workspace=@nexus/frontend
```

To build the frontend and then run the interactive backend deployment:

```bash
npm run deploy
```

These deployment scripts do not create a hosting service, container, or cloud resource automatically. They prepare the frontend artifact and start the backend process; the hosting platform or process supervisor remains responsible for serving and restarting the application.

## Health, monitoring, and recovery

### Health endpoints

`GET /api/health/ping` is a public liveness endpoint. It returns:

```json
{ "status": "ok" }
```

It confirms that the backend process is running and does not contact dependencies.

`GET /api/health` is a protected readiness endpoint. Set a long, random `HEALTH_CHECK_SECRET` in `backend/.env` and send it as:

```http
Authorization: Bearer HEALTH_CHECK_SECRET
```

The endpoint reports the backend version and the status of PostgreSQL, Microsoft Entra OpenID discovery, SMTP, and Groq. It does not send email or generate an AI response.

- Disabled optional email or Groq integrations are reported as `disabled`.
- A required or configured service that cannot be reached produces an `unhealthy` report with HTTP status `503`.
- If `HEALTH_CHECK_SECRET` is missing, the detailed endpoint is disabled and returns HTTP `503` with an explicit configuration message.
- If the endpoint is configured but the bearer token is missing or incorrect, it returns HTTP `401`.

### Logs and monitoring signals

The backend writes system-error logs with an operation, affected object, and safe diagnostic context. Sensitive values such as session cookies, Microsoft tokens, Groq keys, database credentials, and passwords are redacted.

Important signals include:

- `GET /api/health/ping` returning `200`, which proves that the backend is responding
- Authorized `GET /api/health` returning `200` with `status: "healthy"`, or `503` with `status: "unhealthy"`
- Repeated log entries for `health.check`, `application.bootstrap`, `process.uncaught-exception`, `process.unhandled-rejection`, database failures, or external-provider failures
- Frontend realtime state changing to `reconnecting` or `error`

UptimeRobot can monitor `/api/health`. Give it the `HEALTH_CHECK_SECRET` value as the authorization header so the request is authenticated. The program can ping the endpoint every five minutes and send an email when it returns `503`.

### Controlled failure and recovery

Nexus isolates optional dependency failures from the core ticket workflow where possible:

- **Backend/runtime:** Restart or redeploy the service, inspect startup logs and environment variables, and roll back to the last known-good release if the deployment caused the failure.
- **PostgreSQL:** Restore database availability, connection limits, credentials, or `DATABASE_URL`; then restart the backend if needed. Do not reset or reseed production data. Transactional lifecycle operations protect against partial writes.
- **Microsoft Entra ID:** Transient authentication requests retry up to three times. Restore provider availability or OAuth configuration and ask new users to retry login. Valid existing sessions may continue until expiry.
- **Groq:** Transient requests retry and then return an assistant fallback. Restore the key, quota, model, or network, or leave AI disabled while normal ticket operations continue.
- **SMTP:** Notification sends retry transient failures and then log and drop the message. Core ticket and handoff operations are not failed by email delivery; dropped messages are not automatically resent because there is no outbox.
- **Files:** Failed multipart uploads clean up files already written in that batch. Repair storage capacity or permissions and retry; restore missing local files from external backups if necessary.
- **Realtime:** The browser reconnects and rejoins ticket and chat rooms. If an event was missed, refresh the page and use persisted HTTP state as the source of truth.

The controlled recovery sequence is: **HOLD**, identify the failed dependency from health and logs, restore or restart only the affected service, then run post-recovery verification. See the complete failure matrix in [Week 5 release operations](docs/week5-release-operations.md#7-failure-recovery).

### Post-recovery verification

Recovery is not complete merely because the process starts again. After a significant failure or restart:

1. Confirm that `GET /api/health/ping` responds successfully.
2. Call authorized `GET /api/health` and verify the expected dependency states. Check the response body, not only the HTTP code.
3. Review startup and runtime logs for recurring errors.
4. Re-authenticate users if the backend restarted because production sessions are held in memory.
5. Run the critical employee-to-agent-to-employee ticket journey and confirm that the ticket remains persisted and the employee sees the final closure.
6. For a release-related incident, verify or redeploy the last known-good candidate before declaring the system ready.

For the isolated automated release smoke suite, run:

```bash
npm run test:smoke --workspace=backend
```

The complete checklist is in [Week 5 recovery verification](docs/week5-release-operations.md#recovery-verification).

## Manual end-to-end browser testing

The critical journey is: an employee submits a ticket, a department agent retrieves and claims it, the agent closes it with completion notes, and the employee verifies the persisted closure.

When testing the live app, use appropriate demo accounts because this flow creates real tickets. For local testing without Microsoft accounts, use [test-authentication mode](#local-test-authentication-mode).

For a Microsoft Entra browser test, start with two Microsoft accounts:

1. Configure an employee user. Either let the first account sign in normally, which creates an `Employee` record automatically, or preconfigure it with `npm run seed:users`.
2. Configure an agent user. Run `npm run seed:users`, add or modify the second account, set its role to `Agent`, and assign it to a department such as Information Technology (`IT`).
3. Start the app with `npm run start`.
4. Sign in as the employee account.
5. Submit a ticket to the agent's department.
6. Sign out.
7. Sign in as the agent account.
8. Open the ticket pool or department tickets view.
9. Claim the employee's ticket, then close it with completion notes.
10. Sign in again as the employee and verify the persisted closure.

This flow verifies Microsoft login, local user resolution, role-based navigation, department-based ticket visibility, ticket submission, claiming, closing, and persistence.

## Manual API testing

Base URL:

```text
http://localhost:3000/api
```

The seeded data is loaded by `npm run prisma:seed`, not on every process start.

Priority must be one of `LOW`, `MODERATE`, or `HIGH`. Use `Content-Type: application/json` on requests with a body. Replace `:id` with the `ticketId` returned on submission.

Authenticated routes require the `nexus_session` cookie created by signing in through Microsoft Entra ID or test mode.

### Authenticate Postman requests

To query authenticated endpoints in Postman:

1. Run the app in test mode with `npm run start:test`.
2. Copy the cookie value for the user you want to use.
3. Send only the cookie name/value pair:

   ```http
   Cookie: nexus_session=SESSION_CODE
   ```

If using a third-party provider account instead:

1. Log in to the app normally through the browser.
2. Open browser DevTools while logged in.
3. Copy the `nexus_session` cookie name and value.
4. Add it to Postman's cookie jar for `localhost` so Postman sends it with each request.

### Ticket endpoints

#### List tickets

```http
GET /tickets
```

#### Submit a ticket

The ticket starts in `OPEN` status with no agent assigned.

```http
POST /tickets
```

```json
{
  "title": "Laptop will not start",
  "description": "Black screen on boot",
  "priority": "HIGH",
  "departmentId": "dept-it"
}
```

#### Get one ticket

```http
GET /tickets/:id
```

#### Modify an open ticket

Only `OPEN` tickets can be modified. All fields are optional, but at least one is required.

```http
PATCH /tickets/:id
```

```json
{
  "title": "VPN access request",
  "description": "Need VPN for remote work",
  "priority": "LOW",
  "departmentId": "dept-hr"
}
```

#### Claim a ticket

An `OPEN` or `REOPENED` ticket becomes `CLAIMED` and is assigned to the authenticated agent or administrator. No request body is required.

```http
POST /tickets/:id/claim
```

#### Close a ticket

A `CLAIMED` ticket becomes `CLOSED` and its agent is cleared. `completionNotes` is optional.

```http
POST /tickets/:id/close
```

```json
{
  "completionNotes": "Replaced the power adapter"
}
```

#### Reopen a ticket

A `CLOSED` ticket becomes `REOPENED` with no agent. If sent, `description` replaces the ticket description.

```http
POST /tickets/:id/reopen
```

```json
{
  "description": "The issue came back after a day"
}
```

#### Cancel a ticket

```http
POST /tickets/:id/cancel
```

The complete HTTP and Socket.IO contract, including query parameters, request bodies, response envelopes, and intentionally unexposed routes, is documented in [docs/api-contract.md](docs/api-contract.md).

## Project structure

| Path | Purpose |
| --- | --- |
| `docs/` | Product, architecture, data-model, workflow, API, and release documentation |
| `backend/src/` | NestJS backend modules, domain logic, integrations, shared infrastructure, and HTTP/WebSocket APIs |
| `backend/src/tickets/` | Core ticket lifecycle, access policies, assignments, handoffs, events, queries, and realtime updates |
| `backend/src/authentication/` and `backend/src/authorization/` | Microsoft Entra login, sessions, request authentication, roles, and access control |
| `backend/src/ai/`, `backend/src/chat/`, `backend/src/files/`, `backend/src/notifications/`, and `backend/src/realtime/` | Assistant, ticket conversations, attachments, email delivery, and live updates |
| `backend/src/administration/`, `backend/src/dashboard/`, `backend/src/users/`, `backend/src/departments/`, `backend/src/filters/`, and `backend/src/priorities/` | Administration, dashboards, user and department management, filtering, and configurable priorities |
| `backend/src/database/`, `backend/prisma/`, `backend/src/common/`, `backend/src/config/`, `backend/src/health/`, `backend/src/audit/`, and `backend/src/background-workers/` | Persistence, migrations, shared validation/logging, configuration, health checks, audit records, and scheduled maintenance |
| `backend/test/` | Integration, API E2E, browser E2E, smoke tests, and test support |
| `frontend/nexus/src/` | React application pages, components, feature modules, API clients, authentication, and realtime UI |
| `scripts/`, `backend/scripts/`, and `postman/` | Setup, deployment, smoke-check, and API testing tooling |

Start with `backend/src/tickets/tickets.controller.ts` to see the routes, then read `tickets.service.ts` and `tickets/policies/`.
