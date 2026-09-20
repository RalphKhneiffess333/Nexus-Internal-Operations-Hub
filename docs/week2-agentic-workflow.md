---
title: "Agentic Workflow Ticket Lifecycle - Nexus"
author: "Ralph Khneiffess"
---

# Agentic Workflow - Nexus
NOTICE: This file is best treated as a historical archive for Eurisko Academy instructors as it may contain stale file references since major application updates have been implemented since the creation of this file. To properly follow its implementation, it is recommended to revert to commit 9e46642f1a39b8984802a7d3597b73e2b4431ad2 on Sep 8, 2026.

The current implementation has since added PostgreSQL persistence, authentication, authorization, files, Ticket Events, handoffs, Chat, administration, and realtime delivery. The current API is documented in [api-contract.md](api-contract.md). The API table later in this archived workflow describes the original development slice and must not be used as the current contract.

## Objective
- The implementation must remain intentionally small and modular. Do not implement future architecture or features unless explicitly requested.
- Implement a set of features of Nexus in an API that revolves around ticket lifecycle operations.
- The ticket lifecycle is as follows: OPEN -> CLAIMED -> CLOSED -> REOPENED -> CLAIMED -> ...
- The backend should correctly transition ticket states respecting conditions, rules, authorization, and invariants previously defined in product-specs.md, architecture.md, and data-model.md.
- The technology used will be NestJS for the backend, as of now, data will be stored in memory without a database connection.

## Context
Before making changes, the agent must inspect and understand:

product-specs.md
architecture.md
data-model.md
this agentic-workflow.md
the agent should not implement features or invent stuff that wasn't specified in any of these files.
All specified files are in the docs folder.

## Current Scope
The current bounded workflow includes:

Ticket viewing
Ticket submission
Ticket claiming
Ticket closing
Ticket reopening
Ticket cancelling
Ticket modification
Ticket lifecycle validation
In memory database
Tests that cover all the specified features

Current implementation should only support ticket lifecycle operations with validations specific to ticket states excluding role and resource based access control for users or department management.

### Out of Scope
The architecture should be easy to extend later, but future functionality should not be implemented prematurely, the current implementation should exclude:
- File attachments
- Frontend Development
- Authentication
- Authorization
- Permissions
- Chat features
- Email notifications
- Ticket handoffs
- Admin management features
- Logs or ticket events

## No Authorization
Authorization was intentionally excluded from this archived workflow. It is implemented in the current repository as a separate module; see [api-contract.md](api-contract.md) for the current protected routes.
There may be authorization requirements described in the product specifications, such as:

Employees can perform certain actions
Agents can claim tickets
Only the assigned agent can close a ticket
Users can only access certain tickets
These requirements must not be implemented as role checks or permission checks during this workflow.

Do not introduce:
UserRole
AgentRole
AdminRole
Permission
RoleGuard
AuthorizationService
AuthorizationGuard

"Can this ticket be claimed based on its current state?" belongs to the Tickets domain.
"Is this particular user allowed to claim tickets?" belongs to Authorization and must not be implemented.

## File Structure
Each entity or feature should have its seperate folder

src/
├── main.ts
├── app.module.ts
│
├── tickets/
│   ├── tickets.module.ts
│   ├── tickets.controller.ts
│   ├── tickets.service.ts
│   │
│   ├── dto/
│   │   └── ...
│   │
│   ├── entities/
│   │   └── ...
│   │
│   ├── policies/
│   │   └── ...
│   │
│   └── repositories/
│       └── ...
│
├── users/
│   └── ...
│
│
├── database/
│   └── ...
│
└── common/
    └── ...

## Policies
Every module that requires validation logic should have a policies folder that stores business validation rules.

They have different responsibilities.
For example:

tickets/
└── policies/
    ├── claim-ticket.policy.ts
    ├── close-ticket.policy.ts
    ├── reopen-ticket.policy.ts
    └── modify-ticket.policy.ts

These policies validate wether a ticket can transition from one state to another.

## Repositories
- The Tickets module must not directly manipulate the in memory database
- Use a repository class responsible for seperation
- Do not allow feature services to reach directly into the database queries.
- Repositories should be organized around the data they own.
- Do not create a single giant DatabaseService class
- The in memory database itself may contain multiple entities, but feature modules should access them through appropriate repositories.
- For example, ticket service should call methods defined by tickets repository to find the appropriate data and not call database queries directly

## God Services
No service should handle unrelated functionality.
If a service starts handling multiple independent responsibilities, split them.
Keep each component focused.
A service should generally be understandable without scrolling through hundreds of lines of code.

## File Size and Complexity Guidelines
Avoid large files.
As a guideline:
Prefer files under 150 lines.
Files approaching 200 lines should trigger consideration of splitting responsibilities
Do not split a small cohesive class just to reduce line count
Never create a 300 to 500 line service when several features can naturally be separated
Large files should be split.

## Controllers
Controllers should remain thin.

A controller should primarily:

Receive HTTP input
Parse route and body parameters
Call the appropriate service operation
Return the result
A controller should not have:
Business rules
Persistence logic
Authorization logic
Complex transformations
Lifecycle validation

