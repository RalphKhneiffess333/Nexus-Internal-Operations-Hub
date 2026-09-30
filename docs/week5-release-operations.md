---
title: "Deployment - Nexus"
author: "Ralph Khneiffess"
---

# Nexus Final Handover

This document contains the final deployment, operational health, release verification, monitoring, and failure-recovery information for Nexus. It is intended to provide the information required to run, verify, troubleshoot, and maintain the deployed application.

Nexus is designed as a general-purpose internal operations platform that can be hosted by individual organizations. For the demonstration deployment, the fictional organization **CedarPeaks** is used.

## 1. Deployment

Nexus is deployed using **Railway** for the application and **Neon PostgreSQL** for persistent database storage. The free tiers are sufficient for the scope and traffic expected from this demonstration.

To simplify deployment and avoid cross-site cookie issues, the NestJS backend serves the built React frontend. Both therefore share the same Railway domain, while backend routes are exposed under the `/api` prefix. This keeps the frontend and API same-origin and simplifies the use of secure `SameSite` session cookies.

The PostgreSQL database is hosted separately on Neon. The application and database are deployed in European regions so that they remain geographically close, reducing avoidable network latency between the backend and database.

Deployment secrets and environment-specific configuration must remain in the hosting environment and must never be committed to the repository. Database schema changes are managed through Prisma migrations so a fresh database can be reproduced consistently.

## 2. Operational Dependencies

Nexus depends on several components that can fail independently:

- **Nexus backend / Railway runtime** — serves both the API and the frontend assets.
- **Neon PostgreSQL** — stores users, tickets, ticket events, configuration, audit information, and other persistent application data.
- **Microsoft Entra ID** — external identity provider used during login.
- **Groq** — external AI provider used by the Nexus AI assistant.
- **Email / SMTP provider** — sends application email notifications.
- **File storage** — stores uploaded attachment bytes while PostgreSQL stores their metadata and relationships.

Failures of optional/external services must be isolated where possible. Microsoft, Groq, or email failures should degrade only their related features rather than stopping ticket-management functionality. Database failure is more severe because most application operations depend on persistent state. A backend failure is the most visible outage because the same service also serves the frontend.

## 3. What Healthy Means

A fully healthy Nexus deployment has an operational backend and database, and its configured external services are reachable and functioning correctly. In particular, Nexus should be able to persist and retrieve data, authenticate new users through Microsoft, process AI requests through Groq, and send configured email notifications.

Two health endpoints are available:

- `GET /api/health/ping` — lightweight liveness check confirming that the backend process is responding.
- `GET /api/health` — reports the broader runtime state of Nexus and its dependencies and indicates whether the system is healthy or degraded.

A successful HTTP response alone should not be treated as proof that every dependency is healthy. The health response body must also be checked. A target may remain reachable while an external dependency has failed, producing a **degraded** runtime state.

## 4. Critical Smoke Test

The most important functional journey in Nexus is the ticket golden path:

```text
Employee submits ticket
        ↓
Ticket is persisted
        ↓
Department agent retrieves and claims it
        ↓
Agent closes the ticket
        ↓
Updated state is persisted and visible to the employee
```

This journey is the basis of the critical smoke test because it proves that the deployed frontend, backend, authorization rules, ticket lifecycle, and database can work together for the application's core purpose.

## 5. Release Gate

A deployment candidate should only receive **GO** when the required evidence for that exact candidate is green. The release gate should verify, using the repository's configured commands:

- frontend and backend type checking/builds;
- application startup and configuration;
- unit and integration tests;
- API/browser end-to-end tests;
- concurrency-sensitive lifecycle tests;
- AI evaluation tests; and
- the critical smoke/golden-path test.

The release gate proves the **candidate commit**, not the future health of the running target. After deployment, health checks, smoke tests, logs, and monitoring provide evidence about the live environment. If the target becomes degraded after a successful release, the correct response is to **HOLD**, diagnose/recover the target, and prove the target again rather than assuming the earlier green gate still proves runtime health.

## 6. Failure Signals and Monitoring

Nexus logs internal failures with useful diagnostic context such as the timestamp, error, and related domain object where appropriate. Logs do not expose session cookies, Microsoft tokens, Groq API keys, database credentials, or other secrets.

