# Nexus — SendGrid Email Notifications Implementation Prompt

You are working in the Nexus repository. Implement the server-side email notification system using SendGrid for the major ticket lifecycle and handoff events.

## Goal

Add reliable, asynchronous email notifications for these successful business events:
- Ticket submission
- Ticket claim
- Ticket close
- Ticket reopen
- Handoff requested
- Handoff accepted
- Handoff rejected/denied

The implementation must fit the existing Nexus architecture and source code. Do not create a parallel ticket lifecycle, authentication system, authorization system, or notification convention.

The user-facing ticket operation must remain successful even if SendGrid is unavailable, misconfigured, slow, or temporarily failing. Email delivery is a side effect and must never make a successful ticket operation fail.

## Current repository status

This document is a future implementation prompt. SendGrid delivery, email delivery-status persistence, and a public email-notification HTTP API are not currently implemented. The current application may create in-app/realtime notifications, but those are not a substitute for the email provider described here. The implemented API surface is documented in [../api-contract.md](../api-contract.md).

## Repository and specification rules

Before changing code, inspect the repository and read the relevant project documents in this order:

1. Product specifications and role behavior.
2. Architecture and module boundaries.
3. Data model and database conventions.
4. Authentication and session handling.
5. Authorization rules.
6. Ticket lifecycle and ticket-event rules.
7. Handoff workflow and invariants.
8. Administration/configuration conventions.
9. Existing notification, realtime, email, logging, and testing code.

The current repository implementation is the final source of truth for names, paths, ORM conventions, module registration, error handling, and existing abstractions. The current request authorizes implementing the notification behavior even if an older planning document says notifications are not yet implemented.

Do not assume Prisma, TypeORM, JWT, Redis, BullMQ, Kafka, or any other technology until you confirm what the repository actually uses.

## Mandatory inspection before coding

Inspect at minimum:

- `package.json` and the lockfile.
- Root and backend module registration, especially `AppModule`.
- Existing configuration/env validation and config naming conventions.
- Database schema, migrations, seed data, and transaction helpers.
- `User` fields, especially email, display name, active status, role, department membership, and identity-provider fields.
- Department and department-member queries.
- Ticket submission, claim, close, reopen, and status-transition services.
- Ticket event/audit creation and event detail types.
- Handoff request, accept, reject, cancel, and automatic-cancellation logic.
- Authentication session resolution and the authenticated-user request shape.
- Authorization policies for ticket ownership, department access, agent eligibility, and handoffs.
- Any existing `Notification`, `Email`, `Outbox`, `Job`, `EventEmitter2`, or provider-adapter code.
- The realtime/event-driven infrastructure if it has already been implemented.
- Existing frontend notification/toast conventions only if this repository contains the frontend.
- Existing test, lint, build, migration, and formatting scripts.

Trace each requested business operation from controller/API entry point through authorization, transaction, database writes, ticket-event creation, and post-operation side effects. Identify the exact transaction boundary before implementing notification delivery.

## Required architecture

Use a provider-independent notification boundary with a SendGrid adapter:

```text
Ticket/Handoff operation
        |
        | one database transaction
        v
Ticket state + immutable TicketEvent + pending email/outbox intent
        |
        | after commit, asynchronous dispatch
        v
Notification service -> EmailProvider interface -> SendGrid adapter
```

Follow these rules:

1. Ticket and handoff business modules must not import `@sendgrid/mail` and must not call SendGrid directly.
2. Domain/business modules may emit internal NestJS events after a successful transaction, using the repository's existing event mechanism. If the realtime implementation already uses `@nestjs/event-emitter`, reuse it consistently.
3. The dispatcher must catch provider errors and record them. It must not throw an error back into the ticket or handoff HTTP request.
4. Sending must be idempotent. A retry, worker restart, duplicate internal event, or repeated delivery attempt must not create duplicate email records or send the same logical notification more than once when a successful delivery is already recorded.
5. Keep realtime broadcasts and email notifications separate. The central realtime gateway may broadcast an event, but it must not contain SendGrid logic.

