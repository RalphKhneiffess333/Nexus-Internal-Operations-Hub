---
title: "Agentic Workflow Ticket Lifecycle - Nexus"
author: "Ralph Khneiffess"
---

# Week 3 - Full-Stack Delivery

NOTICE: This file is best treated as a historical archive for Eurisko Academy instructors as it may contain stale file references since major application updates have been implemented since the creation of this file. To properly follow its implementation, it is recommended to revert to commit a9d9b11cdfd889dd881342f3ad7a0474b9701c81 on Sep 17, 2026.

For the current repository contract, use [api-contract.md](api-contract.md). The contract below has been retained as the Week 3 delivery example and is supplemented by the later Chat, handoff, administration, attachment, and realtime routes in that document.

## Overview

Week 3 completed the first full-stack delivery of Nexus, moving the application from isolated backend functionality to a connected system backed by PostgreSQL, with authentication, authorization, a React frontend, and automated test coverage.

The main goal was to connect the existing application layers while preserving the architectural boundaries established in the previous weeks. The sections below reference the main implementation files that prove each delivered feature.

## Delivered Features
### 1. PostgreSQL Database Integration

The application was migrated from the previous in-memory ticket persistence implementation to PostgreSQL.
- Added PostgreSQL database connectivity and configuration.
- Added reproducible database migrations.
- Replaced in-memory ticket persistence with a PostgreSQL repository using Prisma.
- Preserved the existing controller → service → repository architecture.
- Preserved ticket lifecycle rules and soft deletion.
- Added the required database constraints and indexes.
- Ensured ticket data survives application restarts.

#### Main implementation evidence:

- [schema.prisma](<../backend/prisma/schema.prisma>) defines the PostgreSQL datasource, domain models, relationships, constraints, enums, and indexes.
- [migrations/](<../backend/prisma/migrations/>) contains the reproducible database migrations for tickets, users, departments, identity providers, department memberships, and identity linking.
- [prisma.service.ts](<../backend/src/database/prisma.service.ts>) owns the Prisma client connection lifecycle.
- [tickets.repository.ts](<../backend/src/tickets/repositories/tickets.repository.ts>) replaces in-memory persistence with Prisma-backed ticket storage, including soft deletion, ticket code generation, and concurrency-safe claiming.
- [users.repository.ts](<../backend/src/users/repositories/users.repository.ts>) and [departments.repository.ts](<../backend/src/departments/repositories/departments.repository.ts>) provide the database-backed user, identity-provider, department, and membership queries used by the rest of the system.

The database remains an infrastructure concern owned by the repository layer rather than being exposed to controllers or business policies.

### 2. Ticket Lifecycle Full Vertical Slice

A complete ticket workflow was connected across the stack:

```text
React Frontend
      |
Ticket API Client
      |
NestJS API
      |
Ticket Service
      |
Ticket Repository
      |
Prisma
      |
PostgreSQL
```

The React application now provides the employee-facing ticket experience:
- View tickets
- View ticket details
- Create tickets
- Modify OPEN tickets
- Cancel OPEN tickets
- Loading, empty, validation, and API error states
- Responsive application shell and navigation

#### Main implementation evidence:

- [ticket-api.js](<../frontend/nexus/src/features/tickets/ticket-api.js>) maps frontend ticket actions to backend ticket endpoints.
- [TicketsPage.jsx](<../frontend/nexus/src/pages/tickets/TicketsPage.jsx>) implements submitted tickets, department tickets, ticket pool, loading states, empty states, and API error states.
- [NewTicketPage.jsx](<../frontend/nexus/src/pages/tickets/NewTicketPage.jsx>) implements ticket creation from the frontend.
- [TicketDetailsPage.jsx](<../frontend/nexus/src/pages/tickets/TicketDetailsPage.jsx>) implements ticket details, edit, cancel, claim, close, and reopen actions using server-returned permissions.
- [tickets.controller.ts](<../backend/src/tickets/tickets.controller.ts>) exposes the ticket API routes.
- [tickets.service.ts](<../backend/src/tickets/tickets.service.ts>) owns the application-level ticket workflow, actor-aware scoping, lifecycle transitions, and action permissions.
- [policies/](<../backend/src/tickets/policies/>) contains the resource and lifecycle policies for viewing, submitting, modifying, cancelling, claiming, closing, and reopening tickets.
- [tickets.repository.ts](<../backend/src/tickets/repositories/tickets.repository.ts>) persists ticket lifecycle changes to PostgreSQL.

