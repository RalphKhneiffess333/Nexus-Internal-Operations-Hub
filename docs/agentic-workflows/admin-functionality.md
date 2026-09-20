---
title: "Admin Functionality - Nexus"
author: "Ralph Khneiffess"
---

# Task: Implement All Nexus Administration Functionality

The current administration implementation is complete for the routes listed in this document. The final HTTP contract, including query parameters, response envelopes, priorities, and activity logs, is maintained in [../api-contract.md](../api-contract.md).

You are working in the existing **Nexus** codebase, a NestJS/Prisma/PostgreSQL backend with a React frontend.

Employee, agent, and dedicated administration functionality are implemented. This document records the administration requirements and the final route conventions; use [../api-contract.md](../api-contract.md) when an exact current payload or response envelope is needed.

Do not redesign Nexus. Inspect the current repository first and adapt this specification to its real architecture, naming, routes, DTO patterns, repositories, error conventions, frontend structure, and tests.

---

## 1. Documentation hierarchy

Before changing code, read these files in this order:

1. `docs/product-specs.md`
2. `docs/architecture.md`
3. `docs/data-model.md`

Then read all relevant implementation-stage documentation, especially:

- authentication documentation
- authorization documentation
- database setup/workflow documentation
- ticket lifecycle/interface documentation
- Ticket Events documentation
- file attachment documentation
- full-stack delivery/workflow documentation
- any ADRs and repository instructions (`AGENTS.md`, README files, etc.)

Interpret them as follows:

- Product specs, architecture, and data model define intended behavior.
- Workflow documents describe what should have been implemented at specific stages.
- The source code is the final source of truth for what currently exists.
- If code and documentation differ, preserve valid current behavior, choose the smallest compatible implementation, and report the discrepancy.

Do not assume a model, endpoint, policy, screen, or test exists merely because a document mentions it. Confirm everything in code.

---

## 2. Mandatory repository inspection

Before editing, inspect the application end-to-end.

### Backend

Inspect at minimum:

- `prisma/schema.prisma` and every existing migration
- database/Prisma service and transaction conventions
- Users module, service, repository, domain types, DTOs, and routes
- Departments and Department Members schema/code, if any
- Authentication strategy, login provisioning, session store, session validation, logout, and `request.user`
- how pre-provisioned users are matched to an identity-provider login
- `hasLogged`/`has_logged`, `active`/`isActive`, provider ID, email, role, and department membership behavior
- Authorization module, role decorator, guards, and route metadata
- resource policies for tickets and files
- Tickets controller/service/repository and list/detail query authorization
- claim, close, reopen, handoff, and department-removal behavior
- Ticket Events and Audit Logs; keep these concepts separate
- system configuration and reminder logic, if any
- configuration/environment handling
- exception mapping, validation pipe, pagination/filter/sort conventions
- existing ID generation, timestamps, soft deletion, indexes, and uniqueness conventions
- unit, integration, API E2E, concurrency, and test-data utilities

### Frontend

Inspect at minimum:

- application shell, navigation, responsive layout, and route guards
- current role-dependent navigation and ADMIN handling
- API client and cookie/authentication behavior
- user/session state and API types
- agent ticket board and ticket details screens
- any existing admin placeholders
- tables, forms, dialogs, confirmation patterns, pagination, filters, loading states, empty states, and error presentation
- existing frontend/unit/browser E2E tests

### Confirm current implementation

Determine and document:

1. The actual Prisma models for User, IdentityProvider, Department, DepartmentMember, Ticket, TicketEvent, AuditLog, and SystemConfiguration.
2. Which of those models do not yet exist.
3. Whether roles are a single enum field or a many-to-many permission model. The authoritative Nexus design expects exactly one application role per user: `EMPLOYEE`, `AGENT`, or `ADMIN`.
4. How users are automatically created or linked on first Microsoft Entra login.
5. How an administrator can safely pre-provision a user before first login.
6. Whether changing a user's role or active state affects existing sessions immediately.
7. Whether department membership already supports one user in multiple departments.
8. How tickets are authorized and queried for ADMIN today.
9. Whether admin is explicitly declared on agent routes or incorrectly inferred through a hierarchy.
10. Whether audit persistence exists and whether the database enforces immutability.
11. Whether configuration values are currently hardcoded.
12. Any existing notification/reminder implementation that consumes configuration.
13. Any existing claimed tickets or pending handoffs affected by membership removal or account deactivation.