## SendGrid integration

Inspect whether a mail provider package or adapter already exists. Reuse it if compatible. Otherwise add the smallest supported dependency, normally `@sendgrid/mail`, using the repository's package manager and lockfile.

Use the repository's configuration system and add only the keys that are needed. The expected configuration is conceptually:

- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`
- `SENDGRID_FROM_NAME`
- `SENDGRID_ENABLED` or the repository's equivalent feature flag, if feature flags are already used
- `SENDGRID_MAX_ATTEMPTS`, defaulting to 3 if a configurable retry count is appropriate
- An application base URL/config value for safe ticket links, if one already exists

Rules:

- The API key is server-only. Never expose it to the browser, commit it, or log it.
- Never log the complete email body, API key, authorization header, or sensitive provider payload.
- The sender must come from verified SendGrid configuration; do not accept a sender address from a client request.
- If notification configuration is missing, follow existing startup/config conventions. Notification delivery may be disabled or marked unavailable, but ticket operations must continue according to the architecture.
- If SendGrid returns a success response, record the provider message/request identifier when available, mark the delivery sent, and record the sent timestamp.
- Treat network errors, timeouts, connection resets, HTTP 429, and HTTP 5xx responses as transient failures.
- Retry transient failures up to three total attempts, with the repository's existing backoff convention or a small bounded backoff.
- Treat known invalid-recipient/request errors as permanent failures. Record the failure without retrying forever.
- Never retry indefinitely.

Create an `EmailProvider` or equivalent interface with a typed request/response contract. The SendGrid implementation should be replaceable in tests by a fake provider.

## Persistence and delivery status

Do not implement database tables or memory data structures for emails, if an email fails to send, just drop it.

## Recipient rules

Resolve recipients on the server from the authenticated Nexus user, ticket, department membership, and handoff records. Never trust recipient IDs or email addresses from client input.

Use the current product rules and repository authorization logic. The baseline recipient matrix is:

| Event | Required recipients | Important behavior |
|---|---|---|
| `SUBMISSION` | Active eligible agents in the ticket's target department | Notify the department agent pool. Deduplicate recipients. Do not notify inactive users or users without a valid email. |
| `CLAIM` | Ticket submitter | The submitter is informed that the ticket was claimed. Do not send a duplicate copy to the actor merely because they are also a recipient. |
| `CLOSE` | Ticket submitter | Include the completion notes when present, safely escaped. |
| `REOPEN` | Ticket submitter and active eligible agents in the target department | The submitter receives confirmation and the department agent pool is informed that the ticket is available again. Deduplicate if applicable. |
| Handoff `REQUESTED` | Requested agent | Include the requester, ticket, department, and action needed. |
| Handoff `ACCEPTED` | Former/current requester, accepted agent, and ticket submitter | Explain the new assignment. Deduplicate users who occupy more than one role. |
| Handoff `REJECTED`/`DENIED` | Requesting/current agent | Preserve the repository's canonical terminology in the subject/body even if the database uses the other term. |
| Handoff `CANCELLED` | Requested agent and other directly affected handoff participant | Include the cancellation reason when the domain operation has one. |

Before coding, verify this matrix against the actual product documents and existing notification conventions. If the repository has an established “concerned parties” resolver, use it instead of duplicating queries. If the final recipient choice differs from this baseline because the repository has a more authoritative rule, document the difference in the final report and tests.

Important recipient rules:

- Use a stable recipient snapshot for the delivery record so a later email-address change does not rewrite historical delivery intent.
- Filter inactive users and blank/invalid email addresses according to existing validation conventions.
- Deduplicate by user ID and normalized email address.
- Never let a client choose an arbitrary notification recipient.
- Do not reveal ticket information to users who could not already access that ticket under the current authorization model.

## Event integration requirements

Integrate notifications only after the corresponding business operation succeeds.

### Ticket submission

- Create the ticket and its immutable `SUBMISSION` ticket event using the existing transaction and event-detail shape.
- Resolve active eligible agents for the target department.
- Do not create or send notification records if validation, authorization, or the ticket transaction rolls back.
- After commit, emit any existing internal/realtime event according to repository conventions.

### Ticket claim

- Preserve the existing atomic/concurrency-safe claim behavior.
- Only the winning successful claim may create the `CLAIM` ticket event and email delivery.
- A failed or losing concurrent claim must not send an email.
- Notify the submitter with the ticket ID/title, agent display name if permitted, and new status.

### Ticket close

- Preserve the existing close authorization and completion-note validation.
- Only a successful close may create the `CLOSE` email delivery.
- Include completion notes only if they are part of the approved recipient-visible data; escape them in HTML and include a plain-text alternative.
- A failed close must not send an email.

### Ticket reopen

- Preserve the existing reopen authorization and lifecycle invariant.
- Only a successful transition to `REOPENED` may create the email deliveries.
- Notify the submitter and the eligible department agent pool according to the verified recipient matrix.
- If reopening cancels or invalidates pending handoffs under the existing domain rules, process those handoff cancellations using the same event/notification conventions without creating duplicate notifications.

### Handoff request

- Only the current assigned agent may request a handoff.
- Preserve same-department and eligible-agent rules.
- Only a successfully persisted `PENDING` handoff request sends the `REQUESTED` email.
- The requested agent must be resolved from the server-side handoff record.

### Handoff acceptance

- Only the requested eligible agent may accept.
- Preserve the atomic ownership transfer and ticket-state rules.
- Create exactly one successful handoff event for the accepted transition.
- The notification must describe the resulting assignee and state.

### Handoff rejection/denial

- Only the requested agent may reject/deny.
- Only a successful state transition from `PENDING` may send the rejection/denial email.
- Do not send an email for invalid, repeated, or unauthorized attempts.
- Reuse the domain's canonical reason field if one exists; do not invent a client-controlled explanation field.

### Handoff cancellation

- Only the authorized requester or the existing system/domain cancellation path may cancel a pending handoff.
- Only a successful cancellation may send the cancellation email.
- If closing a ticket, removing a user, or another existing domain action automatically cancels pending handoffs, use the repository's established behavior and avoid sending duplicate cancellation messages for the same handoff transition.

## Email templates

Implement typed templates for each notification type. Use the repository's existing template or branding approach if one exists. Otherwise provide a small maintainable renderer with both HTML and plain-text output.

Every email should include, where applicable:

- Nexus/application name.
- Clear event-specific subject.
- Ticket identifier and title.
- Current ticket status.
- Target department.
- Actor display name where appropriate.
- Event timestamp.
- Relevant handoff participants and handoff status.
- Completion notes for close events when allowed.
- A safe link to the ticket/app if the repository already has an application base URL and the route is known.

Template rules:

- Escape all user-controlled values in HTML.
- Include a plain-text alternative.
- Do not put secrets, session tokens, or raw database records in email links or bodies.
- Do not expose internal authorization details or unrelated private chat content.
- Do not attach uploaded files unless that behavior is explicitly supported by the existing product requirements.
- Use stable, typed template data instead of passing an unbounded entity object into the renderer.
- Make subjects deterministic and easy to filter, for example `[Nexus] Ticket #123 claimed`.

