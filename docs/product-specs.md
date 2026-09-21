---
title: "Product Specs - Nexus"
author: "Ralph Khneiffess"
---

# Nexus (Internal Operations Service Hub) - Product Specs

The current implemented API surface and the features intentionally not exposed as standalone endpoints are recorded in [api-contract.md](api-contract.md). This document defines product behavior and acceptance criteria; it does not define exact route names or JSON envelopes.

Current implementation notes: ticket, Chat, handoff, administration, file attachment, authentication, authorization, and realtime APIs are implemented. SendGrid email delivery, reminder processing, audit-log purge processing, and other background workers described as future behavior are not currently included.

## Overview
### Context 
Organizations require internal communications between their multiple departments. Although a company itself may be well established, its employees regularly need assistance from different internal departments. These requests vary from technical problems, such as laptop issues, to access and administrative requests and more.

### Problem
Currently, request management at some organizations is quite scattered. Employees communicate through messy channels to departments, as basic chats provide no clear ownership and no intuitive view for the request agent, requests are often times forgotten, sent to the wrong people or lost in chat history.
This process has created unecessary problems and miscommunications between employees.
There is no structured process for submitting and resolving internal requests.

### Goal
Organizations requires a robust system that can provide a clear process for managing internal requests among employees and departments.

### Solution
Nexus is an Internal Operations Service Hub that allows employees to submit requests and enables the appropriate departments to receive, claim, track, and resolve them.

## Project Context
### Known Facts
The following facts are currently verified:
- Employees need to request assistance from various internal departments (IT, HR, Finance, etc...).
- The target companies don't have any organized communication method for employee requests and rely on messy channels.
- An internal operations service hub is needed to manage employee requests from upper departments.
- Nexus is meant for internal company use only.

### Assumptions

The following assumptions are made for Nexus:
- It is intended for mid sized companies of around 50-100 employees.
- Company departments may have one or multiple agents.
- Most established companies already use an identity provider for their employees account management.
- Employee requests will have target departments and priority levels.
- Administrators need to configure and manage Nexus
- Department agents are also considered employees and are allowed to use Nexus for requests.
- Department Administrators are employees and may also act as agents within their department.

### Constraints
- Nexus is intended for internal company use only.
- Access to requests and employee information must be restricted to authorized users.

### Unknowns
- It is currently unknown whether the company Nexus uses will utilize Microsoft or Google third party identity providers.
- It is currently unknown whether companies expect chat message integration with external Teams products like Slack or Microsoft Teams

### Non-Goals
- Nexus is not designed to provide ways to resolve the actual requests and is only meant for request management
- Nexus is not designed to replace human workers
- Nexus is not designed to provide assistance for external customers.
- Nexus is not designed to be a general purpose chat app.

### Actors
#### System Administrator
The system administrator is responsible for handling Nexus's configurations, users and permissions. In short, the system administrator grants users certain permissions depending on their roles (Employee, Agent, Admin), configures departments, priorities and their reminder intervals, role mappings, user to department mappings, and has access to the system's history logs.
Example 1: Upon first configuring Nexus, the administrator needs to map the user roles to their accounts.
Example 2: A new Finance department has opened, the system administrator needs to add the "Finance" department option for the request target department.

#### Employee
The employee is the person who needs assistance from internal departments, he submits requests through Nexus for help.
Example: An employee is having technical problems with his laptop, he sends a technical request to the IT Department to handle it through Nexus.
NOTE: An employee covers all workers of a company including Department Agents and Administators
#### Agent
The department agent is the worker who helps the employees with their requests, when an employee submits a request, is it converted to a ticket on Nexus that the agent claims from a pool of tickets specific to the department he works in.
Example: An agent claimed the ticket related to the previous IT technical problem with the employee's laptop, the ticket displayed to him shows information about the employee (email, phone number, etc...) and details about the subject. After resolving the ticket subject, the agent marks the ticket as complete.
NOTE: Administrators also have the functional capabilities of agents and claim tickets sent to them

| Role | Employee Actions | Agent Actions | Admin Actions |
| -------- | :--------: | :--------: | :-------: |
| Employee   | X   |    | |
| Agent   | X   | X   | |
| Administrator | X | X | X |

Administrators > Agents > Employees
## Requirements
### Functional Requirements
#### Role Mapping
Nexus must allow the administrator to map its custom roles (Employee, Agent, Admin) to user accounts either before or after they login.

#### User Authentication
Nexus must allow unauthenticated users to login to the system using their assigned email.

