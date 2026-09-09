---
title: "Database Setup - Nexus"
author: "Ralph Khneiffess"
---

# Database Setup - Nexus
## Objective
The implementation must introduce a PostgreSQL SQL database for Nexus and migrate the existing ticket persistence layer from the in-memory database to PostgreSQL.

The goal of this workflow is database persistence only.

The existing ticket API behavior, ticket lifecycle rules, policies, DTOs, controllers, and service responsibilities should remain functionally unchanged unless a database-specific change is strictly required.

The implementation must remain intentionally small and modular.

Do not implement future architecture or features unless explicitly requested.

## Context
Before making changes, the agent must inspect and understand:

docs/product-specs.md
docs/architecture.md
docs/data-model.md
docs/agentic-workflow.md
The current Nexus backend source code
The agent must understand the existing repository and service boundaries before modifying persistence.

The previous workflow intentionally used an in-memory database because database integration was out of scope.

This workflow removes that limitation and introduces PostgreSQL persistence.

## Current Scope
The current workflow includes:

PostgreSQL database setup
Database connection configuration
Database schema/migrations
Replacing the in-memory ticket persistence implementation
Ticket repository persistence using PostgreSQL
Ticket creation persistence
Ticket retrieval from PostgreSQL
Ticket modification persistence
Ticket claiming persistence
Ticket closing persistence
Ticket reopening persistence
Ticket cancellation/deletion persistence
Persistence of ticket fields defined by the existing API
Database constraints relevant to the currently implemented ticket lifecycle
Database indexes required by the current ticket queries
Updating tests to work with PostgreSQL
Verifying that existing ticket lifecycle behavior remains unchanged
Out of Scope

### The agent must NOT implement:
Authentication
Authorization
Role management
User management
Department management
Chat
File attachments
Email notifications
Ticket handoffs
Audit logs
Ticket events
WebSockets
Redis
Caching
Message queues
Cloud database deployment
Cloud file storage
Database replication
Database sharding
Analytics
AI functionality
Future identity providers
Production infrastructure unrelated to PostgreSQL
Any feature not required to persist the currently implemented ticket workflow
Do not implement the complete database described in data-model.md if those entities are not currently implemented.

Only create database structures required by the current application.

## Database Technology
PostgreSQL is the required database.

The application should communicate with PostgreSQL by replacing the in-memory DB calls in the existing repository abstractions by PostgreSQL database calls.

The database implementation should not leak into controllers or business policies.

The exact PostgreSQL integration technology should follow the existing NestJS project conventions.

Use Prisma as the ORM.

## Architecture
The architecture should preserve the existing separation:

Controller
    ↓
Ticket Service
    ↓
Ticket Repository
    ↓
  Prisma
    ↓
PostgreSQL

The Ticket Service must continue to own application-level ticket operations.

Ticket policies must continue to own lifecycle validation.

The repository must own persistence operations.

Controllers must remain thin.

Policies must not access PostgreSQL directly.

The Ticket Service must not execute SQL directly.

No feature should directly access the database connection.

## Repository Boundary
The existing Tickets module must continue to depend on a ticket repository abstraction.
The exact structure may be adapted to the existing implementation.

The important requirement is that:

TicketsService depends on the repository abstraction.
PostgreSQL-specific persistence is implemented by repository.
Controllers do not know PostgreSQL exists.
Policies do not know PostgreSQL exists.

## Database Configuration
The application must support PostgreSQL connection configuration through environment variables.

At minimum, the configuration should support:

DATABASE_HOST
DATABASE_PORT
DATABASE_NAME
DATABASE_USER
DATABASE_PASSWORD

A single database connection configuration should be used by the application.

Credentials must not be hardcoded in source code.
A .env.example file should document the required variables without containing real credentials.

## Database Schema
The database should initially contain only the entities required by the currently implemented ticket workflow.

## Transactions
Operations requiring multiple related database changes must use transactions.

At the current scope, use transactions wherever the operation performs multiple database writes that must succeed or fail together.

The transaction boundary should belong to the application/repository persistence layer rather than the controller.

If an operation currently requires only one SQL statement, do not introduce a transaction unnecessarily.

## Concurrency
Ticket claiming is a critical concurrency operation.

