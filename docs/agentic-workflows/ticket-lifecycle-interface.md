---
title: "Ticket Lifecycle Slice Interface - Nexus"
author: "Ralph Khneiffess"
---

# Ticket Lifecycle Slice Interface - Nexus
## Objective
The implementation must create the React frontend for Nexus and connect it to the existing ticket lifecycle API.

The frontend should provide the initial employee-facing ticket experience:

View submitted tickets
View ticket details
Submit new tickets
Modify tickets while they are OPEN
Cancel tickets while they are OPEN
The interface should use a left-side navigation bar layout.

The frontend must consume the already existing Nexus backend API.

The backend must not be modified as part of this workflow.

Authorization and authentication are intentionally not implemented yet. The frontend must therefore not introduce authentication flows, role checks, permission systems, or authorization abstractions.

The implementation should remain intentionally small, modular, and easy to extend in future workflows.

## Context
Before making changes, the agent must inspect and understand:

docs/product-specs.md
docs/architecture.md
docs/data-model.md
docs/agentic-workflow.md
docs/database-setup.md
The existing backend source code
The existing ticket API implementation
The existing repository/project structure
The previous workflows implemented the ticket lifecycle API and PostgreSQL persistence.

The frontend currently has a vanilla react vite setup.
The frontend workflow must treat that API as an existing external dependency.

The frontend should adapt to the API that already exists rather than changing the API to suit the frontend.

## Current Scope
The current frontend scope is limited to the employee ticket experience.

### Included
Application shell
Microsoft Teams-inspired left navigation
Tickets navigation section
Employee ticket list
Ticket details
Ticket submission
Ticket modification
Ticket cancellation
API client for the existing ticket API
Loading states
Empty states
API error states
Form validation appropriate for the API
Responsive interface for desktop and mobile
Ticket Operations Available in the UI
The UI should expose only:

GET /tickets
GET /tickets/:id
POST /tickets
PATCH /tickets/:id
POST /tickets/:id/cancel
The UI should not expose:

Ticket claiming
Ticket closing
Ticket reopening
Handoffs
Chat
Notifications
Authentication
Authorization
Administration
Although the backend currently exposes claiming, closing, and reopening functionality, those operations must not be represented as employee UI actions in this workflow.

### Out of Scope
The agent must NOT implement:

Authentication
Login screens
Microsoft Entra ID integration
Authorization
Role checks
Permission checks
Employee/Agent/Admin UI separation
Claim ticket UI
Close ticket UI
Reopen ticket UI
Agent dashboards
Admin dashboards
Department management
User management
Chat
Email notifications
WebSockets
Handoffs
Audit logs
Ticket events
File attachments
File upload UI
Analytics
AI features
Search functionality unless already provided by the existing API
Backend modifications
Database modifications
New backend endpoints
New backend dependencies
Do not implement future architecture prematurely.

## Frontend Architecture
### Technology
The frontend must use React.

Use the existing frontend technology and conventions if a frontend already exists.

If no frontend exists, create a minimal React application using the project's established package/tooling conventions.

Do not introduce unnecessary frameworks or dependencies.

The frontend should have a clear separation between:

React Components
        ↓
Page / Feature Logic
        ↓
API Client
        ↓
Existing Nexus Backend API

The frontend should not contain backend business logic.

### Suggested Frontend Structure
Use a structure similar to:

frontend/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── ...
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── ...
│   │   │
│   │   └── tickets/
│   │       ├── TicketList.tsx
│   │       ├── TicketListItem.tsx
│   │       ├── TicketStatusBadge.tsx
│   │       ├── TicketDetails.tsx
│   │       └── ...
│   │
│   ├── pages/
│   │   └── tickets/
│   │       ├── TicketsPage.tsx
│   │       ├── TicketDetailsPage.tsx
│   │       └── NewTicketPage.tsx
│   │
│   ├── features/
│   │   └── tickets/
│   │       ├── ticket-api.ts
│   │       ├── ticket-types.ts
│   │       └── ...
│   │
│   ├── lib/
│   │   └── api/
│   │       └── client.ts
│   │
│   └── ...
│
├── package.json
└── ...

The exact structure may be adapted to the existing frontend project.

Do not create unnecessary layers simply to match this example.

## Application Shell
### Navigation
The application should have a persistent left-side navigation.

The navigation should be visually compact and clearly distinguish navigation items.

For the current scope, only the Tickets section needs to be functional.

Example:

┌──────────────┬──────────────────────────────────────┐
│              │                                      │
│  Nexus       │                                      │
│              │          Current Page                │
│  ▣ Tickets   │                                      │
│              │                                      │
│  ○ ...       │                                      │
│  ○ ...       │                                      │
│              │                                      │
│              │                                      │
└──────────────┴──────────────────────────────────────┘

The Tickets navigation item should take the user to the ticket list.

The active navigation item must be visually distinguishable.

The layout must work on smaller screens.