## API, frontend, and configuration scope

This feature primarily belongs in the backend. Do not add a frontend notification management screen unless the existing requirements and repository already define one.

Do not expose SendGrid credentials or provider internals through an API. If the repository already has an admin configuration model, follow it only where appropriate; do not store secrets in ordinary client-visible system configuration.

If the frontend already displays realtime ticket updates, keep email delivery independent from realtime connection state. A disconnected browser must still receive the email if the server-side notification was accepted for delivery.

## Tests

Add tests following the repository's existing test style. At minimum cover:

### Provider and configuration

- SendGrid adapter maps the typed email request correctly.
- API key and sender configuration are read from the server configuration layer.
- Secrets are never included in logs or serialized responses.
- A fake provider can be injected in unit and integration tests.

### Recipient resolution

- Submission notifies eligible active department agents.
- Claim and close notify the submitter.
- Reopen notifies the submitter and eligible department agents according to the verified matrix.
- Each handoff action notifies the correct affected users.
- Inactive users, missing emails, unauthorized users, and duplicates are handled correctly.
- Recipient resolution never accepts arbitrary client-supplied email addresses.

### Transaction and event correctness

- A failed/rolled-back ticket operation creates no email delivery intent.
- A failed/unauthorized handoff creates no email delivery intent.
- A successful operation creates exactly the expected immutable ticket event and email intent.
- Concurrent claim attempts produce one winning claim, one claim event, and one logical claim email.
- Repeated handoff commands do not create duplicate transition emails.
- Automatic handoff cancellation follows the existing domain behavior without duplicate notifications.

