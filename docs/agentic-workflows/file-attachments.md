---
title: "File Attachments - Nexus"
author: "Ralph Khneiffess"
---
# Task: Implement File Attachments for Nexus

You are working in the existing **Nexus** codebase.

Your task is to implement the **File Attachments** feature end-to-end and integrate it into the already-implemented ticket lifecycle and Ticket Events system.

The feature must allow:

1. A user to optionally attach one or more files when **submitting/opening a ticket**.
2. A user to optionally attach one or more files when **reopening a closed ticket**.
3. An agent to optionally attach one or more files when **closing a ticket**, alongside the completion notes.
4. Authorized users viewing a ticket to see and download the files associated with those ticket lifecycle events.

Chat is **not implemented yet**.

Do NOT implement chat or chat attachments in this task.

However, the database/schema design for `File` and `Attachment` must preserve the intended future ability to attach files to chat messages without requiring a destructive redesign later.

Do not redesign Nexus or reimplement existing features.

Inspect the current repository first and integrate file attachments into the architecture that already exists.

---

# 1. Documentation hierarchy

Before changing code, read these files first and in this order:

1. `docs/product-specs.md`
2. `docs/architecture.md`
3. `docs/data-model.md`

These three files are the authoritative specification for the intended complete Nexus system.

Then read:

- `docs/ticket-events.md`
- database workflow documentation
- authentication workflow documentation
- authorization workflow documentation
- ticket lifecycle workflow/interface documentation
- full-stack delivery/workflow documentation
- any other relevant implementation-stage documentation

Important distinction:

- `product-specs.md`, `architecture.md`, and `data-model.md` define the intended system.
- Workflow documents describe what was implemented at particular stages.
- `ticket-events.md` describes the Ticket Events implementation that should now exist.
- The actual source code is the final source of truth for what is currently implemented.

Do not assume something exists just because an architecture document describes it.

Confirm it in the code.

If documentation and current implementation differ, preserve valid existing behavior and report the discrepancy rather than silently redesigning the application.

---

# 2. Inspect the repository before coding

Before making changes, inspect the implementation end-to-end.

At minimum inspect:

## Backend

- `prisma/schema.prisma`
- all existing Prisma migrations
- Prisma/database infrastructure
- Tickets module
- Tickets controller
- Tickets service/application service
- Ticket repository abstraction
- Prisma/PostgreSQL ticket repository
- Ticket Events implementation
- Ticket Event repository
- ticket DTOs
- ticket event DTOs/types
- ticket entities/types
- lifecycle policies
- authentication middleware/guards/request context
- authorization decorators/guards
- ticket resource authorization policies
- application configuration/environment handling
- global validation configuration
- global exception handling
- current test utilities
- integration tests
- API E2E tests

## Frontend

Inspect the existing React ticket experience, especially:

- new ticket form
- ticket details page
- reopen UI
- close ticket UI
- ticket history/timeline UI
- API client
- ticket API types
- authentication handling
- error display conventions
- browser E2E tests

## Existing Ticket Events

Confirm exactly how the current implementation creates:

- `SUBMISSION`
- `REOPEN`
- `CLOSE`

events.

Determine:

1. Where those events are created.
2. What transaction boundary currently surrounds them.
3. How their IDs are generated.
4. How their details are stored.
5. How ticket history is retrieved.
6. How event DTOs are returned to the frontend.
7. How authorization for ticket history works.
8. Whether event retrieval already supports Prisma relation includes.
9. Whether any attachment-related schema already exists.

Do not begin implementation until this flow is understood.

---

# 3. Scope

Implement file attachments for exactly these ticket lifecycle actions:

```text
SUBMISSION
REOPEN
CLOSE
```

Meaning:

```text
Ticket submission
    └── SUBMISSION TicketEvent
            └── zero or more Attachments
                    └── one File each
```

```text
Ticket reopen
    └── REOPEN TicketEvent
            └── zero or more Attachments
                    └── one File each
```

```text
Ticket close
    └── CLOSE TicketEvent
            └── zero or more Attachments
                    └── one File each
```

Do NOT attach files directly to the Ticket row.

The Ticket represents current state.

Ticket Events represent historical lifecycle actions and their notes.

Files belonging to opening/reopening/completion notes therefore belong to the corresponding Ticket Event through `Attachment`.

---

# 4. Explicitly out of scope

Do NOT implement:

- ticket chat
- chat messages
- chat UI
- chat endpoints
- sending chat attachments
- notifications
- email notifications
- WebSockets
- cloud object storage
- S3
- Azure Blob Storage
- Google Cloud Storage
- virus scanning infrastructure
- background file-processing queues
- image transformations
- image thumbnails
- document previews
- OCR
- file versioning
- generic user file manager
- arbitrary file sharing
- attachments on ticket modifications
- attachments on claim events
- attachments on handoff events
- attachments on delete events
- audit-log attachments

Do not implement future architecture merely because it appears in the complete design.

---

# 5. Required data model

Follow `data-model.md`.

There are conceptually two separate entities:

```text
File
Attachment
```

They serve different purposes.

## File

`File` stores metadata about a physical file stored by Nexus.

It must conceptually contain:

- unique file ID
- uploader/user ID
- original filename
- storage path/key
- file size
- MIME type
- created timestamp
- updated timestamp according to project conventions

