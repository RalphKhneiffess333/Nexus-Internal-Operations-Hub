# Nexus Postman collections

These collections target the backend directly. HTTP backend routes use the
global `/api` prefix. Socket.IO remains at the origin root with the
`/operations` namespace and `/socket.io` transport path.

## Local test mode

Start the application with:

```text
npm run start:test
```

Import `environments/Nexus Local Test.postman_environment.json` and select it
in Postman. Run the `Local test authentication` folder in `Nexus API` once, or
run the authentication setup requests at the start of `Nexus Smoke`.

The imported local-test environment already uses:

```text
baseUrl = http://localhost:3000/api
origin  = http://localhost:3000
```

Use `baseUrl` for HTTP requests. Use `origin` only for the manual Socket.IO
request.

The login requests call the test-only `POST /api/__test/auth/login` endpoint and
extract the stable `nexus_session` value from `Set-Cookie`. Requests send that
value explicitly as a `Cookie` header because the backend marks the cookie as
`Secure`, while local test mode normally runs over HTTP.

The test-only endpoints are not registered by `npm run start` or a production
build.

### Variables you may need to fill manually

For **Nexus Local Test**, most variables are already provided or populated by
the authentication and smoke requests. You may need to set:

| Variable | When to set it | Value |
| --- | --- | --- |
| `healthSecret` | When calling `GET /api/health` | The value of `HEALTH_CHECK_SECRET` from `backend/.env.integration` |
| `runAi` | When you want to execute the AI smoke request | Set to `true`; leave as `false` to skip it |
| `configurationKey` | Before sending the admin configuration update request | A valid key returned by `GET /api/admin/configurations` |
| `fileFixture` | Only if Postman cannot resolve the upload path | Select `postman/fixtures/smoke.txt` in the multipart `files` field |

Do not manually fill these session variables during the normal local test
workflow:

```text
sessionEmployee
sessionEmployee2
sessionAgent
sessionAgent2
sessionItAgent2
sessionHrAgent2
sessionAdmin
```

Run the **Local test authentication** folder first. Its login requests populate
the session variables from the `Set-Cookie` response header.

The following variables are also populated as requests succeed. Leave them
blank before starting a smoke run:

```text
ticketId
ticketEventId
attachmentId
messageId
handoffId
conversationId
```

For **Nexus Normal**, complete Microsoft Entra authentication in the browser,
copy the value of the browser's `nexus_session` cookie, and paste it into:

```text
sessionManual
```

Paste only the cookie value, not the `nexus_session=` text. The role-specific
session variables in the Normal environment resolve to `sessionManual`.
The variables `authStateCookie`, `oauthCode`, and `oauthState` are only needed
when manually testing the Microsoft callback request.

## Normal authentication

Start the normal application with:

```text
npm run start
```

Import `environments/Nexus Normal.postman_environment.json`. Complete Microsoft
Entra authentication in the browser, copy the `nexus_session` cookie from the
browser developer tools, and set `sessionManual` in the environment. The
role-specific session variables in the Normal environment resolve to
`sessionManual`; custom requests can use `Cookie: nexus_session={{sessionManual}}`.

The `baseUrl` variable must include `/api`, for example
`http://localhost:3000/api`. The separate `origin` variable must not include
`/api`; it is used only for the Socket.IO reference request.

The Microsoft login and callback requests are included for reference, but the
OAuth flow remains browser-assisted because the identity provider owns the
credential interaction.

## Running smoke tests

Use Postman's Collection Runner with `Nexus Smoke` and the Local Test
environment. Run the requests in collection order. The smoke collection:

- creates and transitions tickets;
- verifies chat and handoff behavior;
- reads administrative resources;
- checks key authorization failures; and
- excludes state-changing administration requests.

Set `runAi` to `true` to include the AI request. It is skipped by default.

## Attachments

The reference and smoke multipart requests use `fixtures/smoke.txt`. If
Postman does not resolve the relative file path automatically, select that
file in the request's form-data `files` row. Nexus accepts up to five files per
event and limits each file to 10 MiB; the extension and MIME type must match.

## Realtime

The reference collection documents the Socket.IO `/operations` namespace and
its join/leave events. Realtime checks are manual and are not part of the HTTP
smoke run. The socket must use the same `nexus_session` cookie and the
`/socket.io` transport path.
