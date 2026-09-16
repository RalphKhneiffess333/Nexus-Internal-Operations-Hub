# Week 3 - Full-Stack Delivery

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

- `backend/prisma/schema.prisma` defines the PostgreSQL datasource, domain models, relationships, constraints, enums, and indexes.
- `backend/prisma/migrations/` contains the reproducible database migrations for tickets, users, departments, identity providers, department memberships, and identity linking.
- `backend/src/database/prisma.service.ts` owns the Prisma client connection lifecycle.
- `backend/src/tickets/repositories/tickets.repository.ts` replaces in-memory persistence with Prisma-backed ticket storage, including soft deletion, ticket code generation, and concurrency-safe claiming.
- `backend/src/users/repositories/users.repository.ts` and `backend/src/departments/repositories/departments.repository.ts` provide the database-backed user, identity-provider, department, and membership queries used by the rest of the system.

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

- `frontend/nexus/src/features/tickets/ticket-api.js` maps frontend ticket actions to backend ticket endpoints.
- `frontend/nexus/src/pages/tickets/TicketsPage.jsx` implements submitted tickets, department tickets, ticket pool, loading states, empty states, and API error states.
- `frontend/nexus/src/pages/tickets/NewTicketPage.jsx` implements ticket creation from the frontend.
- `frontend/nexus/src/pages/tickets/TicketDetailsPage.jsx` implements ticket details, edit, cancel, claim, close, and reopen actions using server-returned permissions.
- `backend/src/tickets/tickets.controller.ts` exposes the ticket API routes.
- `backend/src/tickets/tickets.service.ts` owns the application-level ticket workflow, actor-aware scoping, lifecycle transitions, and action permissions.
- `backend/src/tickets/policies/` contains the resource and lifecycle policies for viewing, submitting, modifying, cancelling, claiming, closing, and reopening tickets.
- `backend/src/tickets/repositories/tickets.repository.ts` persists ticket lifecycle changes to PostgreSQL.

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

- `backend/src/authentication/authentication.module.ts` registers the authentication controller, Microsoft strategy, session service, and global authentication guard.
- `backend/src/authentication/authentication.controller.ts` exposes Microsoft login/callback, current-user, logout, and logout-all-devices endpoints.
- `backend/src/authentication/authentication.service.ts` validates login state, resolves or provisions local users, links Microsoft identities, rejects inactive users, and creates sessions.
- `backend/src/authentication/strategies/microsoft-auth.strategy.ts` handles the Microsoft Entra OAuth flow, token exchange, OpenID/JWKS lookup, ID token verification, and normalized identity extraction.
- `backend/src/authentication/sessions/session.service.ts` implements opaque sessions, sliding seven-day expiration, and logout-all-devices.
- `backend/src/authentication/guards/authentication.guard.ts` reads the session cookie, refreshes valid sessions, resolves the user, and attaches `request.user`.
- `frontend/nexus/src/features/authentication/AuthenticationProvider.jsx` connects the React application to the backend authentication session.

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

- `backend/src/authorization/authorization.module.ts` registers the authorization guard globally.
- `backend/src/authorization/guards/authorization.guard.ts` handles public route bypasses, protected-route authentication checks, role checks, `401 Unauthorized`, and `403 Forbidden`.
- `backend/src/authorization/decorators/public.decorator.ts` and `backend/src/authorization/decorators/roles.decorator.ts` provide endpoint-level authorization metadata.
- `backend/src/tickets/tickets.controller.ts` applies role requirements to ticket endpoints.
- `backend/src/tickets/tickets.service.ts` applies the authenticated actor to ticket scopes and operations.
- `backend/src/tickets/policies/` enforces ticket ownership, department access, assignment rules, and lifecycle permissions.

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

- `backend/src/authentication/authentication.service.spec.ts` tests login state validation, local user provisioning/linking, inactive-user rejection, Microsoft strategy failures, and session creation.
- `backend/src/authentication/strategies/microsoft-auth.strategy.spec.ts` tests Microsoft login URL generation, token exchange failures, malformed/missing ID tokens, invalid token claims, and OpenID configuration failures.
- `backend/src/authentication/guards/authentication.guard.spec.ts` tests session-cookie handling, expired/missing sessions, user attachment, and session refresh.
- `backend/src/authentication/sessions/session.service.spec.ts` tests opaque session creation, sliding expiration, expired-session cleanup, and logout-all-devices.
- `backend/src/authorization/guards/authorization.guard.spec.ts` tests public endpoints, protected endpoint `401` behavior, allowed roles, and disallowed role `403` behavior.
- `backend/src/tickets/tickets.service.spec.ts` tests invalid ticket transitions and permission failures without writing to the repository.

#### Integration tests

- `backend/src/tickets/tickets.service.integration-spec.ts` tests ticket submission, retrieval, modification, cancellation, authenticated ownership, visibility rules, department restrictions, scoped ticket lists, and action permissions against the real persistence layer.
- `backend/src/tickets/tickets.lifecycle.integration-spec.ts` tests persisted lifecycle behavior across OPEN -> CLAIMED -> CLOSED -> REOPENED -> CLAIMED and verifies rejected operations leave stored tickets unchanged.
- `backend/src/departments/departments.service.spec.ts` tests active department listing and inactive department filtering against the database.

#### API E2E tests

- `backend/test/api/tickets.api.e2e-spec.ts` tests ticket submit, claim, close, reopen, persistence after restart, invalid close behavior, and concurrent claim behavior over HTTP.
- `backend/test/api/authorization.api.e2e-spec.ts` tests unauthenticated access rejection, role rejection, identity-field tampering rejection, and authenticated submitter ownership.
- `backend/test/api/departments.api.e2e-spec.ts` tests active department listing over HTTP.

#### Browser E2E tests

- `backend/test/browser/auth.browser.e2e-spec.ts` tests unauthenticated landing, authenticated workspace entry, and sign-out.
- `backend/test/browser/tickets-submission.browser.e2e-spec.ts` tests browser ticket submission, required-field validation, and submitted ticket list rendering.
- `backend/test/browser/tickets-agent-workflow.browser.e2e-spec.ts` tests agent ticket claiming and closing from the browser.
- `backend/test/browser/tickets-lifecycle.browser.e2e-spec.ts` tests employee reopen, edit, and cancel flows from the browser.
- `backend/test/browser/golden-path.browser.e2e-spec.ts` tests the full employee-to-agent-to-employee flow: submit, claim, close, and employee closure visibility.

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