Two agents may attempt to claim the same ticket simultaneously.

The implementation must guarantee that only one claim succeeds.

The PostgreSQL implementation should use an atomic database operation or row-level locking.

The claim operation must verify that:

status IN (OPEN, REOPENED)
AND agent_id IS NULL
AND active = true

before assigning the agent.

The operation must be atomic.

A valid result should be:

Agent A → claim succeeds
Agent B → claim fails

It must never result in:

Agent A and Agent B both successfully claiming the ticket

Do not rely only on application-level checks such as:

find ticket
if ticket is open
    update ticket

because that is vulnerable to race conditions.

## Migrations
Database schema changes must be reproducible.

The project should use migrations rather than requiring developers to manually create tables.

A fresh PostgreSQL database should be able to reach the required schema by running the project's migration process.

The migration must:

Create the required ticket table
Create required constraints
Create required indexes
Create required unique constraints
Be deterministic and reproducible
Do not manually modify the database as part of the implementation.

## Indexes
Create indexes based on actual current queries.

At minimum, consider indexes for:

ticket_id
ticket_code
submitted_by
department_id
agent_id
status
If a composite index is useful for the current ticket pool query, it may be added.

Do not create indexes for entities or queries that are not currently implemented.

Error Handling
Database failures must be converted into appropriate application-level errors.

The application must not expose raw PostgreSQL errors to API consumers.

Examples include:

Database unavailable
Connection failure
Unique constraint violation
Invalid database operation
Transaction failure
The API should return appropriate NestJS exceptions where applicable.

## Implementation Process
The agent must follow this process.

Step 1: Inspect
Inspect:
docs/product-specs.md
docs/architecture.md
docs/data-model.md
docs/agentic-workflow.md
Existing src/ files
Existing repository implementation
Understand how the current in-memory persistence works before changing it.

Step 2: Plan
Determine:
Where database configuration belongs
Where migrations belong
Which repository should communicate with PostgreSQL
Which existing repository interfaces should remain unchanged
Do not redesign the Tickets module unnecessarily.

Step 3: Implement Database Infrastructure
Add only the infrastructure required for PostgreSQL:

Configuration
PostgreSQL connection
Migration setup
Required database module/provider
Development database setup if necessary

Step 4: Implement Schema
Create the migration for the currently implemented ticket entity.

Add:

Columns
Types
Constraints
Unique constraints
Indexes
Do not create unused tables from future features.

Step 5: Implement PostgreSQL Repository
Implement PostgreSQL persistence behind the existing repository boundary.

The Ticket Service should continue using the repository rather than SQL.

Step 6: Implement Concurrency-Safe Operations
Pay particular attention to ticket claiming.

Verify that concurrent claim attempts cannot result in multiple agents being assigned.

Step 8: Run and Verify
Verify:

Application starts
PostgreSQL connects
Migrations execute successfully
Tickets can be created
Tickets survive application restarts
Ticket retrieval works
Modification works
Claiming works
Closing works
Reopening works
Cancellation works
Invalid lifecycle transitions remain rejected
Concurrency behavior is correct
Step 9: Review Architecture
Before finishing, verify:

Controllers remain thin
Ticket policies do not access PostgreSQL
Ticket services do not execute SQL
Repositories own persistence
No authorization was introduced
No authentication was introduced
No audit/event functionality was introduced
No chat functionality was introduced
No unrelated dependencies were introduced
No future database entities were implemented unnecessarily
No business rules were moved into the database unnecessarily

## Definition of Done
This workflow is complete when:

Nexus uses PostgreSQL instead of the in-memory database for ticket persistence
PostgreSQL configuration is environment-based
Database schema is created through migrations
Ticket data survives application restarts
Repository boundaries remain intact
Ticket lifecycle behavior remains unchanged
Ticket invariants remain enforced
Ticket claiming is concurrency-safe
Soft deletion is preserved
Required indexes and constraints exist
Existing ticket business-rule tests pass
The application starts successfully
No authentication, authorization, chat, notifications, handoffs, audit logs, or unrelated features have been introduced
The implementation remains small and understandable
The final implementation should allow a developer to inspect the Tickets module and database layer and clearly understand how a ticket moves from the API through the service and repository into PostgreSQL.