### Employee Ticket Experience
#### Ticket List
The Tickets section should display the tickets available to the current frontend user.

Because authentication and authorization do not exist yet, the frontend should consume the existing:

GET /tickets

endpoint without attempting to determine the user's role.

The ticket list should clearly display the important ticket information.

At minimum, each ticket should show:

Ticket code
Title
Status
Priority
Target department
Submission date
The list should provide an obvious way to open a ticket's details.

The interface should visually distinguish ticket statuses:

OPEN
CLAIMED
CLOSED
REOPENED
The frontend must not provide actions for statuses that are outside the current employee UI scope.

For example, a CLAIMED ticket may display its status but must not display a "Claim" button.

Ticket Details
Selecting a ticket should display its complete available ticket information.

Suggested presentation:

TKT-0001

Laptop Access Issue
────────────────────────────────

Status       Open
Priority     High
Department   IT

Description
Cannot access my company laptop...

Submitted by
user-id

Submitted
September 11, 2026

Last updated
September 11, 2026

Fields that are unavailable or null should not be represented.

For example for tickets that are not claimed:

Assigned agent should not be displayed

rather than displaying:

agentId: null

#### Ticket Submission
The UI must provide a way to create a ticket.

Use:

POST /tickets

The form must support the fields required by the existing API:

Title
Description
Priority
Department
Submitted By
However, because authentication does not exist yet, submittedBy may be provided by the frontend as required by the current testing API.

The frontend must not implement authentication merely to populate this value.

The priority selector must support:

LOW
MODERATE
HIGH
The department selector must use department values accepted by the existing API.

Do not hardcode future department-management functionality into the frontend.

If the existing API currently requires a department identifier, use that identifier.

The form should:

Validate required fields
Display validation errors
Prevent submission while a request is already being submitted
Display API errors
Display a success state after creation
Navigate to the newly created ticket when appropriate
The frontend should not duplicate backend lifecycle rules.

For example, the frontend may require a title, but it should not independently implement ticket state transition logic.

#### Ticket Modification
An employee should be able to modify a ticket only while its status is:

OPEN

The UI must expose an edit action for open tickets.

The edit form should support modification of:

Title
Description
Priority
Department
Use:

PATCH /tickets/:id

The frontend should hide or disable the edit action for:

CLAIMED
CLOSED
REOPENED
The frontend should not assume that its local state is authoritative.

The backend remains the source of truth.

If the backend rejects a modification because the ticket state changed, the frontend must display the returned error appropriately.

#### Ticket Cancellation
Cancellation corresponds to the existing ticket cancellation API:

POST /tickets/:id/cancel

The UI should expose cancellation only for tickets in the OPEN state.

Cancellation should require a deliberate user action.

A confirmation dialog should be displayed before cancellation.

Example:

Cancel ticket?

Are you sure you want to cancel TKT-0001?
This action cannot be undone.

[Keep Ticket] [Cancel Ticket]

After successful cancellation:

Refresh or update the ticket
Display the resulting ticket state appropriately
Prevent further modification
Prevent another cancellation attempt
The frontend must not delete ticket records locally as a substitute for the API operation.

The backend's soft-deletion behavior remains authoritative.

#### Claiming and Closing
Claiming and closing are deliberately excluded from this frontend workflow.

The UI must NOT contain:

Claim Ticket
Close Ticket

actions.

The frontend may display existing ticket information such as:

Status: CLAIMED
Agent: ...
Completion notes: ...
Closed at: ...

when those fields are returned by the API.

Displaying existing data is allowed.

Providing employee controls to perform those operations is not.

#### Reopening
Ticket reopening is also excluded from the current UI scope.

The frontend must not provide a "Reopen Ticket" action.

If a ticket returned by the API has:

status: REOPENED

the frontend should display that state normally.

## API Integration
### API Client
All communication with the Nexus backend should go through a small API client abstraction.

Components should not directly call fetch, Axios, or another HTTP library throughout the application.

Prefer:

Ticket components
       ↓
ticket-api.ts
       ↓
HTTP client
       ↓
Nexus backend

The API client should provide operations similar to:

getTickets()
getTicket(id)
createTicket(data)
updateTicket(id, data)
cancelTicket(id)

The exact implementation should follow the existing frontend conventions.

### API Base URL
The backend API base URL must be configurable through frontend environment configuration.

Do not hardcode a production backend URL into components.

For example, depending on the frontend tooling:

VITE_API_URL

or the equivalent environment configuration for the existing project.

Provide an example environment file if appropriate:

.env.example

Do not commit real credentials or environment-specific secrets.

API Types
The frontend should define types representing the existing ticket API response.

Example:

type TicketStatus =
  | "OPEN"
  | "CLAIMED"
  | "CLOSED"
  | "REOPENED";

type TicketPriority =
  | "LOW"
  | "MODERATE"
  | "HIGH";

