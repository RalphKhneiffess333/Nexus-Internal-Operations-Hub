---
title: "Data Model - Nexus"
author: "Ralph Khneiffess"
---

# Nexus - Data Model & Database Schema
This document defines the complete data model, database schema, entity relationships, constraints, indexes, and data lifecycles.

## Major Entity Objects
Regarding Nexus operations, some major data objects were involved:
- Users: The main process drivers
- Tickets: The central entity the app revolves around
- Departments: Company's internal employee division
- Chat Messages: Exchanged between agents and employees
- File Attachments: Documents, Images or files attached to tickets or chats by users

## Detailed Database Tables
This section discusses the detailed attributes and required tables for each entity.
Each table requires a unique ID and timestamp tracking (created_at) attributes.
### User Related Tables
#### Users Table
The main user entity table our app will use to manage users and permissions, every user has:
- Personal information like phone number, full name and email
- A role
- An indicator to signal if the user signed in once into his account or not (Especially useful for administrators to configure user accounts before a user actually joins)
- An indicator to signal if the user's account is active or has it been disabled
- An identity provider id to be able to securely validate authentication
- An identity provider to know which third party provider did the user login with.

#### Identity providers table
The user table needs to store the identity provider of the account, since future identity providers may be implemented, we need a separate table that can store the available identity providers instead of hard coding them, each identity provider has.
- A code and a name
- It should keep track of whether this identity provider is enabled or disabled on the app

### Department Related Tables
#### Departments Table
Stores all info related to individual departments, every department has:
- A code, a name and a description
- A signal that indicates if a department is active or not

#### Department Members Table
Maps user accounts to departments, every mapping has:
- A user account
- A department

### Ticket Related Tables
#### Tickets Table
This table represents the current state of tickets, every ticket has:
- A human readable unique ID to simplify app usage
- Attributes like title and priority (LOW, MODERATE, HIGH)
- A status (OPEN, CLAIMED, CLOSED, REOPENED)
- The department it belongs to
- The employee who submitted it
- The agent who claimed it (If an agent claimed it)
- A signal to indicate if the ticket has been deleted or not 

NOTE: For integrity reasons, ticket records should not be deleted from the database, instead, soft deletion is performed by changing the active attribute of the specific ticket

#### Handoff Requests table
This table manages handoff request states, every request has:
- The requester and requested agent of the handoff
- The ticket being handed off
- The handoff request status: "PENDING", "CANCELLED", "ACCEPTED", "REJECTED"
- The date resolved (if it was resolved)

#### Ticket Events table
Stores history logs about events related to tickets, history logs are divided between ticket related events (Submission, Modification, Claiming, etc...) stored in the ticket events table for business-domain timeline, and system events (New department added, agent was added to department, system logs...) stored in the Audit Logs table for security and administration activity. 
When an admin wants to see all history logs, all records are pulled from both ticket events and audit logs tables.

Ticket events are particularly useful for fetching ticket opening and completion notes since each events stores its details independently.

Every event has:
- The ticket that received the event
- The user who performed the event
- An action type (opened, closed, reopened, claimed, ...)
- Event details (Specific field structure to each action type)

### Chat Table
This table stores the exchanged chat messages between employees and agents, every chat message has:
- The ticket its thread belongs in
- A sender
- The chat message content

### File Attachments Related Tables
#### Files table
This table stores the actual data of files saved in File storage systems, every file has:
- A user who uploaded it
- A filename
- A file storage path
- A file size
- A MIME type

#### Attachments table
This table links the files stored in the files table to their corresponding resouce (chat or ticket notes), every attachment has:
- A file
- A chat message ID (If the resource belongs to a chat message)
- A ticket event ID (If the resource belongs to ticket opening or closure notes)
### System Related Tables
#### Audit Logs Table
Stores logs about system behavior and user actions, this table should be prohibited the use of UPDATE and DELETE operations on it.
Audit logs cannot be modified. Logs cannot be deleted before a two year period, after which a background process may permanently delete them.
every log has:
- The action
- The user who perfomed the action (Empty if it is a system action)
- Log details (Structure specific to the action)

#### System Configurations
Stores key-value pairs of values the system uses in its operations (like priority values reminder intervals), every pair has:
- A key
- A value
- A description
## Relationships & Cardinalities
| Relationship | Cardinality | Description |
| -------- | :--------: | :--------: |
| Identity Provider - User   | 1 : N  |  An identity provider can provide many user accounts, but each user only has one identity provider  |
| User - Departments   | N : M   | Many users can belong to many departments, this is handled by the "Department Members" junction table   |
| Department - Ticket | 1 : N | Many tickets can belong to only one department and one departments can receive many tickets |
| User - Ticket (Submitter) | 1 : N | One user can submit many tickets but one ticket only has one submitter user|
| User - Ticket (Agent) | 1 : N | One user can be an agent for many tickets but one ticket can either have 0..1 agent|
| Ticket - handoff Request (Requester) | 1 : N | One user can request many handoffs but each handoff has only one requester|
| Ticket - handoff Request (Requested) | 1 : N | One user can be requested by many handoffs but each handoff has only one requested agent|
| Ticket - Ticket Event | 1 : N | A ticket can have many events in its history but each ticket event belongs to one ticket|
| Ticket - Chat Message | 1 : N | A ticket can have many chat messages but each chat message belongs to only one ticket|
| User - Chat Message | 1 : N | One user can send many chat messages but each chat message belongs to only one user|
| File - Attachment | 1 : 1 | A file can be attached to one attachment and an attachment references only one file|
| Chat Message - Attachment | 1 : N | A chat message can have multiple attachments but each attachment belongs to only one chat message|
| Ticket Event - Attachment | 1 : N | A ticket event can have multiple attachments but an attachment belongs to only one ticket event|