Use the project's existing naming and ID conventions.

Do not invent a completely different ID strategy.

The uploader must reference the authenticated Nexus `User`.

The client must NEVER provide or control `uploadedBy`.

It must come from the authenticated request user.

## Attachment

`Attachment` associates a `File` with the resource to which it belongs.

According to the intended Nexus data model, an attachment may belong to:

```text
TicketEvent
OR
ChatMessage
```

but never both.

For the current implementation:

```text
Attachment -> TicketEvent
```

is used.

The schema must remain compatible with the future:

```text
Attachment -> ChatMessage
```

relationship.

Do NOT implement ChatMessage merely to satisfy that future relationship if ChatMessage does not currently exist.

Adapt the Prisma schema in the smallest way that preserves this future design.

---

# 6. Attachment invariant

An attachment belongs to **exactly one valid resource**.

Conceptually:

```text
eventId != null XOR messageId != null
```

Valid:

```text
eventId = event-123
messageId = null
```

Future valid state:

```text
eventId = null
messageId = message-456
```

Invalid:

```text
eventId = null
messageId = null
```

Invalid:

```text
eventId = event-123
messageId = message-456
```

The authoritative data model requires this invariant to be enforced through database constraints.

Prisma does not express every PostgreSQL CHECK constraint directly.

If necessary, create the required CHECK constraint in the Prisma SQL migration.

Do not rely only on application code if PostgreSQL can enforce the invariant.

If ChatMessage does not yet exist and Prisma cannot create a relation to a nonexistent model, design the current schema so that adding the future `messageId` relationship remains straightforward.

Do not create a fake ChatMessage model just for this task.

Explain the chosen compatibility strategy in the final report.

---

# 7. File-to-Attachment cardinality

Follow the documented relationship:

```text
File 1:1 Attachment
```

Each stored File represents one uploaded attachment.

A File should not be reused across unrelated resources.

An Attachment references exactly one File.

Enforce the one-to-one relationship using the appropriate unique foreign-key constraint.

---

# 8. TicketEvent-to-Attachment relationship

Implement:

```text
TicketEvent 1:N Attachment
```

A lifecycle event may contain zero, one, or multiple attachments.

Each current-scope Attachment belongs to exactly one TicketEvent.

Add the appropriate Prisma relation.

Ticket Events themselves remain append-only.

Adding attachments as part of the lifecycle operation must not introduce a public API that lets clients arbitrarily mutate historical Ticket Events.

---

# 9. Database indexes

Implement indexes based on the documented data model and actual query patterns.

At minimum account for:

```text
File.uploadedBy
Attachment.eventId
```

and later compatibility with:

```text
Attachment.messageId
```

when chat exists.

Do not create meaningless indexes.

Inspect PostgreSQL/Prisma conventions already used in Nexus.

---

# 10. Prisma migration

Create a new Prisma migration.

Never modify an already-applied historical migration.

The migration should introduce the required:

- File table/model
- Attachment table/model
- foreign keys
- unique constraints
- indexes
- resource ownership CHECK constraint where applicable
- TicketEvent attachment relation

Use the existing table/column naming conventions.

The migration must work on a fresh database as part of the project's normal migration chain.

Run Prisma validation and generation afterward.

---

# 11. File storage architecture

Nexus currently specifies **local filesystem storage** for this scope.

Do not store raw file contents in PostgreSQL.

The architecture should remain conceptually:

```text
Uploaded File
      ↓
File Storage abstraction
      ↓
Local filesystem implementation
```

while:

```text
PostgreSQL
      ↓
File metadata
Attachment relation
```

The database stores metadata and relationships.

The filesystem stores the actual bytes.

---

# 12. FileStorage abstraction

The architecture documentation defines a `FileStorage` adapter.

Implement a small provider-independent abstraction rather than embedding direct filesystem calls throughout TicketsService.

The exact structure must follow existing repository conventions, but conceptually something like:

```text
files/
  file-storage.interface.ts
  local-file-storage.service.ts
  files.repository.ts
  prisma-files.repository.ts
```

or another structure that better matches the current codebase.

The important separation is:

```text
business/application logic
        ↓
FileStorage abstraction
        ↓
local filesystem implementation
```

Do NOT scatter:

```ts
fs.writeFile(...)
fs.unlink(...)
```

through ticket controllers/services.

Do not create a giant generic storage framework.

The abstraction only needs the operations required by this feature.

Likely responsibilities include:

```text
store
read/open
delete/cleanup
```

Use the smallest useful interface.

---

# 13. Storage location

Use a dedicated application-controlled upload directory.

Do NOT store files:

- inside frontend source directories
- inside public static directories
- under arbitrary user-selected paths
- using client-supplied absolute paths

The physical storage filename/path must be server-controlled.

The original filename should be metadata only.

Generate a unique storage identifier/name to prevent collisions.

Conceptually:

```text
original filename:
network-diagram.pdf

physical storage:
uploads/<generated-id>
```

or an equivalent safe structure.

Do not rely on the original filename for uniqueness.

Do not allow `../` or similar path traversal through filenames.

The storage directory should be configurable through environment/application configuration rather than duplicated as magic strings.

Update `.env.example` if a new configuration variable is required.

Do not put secrets or machine-specific absolute paths into the repository.

Ensure runtime upload storage is excluded from Git where appropriate.

---

# 14. File validation