Production monitoring is implemented through **UptimeRobot**. Every five minutes,
UptimeRobot sends an authenticated `GET /api/health` request using the configured
health-check bearer secret. A healthy response returns HTTP `200`; if the health
endpoint returns HTTP `503`, UptimeRobot sends an email alert to the configured
recipient. The recipient can then use the application and provider logs to identify
the failing component. A `401` response indicates that the UptimeRobot authorization
header or secret is misconfigured and should be corrected.

Monitoring should complement the release gate rather than replace it: the gate validates a candidate before release, while monitoring detects changes in the running target after release.

### Controlled failure and recovery

As a controlled failure test, Neon PostgreSQL was deactivated while Nexus was running. Nexus logged the database failure without exposing credentials, `/api/health` returned `503`, and UptimeRobot emailed the configured recipient after its next five-minute check. Users received controlled failure messages and could not complete database-dependent actions; raw database errors were not shown.

Recovery consisted of restoring database availability. We confirmed recovery by checking that `/api/health` returned `200`, reviewing logs for recurring errors, and completing the ticket golden path successfully.

## 7. Failure Recovery

| Failure | Expected behavior | Recovery strategy |
| --- | --- | --- |
| **Backend / Railway runtime** | The API and frontend become unavailable because the backend serves both. | First restart/redeploy the Railway service. Check startup/runtime logs and environment variables. If a new release caused the failure, roll back/redeploy the last known-good candidate, then rerun health and the critical smoke test. |
| **PostgreSQL / Neon** | Ticket and most state-dependent operations fail. The backend should return controlled errors rather than expose raw database errors. | Check Neon availability, connection limits, credentials, and `DATABASE_URL`. Restore connectivity/restart the application connection if necessary. For data loss/corruption, restore from the available database recovery/backup mechanism, then verify migrations, health, and the golden path. Multi-write lifecycle operations must remain transactional so partial state is rolled back. |
| **Microsoft Entra ID** | New logins fail, but already-authenticated users may continue using valid sessions until they expire. | Retry transient provider/network failures up to three times. Verify Entra availability and OAuth configuration (tenant/client/secret/redirect URI). Do not invalidate otherwise valid Nexus sessions solely because Microsoft is temporarily unavailable. |
| **Groq AI provider** | The AI assistant/triage feature becomes unavailable; normal Nexus ticket functionality continues. | Retry transient failures up to three times with delay/backoff. Check provider status, API key/configuration, quotas/rate limits, and logs. If still unavailable, return a controlled "AI temporarily unavailable" response and keep the rest of Nexus operational. |
| **Email / SMTP provider** | Email notifications stop, while core ticket operations continue. | Retry transient network failures up to three times. Log the failure; do not block the ticket operation on email delivery. Invalid/rejected messages should not be blindly retried. Provider configuration/credentials should be checked before restoring normal delivery. |
| **File storage / attachments** | Upload/download operations may fail while unrelated ticket operations should remain controlled. | Check storage availability/capacity and permissions. Reject failed uploads cleanly and avoid leaving inconsistent file/database records. Restore missing files from external backups where available; future maintenance should include orphan-file cleanup and migration to durable object storage if reliability requirements grow. |
| **Bad deployment/configuration** | Application may start incorrectly, health may degrade, or specific integrations may fail. | Compare deployed environment variables/secrets with the documented configuration, correct the target configuration, restart/redeploy, then rerun `/api/health` and the smoke test. Never solve configuration problems by committing secrets to source control. |

### Recovery verification

Recovery is not complete when the process merely starts again. After any significant incident:

1. Confirm `/api/health/ping` responds.
2. Check `/api/health` and verify the expected dependency state.
3. Run the critical smoke/golden-path test.
4. Review logs for recurring errors.
5. For a release-related incident, verify or redeploy the last known-good candidate before declaring **GO** again.

## 8. Maintenance Notes

Nexus should continue to follow several reliability rules during maintenance: related database writes must remain transactional; concurrency-sensitive operations such as ticket claiming and handoff acceptance must remain atomic; external-service failures should be isolated from unrelated functionality; migrations must remain reproducible; and secrets must remain outside source control.

The current recovery model is intentionally simple for the project scope. UptimeRobot
provides automated uptime/health monitoring and email alerting; future operational
improvements should include durable external backups, durable cloud object storage
for attachments, and more formal rollback/recovery procedures.