The frontend consumes the backend API rather than implementing business or persistence logic itself.

### 3. Microsoft Entra ID Authentication

Authentication was introduced as a separate backend module using Microsoft Entra ID.

The implementation includes:
- Provider-independent authentication abstractions.
- Microsoft Entra ID authentication strategy.
- Application user resolution and provisioning.
- Identity-provider linking.
- In-memory session management.
- Secure opaque session identifiers.
- HTTP-only session cookies.
- Sliding seven-day session expiration.
- Request-level authentication through `request.user`.
- Logout and logout-all-devices support.

#### Main implementation evidence:

- [authentication.module.ts](<../backend/src/authentication/authentication.module.ts>) registers the authentication controller, Microsoft strategy, session service, and global authentication guard.
- [authentication.controller.ts](<../backend/src/authentication/authentication.controller.ts>) exposes Microsoft login/callback, current-user, logout, and logout-all-devices endpoints.
- [authentication.service.ts](<../backend/src/authentication/authentication.service.ts>) validates login state, resolves or provisions local users, links Microsoft identities, rejects inactive users, and creates sessions.
- [microsoft-auth.strategy.ts](<../backend/src/authentication/strategies/microsoft-auth.strategy.ts>) handles the Microsoft Entra OAuth flow, token exchange, OpenID/JWKS lookup, ID token verification, and normalized identity extraction.
- [session.service.ts](<../backend/src/authentication/sessions/session.service.ts>) implements opaque sessions, sliding seven-day expiration, and logout-all-devices.
- [authentication.guard.ts](<../backend/src/authentication/guards/authentication.guard.ts>) reads the session cookie, refreshes valid sessions, resolves the user, and attaches `request.user`.
- [AuthenticationProvider.jsx](<../frontend/nexus/src/features/authentication/AuthenticationProvider.jsx>) connects the React application to the backend authentication session.

Microsoft-specific authentication logic remains isolated inside the authentication strategy, while the rest of the application works with a normalized authenticated identity.

### 4. Authorization

Authorization was implemented as a separate concern from authentication.

The authorization flow now follows:

```text
Authentication
      |
request.user
      |
Authorization Guard
      |
Controller
      |
Feature Service
      |
Resource Policy
```

The centralized authorization layer handles endpoint-level role authorization, while feature modules remain responsible for resource-specific policies such as ticket ownership, assignment, department restrictions, and lifecycle permissions.

Authorization also distinguishes between:
- `401 Unauthorized` — no authenticated user
- `403 Forbidden` — authenticated user without the required role

#### Main implementation evidence:

- [authorization.module.ts](<../backend/src/authorization/authorization.module.ts>) registers the authorization guard globally.
- [authorization.guard.ts](<../backend/src/authorization/guards/authorization.guard.ts>) handles public route bypasses, protected-route authentication checks, role checks, `401 Unauthorized`, and `403 Forbidden`.
- [public.decorator.ts](<../backend/src/authorization/decorators/public.decorator.ts>) and [roles.decorator.ts](<../backend/src/authorization/decorators/roles.decorator.ts>) provide endpoint-level authorization metadata.
- [tickets.controller.ts](<../backend/src/tickets/tickets.controller.ts>) applies role requirements to ticket endpoints.
- [tickets.service.ts](<../backend/src/tickets/tickets.service.ts>) applies the authenticated actor to ticket scopes and operations.
- [policies/](<../backend/src/tickets/policies/>) enforces ticket ownership, department access, assignment rules, and lifecycle permissions.

This keeps authentication, authorization, and business rules independently testable and maintainable.

### 5. Automated Testing

All tests can be run from the repository root with:

```bash
npm run test
```

Week 3 added coverage across unit, integration, API E2E, and browser E2E levels.

- **Unit tests** for isolated business logic and policies.
- **Integration tests** for interactions between application components and persistence.
- **End-to-end tests** for complete API/application flows.

The authorization test coverage includes authentication requirements, role restrictions, resource ownership, lifecycle permissions, and attempts to tamper with identity-related fields.

#### Unit tests