The product requirements explicitly require uploaded files to be validated.

The architecture specifically calls out checking things such as:

- MIME type
- extension
- file size
- malicious/executable uploads

Implement reasonable server-side validation.

Do NOT trust:

```text
filename
Content-Type
extension
```

independently.

At minimum:

1. enforce a maximum file size
2. validate filename/extension
3. validate allowed/rejected MIME types
4. reject obviously dangerous executable/script file types
5. reject malformed uploads
6. generate storage names server-side

If the repository or documentation already defines exact limits or allowed types, use those.

If no exact numeric size limit or exhaustive MIME allowlist is defined in the authoritative documentation, do NOT pretend one was specified.

Choose a conservative implementation default only where technically necessary, centralize/configure it, and clearly report that default in the final implementation report so it can later become system configuration.

Do not introduce heavyweight antivirus infrastructure because that is outside this task.

Validation failures should produce an appropriate `400`/`413`-style application response according to the existing NestJS error conventions.

Never expose filesystem internals to clients.

---

# 15. Multiple attachments

Support **zero or more files** for each supported lifecycle operation.

Do not require an attachment.

Existing requests without files must continue working.

The existing behavior:

```text
submit ticket with JSON fields
reopen ticket
close ticket with optional completion notes
```

must remain functionally valid.

Determine an appropriate maximum file count if required for safe multipart handling.

If the documentation does not specify one, treat it as an implementation safety limit, centralize it, and document it rather than presenting it as a product requirement.

---

# 16. HTTP API / multipart handling

The supported lifecycle endpoints need to accept files.

Inspect the existing API before choosing exact endpoint signatures.

Prefer extending the existing lifecycle operations rather than creating separate workflows such as:

```text
create ticket
then separately attach files
```

because attachments belong to the lifecycle event being created.

The intended semantic operation is:

```text
submit ticket + submission files
```

not:

```text
submit ticket
upload unrelated files
manually associate them later
```

Likewise:

```text
reopen ticket + reopen notes/files
```

and:

```text
close ticket + completion notes/files
```

should be cohesive operations.

Use the standard NestJS multipart upload mechanism consistent with the installed stack.

Do not add a dependency if the existing NestJS/Express stack already provides the necessary upload functionality.

Preserve DTO validation for textual fields when converting an endpoint from JSON to `multipart/form-data`.

Be careful because multipart form fields arrive as strings.

Priority, IDs, optional fields, etc. must continue to be validated correctly.

Do not weaken the global validation behavior.

---

# 17. Ticket submission integration

Current conceptual submission flow:

```text
authenticated user
      ↓
submit ticket DTO
      ↓
validate department/request
      ↓
create Ticket
      ↓
create SUBMISSION TicketEvent
```

Extend it to:

```text
authenticated user
      ↓
submit ticket DTO + optional files
      ↓
validate request
validate files
      ↓
store file bytes safely
      ↓
transaction
  create Ticket
  create SUBMISSION TicketEvent
  create File metadata for each upload
  create Attachment for each File -> SUBMISSION event
commit
```

The `File.uploadedBy` value must be the authenticated user who submitted the ticket.

Attachments must point to the actual newly-created `SUBMISSION` event.

Do NOT attach them directly to the Ticket.

If no files are provided:

```text
Ticket
+
SUBMISSION event
```

must behave exactly as before.

---

# 18. Reopen integration

When the ticket submitter successfully reopens a ticket, optional files may accompany the reopen information.

Conceptually:

```text
reopen ticket
      ↓
REOPEN TicketEvent
      ↓
Attachments
      ↓
Files
```

The files belong to the `REOPEN` event.

`File.uploadedBy` is the authenticated user performing the reopen.

Preserve all existing reopen authorization and lifecycle rules.

Do not permit attachments to be used as a way to bypass reopen validation.

For example, a user who cannot reopen the ticket must not be able to upload files to it.

If reopening fails:

```text
no REOPEN event
no File database records
no Attachment records
no permanently retained uploaded files
```

---

# 19. Close integration

When an authorized assigned agent closes a claimed ticket, allow optional files alongside completion notes.

Conceptually:

```text
close ticket
      ↓
CLOSE TicketEvent
      ↓
completion notes snapshot
      ↓
Attachments
      ↓
Files
```

The files belong to the `CLOSE` TicketEvent.

`File.uploadedBy` must be the authenticated agent closing the ticket.

Preserve all existing close policies:

- correct role
- correct department/resource access
- ticket is in the required state
- agent owns/is assigned to the ticket
- any other existing policy

An unauthorized agent must not be able to upload a completion attachment merely by knowing the ticket/event ID.

---

# 20. Files and Ticket Events must be cohesive

Do not create a separate client-controlled operation like:

```http
POST /ticket-events/:eventId/attachments
```

that allows arbitrary historical events to be changed after the fact unless the existing authoritative requirements explicitly require post-event attachment mutation.

For this scope, attachments are provided as part of:

```text
SUBMISSION
REOPEN
CLOSE
```

and recorded with the corresponding event.

This preserves the historical meaning of the event.

The attachment is part of the historical notes at the moment the event occurred.

---

# 21. Transaction and filesystem integrity

This is a critical part of the implementation.

The authoritative data model requires submission/event/file/attachment persistence to remain consistent.

For example:

```text
Ticket
+
SUBMISSION TicketEvent
+
File metadata
+
Attachment
```

must not end in a partially persisted database state.

Use a Prisma transaction for related database writes.

However, PostgreSQL transactions cannot automatically roll back filesystem operations.

Design explicit compensating cleanup.

The implementation must account for both:

```text
database succeeds / filesystem fails
```

and:

```text
filesystem succeeds / database fails
```

Do not treat filesystem writes as magically transactional.

A robust flow may involve:

1. multipart layer receives/stages files
2. validate all files before lifecycle persistence
3. store/move files using generated server-controlled names
4. perform required Ticket + TicketEvent + File + Attachment database writes transactionally
5. if the database transaction fails, remove files written for the failed operation
6. if file persistence fails before commit, abort the lifecycle operation and clean up any files already stored during that request

The exact ordering may be adjusted to fit the current architecture.

The required invariant is:

> A lifecycle request must not be reported successful unless its required ticket mutation, TicketEvent, File records, Attachment records, and physical files all succeeded.

Avoid orphaned files as much as possible using synchronous compensation.

The architecture mentions eventual orphan cleanup as an additional safeguard, but do NOT build a background worker as part of this task unless one already exists and naturally supports this feature.

---

# 22. Multiple-file failure behavior

Uploads must behave cohesively.

Suppose three files are submitted:

```text
A succeeds
B succeeds
C fails
```

Do not silently complete the lifecycle operation with A and B unless the product already explicitly supports partial attachment success.

Prefer all-or-nothing behavior for the lifecycle request:

```text
operation fails
A cleaned up
B cleaned up
C not stored
database transaction rolled back
```

This keeps the Ticket Event's historical record trustworthy.

---

# 23. File authorization model

A file inherits the authorization permissions of the resource to which it is attached.

For current scope:

```text
File
 ↓
Attachment
 ↓
TicketEvent
 ↓
Ticket
 ↓
existing Ticket visibility policy
```

Do not authorize file downloads based solely on:

```text
file.uploadedBy === request.user.id
```

The uploader is metadata, not the complete viewing rule.

A user who is allowed to view the underlying ticket/event should be allowed to access its attachment according to the existing ticket visibility policy.

A user who cannot view the underlying ticket must not be able to access the file.

Reuse existing resource authorization.

Do not duplicate ticket visibility logic inside a generic authentication module.

---

# 24. Secure file retrieval

Clients must NOT receive direct local filesystem paths.

Never return:

```text
C:\server\nexus\uploads\...
/var/nexus/uploads/...
```

Do not expose the upload directory as a public static directory.

Clients must retrieve files through the Nexus backend.

Implement an authenticated/authorized retrieval endpoint consistent with the existing API.

Conceptually something like:

```http
GET /files/:fileId
```

or:

```http
GET /attachments/:attachmentId/file
```

Choose whichever best matches the existing module architecture.

The request flow must conceptually be:

```text
request file
    ↓
authentication
    ↓
resolve File -> Attachment -> TicketEvent -> Ticket
    ↓
existing role/resource authorization
    ↓
read physical file
    ↓
stream response
```

Set appropriate response metadata, including safe content type and download filename.

Prefer safe download behavior rather than inline execution for potentially active content.

Do not load unnecessarily large files entirely into memory if the existing framework supports streaming.

Return appropriate not-found/forbidden behavior without leaking sensitive storage details.

---

# 25. File IDs must not grant access

Knowing:

```text
fileId
```

must never be sufficient to retrieve a file.

Do not implement:

```text
GET /files/:id
    ↓
find file
    ↓
send file
```

without resolving and authorizing its owning resource.

Authorization is mandatory.

---

# 26. Repository/module boundaries

Do not turn `TicketsService` into a file-storage god service.

Use the smallest modular separation consistent with Nexus.

A reasonable conceptual architecture is:

```text
Tickets lifecycle
       ↓
application orchestration
       ├── TicketRepository
       ├── TicketEventsRepository
       ├── FilesRepository / AttachmentRepository
       └── FileStorage
```

The exact class structure should follow what is already present.

Responsibilities should remain clear:

### Tickets

Own:

- lifecycle behavior
- submit
- reopen
- close
- ticket policies
- coordination with Ticket Events

### Ticket Events

Own:

- immutable historical event persistence
- history retrieval

### File/Attachment persistence

Own:

- File metadata
- Attachment relationships
- attachment lookup

### FileStorage adapter

Own:

- physical bytes
- generated storage paths/keys
- reading/streaming
- cleanup

### Authorization

Own:

- centralized role requirements where currently appropriate

### Ticket resource policies

Own:

- whether a user can view/operate on the underlying ticket

Do not move resource-specific ticket rules into FileStorage.

---

# 27. Avoid god services

Follow existing Nexus modularity conventions.

Do not create:

```text
FileService with 700 lines
```

that handles:

- HTTP
- authorization
- database access
- filesystem
- ticket lifecycle
- validation
- response mapping

Split responsibilities naturally.

Do not over-engineer with unnecessary patterns either.

Prefer small cohesive components that fit existing project conventions.

---

# 28. Attachment response model

Ticket history/details should expose enough attachment metadata for the frontend to render attachments.

For each attachment, expose only safe client-facing information such as:

```text
attachment ID
file ID
original filename
file size
MIME type
created timestamp
```