Do not begin implementation until these flows are understood.

---

## 3. Administration scope

Implement these administration capabilities:

1. Admin dashboard/navigation.
2. User account management and pre-provisioning.
3. Role mapping.
4. User activation/deactivation.
5. Department creation, editing, and soft deletion/reactivation where compatible.
6. Department membership management, including multi-department agents.
7. System configuration management for configuration keys actually required by the documented/current system.
8. System-wide ticket visibility for admins.
9. Read-only administration history combining administrative Audit Logs with ticket-domain history in a clear interface.
10. Audit logging of every administration mutation.

Administrators remain employees and may use employee functionality. They may use agent functionality only where product requirements and current route contracts explicitly allow ADMIN.

The authorization system must **not** silently treat `ADMIN > AGENT > EMPLOYEE` as automatic permission inheritance. Every endpoint must state its allowed roles explicitly. Admin-only endpoints use `@Roles(Role.ADMIN)` (or the repository's equivalent). Shared agent/admin endpoints explicitly list both roles.

---

## 4. Explicitly out of scope

Do not implement unrelated future features merely because the complete architecture mentions them:

- chat or chat administration
- notifications or email delivery if not already present
- WebSockets
- handoffs if not already present
- analytics/productivity dashboards
- AI assignment
- employee schedules
- new identity providers
- password authentication or storing Microsoft credentials/tokens as passwords
- arbitrary permission/role builders
- multiple simultaneous application roles per user
- hard deletion of users, departments, tickets, Ticket Events, or Audit Logs
- audit-log editing/deletion APIs
- generic database editor
- production deployment/infrastructure
- a new design system

If an existing implemented feature must react to an admin mutation (for example, an agent removed from a department has a claimed ticket), update that integration only as necessary to preserve documented invariants.

---

## 5. User management

Create an admin-only user management experience and API.

### Required capabilities

Admins must be able to:

- list users with pagination using existing conventions
- search/filter by name, email, role, active status, login status, and department where practical
- view safe account details and department memberships
- pre-provision a user before first login
- change exactly one application role among `EMPLOYEE`, `AGENT`, and `ADMIN`
- activate or deactivate an account
- manage the user's department memberships through the department-membership functionality

### Pre-provisioning and identity linking

Preserve the current Microsoft Entra authentication architecture.

- Nexus never accepts or stores a password.
- An admin-created user begins with `hasLogged = false` (using actual naming) and `active = true` unless the existing design requires an explicit value.
- Use the existing identity-provider linkage strategy. Do not invent a second identity model.
- If provider user ID is unknown before first login, use the existing safe email/provider matching workflow, then bind the verified provider identity atomically on first successful login.
- Prevent an identity from linking to multiple Nexus users and prevent ambiguous duplicate-email/provider records.
- `uploadedBy`, ticket ownership, audit actors, and historical records must continue pointing to the stable Nexus User ID.
- Never allow the client to set `hasLogged`, provider claims, provider tokens, or internal linkage fields arbitrarily.

If the current schema makes correct pre-provisioning impossible, evolve it with a new migration in the smallest safe way. Never rewrite an applied migration.

### Role mapping rules

- A user has exactly one role.
- Reject invalid roles through DTO and database validation.
- Only ADMIN can change roles.
- A role change must take effect in subsequent authorization checks. Inspect whether sessions store a user snapshot or reload the user per request. Prevent stale sessions from retaining removed privileges.
- Do not permit the last active administrator to demote or deactivate themselves if that would leave Nexus without any active admin. Enforce this atomically, or clearly document a repository-backed bootstrap mechanism if the codebase already uses one.
- Protect against concurrent changes that could bypass the last-admin invariant.

### Account activation rules

- Inactive users cannot receive or continue using an authenticated Nexus session.
- Deactivation must invalidate all existing sessions for that user, or request authentication must reject them immediately and remove/revoke those sessions according to existing session conventions.
- Do not delete the user or rewrite historical actor references.
- Define and implement safe behavior for deactivating an agent with claimed tickets or pending handoffs by reusing the same lifecycle rules as department removal. Do not leave invalid ownership.
- Reactivation restores login eligibility but must not silently restore old ticket assignments or removed department memberships.

### Self-management safeguards

Admin endpoints must handle attempts to modify the currently authenticated admin deliberately. At minimum, prevent actions that lock the system out (last-admin deactivation/demotion). If self-demotion or self-deactivation is otherwise allowed, invalidate the current session immediately after a successful transaction and make the frontend handle it correctly.

---

## 6. Department management

Implement admin-only department management.

### Department fields

Follow the actual schema and documented concepts:

- unique ID
- unique code
- name
- description
- active flag
- timestamps according to project conventions

### Operations

Admins can:

- list/search departments and see active/inactive status and useful member counts
- create a department
- edit its code, name, and description
- soft-delete/deactivate a department
- reactivate a department if compatible with current conventions
- view and manage its members

Validate required fields, lengths, normalization, unique code/name rules already used by the repository, and malformed IDs. Do not expose raw Prisma/PostgreSQL errors.

### Soft deletion and referential integrity

- Never physically delete a department merely because an admin removes it.
- Existing tickets and historical events must retain their department references.
- Inactive departments must disappear from new-ticket target options and active ticket-pool routing choices.
- Historical ticket details must still display the inactive department.
- Prevent new tickets from targeting an inactive department at the backend, not only in the UI.
- Prevent department deactivation if the department has active tickets but allow the admin to remove the department option from ticket submission forms.
- Do not cascade-delete tickets, users, events, files, or audit records.

---

## 7. Department membership management

The User-to-Department relationship is many-to-many. A department agent can belong to multiple departments.

Admins can:

- assign an eligible user to one or more departments
- remove a user from a department
- list members of a department
- list departments for a user

Enforce a composite uniqueness constraint so the same membership cannot be added twice. Membership creation/removal must be idempotent or return a consistent conflict/not-found error according to current conventions.

### Role compatibility

Derive exact eligibility from product requirements and current code. At minimum:

- department membership drives agent/admin access to department ticket pools
- EMPLOYEE users must not accidentally gain agent permissions merely by being added to a department
- role checks and membership checks remain separate
- changing AGENT/ADMIN to EMPLOYEE must reconcile memberships/active assignments safely; do not leave a user authorized through stale state

### Removing an assigned agent

The product acceptance criteria state that if an agent is removed from a department while owning claimed tickets in that department, each affected ticket returns to the pool with no assigned agent and an appropriate available status. Preserve the actual lifecycle model:

- atomically verify affected tickets
- clear the current agent
- If the agent has a claimed ticket while being removed, the ticket transitions to CLOSED with the completion notes being that this agent was removed from the department.
- create the corresponding immutable Ticket Event(s) if the current Ticket Event design defines an action for this transition; do not fabricate an undocumented event type
- cancel affected pending handoffs if handoffs already exist, following current handoff rules
- create the administrative Audit Log entry

All related database changes must be in one transaction. Do not weaken claim concurrency.

If the documentation and implemented status model do not provide a truthful automatic transition for previously reopened tickets, stop and report the discrepancy rather than recording false history; choose the smallest explicit policy consistent with existing code.

---

## 8. System configuration

Implement admin management for configuration data that is genuinely part of the current Nexus system.

The documented model is a key/value/description store with unique keys. Examples include reminder intervals per priority and other non-secret operational values.

Requirements:

- list configuration entries
- view key, value, description, and safe metadata
- update allowed configuration values
- validate values by semantic type, not merely as arbitrary strings
- reject negative reminder intervals
- maintain unique keys
- audit old and new values
- ensure existing consumers read configuration dynamically from the database rather than duplicating magic constants

Do not expose secrets or make environment secrets editable through this feature. Do not create unrestricted arbitrary keys from the UI unless the current architecture explicitly requires it. Prefer a registry/allowlist of supported configuration keys with centralized parsers and validators.

If notification/reminder processing is not implemented, persist and expose only configuration keys that the authoritative documentation clearly requires, and explicitly report that no nonexistent reminder worker was added.

Priority values `LOW`, `MODERATE`, and `HIGH` are documented enums. Do not convert them into freely editable values unless the current schema and authoritative docs explicitly support doing so.

---

## 9. Admin ticket access

Administrators can view all active and historical tickets across the system, regardless of submitter or department.

- Reuse existing ticket DTOs, repositories, event history, attachment metadata, and secure file-download authorization.
- Extend the authoritative ticket-list query/policy rather than creating a duplicate admin ticket system.
- Support existing pagination/filter/sort patterns; useful admin filters include status, priority, department, submitter, assigned agent, active/deleted state, and date range where practical.
- Admin visibility does not automatically allow arbitrary mutation. Claim/close/other actions must still follow explicit route roles and resource/lifecycle policies.
- Soft-deleted tickets may be visible to admins as historical records but must remain clearly marked and immutable according to existing lifecycle rules.
- Admin attachment downloads must still resolve File -> Attachment -> TicketEvent -> Ticket and authorize the owning ticket. A file ID alone never grants access.

---

## 10. Audit Logs and administration history

Ticket Events and Audit Logs are different:

- Ticket Events are immutable business history for one ticket.
- Audit Logs are immutable system/security/administrative activity.

Implement or complete the Audit module only to the extent required for administration.

### Required audit actions

At minimum record successful mutations for:

- user pre-provisioning/account creation
- role mapping/change
- user activation/deactivation
- department addition
- department modification
- department soft deletion/reactivation
- department membership addition/removal
- system configuration modification

Use the documented action names where they already exist, such as `DEPARTMENT_ADDITION`, `DEPARTMENT_MODIFICATION`, `DEPARTMENT_DELETION`, `DEPARTMENT_MAPPING`, `ROLE_MAPPING`, and `SYSTEM_VARIABLE_MODIFICATION`. Add narrowly named actions for uncovered required operations only if needed and consistent with repository enums.

Each audit entry contains:

- unique ID
- action type
- actor Nexus User ID (nullable only for genuine system actions)
- structured JSON details containing safe identifiers and before/after snapshots needed for accountability
- creation timestamp

Never put passwords, session IDs, cookies, provider tokens, secrets, raw uploaded bytes, or sensitive infrastructure details into audit JSON.

### Atomicity

The domain mutation and its Audit Log must commit or roll back together. A successful admin action without its required audit entry is invalid. Use the repository's Prisma transaction boundary; controllers must not orchestrate transactions.

### Immutability

- Expose no update/delete Audit Log endpoint.
- Enforce immutability at the database level using the project's PostgreSQL migration conventions where practical (for example, a trigger rejecting UPDATE/DELETE), not only application discipline.
- Logs remain available for at least two years.
- Do not implement the two-year purge worker unless one already exists and naturally belongs in scope.

### History UI/API

Admins need a read-only history screen with pagination and useful filters (action type, actor, date range, and related entity where supported).

The docs say admins can view all history. Present a clear separation or unified read model for:

- administrative/system Audit Logs
- ticket-domain Ticket Events

Do not merge the tables or pretend their payloads have the same schema. If providing a combined chronological feed, normalize only the safe display envelope while preserving source type and identifiers. Reuse existing ticket-history authorization and mapping.

---

## 11. API design

The implemented contract is:

```http
GET    /admin/users
POST   /admin/users
PATCH  /admin/users/:userId/role
PATCH  /admin/users/:userId/status
POST   /admin/users/:userId/departments/:departmentId
DELETE /admin/users/:userId/departments/:departmentId

GET    /admin/departments
POST   /admin/departments
PATCH  /admin/departments/:departmentId
DELETE /admin/departments/:departmentId
POST   /admin/departments/:departmentId/reactivate
GET    /admin/departments/:departmentId/members

GET    /admin/priorities
POST   /admin/priorities
PATCH  /admin/priorities/:priorityId
DELETE /admin/priorities/:priorityId
POST   /admin/priorities/:priorityId/reactivate

GET    /admin/configurations
PATCH  /admin/configurations/:key

GET    /admin/audit-logs/activity
GET    /admin/audit-logs/:auditLogId
```

There is no dedicated admin user-detail or admin user-memberships GET route. The general `GET /users/:userId` profile route is available to authenticated users. There is no collection route at `/admin/audit-logs`; administration history is read through `/admin/audit-logs/activity`.

The user list accepts `page`, `pageSize`, `search`, `status`, `departmentId`, and `hasLogged`. Department and member lists accept `page`, `pageSize`, and `search`. The activity list accepts `page`, `pageSize`, `source`, `auditAction`, and `ticketAction`.

All administration routes must:

- require authentication
- explicitly require ADMIN
- validate params, query strings, and bodies
- use DTOs and the global validation pipe
- return safe response DTOs rather than raw Prisma objects
- apply pagination limits
- return consistent 400/401/403/404/409/5xx errors
- never leak Prisma errors, SQL, internal stack traces, session identifiers, provider tokens, or secrets

List responses are mapped DTOs. Counted administration lists return `{ items, page, pageSize, total }`; the activity list returns `{ items, page, pageSize, hasMore }`. Department responses currently expose the persisted description under the response key `desc`.

Do not add generic CRUD endpoints that permit arbitrary writes to historical or security data.

---

## 12. Backend architecture

Follow the existing modular-monolith structure.

Conceptually:

```text
Admin HTTP controller
        ↓
Administration application service
        ├── Users service/repository
        ├── Departments service/repository
        ├── System configuration repository
        ├── Ticket lifecycle/repository (only for required reconciliation)
        └── Audit repository
                ↓
             Prisma
                ↓
           PostgreSQL
```

Requirements:

- Controllers remain thin.
- Services own orchestration and application rules.
- Feature policies own resource-specific rules.
- Repositories own persistence/query details.
- The generic Authorization module owns endpoint-role checks only; it must not query tickets or departments.
- Authentication continues to own login/session mechanics, not role administration.
- Do not bypass UsersService from Authentication or duplicate identity-linking logic.
- Avoid god services and circular dependencies. Extract focused transactional orchestration where needed.
- Reuse existing ID generation and error types.

---

## 13. Database and migrations

After inspection, add only missing structures. Expected concepts include:

- User with one Role, `active`, `hasLogged`, and identity-provider linkage
- Department with code/name/description/active
- DepartmentMember with composite unique/primary key
- SystemConfiguration with unique key, value, description, and timestamps where conventions require
- AuditLog with action, nullable actor, JSONB details, and created timestamp

Create new Prisma migrations. Never edit an already-applied historical migration.

Add only meaningful constraints and indexes based on actual queries, likely including:

- unique normalized user email/provider identity as supported by current design
- User role/active/login search needs
- unique Department code (and name only if authoritative/current behavior requires it)
- Department active/list query support if justified
- unique `(userId, departmentId)` membership
- indexes on DepartmentMember `userId` and `departmentId` according to PostgreSQL query needs
- unique SystemConfiguration key
- AuditLog `createdAt`, `action`, `actorId`, and useful composite indexes based on filters

Use database constraints for invariants PostgreSQL can enforce. Run Prisma validation and client generation. Ensure the entire migration chain works on a fresh database.

Seed or bootstrap behavior must not hardcode production credentials. If an initial admin is required, follow the repository's existing secure environment/seed process and document it.

---

## 14. Frontend administration experience

Build a responsive admin section consistent with the current UI.

### Navigation and route protection

- Show admin navigation only to ADMIN users.
- Protect routes client-side for UX and server-side for security.
- Direct URL navigation by non-admins must not reveal data.
- Preserve employee and explicitly allowed agent views for admins.
#### Management tab
This tab is independant in the navigation bar, it has 4 sections:
### Users section

- paginated/searchable/filterable table
- name, email, role, active state, login state, and department summary
- create/pre-provision form
- user detail/edit interaction
- role selector with confirmation for privilege changes
- activate/deactivate action with explicit warning
- department multi-membership editor
- clear handling of last-admin and self-session consequences

### Departments section

- list active/inactive departments
- create/edit forms
- soft-delete confirmation explaining effects
- optional reactivate action
- member list and add/remove controls
- inactive departments visually distinguished

### Configuration screen

- list supported non-secret configuration items
- typed controls and units (for example minutes/hours) matching backend semantics
- inline/help descriptions
- validation and save feedback

### Tickets

- Admin can browse all tickets through the existing ticket interface with system-wide filters.
- Reuse existing ticket details, timeline, and attachment download components.

### Logs screen
This tab is independant in the navigation bar, it has 3 sections: All system events which include ticket events and audit logs in chronological order, ticket events only and audit logs only:
- read-only lists
- filters and pagination
- actor, action, timestamp, source type, and safe human-readable details
- link to related users/departments/tickets where IDs are present and authorized
- no edit/delete controls

### UX requirements

- loading, empty, success, validation, conflict, forbidden, and server-error states
- do not optimistically claim success before the API commits
- refresh/invalidate cached data after mutations using current state-management conventions
- preserve cookie credentials; do not manually manage auth secrets
- accessible labels, keyboard-safe controls, confirmation for destructive/privilege-changing operations
- no raw JSON editor for audit details or system configuration

---

## 15. Security and concurrency

Protect against:

- non-admin access to every admin endpoint
- mass-assignment of protected User fields
- role escalation through ordinary user/profile endpoints
- stale privileged sessions after demotion/deactivation
- removing/deactivating the last active admin
- duplicate users or identity linking
- duplicate department codes/memberships
- membership changes racing with ticket claims
- department removal leaving invalid ticket ownership
- inactive departments accepting new tickets
- audit log tampering
- unbounded list queries
- injection through search/filter/sort inputs
- sensitive data in responses or audit details

Use transactions and atomic conditional updates/locking where multiple writes or concurrent invariants are involved. Preserve existing claim concurrency guarantees and run those tests afterward.

---

## 16. Testing requirements

Follow current testing patterns and use real Prisma/PostgreSQL integration where the repository already does.

### Authorization tests

- unauthenticated admin request -> 401
- EMPLOYEE and AGENT on every admin capability -> 403
- ADMIN -> allowed
- shared agent/admin routes explicitly allow both roles
- ADMIN is not silently accepted by agent-only metadata unless explicitly listed

### User tests

- list/filter users
- pre-provision user with `hasLogged = false`
- first verified provider login links the intended user and sets `hasLogged = true`
- duplicate/ambiguous email or identity rejected
- invalid role rejected
- exactly one role after mapping
- role change audited atomically
- stale session loses privilege after demotion
- inactive account cannot login/use an old session
- reactivation works without restoring previous assignments
- last active admin cannot be demoted/deactivated, including concurrent attempts
- self-demotion/deactivation behavior matches the chosen documented policy
- protected/internal fields cannot be mass-assigned

### Department tests

- create valid department
- missing/duplicate code/name validation
- edit and audit before/after values
- soft delete preserves historical tickets/references
- inactive department unavailable for new submissions
- reactivate if implemented
- non-admin cannot mutate departments

### Membership tests

- add/remove membership
- duplicate membership handled safely
- agent belongs to multiple departments
- employee membership does not grant agent actions
- removal revokes department ticket visibility/claim eligibility
- removing agent with claimed tickets reconciles them transactionally
- pending handoff impact follows implemented rules
- simulated failure rolls back membership, ticket changes, events, and audit entry
- concurrent removal and claim cannot violate ownership invariants

### Configuration tests

- list/update supported configuration
- duplicate/unknown key rejected as designed
- invalid type/negative reminder rejected
- old/new values audited
- secrets cannot be accessed/changed
- existing consumers observe new value without source-code constants

### Ticket/admin visibility tests

- admin views tickets across departments and submitters
- agent remains department-scoped
- employee remains submitter-scoped
- admin list filters/pagination work
- admin file download follows ticket authorization
- admin mutations still obey explicit lifecycle/resource policy

### Audit tests

- every successful admin mutation creates exactly one appropriate audit record
- failed mutation creates no success audit record
- mutation and audit insertion roll back together
- actor derives from authenticated user, never request body
- safe details contain useful before/after data but no secrets
- API has no mutation routes for logs
- database rejects AuditLog UPDATE/DELETE if DB immutability is implemented
- pagination/filtering/chronology
- Ticket Events remain separate and unchanged

### Frontend/browser E2E

At minimum implement one complete flow:

```text
admin logs in
  -> opens Users
  -> pre-provisions an agent
  -> assigns AGENT role
  -> assigns two departments
  -> user appears correctly
  -> audit history shows actions
  -> agent permissions work after login
```

Also cover a department flow and one access-denied flow if existing browser infrastructure supports them without excessive duplication.

---

## 17. Repository-wide verification

Before completion, search the repository for all administration integration points, including:

```text
ADMIN
Role.ADMIN
@Roles
role
hasLogged
has_logged
active
isActive
User
IdentityProvider
Department
DepartmentMember
departmentId
claim
assignedAgent
AuditLog
TicketEvent
SystemConfiguration
reminder
config
session
logout
```

Confirm there is one authoritative implementation for each mutation and no alternate route bypasses admin authorization or audit creation.

Inspect every existing ticket route: administrators receive employee/agent capabilities only where explicitly required. Do not globally modify role matching to introduce accidental privilege inheritance.

---

## 18. Before coding: produce a concise implementation plan

After repository inspection and before edits, output a concise plan that includes:

1. Current relevant Prisma models and missing models.
2. Current Users/authentication provisioning and identity-linking flow.
3. Current session behavior after role/active changes.
4. Current role guard semantics and ADMIN access gaps.
5. Current department/membership implementation.
6. Current ticket impact of membership removal/deactivation.
7. Current admin ticket visibility.
8. Current AuditLog and SystemConfiguration implementation.
9. Current frontend admin/navigation state.
10. Proposed modules/services/repositories/controllers.
11. Proposed schema/migration/constraint/index changes.
12. Proposed transaction boundaries and concurrency strategy.
13. Proposed APIs and frontend routes/screens.
14. Tests to add/update.
15. Exact files expected to change.
16. Documentation-versus-code discrepancies and any genuine blockers.

Then implement the feature. Do not stop after the plan unless a genuine blocker requires user input.

---

## 19. Verification commands

Inspect `package.json` files and run the actual repository scripts; do not guess script names.

At minimum verify where configured:

- Prisma format/validate
- Prisma Client generation
- migrations on the development/test database
- fresh-database migration chain
- backend typecheck/build
- frontend typecheck/build
- lint
- unit tests
- backend integration tests
- API E2E tests
- concurrency tests, especially claim versus membership removal
- frontend tests
- browser E2E tests

Do not hide failures. Distinguish code failures from unavailable external infrastructure.

---

## 20. Final implementation report

Report:

### Repository findings

- what existed before implementation
- documentation/code discrepancies

### Files created

List each file.

### Files modified

List each file.

### Database

- models, enums, relations, indexes, constraints, and migrations
- audit immutability mechanism
- last-admin/concurrency safeguards

### Backend

- user/role/status management
- department/membership management
- system configuration
- admin ticket visibility
- audit/history APIs
- transaction boundaries

### Authentication and authorization

- pre-provisioning/identity linking
- session behavior after privilege/status changes
- explicit ADMIN role metadata
- resource-policy reuse

### Frontend

- navigation/routes
- each admin screen and key interactions
- errors/loading/confirmation behavior

### API contract

Document actual methods, routes, request bodies/query parameters, and important responses.

### Audit coverage

Map every admin mutation to its audit action and details.

### Tests and verification

List tests added/updated and every command run with pass/fail status.

### Defaults and decisions

Clearly identify implementation choices not explicitly fixed by authoritative docs, such as pagination limits, allowed editable configuration keys, self-demotion policy, inactive-department handling, and claimed-ticket reconciliation. Do not present them as documented product requirements.

### Deferred functionality

List intentionally unimplemented out-of-scope features. Do not claim completion for features that were not built.

---

## 21. Definition of Done

The task is complete only when:

- admin-only navigation and screens exist
- admin routes are authenticated and explicitly ADMIN-authorized
- non-admin users cannot call admin APIs or view admin data
- users can be safely pre-provisioned and linked on first verified login
- admins can list/view users and map exactly one valid role
- admins can activate/deactivate users
- stale sessions cannot retain removed privileges
- the last active admin cannot be accidentally removed
- admins can create/edit/soft-delete departments
- inactive departments cannot receive new requests
- historical department references remain intact
- users can have multiple department memberships without duplicates
- membership removal safely reconciles claimed tickets and existing handoffs
- all related writes are transactional and concurrency-safe
- admins can manage supported non-secret system configuration with typed validation
- admins can view all tickets without weakening ticket mutation policies
- every successful admin mutation creates an immutable Audit Log atomically
- failed admin mutations do not create success logs or partial state
- Ticket Events remain distinct and immutable
- admins have a read-only system/ticket history experience
- no audit edit/delete API exists
- no raw Prisma/database/authentication secrets leak to clients
- existing employee and agent behavior remains correct
- claim concurrency and existing lifecycle tests remain correct
- migrations work from a fresh database
- Prisma validates and generates
- backend and frontend build
- relevant tests and E2E tests pass
- the final report accurately documents choices, gaps, and verification