- [authentication.service.spec.ts](<../backend/src/authentication/authentication.service.spec.ts>) tests login state validation, local user provisioning/linking, inactive-user rejection, Microsoft strategy failures, and session creation.
- [microsoft-auth.strategy.spec.ts](<../backend/src/authentication/strategies/microsoft-auth.strategy.spec.ts>) tests Microsoft login URL generation, token exchange failures, malformed/missing ID tokens, invalid token claims, and OpenID configuration failures.
- [authentication.guard.spec.ts](<../backend/src/authentication/guards/authentication.guard.spec.ts>) tests session-cookie handling, expired/missing sessions, user attachment, and session refresh.
- [session.service.spec.ts](<../backend/src/authentication/sessions/session.service.spec.ts>) tests opaque session creation, sliding expiration, expired-session cleanup, and logout-all-devices.
- [authorization.guard.spec.ts](<../backend/src/authorization/guards/authorization.guard.spec.ts>) tests public endpoints, protected endpoint `401` behavior, allowed roles, and disallowed role `403` behavior.
- [tickets.service.spec.ts](<../backend/src/tickets/tickets.service.spec.ts>) tests invalid ticket transitions and permission failures without writing to the repository.

#### Integration tests

- [tickets.service.integration-spec.ts](<../backend/src/tickets/tickets.service.integration-spec.ts>) tests ticket submission, retrieval, modification, cancellation, authenticated ownership, visibility rules, department restrictions, scoped ticket lists, and action permissions against the real persistence layer.
- [tickets.lifecycle.integration-spec.ts](<../backend/src/tickets/tickets.lifecycle.integration-spec.ts>) tests persisted lifecycle behavior across OPEN -> CLAIMED -> CLOSED -> REOPENED -> CLAIMED and verifies rejected operations leave stored tickets unchanged.
- [departments.service.spec.ts](<../backend/src/departments/departments.service.spec.ts>) tests active department listing and inactive department filtering against the database.

#### API E2E tests

- [tickets.api.e2e-spec.ts](<../backend/test/api/tickets.api.e2e-spec.ts>) tests ticket submit, claim, close, reopen, persistence after restart, invalid close behavior, and concurrent claim behavior over HTTP.
- [authorization.api.e2e-spec.ts](<../backend/test/api/authorization.api.e2e-spec.ts>) tests unauthenticated access rejection, role rejection, identity-field tampering rejection, and authenticated submitter ownership.
- [departments.api.e2e-spec.ts](<../backend/test/api/departments.api.e2e-spec.ts>) tests active department listing over HTTP.

#### Browser E2E tests

- [auth.browser.e2e-spec.ts](<../backend/test/browser/auth.browser.e2e-spec.ts>) tests unauthenticated landing, authenticated workspace entry, and sign-out.
- [tickets-submission.browser.e2e-spec.ts](<../backend/test/browser/tickets-submission.browser.e2e-spec.ts>) tests browser ticket submission, required-field validation, and submitted ticket list rendering.
- [tickets-agent-workflow.browser.e2e-spec.ts](<../backend/test/browser/tickets-agent-workflow.browser.e2e-spec.ts>) tests agent ticket claiming and closing from the browser.
- [tickets-lifecycle.browser.e2e-spec.ts](<../backend/test/browser/tickets-lifecycle.browser.e2e-spec.ts>) tests employee reopen, edit, and cancel flows from the browser.
- [golden-path.browser.e2e-spec.ts](<../backend/test/browser/golden-path.browser.e2e-spec.ts>) tests the full employee-to-agent-to-employee flow: submit, claim, close, and employee closure visibility.

#### 6. Regression Protection
Regression protection was established to ensure that ongoing code changes, database migrations, and feature expansions do not inadvertently break existing core functionalities, workflow rules, or security boundaries.

The implementation includes:

Automated execution of the entire test suite (unit, integration, API E2E, and browser E2E) on every code change to catch regressions early.

Isolated test database setups ensuring migration safety, constraint enforcement, and data integrity across updates.

Automated safety nets guarding critical business logic, such as ticket lifecycle state transitions, role-based access control (RBAC), and session handling.

## Result

By the end of Week 3, Nexus had progressed from a backend-oriented prototype to a connected full-stack application:

```text
React
  |
API
  |
Authentication / Authorization
  |
Application Services
  |
Domain Policies
  |
Repositories
  |
PostgreSQL
```

The major Week 3 outcome was not only the addition of individual features, but the integration of these features into a coherent end-to-end system while maintaining clear boundaries between presentation, authentication, authorization, business logic, and persistence.