Do NOT expose:

```text
physical storage path
internal server path
Prisma internals
filesystem implementation details
```

Inspect the existing Ticket Event response DTO/types and extend them cleanly.

Avoid leaking raw Prisma models directly if the project currently maps persistence models to API/domain responses.

---

# 29. Ticket history integration

Existing Ticket Event history should include attachments for the relevant events.

Conceptually:

```json
{
  "action": "SUBMISSION",
  "details": {
    "...": "..."
  },
  "attachments": [
    {
      "id": "...",
      "fileId": "...",
      "filename": "error-screenshot.png",
      "size": 142322,
      "mimeType": "image/png"
    }
  ]
}
```

Do not put file binary contents inside the history JSON.

Do not encode files as Base64 inside TicketEvent details.

Do not store attachment metadata inside the event JSON if relational `File`/`Attachment` records exist.

The event details remain the historical action snapshot.

Attachments are related entities.

---

# 30. Historical integrity

Ticket Events remain immutable.

Files associated with historical Ticket Events should not be silently replaceable.

Do not implement:

```text
replace attachment
edit attachment metadata
move attachment to another event
```

as client-facing operations.

Do not allow users to attach a new file retroactively to an old SUBMISSION/CLOSE/REOPEN event in this scope.

Attachments should be created as part of the lifecycle action.

---

# 31. Existing historical events

Existing Ticket Events may already exist without attachments.

That is valid.

Do not fabricate attachments.

Do not rewrite existing Ticket Events.

Do not attempt to infer old files that never existed.

The new relations must allow existing events to have:

```text
attachments = []
```

---

# 32. Future chat compatibility

This is important.

The full Nexus model requires future support for:

```text
ChatMessage
    1:N
Attachment
    1:1
File
```

Do not implement Chat now.

But avoid a design such as:

```text
TicketEventFile
```

that permanently couples the physical File model only to Ticket Events.

The intended abstraction is:

```text
File
   ↓
Attachment
   ├── TicketEvent
   └── ChatMessage (future)
```

The database and application structure should make the future Chat attachment implementation additive rather than requiring the File system to be rewritten.

For example, future chat support should conceptually be able to reuse:

- File model
- file metadata
- FileStorage adapter
- validation
- secure retrieval
- Attachment model

while adding the ChatMessage attachment resource relationship.

Do not create placeholder chat endpoints/services/tables merely for future-proofing.

---

# 33. Frontend — ticket submission

Update the existing new-ticket form.

Add an attachment input that supports selecting multiple files.

The attachments are optional.

The existing fields remain:

- title
- department
- priority
- description

Add a clear attachment area consistent with the current UI.

Users should be able to:

- choose files
- see selected filenames
- remove a selected file before submission
- submit without files
- see a useful validation/upload error

Use `FormData`/multipart requests when files are present or use a consistent multipart submission strategy if simpler.

Do not manually set an incorrect multipart `Content-Type` boundary.

Preserve existing authentication/cookie behavior.

---

# 34. Frontend — reopen

Update the existing reopen interaction so the user can optionally select files associated with the reopen notes/description.

The UI should clearly communicate that the selected files belong to this reopening.

Do not add attachments to unrelated historical events.

Preserve existing reopen validation and UX.

---

# 35. Frontend — close

Update the agent close-ticket interaction.

The agent must be able to provide:

```text
completion notes
+
optional attachments
```

Display selected files before closure.

Allow removing a selected file before submitting.

If the close operation fails, show the existing error UI and do not misleadingly show the ticket as successfully closed.

---

# 36. Frontend — ticket history/details

Update the ticket history/details interface so attachments belonging to:

- SUBMISSION
- REOPEN
- CLOSE

events are visible alongside the corresponding event/notes.

Do not create a disconnected global attachments section if the existing history UI can naturally display them with their event.

Example:

```text
Ticket submitted
Sep 18, 10:35

Description:
Laptop cannot connect to VPN.

Attachments:
📎 vpn-error.png
📎 logs.pdf
```

and:

```text
Ticket closed
Sep 18, 12:20

Completion notes:
VPN profile was recreated.

Attachments:
📎 new-profile.pdf
```

Clicking/downloading a file must go through the authenticated Nexus backend endpoint.

Do not build public filesystem URLs.

---

# 37. Frontend file errors

Handle useful errors such as:

- file too large
- rejected file type
- upload failure
- unauthorized access
- missing file
- server/storage failure

Use the project's existing error presentation conventions.

Do not expose backend paths or raw Prisma/filesystem exceptions.

---

# 38. Authentication

Reuse the existing authentication implementation.

The authenticated actor is the source of:

```text
File.uploadedBy
```

Never accept this from the frontend.

Do not change Microsoft Entra authentication unless absolutely required.

Do not introduce a new identity system.

---

# 39. Authorization

Reuse the existing role/resource authorization architecture.

For lifecycle upload:

```text
Can user submit/reopen/close this ticket?
```

must be answered by the existing lifecycle authorization/policies.

For retrieval:

```text
Can user view the ticket that owns this attachment?
```

must be checked before file access.

Do not create a parallel, inconsistent authorization model just for files.

A file inherits its owning resource's permissions.

---

# 40. Security requirements

Treat file upload as an untrusted input boundary.

Protect against at least:

- path traversal
- filename collisions
- executable/script upload where unsafe
- oversized files
- invalid file types
- spoofed filenames/extensions where practical
- malformed multipart requests
- unauthorized downloads
- direct filesystem access
- client-controlled storage paths
- client-controlled uploader IDs
- accidental storage-path exposure
- orphaned files after failed operations

Do not execute uploaded files.

Do not pass uploaded filenames into shell commands.

Do not make the upload directory publicly served.

---

# 41. File deletion semantics

Do not automatically delete historical attachment records/files merely because the Ticket is soft-deleted.

Ticket deletion in Nexus is soft deletion for integrity/history.

The attachment belongs to historical Ticket Events.

Preserve historical integrity unless the authoritative documentation explicitly defines another retention/deletion rule.

Do not invent a file-retention cleanup policy in this task.

---

# 42. Tests

Add thorough automated tests.

Follow the current project's testing patterns.

Do not replace meaningful integration tests with mocks if the repository currently tests Prisma/PostgreSQL integration.

At minimum cover the following.

## Submission without attachments

Verify existing behavior remains unchanged:

```text
Ticket
+
SUBMISSION event
+
zero attachments
```

## Submission with one attachment

Verify:

```text
Ticket created
SUBMISSION event created
File record created
Attachment created
physical file stored
Attachment points to SUBMISSION event
File uploadedBy == authenticated submitter
```

## Submission with multiple attachments

Verify all files and attachment relations are created.

## Reopen with attachments

Verify:

```text
Ticket -> REOPENED
REOPEN event
files stored
attachments -> REOPEN event
uploadedBy == authenticated submitter
```

## Close with attachments

Verify:

```text
Ticket -> CLOSED
CLOSE event
completion notes preserved
files stored
attachments -> CLOSE event
uploadedBy == authenticated agent
```

## No attachment

Verify all three lifecycle operations continue to work without files.

## Unauthorized upload

Verify unauthorized users cannot:

- reopen and attach files
- close and attach files
- attach files to a ticket they cannot operate on

Ensure no physical or database files remain after rejection.

## Invalid file

Test rejected:

- oversized file
- unsafe file type
- malformed upload where practical

Verify the lifecycle operation does not succeed.

## Transaction failure

Simulate/fake a database failure after physical storage where practical.

Verify:

```text
ticket mutation rolled back
event rolled back
File rows rolled back
Attachment rows rolled back
physical files cleaned up
```

## Storage failure

Simulate a storage failure.

Verify:

```text
ticket lifecycle mutation does not commit
no File row
no Attachment row
no misleading success response
```

## Multi-file partial storage failure

If file 1 stores and file 2 fails:

```text
file 1 cleaned up
operation fails
database lifecycle changes do not commit
```

## Download authorization

Test:

- ticket submitter with visibility can retrieve attachment
- authorized department agent can retrieve attachment according to existing policy
- admin can retrieve according to existing policy
- unrelated employee cannot retrieve attachment
- unauthorized agent cannot bypass ticket visibility
- unauthenticated request is rejected

Use the actual authorization rules discovered in the repository.

## Path security

Verify original filenames cannot escape the configured storage directory.

## History

Verify history responses include safe attachment metadata but not storage paths.

## Existing event compatibility

Verify pre-existing TicketEvents with zero attachments still serialize correctly.

---

# 43. Browser E2E tests

Where the current test infrastructure supports it, extend browser E2E coverage.

At minimum cover one meaningful complete flow:

```text
employee logs in
    ↓
opens new ticket page
    ↓
fills ticket
    ↓
selects file
    ↓
submits
    ↓
ticket persists
    ↓
SUBMISSION event persists
    ↓
File + Attachment persist
    ↓
ticket history displays filename
    ↓
authorized file retrieval succeeds
```

Also add close/reopen browser coverage if it fits the current testing structure without excessive duplication.

Prefer meaningful E2E tests over many shallow UI tests.

---

# 44. Preserve Ticket Events transactional behavior

The existing Ticket Events implementation already requires lifecycle mutation + event creation to be atomic.

Do not break that architecture.

The new persistence unit becomes conceptually:

### Submission

```text
Ticket
+
SUBMISSION event
+
File metadata[]
+
Attachment[]
```

### Reopen

```text
Ticket state transition
+
REOPEN event
+
File metadata[]
+
Attachment[]
```

### Close

```text
Ticket state transition
+
CLOSE event
+
File metadata[]
+
Attachment[]
```

All database changes for one operation must commit or roll back together.

---

# 45. Do not weaken concurrency behavior

Adding files must not weaken any existing concurrency protections.

In particular, do not modify claim semantics or other lifecycle operations in a way that reintroduces race conditions.

Although claim events do not receive attachments in this scope, the Ticket Events implementation and shared transaction infrastructure may be touched.

Run existing concurrency tests afterward.

---

# 46. Backward compatibility

Existing clients/tests that perform ticket operations without files should continue to work wherever reasonably possible.

Do not unnecessarily break:

- ticket submission
- ticket retrieval
- ticket history
- modification
- claim
- close
- reopen
- cancellation
- authentication
- authorization

If changing request encoding to multipart creates a compatibility issue, inspect the current API and implement the cleanest compatibility approach.

Do not silently remove existing JSON support unless technically necessary.

---

# 47. Error handling

Follow existing NestJS error conventions.

Do not leak:

- Prisma errors
- PostgreSQL errors
- absolute filesystem paths
- Node filesystem stack traces
- storage implementation details

Convert failures into appropriate application responses.

Storage failures must not crash the process.

Database failures must not leave physical files behind when synchronous cleanup is possible.

Cleanup failures should be logged appropriately according to existing project conventions rather than hiding the primary request failure.

---

# 48. Logging

Do not use Ticket Events as generic technical logs.

Do not create new TicketEvent action types such as:

```text
FILE_UPLOADED
FILE_DOWNLOADED
```

unless the authoritative specification explicitly requires them.

The attachment belongs to the existing:

```text
SUBMISSION
REOPEN
CLOSE
```

event.

Audit logging is outside this task.

---

# 49. API contract

After inspecting the current API, define and implement the exact multipart contracts.

Keep them simple.

For example, conceptually:

```http
POST /tickets
Content-Type: multipart/form-data

title
description
priority
departmentId
files[]
```

```http
POST /tickets/:id/reopen
Content-Type: multipart/form-data

description
files[]
```

```http
POST /tickets/:id/close
Content-Type: multipart/form-data

completionNotes
files[]
```

These are conceptual examples.

Do NOT blindly change route names if the existing application already uses different routes.

Preserve current endpoint names and lifecycle semantics.

Only extend their input capability.

Document the final actual API contract in the completion report.

---

# 50. Repository-wide search

Before considering the task complete, search the repository for:

```text
submit
submission
reopen
close
completionNotes
TicketEvent
SUBMISSION
REOPEN
CLOSE
attachments
files
upload
storage
multipart
FormData
```

Make sure there are no alternate submission/reopen/close paths that bypass attachment handling or create duplicate Ticket Events.

There must be one authoritative integration point per lifecycle operation.

---

# 51. Avoid duplicate records

Be particularly careful with service/repository layering.

For one uploaded physical file there should be exactly:

```text
1 File
1 Attachment
```

For one lifecycle operation there should still be exactly:

```text
1 lifecycle TicketEvent
```

regardless of attachment count.

Example:

```text
submission with 3 files
```

must create:

```text
1 Ticket
1 SUBMISSION event
3 File rows
3 Attachment rows
3 physical files
```

NOT:

```text
3 SUBMISSION events
```

---

# 52. Do not put files in TicketEvent JSON

Do not modify TicketEvent `details` into something like:

```json
{
  "description": "...",
  "files": [
    {
      "path": "..."
    }
  ]
}
```

Attachments are relational resources.

Use:

```text
TicketEvent
    ↓
Attachment
    ↓
File
```

This is important for future chat reuse and authorization.

---

# 53. Performance

Do not return file contents while loading ticket history.

History should return metadata only.

Binary data should only be transferred when the user explicitly requests/downloads a file.

Avoid N+1 database queries when loading event attachments if Prisma can retrieve the required relations efficiently.

Do not prematurely optimize beyond actual query patterns.

---

# 54. Naming

Before creating new classes/models, inspect current terminology.

Use the project's established conventions for:

- `userId` vs `uploadedBy`
- `eventId`
- `fileId`
- camelCase Prisma fields
- mapped SQL names
- DTO names
- repository names
- module names
- route naming
- timestamps
- ID generation

Do not create duplicate concepts under different names.

---

# 55. Documentation/comments

Use comments only where behavior is non-obvious.

Useful comment targets include:

- why Attachment is separate from File
- why physical files require compensating cleanup
- why authorization is derived from the owning resource
- why attachments link to TicketEvents rather than Ticket
- future ChatMessage resource compatibility

Do not fill straightforward code with comments.

---

# 56. Verification

Run the actual commands defined in the repository's `package.json`.

At minimum verify:

- Prisma schema validation
- Prisma Client generation
- new migration
- backend build
- frontend build
- backend tests
- integration tests
- API E2E tests
- browser E2E tests where configured
- linting where configured

Do not assume script names.

Inspect `package.json`.

Also verify manually or through tests:

```text
submit without file
submit with file
submit with multiple files
reopen with file
close with file
history attachment metadata
authorized download
unauthorized download
invalid upload
storage failure
database rollback/cleanup
```

Existing Ticket Event and lifecycle tests must still pass.

---

# 57. Expected architecture

The resulting write path should remain approximately:

```text
HTTP multipart request
        ↓
Authentication
        ↓
Authorization
        ↓
Ticket Controller
        ↓
Ticket lifecycle service/application layer
        ↓
Ticket resource/lifecycle policies
        ↓
File validation
        ↓
FileStorage abstraction
        ↓
Local filesystem
        +
Transactional DB orchestration
        ↓
┌───────────────────────────┐
│ Ticket Repository         │
│ TicketEvent Repository    │
│ File Repository           │
│ Attachment Repository     │
└───────────────────────────┘
        ↓
Prisma
        ↓
PostgreSQL
```

The retrieval path should approximately be:

```text
GET file
   ↓
Authentication
   ↓
resolve File
   ↓
resolve Attachment
   ↓
resolve TicketEvent
   ↓
resolve Ticket
   ↓
existing ticket visibility authorization
   ↓
FileStorage
   ↓
stream physical file
```

The frontend history path remains:

```text
Ticket details
    ↓
Ticket Events
    ↓
attachment metadata
    ↓
user clicks attachment
    ↓
authenticated Nexus file endpoint
```