## Database Schema
![Database Schema Diagram](./assets/Database%20Schema.png)

NOTE: Every table additionally has:
created_at: NOT NULL, DEFAULT CURRENT_TIMESTAMP
updated_at: NOT NULL. DEFAULT CURRENT_TIMESTAMP

## Log Details
This section focuses on the different log events for both Audit Log and Ticket Events table along with their corresponding detail JSON structure.
### Ticket Events
The following are the available ticket events stored in the "actions" attribute as ENUM: 
#### SUBMISSION
- title
- target department
- priority level: LOW, MODERATE, HIGH
- description
- submitter ID (linked to Users table)

#### CLAIM
- Agent ID (linked to Users table)
- timestamp

#### CLOSE
- Agent ID (linked to Users table)
- Completion notes

#### REOPEN
- priority level: LOW, MODERATE, HIGH
- description
- submitter ID (linked to Users table)

#### DELETE
- Employee who deleted it (linked to Users table)

#### MODIFICATION
- old title
- new title
- old target department
- new target department
- old priority level
- new priority level
- old description
- new description

#### HANDOFF
- requester ID (linked to Users table)
- requested ID (linked to Users table)
- action: REQUESTED, ACCEPTED, DENIED, CANCELLED
- timestamp

### Audit Logs
The following are system and user log types stored in the "actions" attribute of the Audit_Logs table:
#### DEPARTMENT_ADDITION
- System admin (linked to Users table)
- Department name
- Department code
- Department description

#### DEPARTMENT_MODIFICATION
- System admin (linked to users Table)
- Department (linked to departments Table)
- Old department name
- New department name
- Old department code
- New department code
- Old department description
- New department description

#### DEPARTMENT_DELETION
- System admin (linked to users Table)
- Department (linked to Departments Table)

#### DEPARTMENT_MAPPING
- System admin (linked to Users Table)
- Employee (linked to Users Table)
- Department (Linked to Departments Table)
- Mapping action (ADDED or REMOVED from department)

#### ROLE_MAPPING
- System admin (linked to Users Table)
- Employee (linked to Users Table)
- New role (Employee, Agent, Admin)

#### SYSTEM_VARIABLE_MODIFICATION
- Key
- Old Value
- New Value

#### SYSTEM_LOG
- Message

## Invariants
### Ticket Invariants
- Every ticket has one target department
- Ticket priorities must be LOW, MODERATE, HIGH
- A ticket's lifecycle should flow in that order OPEN -> CLAIMED -> CLOSED -> REOPENED
- OPEN, REOPENED, and CLOSED tickets must have no agent
- The agent who claimed the ticket must belong to the department it was sent to
- A CLAIMED ticket cannot have more or less than one current agent
- Any ticket that has a state other than "OPEN" cannot be deleted or modified

### Handoff Invariants
- Requester and destination agent must be different users.
- Both agents must belong to the ticket's department
- Handoffs can only be created for CLAIMED tickets
- Only pending handoffs can switch to Accepted, Rejected or Cancelled states
- The requester must be the ticket's current agent
- Multiple handoffs could exist for a ticket at the same time
- A rejected or cancelled handoff must not change the ticket's current agent
- A handoff cannot be accepted if the ticket is not CLAIMED

### Chat Invariants
- Every message belongs to exactly one ticket and one user
- Only authorized users can create messages for the tickets
- Messages cannot be sent for OPEN, REOPENED OR CLOSED tickets
- Chats for any ticket that isn't CLAIMED are read only
- Authorized users for ticket chats are either the employee who submitted the ticket, or the agent who claimed it

### File Invariants
- A file attached to a resource must inherit its authorization permissions
- An attachment must belong to exactly one valid resource, a chat message or a ticket event, this is enforced through database constraints.

### System Invariants
- Audit logs and Ticket Event logs cannot be modified or deleted
- Audit logs must remain available for two years
- System variables cannot have two duplicate keys
- For reminder notification intervals, it must not be negative

## Relational vs Document Database
In our database, multiple properties can be observed from everything listed so far:
- High relationships between our entities
- High focus on data integrity (Transactions and concurrency)
- Highly structured entities

While designing Nexus database, two database types were considered:
### SQL (Relational) Databases
Stores information in the form of related tables, provides high support for transactions, concurrency, and enforces constraints on our data which is ideal for integrity.

Complex queries can become complicated.
Horizontal scaling can be troublesome.