## Point Of Focus
This section discusses one narrow user facing service request flow. Although many request flows, tests and features are implemented, we will discuss one specific feature as an example: Ticket Submission, built with a React frontend, a NestJS backend, and real database persistence, behind an explicit API request and response contract.

### 1. User-Facing Flow
An authenticated user opens `/tickets/new`. The React route is defined in [App.jsx](<../frontend/nexus/src/App.jsx>), and [NewTicketPage.jsx](<../frontend/nexus/src/pages/tickets/NewTicketPage.jsx>) renders [TicketForm.jsx](<../frontend/nexus/src/components/tickets/TicketForm.jsx>).

The user enters a title, description, priority, and department. The page validates the fields locally, then [ticket-api.js](<../frontend/nexus/src/features/tickets/ticket-api.js>) sends:

```http
POST /tickets
```

The request is JSON and includes the session cookie through [client.js](<../frontend/nexus/src/lib/api/client.js>). NestJS authenticates the cookie, validates the body, checks the department, and calls [tickets.service.ts](<../backend/src/tickets/tickets.service.ts>).

The service creates an `OPEN` ticket for the authenticated user, with no assigned agent. [tickets.repository.ts](<../backend/src/tickets/repositories/tickets.repository.ts>) persists it in PostgreSQL through Prisma and generates a ticket code such as `TKT-0001`. The API returns the created ticket. The page then navigates to `/tickets/:ticketId`; [TicketDetailsPage.jsx](<../frontend/nexus/src/pages/tickets/TicketDetailsPage.jsx>) fetches it and [TicketDetails.jsx](<../frontend/nexus/src/components/tickets/TicketDetails.jsx>) displays the ticket details and `Open` status.

Departments are loaded before submission with `GET /departments` from [department-api.js](<../frontend/nexus/src/features/departments/department-api.js>).

### 2. API Contract

The endpoint is implemented by [tickets.controller.ts](<../backend/src/tickets/tickets.controller.ts>).

**Request:** `POST /tickets`

```json
{
  "title": "Badge access",
  "description": "Need building access",
  "priority": "MODERATE",
  "departmentId": "dept-it"
}
```

Validation in [submit-ticket.dto.ts](<../backend/src/tickets/dto/submit-ticket.dto.ts>) requires non-empty strings for `title`, `description`, and `departmentId`, and requires `priority` to be a sanitized non-empty priority code. The lifecycle service resolves that code against the active priorities managed by administrators. The global pipe in [main.ts](<../backend/src/main.ts>) rejects unknown fields.

**Success:** `201 Created`. The body is the mapped ticket response, including `ticketId`, `ticketCode`, input values, `status: "OPEN"`, a nested `department`, nested submitter/agent profiles, timestamps, and a `permissions` object. The server derives the submitter from the authenticated session and does not return a client-controlled `submittedBy` string or top-level `agentId`.

Example response for an employee submitting a ticket:

```json
{
  "ticketId": "generated-uuid",
  "ticketCode": "TKT-0001",
  "title": "Badge access",
  "description": "Need building access",
  "priority": "MODERATE",
  "status": "OPEN",
  "departmentId": "dept-it",
  "department": {
    "departmentId": "dept-it",
    "code": "IT",
    "name": "Information Technology"
  },
  "active": true,
  "completionNotes": null,
  "createdAt": "ISO date string",
  "updatedAt": "ISO date string",
  "closedAt": null,
  "submittedBy": {
    "userId": "authenticated-user-id",
    "fullName": "Alex Employee",
    "email": "alex@company.com"
  },
  "agent": null,
  "permissions": {
    "canModify": true,
    "canCancel": true,
    "canClaim": false,
    "canClose": false,
    "canRequestHandoff": false,
    "canReopen": false
  }
}
```

**Errors:**

- `400 Bad Request`: invalid fields or unknown fields, handled by [main.ts](<../backend/src/main.ts>).
- `401 Unauthorized`: no authenticated session, handled by [authorization.guard.ts](<../backend/src/authorization/guards/authorization.guard.ts>).
- `404 Not Found`: the department does not exist or is inactive, handled by [submit-ticket.policy.ts](<../backend/src/tickets/policies/submit-ticket.policy.ts>).
- `503 Service Unavailable`: database availability failure, mapped in [prisma-error.ts](<../backend/src/database/prisma-error.ts>).

