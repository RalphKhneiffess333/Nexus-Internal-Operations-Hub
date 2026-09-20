---
title: "Authorization - Nexus"
author: "Ralph Khneiffess"
---

# Nexus - Authorization
This document defines how authorization is implemented in Nexus.

The current route-level role assignments and API response conventions are summarized in [../api-contract.md](../api-contract.md). The role names used by the implementation are the Prisma values `Employee`, `Agent`, and `Admin`; resource-specific ticket, Chat, and handoff checks remain inside their feature modules.

Authorization determines whether an authenticated Nexus user is allowed to perform a specific action.

Authorization is intentionally separated from authentication and from the individual business modules.

The authorization architecture has two complementary responsibilities:

Role-based endpoint authorization — handled centrally by the Authorization module using controller metadata such as @Roles(...).
Resource-based authorization — handled by the module that owns the resource, using module-specific policies.
For example:

An endpoint may require the AGENT role.

The Authorization module determines whether the authenticated user has that role.

If the endpoint is operating on a specific ticket, the Tickets module then determines whether that particular agent may perform the operation on that particular ticket.

Conceptually:

HTTP Request
     |
     v
Authentication
     |
     | request.user
     v
Authorization
     |
     | @Roles(...)
     |
     v
Controller
     |
     v
Feature Module
     |
    | Resource Policy
    v

## Current API contract

The implemented endpoint matrix and route-specific role assignments are maintained in [../api-contract.md](../api-contract.md). The global guard returns `401 Unauthorized` when no authenticated user is present and `403 Forbidden` when the authenticated user's explicit role is not allowed. Resource policies may return additional `400`, `404`, or `409` outcomes for invalid resource state.
Application Service
The Authorization module must not access tickets, chats, files, departments, or other feature-specific resources.

## Objective
Nexus must provide a centralized and reusable authorization mechanism for determining whether an authenticated user may access an endpoint based on their application role.

Authorization must:

Read the authenticated user from the request context.
Determine which roles are required by the endpoint.
Reject unauthenticated users when authentication is required.
Reject authenticated users whose role is not permitted by the endpoint.
Support endpoints that allow multiple roles.
Avoid duplicating role checks throughout controllers and services.
Remain independent from feature-specific resources.
Allow individual modules to perform resource-specific authorization through policies.
Return appropriate HTTP errors when access is denied.
Authorization must not perform authentication.

Authorization must not communicate with Microsoft Entra ID.

Authorization must not determine whether a user owns a particular ticket or resource.

Authentication and Authorization Separation
Authentication and authorization are separate pipeline stages.

Authentication establishes the identity of the requester.

Authorization determines whether that authenticated identity is allowed to access the requested endpoint.

For example:

Request
   |
   v
Authentication Guard
   |
   | request.user = User 42
   v
Authorization Guard
   |
   | @Roles(AGENT, ADMIN)
   v
Controller
   |
   v
Ticket Service
   |
   v
Ticket Policy
Authentication must not contain role checks.

Authorization must not authenticate users.

The authorization module may consume the authenticated user produced by the Authentication module.

## Request User Context
The Authentication module attaches the authenticated Nexus user to the request.

Conceptually:

request.user = authenticatedUser;
If the request has no valid session, authentication sets:

request.user = null;
The Authorization module consumes this value.

The authorization module must not attempt to determine the user's identity itself.

It must not:

Read session cookies directly.
Validate Microsoft tokens.
Communicate with identity providers.
Create sessions.
Look up users independently when the authentication layer has already established the request identity.
The expected pipeline is:

HTTP Request
      |
      v
Authentication Guard
      |
      +---- No session ----> request.user = null
      |
      +---- Valid session -> request.user = User
      |
      v
Authorization Guard
## Authorization Responsibilities
The Authorization module is responsible for centralized role-based access control.

Its responsibilities include:

Reading request.user.
Reading controller/route authorization metadata.
Determining whether the endpoint requires authentication.
Determining whether the user's role satisfies the endpoint's role requirements.
Allowing the request to continue when the requirements are satisfied.
Rejecting the request when the requirements are not satisfied.
The Authorization module is not responsible for resource-specific authorization.

For example, the Authorization module may determine:

User role = AGENT
Endpoint requires = AGENT
=> Role authorization succeeds
It must not determine:

Does this agent belong to the ticket's department?
Does this agent own the ticket?
Is this ticket currently assigned to this agent?
Is this ticket in a state that allows closing?
Those decisions belong to the Tickets module.

## Role-Based Access Control
Nexus currently defines three application roles:

EMPLOYEE
AGENT
ADMIN
The role hierarchy is:

ADMIN
  >
AGENT
  >
EMPLOYEE
However, the hierarchy does not automatically mean that every higher role is accepted by every lower-role endpoint.

Endpoint requirements must be explicitly defined.

For example:

@Roles(Role.AGENT)
means that the endpoint requires the AGENT role.

If administrators are also intended to access that endpoint, this must be expressed explicitly:

@Roles(Role.AGENT, Role.ADMIN)
The authorization system should not silently infer additional roles unless this behavior is explicitly defined by the application.

This keeps endpoint permissions explicit and easy to audit.

## Roles Metadata
Role requirements should be expressed through NestJS controller metadata.

A custom decorator should be provided:

@Roles(...)
For example:

@Roles(Role.ADMIN)
@Get()
getAllTickets() {
    ...
}
An endpoint may specify multiple allowed roles:

@Roles(Role.AGENT, Role.ADMIN)
@Post(':id/claim')
claimTicket() {
    ...
}
This means either an AGENT or ADMIN may pass the centralized role check.

Controllers therefore describe the access requirements without implementing the authorization logic themselves.

Roles Decorator
The @Roles(...) decorator should only define metadata.

Conceptually:

@Roles(Role.AGENT, Role.ADMIN)
stores metadata equivalent to:

requiredRoles:
    - AGENT
    - ADMIN
The decorator must not:

Inspect the request.
Read the authenticated user.
Perform database operations.
Throw authorization errors.
Perform resource checks.
The authorization guard is responsible for interpreting the metadata.

## Authorization Guard
The Authorization module should provide a reusable NestJS guard responsible for role-based endpoint authorization.

Conceptually:

AuthorizationGuard
       |
       +-- Read @Roles metadata
       |
       +-- Read request.user
       |
       +-- Check authentication requirement
       |
       +-- Check user's role
       |
       +-- Allow / reject request
The guard should be applied centrally rather than requiring every controller to manually invoke an authorization service.

The guard should use NestJS's reflection/metadata mechanism to retrieve the roles declared by the endpoint.

## Authentication Requirement
An endpoint that declares role requirements inherently requires authentication.

For example:

@Roles(Role.EMPLOYEE, Role.AGENT, Role.ADMIN)
@Get('/tickets')
requires an authenticated user.

If:

request.user === null
the request must be rejected.

The appropriate response is:

401 Unauthorized
The response should communicate that authentication is required.

Example:

{
  "statusCode": 401,
  "message": "Authentication is required"
}
The exact response format may follow the standard NestJS error response format used by the application.

## Invalid or Missing Role
If the request is authenticated but the user's role does not match any role declared by the endpoint, the request must be rejected.

Example:

User:
    role = EMPLOYEE

Endpoint:
    @Roles(AGENT, ADMIN)
Result:

403 Forbidden
Example response:

{
  "statusCode": 403,
  "message": "You do not have permission to access this resource"
}
This is different from an unauthenticated request.

No authenticated user
        |
        v
401 Unauthorized

Authenticated user without required role
        |
        v
403 Forbidden
Endpoints Without Role Metadata
Endpoints that do not declare @Roles(...) require an explicit policy regarding authentication.

The Authorization module should support endpoints that are intentionally public.

For example:

@Public()
@Get('/health')
healthCheck() {
    ...
}
A public endpoint does not require an authenticated user.

The authorization layer should therefore distinguish between:

Public endpoint
and:

Authenticated endpoint
A public endpoint must not accidentally become inaccessible merely because request.user is null.

A dedicated metadata decorator such as:

@Public()
should be used rather than relying on the absence of @Roles(...) to implicitly determine whether an endpoint is public.

This makes security requirements explicit.

Public Endpoints
The @Public() decorator marks an endpoint as intentionally accessible without authentication.