### NoSQL (Document) Databases
Stores information in the form of documents which provides high flexibility for schemas. Document databases are more developer friendly (JSON oriented), they are easier to scale compared to SQL databases.

Relationships between entities aren't easily managed.
Constraints on data aren't as easily defined compared to SQL databases.
Data structure of document databases may lead to data duplications in some cases

### Decision
For Nexus specifically, the biggest advantage of a relational database is consistency and relationships, while the biggest advantage of a document database is flexibility and scalability.

Since Nexus has a small number of users, highly structured entities, many relationships, constraints, invariants and transactions, SQL databases are the more suited option in this case.

## Performance and Reliability
### Indexes
Outside of primary keys which are automatically indexed, we have several other indexes: 

| Table | Index | Reasoning |
| -------- | :--------: | :--------: |
| Users   | email  |  Used for optimizing account lookups for filtering application users  |
| Tickets   | submitter_id  |  Used for optimizing ticket search queries to get all tickets owned by a user  |
| Tickets   | department_id  |  Used for optimizing department specific ticket search queries  |
| Tickets   | agent_id  |  Used for optimizing ticket search queries to get all tickets claimed by an agent  |
| Tickets   | (department_id, status, created_at)  |  Used for optimizing ticket pool search queries for specific departments in order |
| Ticket_Events   | (ticket_id, created_at)  |  Optimizes ticket history timeline queries |
| Ticket_Events   | (created_at)  |  Optimizes queries to find all ticket events in chronological order |
| Chat_Messages   | (ticket_id, created_at)  |  Optimizes chat history queries so that they are sorted by timestamp |
| Handoff_Requests   | (ticket_id, status)  |  Optimizes handoff requests state lookup queries|
| Handoff_Requests   | (requested_id, status)  |  Optimizes handoff requests queries to get all pending requests of a requested agent|
| Handoff_Requests   | (requester_id, status)  |  Optimizes handoff requests queries to get all pending requests of a requester agent|
| Files   | uploaded_by  |  Optimizes authorization queries to find all uploaded files by a user |
| Attachments   | message_id  |  Optimizes queries to get files attached to a message|
| Attachments   | event_id  |  Optimizes queries to get files attached to a ticket submission or closing event|
| Audit_logs   | created_at  |  Optimizes queries to get all audit logs in chronological order|

### Transactions

Nexus relies on database transactions to preserve data integrity when an operation requires multiple related database changes. An operation that modifies the state of a ticket and its corresponding history, handoff, or other records must either complete all required changes successfully or have all changes rolled back.

This is particularly important because several Nexus operations modify multiple entities at once. For example, claiming a ticket requires updating the ticket's status and assigned agent while also creating a corresponding ticket event and audit log. These operations should occur within the same database transaction so that a partial failure cannot leave the system in an inconsistent state.
Here's a transaction example covering ticket submissions:: 
- Create the ticket with its initial OPEN status.
- Create the corresponding SUBMISSION ticket event.
- CReate a file if the user attached any in the notes
- Create the attachment of the file to the event
- If any operation fails, the ticket creation should be rolled back and undo all these operations.

These operations should use a transaction so that the ticket state and its history cannot become inconsistent: Submission, claiming, closing, reopening, modification, deletion, handoff requests.

### Concurrency Control
Nexus must manage operations that can be performed concurrently on the same resource. 
Example: Ticket Claiming: multiple agents may attempt to claim the same ticket at the same time.

Ticket claiming must be performed atomically. The operation should verify that the ticket is still in an OPEN or REOPENED state and has no current agent while assigning the new agent and changing the status to CLAIMED. Database concurrency is ensured using database features such as row level locking or atomic conditional updates should be used to ensure that only one claim succeeds.
Other operations also require concurrency control like ticket handoffs.

Database transactions and concurrency controls manage operations together with database constraints and application level authorization. Authorization determines whether an operation is permitted, while transaction and
concurrency ensure that parallel operations cannot create unexpected behavior.

## Important Queries Examples
- User lookup: Find a user by their identity provider information (used on authentication before initializing session).
- User tickets: Retrieve all tickets submitted by a specific user (shown to employees on their "ticket board").
- Agent tickets: Retrieve all tickets currently assigned to a specific agent (shown to agents on their ticket board).
- Open ticket pool: Retrieve all open tickets for a department, ordered by creation time (shown to agents on their ticket pool).
- Ticket details: Retrieve a ticket along with its submitter, department, and assigned agent. (shown to agents and employees when expanding a ticket)
- Ticket history: Retrieve the complete event history of a ticket in chronological order. (shown to agents and employees when expanding a ticket)
- Ticket chat: Retrieve all chat messages belonging to a specific ticket in chronological order.
- Ticket attachments: Retrieve all files attached to a ticket's events (Shown to agents and employees when looking at ticket opening and completion notes).
- Message attachments: Retrieve all files attached to a specific chat message.
- Pending handoffs: Retrieve all pending handoff requests for a specific agent.
- Audit history: Retrieve audit logs in chronological order for system auditing.
- Identity providers: Retrieve all active identity providers available for authentication.