### Dispatcher and failure handling

- A successful provider response marks the delivery `SENT`.
- Timeout, network, 429, and 5xx failures are retried no more than the configured maximum.
- A permanent invalid-recipient/request error is recorded without endless retries.
- SendGrid failure does not fail the ticket or handoff operation.
- A pending delivery can be resumed after process restart.
- A sent delivery is idempotent and is not sent again by a duplicate event/worker.

### Templates and safety

- HTML escapes ticket titles, completion notes, handoff reasons, names, and other user-controlled values.
- Plain-text output exists and contains the important event data.
- No session token, API key, or sensitive internal payload appears in an email.
- Subject and template data are correct for every event type.

Do not call the real SendGrid API in normal automated tests. Use a fake provider and make any live provider test explicitly opt-in through an environment flag.

## Implementation workflow

Follow this sequence:

1. Inspect the repository and project documents.
2. Identify existing module, ORM, config, event, notification, and test conventions.
3. Write a short implementation plan listing the exact files you will change.
4. Implement the provider-independent email contract and SendGrid adapter.
6. Implement typed recipient resolution and templates.
8. Register modules/providers/listeners in the correct NestJS module graph.
9. Add configuration examples without adding real secrets.
10. Add unit, integration, and concurrency-focused tests.
11. Run the repository's format, lint, typecheck, build, migration/schema validation, and relevant test commands.
12. Review the diff for accidental direct SendGrid calls, secret leakage, duplicate event handling, authorization bypasses, and notifications sent before commit.

Do not silently change unrelated ticket behavior, authorization rules, realtime behavior, or database semantics. If the repository has a pre-existing issue that blocks this feature, report it clearly and make the smallest safe compatibility change.

## Required final report

At the end, report:

- Files added and changed.
- The final notification architecture and async delivery path.
- The exact recipient matrix implemented.
- The exact SendGrid environment/configuration keys required.
- The retry and failure behavior.
- The idempotency/deduplication strategy.
- Any database migration required.
- Tests and validation commands run, with results.
- Any assumptions or deviations from the project documents.
- Any follow-up work intentionally left out, such as chat-message or reminder emails if they are not part of this task.

## Definition of done

This task is complete only when:

- SendGrid is behind a provider adapter and can be replaced by a fake in tests.
- Ticket and handoff modules do not call SendGrid directly.
- Successful submission, claim, close, reopen, and handoff transitions create the correct asynchronous notification intent.
- Recipient resolution is server-side, authorization-aware, deduplicated, and based on current Nexus users.
- Email delivery does not block or fail ticket operations.
- Transient failures retry with a bounded limit, permanent failures are recorded.
- Duplicate events and worker restarts do not create duplicate successful emails.
- Templates are typed, escaped, and include plain text.
- Secrets are protected.
- Tests cover the event matrix, transaction behavior, recipient rules, provider failures, retries, and idempotency.
- The repository builds, typechecks, lints, and passes the relevant tests.

---

Start by inspecting the repository and documents. Do not begin by writing new files from assumptions.
