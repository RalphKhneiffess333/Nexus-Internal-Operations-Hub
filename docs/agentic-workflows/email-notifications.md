---
title: "Email Notifications - Nexus"
author: "Ralph Khneiffess"
---

# Nexus Email Notifications

Nexus implements server-side transactional email notifications through a
provider boundary and the `NodemailerEmailProvider` SMTP adapter. This document
describes current behavior; the HTTP and realtime surface is documented in
[../api-contract.md](../api-contract.md).

## Delivery model

Ticket lifecycle, handoff, and reminder services dispatch emails only after a
successful domain operation. Sending is a best-effort side effect: the ticket
or handoff action remains successful if SMTP is disabled, unavailable, slow, or
rejects a message.

`EmailNotificationsService` resolves recipients from current Nexus data,
deduplicates valid email addresses, applies bounded retry attempts, and logs a
terminal failure. The implementation has no email outbox, delivery-status
table, provider-message persistence, or restart-resume queue. A failed message
is dropped after its final attempt.

## SMTP configuration

The adapter reads these backend-only environment variables:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL` and optional `SMTP_FROM_NAME`
- `SMTP_ENABLED` (defaults to enabled when SMTP host and sender are supplied)
- `SMTP_TIMEOUT_MS`
- `EMAIL_MAX_ATTEMPTS` (default `3`) and `EMAIL_RETRY_DELAY_MS` (default `250`)
- `APP_BASE_URL`, used to construct safe ticket links

If SMTP is disabled or lacks a host or sender address, the provider is inert.
Its health check reports `disabled`; it does not send an email merely to check
connectivity.

## Delivered event matrix

| Event | Recipients |
|---|---|
| Ticket submitted | Active Agent and Admin members of the target department, excluding the submitting actor |
| Ticket claimed or closed | The submitter, unless they performed the action |
| Ticket reopened | The submitter when applicable, plus active Agent and Admin members of the target department, excluding the actor |
| Unclaimed-ticket reminder | Active Agent and Admin members of the target department |
| Handoff requested | Requested agent |
| Handoff accepted | Requester, requested agent, and ticket submitter |
| Handoff rejected | Requester |

Ticket cancellation and automatic cancellation of competing handoffs intentionally
do not send email. Realtime/in-app notifications remain a separate mechanism
and do not depend on SMTP delivery.

## Boundaries and safety

- Ticket and handoff modules depend on the application-owned notification
  service, not on SMTP transport details.
- The client cannot select recipients or sender addresses.
- Recipient selection excludes inactive users and invalid addresses.
- Emails contain only authorization-safe ticket and handoff context and use
  application-generated ticket links.
- Automated tests use the provider interface or Nodemailer transport mocks; no
  external mail provider is called during normal test execution.

## Related runtime behavior

The unclaimed-ticket reminder worker is scheduled by the Background Workers
module. It determines due tickets from the active priority reminder interval,
atomically records the reminder timestamp, then emits in-app and email
notifications. Scheduled worker lifecycle and intervals are documented in
[../architecture.md](../architecture.md).