`GET /tickets` is a separate paginated contract: it accepts `scope`, `page`, `pageSize`, `search`, `status`, `departmentId`, `priority`, and `includeInactive`, and returns `{ items, page, pageSize, hasMore }`. Ticket list items use reduced user references. The full current contract is maintained in [api-contract.md](api-contract.md).

### 3. Authorization Rule

Only authenticated users with role `Employee`, `Agent`, or `Admin` may submit a ticket. This role check is declared in [tickets.controller.ts](<../backend/src/tickets/tickets.controller.ts>) and enforced by the global [authorization.guard.ts](<../backend/src/authorization/guards/authorization.guard.ts>).

An authenticated employee submitting the allowed fields is accepted. A request without a valid session is denied with `401 Unauthorized`. The backend also sets `submittedBy` from `request.user.userId` in [tickets.service.ts](<../backend/src/tickets/tickets.service.ts>), so the client cannot choose another owner.

### 4. Invalid Request

This request is deliberately invalid because ownership fields are not part of the DTO:

```json
{
  "title": "Tampered owner",
  "description": "Invalid ownership attempt",
  "priority": "LOW",
  "departmentId": "dept-it",
  "submittedBy": "another-user"
}
```

The validation pipe rejects the unknown `submittedBy` property with `400 Bad Request`. This is verified by `rejects frontend supplied ticket ownership fields` in [authorization.api.e2e-spec.ts](<../backend/test/api/authorization.api.e2e-spec.ts>).

### 5. Expected Failure

If the submitted `departmentId` does not exist, [tickets.service.ts](<../backend/src/tickets/tickets.service.ts>) cannot find it. [submit-ticket.policy.ts](<../backend/src/tickets/policies/submit-ticket.policy.ts>) returns `404 Not Found` with `Department was not found`, and no ticket is created. This is tested in [tickets.service.integration-spec.ts](<../backend/src/tickets/tickets.service.integration-spec.ts>).

On the frontend, [NewTicketPage.jsx](<../frontend/nexus/src/pages/tickets/NewTicketPage.jsx>) catches the API error and shows it in the form error banner. A browser E2E test specifically submitting a nonexistent department was **Not found in the current implementation**.

### 6. Business-Rule Test

Business rule: when a user submits a service request, it is sent to the selected department and remains open and unassigned until a support agent claims it.

The test `submits a ticket as OPEN with no assigned agent` in [tickets.service.integration-spec.ts](<../backend/src/tickets/tickets.service.integration-spec.ts>) verifies this rule. It confirms that the request is saved for the selected department, starts in the `Open` state, and has no assigned agent. The same test also confirms that the request is associated with the authenticated user.

### 7. Backend/Database Integration Test

The test `submits a ticket as OPEN with no assigned agent` is in [tickets.service.integration-spec.ts](<../backend/src/tickets/tickets.service.integration-spec.ts>). It exercises the service, department lookup, submit policy, repository, Prisma, and the real configured integration database.

The setup in [tickets.test-utils.ts](<../backend/src/tickets/tickets.test-utils.ts>) uses `DatabaseModule` and a real `PrismaService`; [setup-integration-env.ts](<../backend/test/setup-integration-env.ts>) loads the integration database configuration and runs migrations. The test verifies persisted values such as `OPEN`, `agentId: null`, the authenticated submitter, department, and generated ticket code. The database is not completely mocked.

### 8. E2E Test

The meaningful browser test is `employees submit a ticket through the browser and it is persisted` in [tickets-submission.browser.e2e-spec.ts](<../backend/test/browser/tickets-submission.browser.e2e-spec.ts>).

It signs in an employee, opens the new-ticket page, fills and submits the form, checks that the details page shows the ticket and `Open` status, then reads the ticket from Prisma. This covers the React UI, API request, NestJS endpoint, authentication, service, repository, and database persistence.

### 9. Regression Protection

The test `keeps tickets after the application restarts` in [tickets.api.e2e-spec.ts](<../backend/test/api/tickets.api.e2e-spec.ts>) protects the previously working behavior that submitted tickets remain persisted after the backend restarts. It would catch a regression to in-memory storage or incorrect database reconnection.

Other tests protect required-field validation and ownership-field rejection in [tickets-submission.browser.e2e-spec.ts](<../backend/test/browser/tickets-submission.browser.e2e-spec.ts>) and [authorization.api.e2e-spec.ts](<../backend/test/api/authorization.api.e2e-spec.ts>). The browser submission test also protects the behavior that persisted ticket data appears in the employee UI.