Conceptually:

@Public()
@Get('/health')
healthCheck() {
    return { status: 'ok' };
}
The authorization guard should detect this metadata and allow the request to continue.

Public endpoints should be kept to a minimum.


## Resource-Based Authorization
Role-based authorization is only one part of Nexus authorization.

The Authorization module must not access feature-specific resources.

Resource-based authorization is handled by the module that owns the resource.

For example:

Tickets Module
    |
    +-- Ticket Policies
The Tickets module can determine whether a user is allowed to perform an operation against a specific ticket.

Examples include:

Whether an employee owns a ticket.
Whether an agent belongs to the ticket's department.
Whether an agent is assigned to the ticket.
Whether the ticket is in a state that permits the operation.
Whether the user may modify the ticket.
Whether the user may reopen the ticket.
The centralized Authorization module must not implement these rules.

## Authorization Layers
Nexus authorization therefore has two layers.

Layer 1 — Endpoint Role Authorization
Handled by:

Authorization Module
Example:

@Roles(AGENT, ADMIN)
Checks:

Does request.user have AGENT or ADMIN role?
Layer 2 — Resource Authorization
Handled by:

Feature Module
Example:

Tickets Module
    |
    v
CloseTicketPolicy
Checks:

Is this ticket CLAIMED?
Is this user the assigned agent?
The complete authorization process is therefore:

Request
   |
   v
Authentication
   |
   | Who is the user?
   v
Authorization Guard
   |
   | Does the user's role allow this endpoint?
   v
Controller
   |
   v
Feature Service
   |
   | Does the user have access to this resource?
   v
Feature Policy
   |
   v
Operation
Module Authorization Policies
Feature modules should contain policies for their resource-specific authorization rules.

For example:

tickets/
├── policies/
│   ├── view-ticket.policy.ts
│   ├── claim-ticket.policy.ts
│   ├── close-ticket.policy.ts
│   ├── reopen-ticket.policy.ts
│   ├── modify-ticket.policy.ts
│   └── delete-ticket.policy.ts
The exact number of policies may be adjusted when implementation begins.

The important principle is that resource-specific authorization remains within the owning module.

Policies should not be responsible for:

Authentication.
Reading session cookies.
Role metadata.
Microsoft authentication.
Creating sessions.
Persistence unrelated to their resource.
Example: Ticket Viewing
Consider:

GET /tickets/:id
The endpoint could declare:

@Roles(Role.EMPLOYEE, Role.AGENT, Role.ADMIN)
The Authorization Guard checks the user's role.

Suppose the user is an employee.

The role check succeeds.

The request then reaches the Tickets module.

The Tickets module invokes its resource policy:

ViewTicketPolicy
The policy determines whether the employee may view this particular ticket.

For example:

Employee
    |
    +-- owns ticket -> allowed
    |
    +-- does not own ticket -> forbidden
The central Authorization module does not need to know what a Ticket is.

Example: Ticket Closing
Consider:

POST /tickets/:id/close
The endpoint may specify:

@Roles(Role.AGENT, Role.ADMIN)
The Authorization Guard checks:

Is user an AGENT or ADMIN?
If not:

403 Forbidden
If yes, the request reaches the Tickets module.

The Tickets module then performs its own resource/domain checks.

For example:

CloseTicketPolicy
checks:

Ticket exists?
Ticket status = CLAIMED?
User is the current assigned agent?
The Tickets module therefore owns ticket-specific access rules and ticket lifecycle rules.

Authorization Must Not Access Resources
The Authorization module must remain resource-agnostic.

It must not contain code such as:

ticketRepository.findById(...)
or:

if (ticket.agentId !== request.user.id)
or:

if (ticket.departmentId !== request.user.departmentId)
These checks belong to the Tickets module.

This separation prevents the Authorization module from becoming a central dependency on every application resource.

Authorization Module Structure
A proposed structure is:

src/
├── authorization/
│   ├── authorization.module.ts
│   ├── guards/
│   │   └── authorization.guard.ts
│   ├── decorators/
│   │   ├── roles.decorator.ts
│   │   └── public.decorator.ts
│   └── ...
│
├── authentication/
│   └── ...
│
├── users/
│   └── ...
│
├── tickets/
│   ├── ...
│   └── policies/
│       ├── view-ticket.policy.ts
│       ├── claim-ticket.policy.ts
│       ├── close-ticket.policy.ts
│       ├── reopen-ticket.policy.ts
│       ├── modify-ticket.policy.ts
│       └── delete-ticket.policy.ts
│
└── ...
The exact file structure may be simplified if implementation does not require all files.

## Implementation Process
1. Read the documentation first
Before making any changes, read:
- docs/product-specs.md
- docs/architecture.md
- docs/data-model.md
- docs/week2-agentic-workflow.md
- docs/agentic-workflows/authentication.md

Identify the authoritative product rules for:
Who can create tickets.
Who is considered the ticket submitter/owner.
Who can view tickets.
Who can claim tickets.
Who can close tickets.
Who can reopen tickets.
Who can modify tickets.
Who can delete tickets.
Agent/department restrictions.
Admin privileges.
Employee restrictions.
Ticket lifecycle/state transitions.

2. Read the existing codebase before implementing
Inspect the existing implementation end-to-end.

At minimum, inspect:

Authentication module.
Authentication guards/strategies.
Session handling.
request.user construction.
User/domain models and types.
User roles.
Ticket controller.
Ticket service/application service.
Ticket entity/model.
Ticket creation DTOs.
Ticket update DTOs.
Ticket lifecycle endpoints.
Ticket repositories.
Existing authorization/permission code.
Existing decorators and guards.
Existing tests.
Existing module boundaries.
Trace an actual request through the application:

HTTP request
    ↓
Authentication
    ↓
request.user
    ↓
Controller
    ↓
Application service
    ↓
Repository/domain
Understand exactly what is currently trusted from the frontend and where authenticated identity is available.

3. Establish the authenticated-user source of truth
The authenticated user must be the source of truth for identity-related fields.

Do NOT trust the frontend to provide identity/ownership fields.

In particular, fields such as:

submittedBy
submittedById
createdBy
owner
ownerId
current user identity
authenticated actor
must not be accepted from the frontend or hardcoded by functions when their value can be derived from the authenticated request.

For ticket creation, for example:

request.user.id
        ↓
ticket.submittedById
The frontend should provide ticket data belonging to the ticket itself, but must not be able to choose which authenticated user submitted the ticket.

4. Audit every ownership/identity field
Search the entire codebase for fields and concepts such as:

submittedBy
submittedById
createdBy
createdById
owner
ownerId
userId
agentId
assignedAgent
assignedAgentId
departmentId
For every occurrence, determine:

Is this identity derived from authentication?
Is it supplied by the frontend?
Is it persisted?
Is it mutable?
Is it used for authorization?
Can a malicious client manipulate it?
Should it instead come from request.user?
Is it a legitimate domain field that is allowed to be explicitly selected?
Fix insecure ownership flows rather than merely adding authorization around them.

The goal is:

Authenticated identity
        ↓
request.user
        ↓
application command/service
        ↓
domain/resource ownership
not:

Frontend
   ↓
submittedById
   ↓
backend trusts it
5. Define the authorization model from the product specs
Before implementation, produce an internal authorization matrix.

Map every protected endpoint to:

Authentication requirement.
Allowed application roles.
Resource-level policy.
Relevant ticket state/lifecycle restrictions.
Ownership/assignment/department restrictions.
For example:

Operation	Authentication	Roles	Resource policy
Create ticket	Yes	EMPLOYEE/AGENT/ADMIN as specified	Submitter derived from request.user
View ticket	Yes	As specified	Ticket visibility policy
Claim ticket	Yes	AGENT/ADMIN as specified	Claim policy
Close ticket	Yes	AGENT/ADMIN as specified	Close policy
Reopen ticket	Yes	As specified	Reopen policy
Modify ticket	Yes	As specified	Modify policy
Delete ticket	Yes	As specified	Delete policy
Do not assume these exact role mappings. Derive them from the product specifications.

6. Implement the centralized Authorization module
Implement the authorization architecture described in the authorization documentation.

The module should contain the centralized endpoint-level authorization mechanism.