interface Ticket {
  ticketId: string;
  ticketCode: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  departmentId: string;
  submittedBy: string;
  agentId: string | null;
  active: boolean;
  completionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

These types should reflect the actual existing API.

Do not invent response fields that the backend does not provide.

## State Management
Use the simplest state management approach appropriate for the current application.

Do not introduce Redux, Zustand, or another global state library unless the existing application already uses one or the implementation genuinely requires it.

The current scope is small enough that local React state and a small API/data layer should generally be sufficient.

The frontend should correctly manage:

Loading
Successful responses
Empty results
API errors
Form submission state
Updating the UI after mutations
Loading States
Every API-driven page should provide an appropriate loading state.

Examples:

Loading tickets...

or skeleton placeholders.

The interface should not appear broken while waiting for the backend.

Buttons performing mutations should indicate that an operation is in progress.

For example:

[Saving...]

instead of allowing repeated submissions.

Error Handling
API failures should result in understandable user-facing messages.

Do not expose raw HTTP responses, stack traces, PostgreSQL errors, or implementation details.

Example:

Unable to load your tickets.
Please try again.

For form operations:

Unable to update this ticket.
The ticket may have changed since you opened it.

The frontend should handle at minimum:

Network failure
Backend unavailable
HTTP 4xx responses
HTTP 5xx responses
Invalid/malformed API responses where practical
The frontend must not attempt to reinterpret backend errors as authorization failures because authorization does not exist yet.

## Responsive Design
The application must work on:

Desktop
Tablet
Mobile
The left navigation should adapt to smaller screens.

A possible mobile behavior is:

Desktop:

┌──────────┬─────────────────────┐
│ Sidebar  │ Content             │
│          │                     │
└──────────┴─────────────────────┘


Mobile:

┌─────────────────────────┐
│ ☰ Nexus                 │
├─────────────────────────┤
│ Content                 │
│                         │
└─────────────────────────┘

The exact implementation is left to the frontend design as long as the interface remains usable.

## UI Design
A playful, soft 3D SaaS dashboard with pastel colors, rounded cards, claymorphism illustrations, subtle neumorphic shadows, friendly typography, and a polished enterprise-product layout.

## Implementation Process
Step 1: Inspect
Inspect:

docs/product-specs.md
docs/architecture.md
docs/data-model.md
docs/agentic-workflow.md
docs/database-setup.md
Existing frontend files, if any
Existing backend ticket controller
Existing backend ticket DTOs
Existing backend ticket response format
Understand the actual API before writing frontend code.

Step 2: Plan
Determine:

Existing React/frontend structure
Frontend entry point
Existing routing solution
Existing styling approach
Existing HTTP client, if any
Where ticket API functions belong
Where ticket types belong
Which components/pages are required
Do not introduce replacement technologies if the project already has suitable conventions.

Step 3: Implement Application Shell
Create or adapt:

Nexus application shell
Left navigation
Tickets navigation
Responsive layout
Only Tickets needs to be functional.

Step 4: Implement Ticket API Client
Create the API integration for:

List tickets
Get ticket
Create ticket
Update ticket
Cancel ticket
Use the existing backend contract exactly.

Step 5: Implement Ticket Views
Implement:

Ticket list
Ticket details
Ticket submission
Ticket modification
Ticket cancellation
Use reusable ticket components where appropriate.

Step 6: Implement UI State Handling
Add:

Loading states
Empty states
Error states
Mutation states
Confirmation dialogs where required

Step 8: Run and Verify
Verify:

Frontend starts successfully
Backend API can be reached
Tickets can be retrieved
Ticket details can be opened
Tickets can be submitted
Open tickets can be modified
Open tickets can be cancelled
Non-open tickets cannot be modified through the UI
Non-open tickets cannot be cancelled through the UI
Claiming is not exposed
Closing is not exposed
Reopening is not exposed
Authentication is not implemented
Authorization is not implemented
Backend remains untouched
## Definition of Done
This workflow is complete when:

A React frontend exists and runs successfully
Nexus has a Microsoft Teams-inspired left navigation
The Tickets section is functional
The frontend connects to the existing ticket API
Employees can view their ticket data through the existing API
Employees can view ticket details
Employees can submit tickets
Employees can modify open tickets
Employees can cancel open tickets
Ticket information defined by the existing API/data model is represented appropriately
Loading, empty, and error states are handled
The UI is responsive
Claiming is not exposed in the UI
Closing is not exposed in the UI
Reopening is not exposed in the UI
No authentication is implemented
No authorization is implemented
No backend code is modified
No database code is modified
No unrelated features are introduced
The implementation remains small and understandable
The final architecture should clearly demonstrate:

React UI
   ↓
Ticket Feature/API Client
   ↓
Existing Nexus Ticket API
   ↓
Existing Ticket Service
   ↓
Existing Ticket Repository
   ↓
PostgreSQL

The frontend is a consumer of the existing ticket lifecycle API and must not become responsible for backend business rules or persistence.

This keeps the workflow consistent with your previous two: small bounded scope, explicit exclusions, repository/backend boundaries preserved, and no premature authorization.