---

# 58. Core design principles

Maintain these principles throughout the implementation.

## Ticket = current state

The Ticket row answers:

> What is the state of this ticket now?

## TicketEvent = historical action

The TicketEvent answers:

> What happened to the ticket at this point in time?

## File = stored object metadata

The File answers:

> What physical file did Nexus store, who uploaded it, and what are its safe metadata?

## Attachment = resource relationship

The Attachment answers:

> What domain resource does this File belong to?

For the current task:

```text
Attachment -> TicketEvent
```

Future:

```text
Attachment -> ChatMessage
```

## FileStorage = physical persistence

The FileStorage adapter answers:

> How are the bytes stored/retrieved?

Today:

```text
LocalFileStorage
```

Potential future implementation:

```text
S3FileStorage
```

The rest of the application should not need major architectural changes merely because the physical storage provider changes.

---

# 59. Before coding: produce a short implementation plan

Before making edits, output a concise implementation plan based on the repository you actually inspected.

Include:

1. Current Ticket/Event Prisma models.
2. Current Ticket Events architecture.
3. Existing submission flow.
4. Existing reopen flow.
5. Existing close flow.
6. Existing transaction boundaries.
7. Existing authentication actor source.
8. Existing ticket resource authorization.
9. Current frontend forms involved.
10. Current API encoding/contracts.
11. Whether any file/storage code already exists.
12. Proposed `File` model.
13. Proposed `Attachment` model.
14. How future ChatMessage attachments will remain possible.
15. Proposed FileStorage abstraction.
16. Physical storage directory/configuration.
17. Validation strategy.
18. Transaction + filesystem compensation strategy.
19. File retrieval authorization strategy.
20. Files to create/modify.
21. Any discrepancies found between documentation and code.

Then implement the feature unless a genuine blocker exists.

Do not stop after producing the plan.

---

# 60. Final implementation report

After completing the work, report:

### Files created

List them.

### Files modified

List them.

### Database

Explain:

- File model
- Attachment model
- relations
- indexes
- constraints
- migration

### File storage

Explain:

- storage abstraction
- local implementation
- configured location
- generated filenames/storage keys
- validation

### Ticket lifecycle

Explain how attachments integrate with:

- submission
- reopen
- close

### Ticket Events

Explain how attachments associate with:

- SUBMISSION
- REOPEN
- CLOSE

### Transactions

Explain the database transaction boundaries.

### Filesystem consistency

Explain cleanup/compensation behavior.

### Authorization

Explain how downloads inherit ticket permissions.

### API

Document the final upload and retrieval contracts.

### Frontend

Explain:

- new ticket attachment UI
- reopen attachment UI
- close attachment UI
- history attachment display/download

### Tests

List tests added/updated.

### Verification

List commands run and whether they succeeded.

### Defaults

Clearly identify any implementation defaults you had to choose because the authoritative docs did not specify an exact value, especially:

- maximum file size
- maximum attachment count
- allowed/rejected MIME types/extensions
- upload directory

Do not present these as documented product requirements.

### Deferred functionality

Explicitly state that:

```text
Chat attachments are intentionally not implemented.
```

Explain how the implementation remains compatible with adding them later.

---

# 61. Definition of Done

This task is complete when all of the following are true:

- `File` persistence exists.
- `Attachment` persistence exists.
- File metadata references the authenticated uploader.
- Physical files are stored outside PostgreSQL.
- Local storage is accessed through an abstraction.
- Physical storage names are server-generated.
- Original filenames are preserved as metadata.
- TicketEvent has a one-to-many attachment relationship.
- File has a one-to-one Attachment relationship.
- Attachment ownership/resource invariants are enforced appropriately.
- Schema design preserves future ChatMessage attachment support.
- Chat itself has NOT been implemented.
- Submission accepts zero or more attachments.
- Submission files belong to the SUBMISSION event.
- Reopen accepts zero or more attachments.
- Reopen files belong to the REOPEN event.
- Close accepts zero or more attachments.
- Close files belong to the CLOSE event.
- Existing lifecycle requests without attachments still work.
- `uploadedBy` is server-controlled.
- File size/type/name validation exists.
- Unsafe paths cannot be client-controlled.
- File metadata and attachment records are transactionally persisted with lifecycle/event writes.
- Filesystem failures do not leave a successful lifecycle mutation.
- Database failures trigger cleanup of newly stored physical files where possible.
- Multiple-file partial failures are cleaned up.
- Ticket history returns safe attachment metadata.
- Ticket history does not return binary contents.
- Ticket history does not expose storage paths.
- Authorized users can retrieve/download attachments.
- Unauthorized users cannot retrieve attachments.
- File IDs do not bypass resource authorization.
- Files are not publicly exposed as static files.
- Historical events are not made mutable.
- No arbitrary post-event attachment mutation API is introduced.
- Existing Ticket Event behavior remains intact.
- Existing authentication behavior remains intact.
- Existing authorization behavior remains intact.
- Existing concurrency guarantees remain intact.
- New Prisma migration succeeds.
- Prisma validates and generates successfully.
- Backend builds.
- Frontend builds.
- Existing tests pass.
- New attachment tests pass.
- Relevant E2E coverage passes.
- No unrelated features were implemented.
- Final report documents all implementation choices and verification results.