Expected conceptual structure:

authorization/
├── authorization.module.ts
├── guards/
│   └── authorization.guard.ts
├── decorators/
│   ├── roles.decorator.ts
│   └── public.decorator.ts
└── ...
Adapt the structure to the existing repository conventions.

@Roles(...)
Implement a decorator that only stores metadata.

Example:

@Roles(Role.AGENT, Role.ADMIN)
It must not:

Read the request.
Query the database.
Perform resource checks.
Authenticate users.
Throw authorization errors.
@Public()
Implement the public endpoint metadata mechanism described in the architecture.

Public endpoints must be explicitly marked.

Authorization guard
Implement a reusable NestJS authorization guard that:

Reads @Public() metadata.
Reads @Roles(...) metadata.
Reads request.user.
Determines whether authentication is required.
Returns/continues for permitted requests.
Returns 401 Unauthorized when authentication is required but no authenticated user exists.
Returns 403 Forbidden when the authenticated user's role is not allowed.
Use the existing authentication/user types and NestJS conventions in the repository.

Do not make the authorization guard responsible for tickets or any other feature-specific resource.

7. Make authorization globally/reusably applied
Inspect how guards are currently registered.

Implement authorization centrally according to the architecture rather than forcing every controller to manually invoke an authorization service.

Where the application uses global guards, follow that pattern.

Ensure that:

Authentication Guard
        ↓
request.user
        ↓
Authorization Guard
        ↓
Controller
is preserved.

Do not accidentally execute authorization before authentication has populated request.user.

8. Add role metadata to ticket lifecycle routes
Inspect every ticket controller route and map it against the product specification.

Add explicit @Roles(...) metadata to the appropriate endpoints.

Pay particular attention to:

Create
List
View
Claim
Assign
Close
Reopen
Modify/update
Delete
Any escalation or lifecycle transition endpoints
Do not infer permissions merely from controller naming.

Do not assume:

ADMIN > AGENT > EMPLOYEE
means an ADMIN automatically satisfies an @Roles(AGENT) endpoint.

Follow the documented rule that endpoint permissions are explicit.

If both are allowed:

@Roles(Role.AGENT, Role.ADMIN)
If only AGENT is allowed:

@Roles(Role.AGENT)
Use the actual product requirements.

9. Implement resource-level authorization through feature-owned policies
Role authorization is not sufficient.

Implement ticket-specific authorization inside the Tickets module.

Conceptually:

Tickets
├── policies/
│   ├── view-ticket.policy.ts
│   ├── claim-ticket.policy.ts
│   ├── close-ticket.policy.ts
│   ├── reopen-ticket.policy.ts
│   ├── modify-ticket.policy.ts
│   └── delete-ticket.policy.ts
Only create the policies actually required by the product rules.

Policies must answer questions about the ticket/resource, such as:

Does the ticket exist?
Is the current user the submitter?
Is the current user the assigned agent?
Does the agent belong to the relevant department?
Is the ticket in the correct state?
Is the requested operation permitted for this ticket?
Is the user allowed to modify this particular ticket?
The exact rules must come from the product specifications.

10. Keep resource authorization out of the Authorization module
The centralized Authorization module must remain resource-agnostic.

Do NOT put code such as:

ticketRepository.findById(...)
inside the Authorization module.

Do NOT put:

ticket.agentId === request.user.id
inside the centralized authorization guard.

Do NOT make the Authorization module depend on the Tickets module.

Instead:

Authorization Guard
    ↓
role check
    ↓
Controller
    ↓
Tickets Application Service
    ↓
Ticket Policy
    ↓
operation
11. Ensure policies use authenticated identity
Resource policies should receive the authenticated user/actor explicitly.

For example, conceptually:

policy.canClose(user, ticket)
rather than allowing the policy to independently discover who the requester is.

The policy may use:

user ID
role
department
other authenticated user attributes
as required by the product rules.

Do not allow the caller to substitute an arbitrary user ID.

12. Protect lifecycle transitions
Do not treat ticket lifecycle endpoints as ordinary CRUD.

For every lifecycle operation, verify both:

Endpoint authorization
Example:

Does this user's role permit closing tickets?
Resource authorization/domain rules
Example:

Is this specific ticket closable?
Is it in the required state?
Is this user allowed to close this ticket?
Both layers must pass.

Conceptually:

POST /tickets/:id/close
        ↓
Authentication
        ↓
@Roles(...)
        ↓
Role authorization
        ↓
CloseTicketPolicy
        ↓
Ticket state/domain validation
        ↓
Close ticket
13. Do not trust frontend lifecycle/ownership values
Audit DTOs and request bodies for security-sensitive fields.

The frontend must not be able to override server-owned values such as:

submitter
creator
owner
assigned actor where assignment is controlled by the backend
authenticated actor
authorization-sensitive relationships
lifecycle state, if lifecycle transitions are represented by dedicated commands/endpoints
For example, do not blindly spread a DTO into a persistence model if that DTO contains fields that the client should not control:

repository.update(id, {
  ...dto,
});
Review whether this can allow clients to modify:

submittedById
createdById
assignedAgentId
status
departmentId
or other protected fields.

Separate client-controlled fields from server-controlled fields where necessary.

14. Review controller/service boundaries
Authorization should not be duplicated throughout the application.

Controllers should primarily express:

@Roles(...)
and invoke the application service.

The application service should invoke the relevant resource policy where resource authorization is required.

Avoid scattered checks such as:

if (user.role === ...)
throughout unrelated controllers/services when the check is an endpoint-level role requirement.

Likewise, do not put ticket-specific rules into generic role helpers.

15. Error semantics
Ensure the authorization layer distinguishes:

Unauthenticated
request.user == null
→ 401 Unauthorized

Example:

{
  "statusCode": 401,
  "message": "Authentication is required"
}
Authenticated but insufficient role
request.user exists
but role is not permitted
→ 403 Forbidden

Example:

{
  "statusCode": 403,
  "message": "You do not have permission to access this resource"
}
Follow the application's existing NestJS error/response conventions if they differ.

Resource policies should also use the application's established forbidden/not-found semantics consistently, especially where resource existence could have security implications.

16. Test the complete authorization matrix
Do not consider the task complete after the guard compiles.

Add/update tests covering at minimum:

Authentication
Protected endpoint with no authenticated user → 401.
Protected endpoint with authenticated user → proceeds.
Public endpoint with no authenticated user → proceeds.
Role authorization
For every protected ticket endpoint:

Each allowed role succeeds.
Each disallowed role receives 403.
Ownership
Verify that an employee cannot access another employee's ticket when the product rules prohibit it.

Verify that changing a frontend-supplied submittedById cannot change ownership.

Verify that ticket creation always uses the authenticated user's identity.

Agent restrictions
Test the documented department/assignment restrictions.

Lifecycle
Test every lifecycle transition against:

Allowed role.
Disallowed role.
Correct ticket state.
Incorrect ticket state.
Correct actor/assignment.
Incorrect actor/assignment.
Tampering
Explicitly test malicious requests that attempt to send:

{
  "submittedById": "another-user",
  "createdById": "another-user",
  "ownerId": "another-user"
}
or equivalent fields.

The backend must not trust these values where identity is derived from authentication.

Also test attempts to directly manipulate protected lifecycle/state fields if applicable.

17. Search for existing security holes
Before finishing, perform a security-oriented repository search.

Look for:

dto.userId
dto.submittedById
dto.createdById
dto.ownerId
dto.agentId
dto.departmentId
dto.status
and patterns such as:

...dto
being passed directly into persistence.

Look for frontend-provided identity being trusted.

Look for role checks duplicated manually.

Look for ticket access without a resource policy.

Look for lifecycle operations that can bypass the intended policy.

Look for routes missing authorization metadata.

Do not only implement the new architecture; fix existing paths that violate it when they are part of the affected authorization surface.

18. Preserve architecture boundaries
The final dependency direction should remain approximately:

Authentication
      ↓
request.user
      ↓
Authorization
      ↓
Controller
      ↓
Feature/Application Service
      ↓
Feature Policy
      ↓
Domain/Repository
The Authorization module must NOT depend on:

Tickets
Chats
Files
Departments
other feature resources
Feature modules may depend on the authenticated-user contract and may own their own policies.