#### Role/Resource Based Access Control
Nexus must restrict access to functionality and request information based on the user's assigned role, department, and ownership. Example:
- Administrators can view all tickets recorded while employees cannot
- Agents can handle tickets they claimed but they cannot handle tickets that are not assigned to them.
- Users cannot access functionality or request information for which their role or department does not have permission.
- Nexus manages permissions and functionalities based on two main factors: User role + user department + resource(Example: An agent can claim tickets but an employee cannot, at the same time an IT agent cannot claim HR tickets, an employee cannot view another employee's tickets)

#### Department Management
Nexus must allow the administrator to add and manage departments and link user accounts to departments.

#### Request Submission
Nexus must allow company employees (normal employees, agents and admins) to submit requests, requests sent are registered under their name and account information. Additionally, each request can be categorized by an administrator-managed priority (with Low, Moderate, and High as the seeded defaults) and department (HR, IT, etc...).
Each request has:
- A title or a name
- A target department or destination (HR, IT, ...)
- A priority selected from the active administrator-managed priority list
- A description of the subject or notes section
- File attachments for images, PDFs, and others (Optional)

Department agents can also submit requests with the addition of sending requests to the administrator

#### Request Routing
Nexus must successfully send the request to the specified department by the employee.
When Nexus receives the request, it must automatically assign it a unique identifier, assign it a first status and record the date of submission, it is called a ticket now.
Tickets initially don't have any agent working on them, when Nexus receives the request, the ticket is saved in a ticket pool specific to the department which can be viewed and claimed by any agent in it.

#### Ticket Claiming
Nexus must allow department agents to claim tickets available in the ticket pool. Upon claiming a ticket, it changes its status to "Claimed"

#### Ticket Tracking
Nexus must track every ticket's status and categorize them using 4 states:
- Open: The ticket was submitted by an employee but it hasn't been claimed by an agent yet
- Claimed: The ticket was claimed by an agent
- Closed: The agent finished working on the ticket and has closed it
- Reopened: The ticket was opened again after discovering that a problem or request was not fully resolved after closing it.

When a user first submit his request, the associated ticket should be given the "Open" status automatically by the system.
The system should show users ticket events in real-time.

Ticket states should be:
Open -> Claimed -> Closed
Closed -> Reopened -> Claimed -> Closed

#### Ticket Closing
Nexus must allow agents  to successfully close tickets when they are done with the request. Additionally, it should allow them to add notes upon ticket completion describing the subject faced and the solution for future references.
Upon closing a ticket, the system automatically changes the ticket status to CLOSED.

#### Ticket Viewing
Nexus must allow users to view tickets according to their role and access permissions:

Employees can view all tickets they have submitted, regardless of their current status, claimed agent, or date of submission.
Agents can view all tickets belonging to their department. However, they can only resolve tickets assigned to them.
Tickets should show all agents that claimed them in a timeline.
Administrators can view all tickets across the system


For tickets that have been claimed, employees can view information about the department agent that claimed it while the department agent can view information about the employee.

#### Ticket Modification
If the ticket is still in the "Open" stage, Nexus must allow the employee to edit and modify his request's details.

#### Ticket Deletion
If the ticket is still in the "Open" stage, Nexus must allow the employee to delete his request

#### Ticket Reopening
If the ticket is closed, Nexus must allow the employee to reopen his request.

#### History Tracking
Nexus must maintain an accurate log of every ticket and system action recorded (ticket submission, assignment, modification, closing, handoffs, etc...). Chat messages are retained in their ticket-specific chat and are not included in the unified history logs.

#### Ticket Specific Chat
Nexus must allow employees who have a claimed ticket to chat with their agent through independent chats for each ticket. The ticket submitter, all agents belonging to the ticket's department, and administrators may view the chat. Only the ticket submitter and the currently assigned agent may send messages.

#### Event Notification
Nexus must send notifications to the concerned party for every meaningful event. Nexus sends notifications as emails. Example: 
- All department agents should receive a notification whenever a new ticket is opened
- Employee should receive a notification whenever one of their ticket's status changes (Claimed or Closed).
- Reminder notifications should be sent to department agents when an unclaimed ticket passes the reminder interval configured for its priority
- Ticket events and new chat messages should be reflected to users in real-time

#### Ticket Handoff
Nexus must allow an agent to attempt delegation of a claimed ticket to another agent within the same department, the receiving agent is required to accept this proposal to successfully handoff the ticket.
A handoff request can have multiple states:
- Pending: Waiting for an accept or a reject
- Accepted: The request was accepted, the new agent has claimed the ticket
- Rejected: The request was rejected
- Cancelled: The requester agent has cancelled the handoff request

#### AI Assistance
Nexus should provide users a useful AI agent that can help them with most tasks like asking about a specific ticket info, submission advice and request formulation.
AI capabilities should differ depending on the user's role, so the AI should not be able to access resources the user cannot access.

### Non-Functional Requirements
#### Security
- Nexus should handle authentication securely 
- role/resource based access control depending on the user's role and department.
- User input should be sanitized
- Uploaded files should be validated

#### Availability
Nexus must stay active for a 99.5% uptime during business hours.
Planned maintenance is excluded from availability uptime calculations

#### Performance
Main web pages should load in under 2 seconds during normal hours. 
Nexus must be able to hold around 50 concurrent users without page loading or speed penalties.
99% of API requests should resolve within under 2 seconds

#### Usability
Nexus should have an intuitive interface and be easy to use for non technical users especially employees, with a responsive web interface for desktop and mobile devices.

#### Maintainability
Configuration data like the available departments, request priorities and other, should be dynamically managed using a database and not hardcoded into the system source code, this allows administrators to eaaily alter such values without the need for developer intervention.

#### Integrity
Nexus must handle concurrent actions (Two agents claiming the same ticket at the same time although rare) safely and atomically to prevent racing conditions and data corruption.
### Acceptance Criteria
#### Role Mapping
- The administrator can map user accounts to system roles
- The system must reject mapping if the specified user role is invalid

Unwanted Behavior Scenarios:
- The admin can assign two roles to the same user account

#### User Authentication
- An unauthenticated user can login to his account
- If the entered credentials are wrong, the user must be notified
- When the user is logged in, he is given the permissions associated with his account's role
- A user stays authenticated until he logs out or his session expires.
- A user can login with multiple devices to the same account without interference

Unwanted Behavior Scenarios:
- A user successfully authenticates to the system using invalid credentials
- An external user can login using an account that is outside the company
- A user is kicked out from his account on his laptop if he logs in with his mobile phone

#### Role/Resource based access control
- An authenticated user has access to specific functionalities depending on the permissions given to his role
- Attempting to access unauthorized data will give the corresponding error message to the user
- A department agent can belong to two departments at the same time thus have ticket access to two departments

Unwanted Behavior Scenarios:
- Nexus grants role assigning capabilities to non administrators
- An employee is able to see the tickets of another employee
- An agent is able to close a ticket he didn't claim
- An agent is able to view tickets of another department outside his own
- An employee closes or claims tickets

#### Department Management
- The system administrator can create, modify or deactivate departments.
- The newly created department appears in request submission forms in the target department dropdown
- Requests sent to this department should now appear as tickets in the department's ticket pool
- The administrator can assign agents to departments

Unwanted Behavior Scenarios:
- Nexus creates a department when necessary info like department name or department code is missing
- Tickets are not being correctly routed to the department

#### Ticket Submission
- An authenticated employee can submit a new request
- The employee can provide a title, target department, priority, and description for the request
- The employee can select one of the available request priorities: "low", "moderate" or "high.
- The employee can select a target department from the departments available in the system.
- After successful submission, a ticket is registered under the employee account who submitted it
- The submitted ticket contains the information provided by the employee.
- Nexus automatically records the date and time of submission
- The new ticket is assigned the "Open" status.
- The ticket becomes visible in the appropriate department pool.

Unwanted Behavior Scenarios:
- Nexus registers the request under a different employee's name
- The request is routed to the wrong department (HR department accidentally receives a request for the IT department).

#### Ticket Claiming
- Department agents can view opened or reopened and unclaimed tickets for their and only their department in a dashboard
- A department agent can claim an opened or reopened ticket if it hasn't been claimed yet
- When an agent claims a ticket, he can start working on resolving the ticket request, no other agent can then claim it
- If an agent is removed from a department while having claimed tickets, each active claimed ticket transitions to `CLOSED`. The assigned agent is cleared and the completion note is recorded as: `This agent was removed from the department.`
- When an agent claims a ticket, the involved employee who opened the ticket is notified and can view information about the agent

Unwanted Behavior Scenarios:
- A department agent is able to claim an already claimed ticket by another agent or a closed ticket.
- Two agents can claim the same ticket at the same time
- A department agent can claim a ticket from another department outside his own

#### Ticket Tracking
- A newly submitted request should be automatically assigned the "Open" status
- A request's status switches to "Claimed" when it is claimed by a department agent
- A request should switch to "Closed" when the department agent is done with the request and resolved it
- A request should switch to "Reopened" when an employee has a request or problem again with a previously closed ticket

Unwanted Behavior Scenarios:
- An "Open" ticket can be closed
- A "Claimed" ticket can be switched to "Open" again

#### Ticket Specific Chat
- An employee can send messages in "Claimed" tickets chats to their agent
- An agent can send messages in "Claimed" tickets chat to the employee
- The ticket submitter, all agents belonging to the ticket's department, and administrators can view the chat and its files
- Only the ticket submitter and currently assigned agent can send messages
- File attachments are supported
- Each ticket should maintain its own isolated chat
- Chat messages should show the sender identity, timestamp and content
- When a request is closed, the chat thread is locked and read only

Unwanted Behavior Scenarios:
- Messages can be sent in "Open", "Reopened" or "Closed" ticket chats
- Chat messages and files can be viewed by unauthorized employees or agents
- Chat messages show missing information like sender identity, timestamp or content

#### Ticket Modification or Deletion
- An employee who previously submitted a request should be able to delete it or modify its details if the ticket is still in the "Opened" Stage
- The employee can modify the ticket's title, target department, priority and description
- The system should record the deletion or modifications in its logs

Unwanted Behavior Scenarios
- An employee can modify a ticket having a status other "Open"

#### Ticket Viewing
- An employe can view all tickets they have submitted with all their necessary info
- An agent can view all tickets belonging to his department
- An administrator can view all the tickets in the system

#### Ticket Closing
- A department agent can close a ticket when the work is finished with completion notes describing the problem or request and the solution provided (optional)
- Completion notes are saved and associated with the request
- Upon successful closure, the ticket's status automatically changes to "closed".
- The date and time of closure are recorded by the system.
- An admin can close a ticket if the agent who claimed it is no longer available.

Unwanted Behavior Scenarios:
- An agent can close a ticket that is not assigned to them.
- An agent can close a ticket that has a status of "Open" or "Closed"
- An employee can close a request.

#### Ticket Reopening
- An employee can reopen a closed ticket
- An employee can send an additional description when opening a ticket
- The ticket status changes from "Closed" to "Reopened"
- Ticket reopening date is recorded
- The reopened ticket is available again in the department pool and can be claimed by a different agent

Unwanted Behavior Scenarios:
- An employee can reopen a ticket that is not "Closed"
- An employee can reopen a ticket that wasn't opened by him


#### History Tracking
- Nexus records actions performed and logs them, including submission, claiming, opening, modification, handoffs, and status changes. Chat messages are stored and displayed in their ticket-specific chat but are not included in the unified history logs.
- Each history entry records the action that occurred
- Each history entry records the user who performed the action
- Each history entry records the date and time at which the action occurred.
- The history preserves the chronological order of actions performed
- The administrator can view the history logs.
- The history logs should stay registered for at least two years
- Logs should be immutable

Unwanted Behavior Scenarios: 
- Users can modify or delete logs
- Events occur without being tracked in the history log, example: Ticket is claimed but no log is registered

#### Event Notification
- Nexus notifies the department agents when an employee submits a ticket to their department
- Nexus notifies the employee when the status of one of their tickets changes
- Nexus sends reminder notifications to agents when a request remains opened and unclaimed for a specific duration according to each ticket priority configured duration by admin.

Unwanted Behavior Scenarios:
- Nexus sends notifications to users who are not concerned with the corresponding events.

#### Ticket Handoff
- An agent can propose delegating a ticket assigned to them to another agent in the same department
- The requester agent can cancel the handoff request
- The destination agent is notified of the event
- The destination agent can either accept or reject the proposal
- If a ticket is closed with a pending handoff request, the request is cancelled.
- If either requester or requested agent leave the department with a pending request, it is cancelled
- If the destination agent refuses the proposal, the ticket will stay assigned to the initiator agent
- If the destination agent accepts the proposal, the ticket is handed him
- This event is recorded in the system logs
- The employee is notified of agent change
- Every handoff can have an optional message attached to it

Unwanted Behavior Scenarios:
- An agent can handoff a ticket to an agent in another department
- An agent can handoff a ticket that isn't assigned to him
- An agent can handoff a ticket that was "Open" or "Closed"

#### AI Assistance
- A user (employee, agent, admin) can interact with the AI assistant by:
  - Asking about a general problem they are facing
  - Asking about a specific ticket they own

If it is a general problem, the agent should advise the user on which department the request belongs to, the priority and so on...
The agent should also propose to the user pre-filling the submission form with data
The agent should not have direct database access, everything should be controlled by the backend

If it is a specific ticket request, the agent should ask the backend for permission to retrieve ticket information.
For the scope of this project, large datasets reads may not be performed due to the need of RAG implementations which are outside this scope, so users can only request for specific tickets at a time and not for general information that includes all tickets in its request.

Unwanted Behavior Scenarios:
- The agent queries directly from the database
- The agent gives unauthorized users forbidden data
- The agent requests multiple ticket information at a time
- The agent returns unexpected or uncontrolled responses