## DTOs
DTOs should represent API input structures
Keep validations inside DTOs where appropriate.
Example:
dto/
├── submit-ticket.dto.ts
├── claim-ticket.dto.ts
├── close-ticket.dto.ts
├── reopen-ticket.dto.ts
├── modify-ticket.dto.ts
└── cancel-ticket.dto.ts

A single ticket.dto.ts containing all DTOs is acceptable if the number of DTOs remains small, but split it when the file becomes large
Do not put business logic inside DTOs.

## Entities
Entity models should represent the data defined by data-model.md.
Do not turn entities into giant classes containing unrelated business functionality.

## Policy Isolation
Avoid creating one big TicketLifecycleValidator class containing every ticket rules
Split policies if they can be seperated:

tickets/
└── policies/
    ├── claim-ticket.policy.ts
    ├── close-ticket.policy.ts
    ├── reopen-ticket.policy.ts
    └── modify-ticket.policy.ts

If several rules are small and belong together, they may remain in a single lifecycle policy.

## Error Handling
Use NestJS exceptions appropriately.

Examples:
throw new NotFoundException(...)
throw new BadRequestException(...)

## Ticket Lifecycle
The valid lifecycle is: OPEN -> CLAIMED -> CLOSED -> REOPENED -> CLAIMED -> CLOSED

The implementation must prevent invalid transitions.
OPEN → CLOSED
OPEN → REOPENED
CLOSED → CLAIMED
CLOSED → CLOSED
CLAIMED → CLAIMED
must not be allowed unless explicitly defined by the product specifications.

## Ticket Invariants
An OPEN ticket must not have an assigned agent.
A REOPENED ticket must not have an assigned agent.
A CLOSED ticket must not have an assigned agent.
A CLAIMED ticket must have exactly one assigned agent.
A ticket cannot be claimed if it already has an assigned agent.
A ticket can only be claimed when its status is OPEN or REOPENED.
A ticket can only be closed when its status is CLAIMED.
A ticket cannot transition directly from OPEN to CLOSED.
A ticket cannot be reopened unless its status is CLOSED.
These are domain rules and should be implemented in the Tickets module.

## Testing
Every implemented ticket operation should have tests covering:

### Valid Transitions
Valid ticket submission
Valid claim
Valid close
Valid reopen
Valid modification
Valid cancellation
Valid retrieval
OPEN -> CLAIMED
CLAIMED -> CLOSED
CLOSED -> REOPENED
REOPENED -> CLAIMED

### Invalid Transitions
Invalid lifecycle transitions
Claiming an already claimed ticket
Closing an unclaimed ticket
Reopening a non closed ticket
Invalid assignment state
Other invariants defined in the product specifications

## Original API (historical)
| Action | Endpoint | Payload |
| -------- | :--------: | :--------: |
| Submit ticket   | POST /tickets   | Title, description, priority, department, submittedBy (only for testing purposes as authorization functionality will automatically fill this field in the future)|
| Get ticket/s  | GET /tickets, /tickets:id | X |
| modify ticket | PATCH /tickets/:id | Title, description, priority, department |
| Claim ticket | POST /tickets/:id/claim | Agent ID (only for testing purposes as authorization functionality will automatically fill this field in the future) |
| close ticket | POST /tickets/:id/close | Completion Notes |
| reopen ticket | POST /tickets/:id/reopen | Description |
| cancel ticket | POST /tickets/:id/cancel | X |

Every endpoint response has the same structure:
{
  "ticketId": "uuid",
  "ticketCode": "TKT-0001",
  "title": "string",
  "description": "string",
  "priority": "priority code managed by the administrator",
  "status": "OPEN | CLAIMED | CLOSED | REOPENED",
  "departmentId": "string",
  "submittedBy": "string",
  "agentId": "string | null",
  "active": true,
  "completionNotes": "string | null",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "closedAt": "ISO-8601 | null"
}

The current API no longer accepts client-supplied `submittedBy`, does not use one response shape for every list/detail route, and returns pagination envelopes for list endpoints. See [api-contract.md](api-contract.md).

## Implementation Process
The coding agent must follow this process.
Step 1: Inspect
Inspect all relevant documentation in docs folder.
Read product-specs.md
Read architecture.md
Read data-model.md

Step 2:Plan
Before implementing a feature, determine:
Which module owns it?
Which service owns the operation?
Which policy owns the business rules?
Which DTO represents the input?
What tests are required?

Step 3:Implement the change
Do not implement unrelated features while working on a feature
Avoid creating abstractions that are not currently required

Step 4: Test
Add or update tests immediately after implementing the feature

Step 5: Review architecture
Before moving to the next feature, check:

Is any service becoming too large?
Is business logic in the controller?
Is business logic in the repository?
Is a policy accessing the database?
Is any feature directly accessing InMemoryDatabaseService?
Has authorization accidentally been introduced?
Has audit/event functionality accidentally been introduced?
Has an unrelated dependency been introduced?

Step 6: Continue
Only after the current feature is working and architecturally clean should the agent move to the next feature.

## This Process is done When
- NestJS application runs successfully 
- Ticket operations are implemented
- Ticket lifecycle rules are enforced
- Ticket invariants are enforced
- Tests cover successful operations and relevant failure cases
- No unnecessary architecture or dependencies have been introduced
- The final implementation should be simple enough that a developer can understand the ticket workflow by inspecting the Tickets module without much difficulty
