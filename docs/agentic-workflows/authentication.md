---
title: "Authentication - Nexus"
author: "Ralph Khneiffess"
---

# Nexus - Authentication
This document defines how authentication is implemented in Nexus. It describes the authentication architecture, Microsoft Entra ID integration, user account provisioning, identity-provider linking, session management, cookies, request authentication, and the separation between authentication and authorization.

The current implementation is backend-only.

Authentication identifies who the user is.

Authorization is intentionally outside the scope of this document and must not be implemented as part of the authentication module.

## Objective
Nexus must authenticate employees using Microsoft Entra ID only for the initial implementation.

The application itself must not handle or store user passwords.

After successful authentication through Microsoft Entra ID:

Nexus identifies the authenticated person.
Nexus looks up the corresponding application user account.
If an application account already exists, it is associated with the authenticated identity.
If the account exists but the user has never logged in before, has_logged is changed to true.
If no application account exists, Nexus creates one.
Nexus creates an in-memory session for the user.
Nexus gives the browser an HTTP-only session cookie.
Subsequent requests use that cookie to identify the user's Nexus session.
The authentication module validates the session and places the authenticated user's information into the request context before the request reaches application functionality.
The authentication architecture must remain independent from Microsoft Entra ID so additional identity providers can be introduced later without changing the rest of the application.
The authentication module is responsible from everything from authentication via microsoft entra ID to session and cookie validation.

## Authentication vs Authorization
Authentication and authorization are separate concerns.

Authentication
Authentication answers:

"Who is making this request?"

The authentication module is responsible for:

Authenticating the user through an identity provider.
Identifying the corresponding Nexus user.
Creating and managing sessions.
Reading and validating the session cookie.
Attaching the authenticated user to the request.
Authorization
Authorization answers:

"Is this authenticated user allowed to perform this action?"

Authorization is not implemented yet.

The authentication implementation must therefore not contain:

Role checks
Permission checks
Department access checks
Resource ownership checks
Authorization guards
UserRole
Permission
RoleGuard
AuthorizationService
AuthorizationGuard
Authentication may provide the authenticated user's application data to later authorization components, but it must not decide what that user is allowed to do.

## Architectural Principles
### Provider Independence
The application must not directly depend on Microsoft Entra ID.

Microsoft Entra ID is an implementation detail of the authentication infrastructure.

The application should depend on a provider-independent authentication strategy interface.

Conceptually:

Application
    |
    v
Authentication Module
    |
    v
Authentication Strategy
    |
    +---- Microsoft Entra ID
    |
    +---- Future Provider
    |
    +---- Future Provider
The authentication module should interact with every strategy through the same contract.

The strategy must return a normalized authenticated identity regardless of which identity provider was used.

The rest of Nexus must not need to know whether the identity originated from Microsoft Entra ID or another provider.

### Authentication Strategy
The authentication module must define an abstraction representing an authentication provider.

The strategy is responsible for provider-specific authentication.

A strategy should conceptually provide operations such as:

authenticate(...)
The result should be provider-independent.

A normalized authentication result should contain the information Nexus needs to identify the user, such as:

AuthenticatedIdentity
    provider
    providerUserId
    email
    firstName
    lastName
    displayName
    phoneNumber
The exact fields may depend on the information available from the identity provider.

The important requirement is that the authentication module does not consume Microsoft-specific objects.

For example, the authentication module should not receive or manipulate Microsoft Graph-specific user objects.

Instead:

Microsoft Entra ID
        |
        v
MicrosoftAuthStrategy
        |
        v
AuthenticatedIdentity
        |
        v
Authentication Module
This allows another provider to later produce the same AuthenticatedIdentity.

### Microsoft Entra ID Strategy
The initial authentication strategy is:

MicrosoftAuthStrategy
It is responsible for communicating with Microsoft Entra ID and validating the authentication response.

Nexus must never receive or store the user's Microsoft password.

Microsoft Entra ID remains responsible for the actual credential authentication.

The strategy must verify the identity information returned by Microsoft before returning a successful AuthenticatedIdentity.

Invalid authentication responses must result in authentication failure.

Examples include:

Invalid authorization response
Invalid or expired token
Missing identity information
Invalid provider identity
Invalid token exchange
Provider authentication failure
The Microsoft-specific logic must remain inside the Microsoft authentication strategy.

No Microsoft-specific logic should be introduced into:

Ticket module
User domain
Ticket service
Controllers unrelated to authentication
Session management
Future authorization module
### User Module
A dedicated Users module must be introduced.

The Users module owns application-level user information.

It is responsible for operations such as:

Finding users.
Creating users.
Updating user information.
Finding users by identity-provider information.
Marking a user as having logged in.
Returning user information to other application modules.
The Users module should not perform authentication.

It does not communicate directly with Microsoft Entra ID.

Its responsibility is application user data.

Conceptually:

Authentication Module
        |
        v
Users Module
        |
        v
Users Repository
        |
        v
Users data
This keeps identity-provider authentication separate from application user management.

User Provisioning During Login
A successful authentication does not automatically mean that a Nexus user record exists.

After the identity provider successfully authenticates the user, Nexus must resolve the provider identity against the Users data.

The login process is therefore:

Web app
 |
 v
Microsoft Entra ID
 |
 v
MicrosoftAuthStrategy
 |
 v
AuthenticatedIdentity
 |
 v
Authentication Module
 |
 v
Users Module
 |
 +------------------------------+
 |                              |
 | Existing account             | No account
 v                              v
User lookup                     Create user
 |                              |
 v                              v
has_logged?                     has_logged = true
 |                              |
 +---- false --> true           |
 |                              |
 +------------------------------+
                |
                v
        Authenticated User
                |
                v
          Create Session
Existing User
If the authenticated identity already corresponds to a Nexus user:

The existing user record must be used.
If has_logged is false, it must be changed to true.
Existing application configuration must remain intact.
No duplicate user account should be created.
The has_logged field represents whether the user has successfully authenticated at least once.

This supports administrators creating user accounts before those users first log into Nexus.

Example:

Administrator creates:

User
----------------
email: employee@company.com
has_logged: false
active: true
(Gives employee role)
The employee later authenticates successfully.

Nexus changes:

has_logged: false
        |
        v
has_logged: true

### Identity Provider Linking
The Nexus data model contains an Identity Providers table.

The purpose of this table is to avoid hardcoding identity providers into the Users table and to allow additional providers to be introduced later.

The initial system contains one enabled provider:

MICROSOFT_ENTRA_ID
Conceptually:

Identity Providers
---------------------------
id
code
name
enabled
created_at
updated_at
A user is associated with the provider through their identity-provider information.

The application must be able to determine:

Provider + Provider User ID
        |
        v
Nexus User
This identity must be treated as the stable external identity identifier rather than relying exclusively on the user's email address.

Email may be used as part of the account lookup/provisioning process where appropriate, but the provider identity must be retained so Nexus can reliably associate future logins with the same external identity.

The preferred lookup is based on:

identity_provider_id
+
identity_provider_user_id
If an existing provider identity is found, its corresponding Nexus user is returned.

If no matching identity exists, Nexus may use the authenticated identity's account information to determine whether an existing preconfigured Nexus user should be linked.

This is important because an administrator may create a Nexus user before that employee performs their first login.

The provisioning process must avoid creating duplicate Nexus users.

The final result must always be:

Authenticated Identity
        |
        v
Exactly one Nexus User
for a successful login.

Active User Accounts
The existing active field on the Users table remains an application account property.

Authentication must verify that the resolved Nexus account is allowed to establish a session.

An inactive Nexus account must not receive an authenticated Nexus session.

This is still authentication/account-state handling, not authorization.

The authentication module should therefore reject login for disabled application accounts.

## Session Management
After successful authentication and successful Nexus user resolution, Nexus creates an application session.

Sessions are intentionally stored in memory.

No database or Redis session store is required for the current implementation.

Conceptually:

Session Store
--------------------------------
sessionId -> {
    userId,
    device information,
    createdAt,
    lastAccessedAt,
    expiresAt
}
The session store belongs to the Authentication module.

The Users module does not manage sessions.

The Ticket module does not manage sessions.

### Session Identifier
Each authenticated login creates a unique session identifier.

The session identifier must be:

Cryptographically secure.
Unpredictable.
Unique.
Suitable for use as an opaque session identifier.
The client must not receive application user information encoded into the session identifier.

The session ID should only identify the server-side session.

Example:

Browser
    |
    | Cookie: nexus_session=<opaque-session-id>
    v
Authentication Module
    |
    v
In-memory session store
    |
    v
userId
### Multiple Devices
The session architecture must support multiple simultaneous sessions for the same Nexus user.

A user logging into Nexus from another device must not invalidate existing sessions.

For example:

User 42

Session A -> User 42 -> Laptop
Session B -> User 42 -> Mobile
Session C -> User 42 -> Tablet
Each session has its own session ID and lifecycle.

Logging in from one device must therefore not replace or invalidate sessions belonging to other devices.

### Device Information
Each session should retain information identifying the device/session context.

The purpose is to distinguish simultaneous sessions belonging to the same user.

The exact device metadata should remain minimal and should not be used for authorization.

A session may conceptually contain:

sessionId
userId
device
createdAt
lastAccessedAt
expiresAt
Device information is session metadata and does not change the identity of the Nexus user.

### Session Lifetime
A session has an inactivity lifetime of seven days.

The seven-day lifetime is sliding.

Every authenticated interaction with the session resets its lifetime.

For example:

Day 0
Login
expires in 7 days

Day 3
User makes request
expires in 7 days from Day 3

Day 6
User makes request
expires in 7 days from Day 6
Therefore:

A session expires after seven days without activity.

The session must not remain valid indefinitely merely because the user originally authenticated successfully.

### Session Expiration
When the session reaches its expiration time:

The session is considered invalid.
The session must no longer authenticate requests.
The session should be removed from the in-memory session store.
The client should be treated as unauthenticated.
A request containing an expired session cookie must not reach authenticated application functionality.

The user must authenticate again to create a new session.

### Session Cookie
After creating a session, Nexus gives the browser an HTTP-only cookie containing the session identifier.

The cookie must be configured securely.

At minimum:

HttpOnly
Secure
SameSite
The exact SameSite configuration should match the deployment architecture.

The cookie must not contain the user's application data.

Example:

Set-Cookie:
nexus_session=<opaque-session-id>
The browser automatically sends the cookie with subsequent requests.

JavaScript running in the browser must not be able to read the session identifier.

### Session Cookie and Security
The session cookie must not expose:

User ID
Email
Role
Department
Identity provider token
Microsoft access token
Microsoft refresh token
Password
Other sensitive user information
The cookie only identifies the server-side session.

The actual user identity is retrieved from the in-memory session store.

### Request Authentication
After login, authenticated requests must pass through the Authentication module before reaching application functionality.

The request pipeline should conceptually be:

HTTP Request
     |
     v
Authentication
     |
     +---- No valid session ---> Unauthenticated response
     |
     v
Authenticated User
     |
     v
Application Controller
     |
     v
Application Service
The Authentication module is responsible for establishing the identity attached to the request.

It must not decide whether the user is authorized to perform the requested operation.

Request User Context
After validating the session, the Authentication module retrieves the corresponding Nexus user.

The authenticated user should then be attached to the request context.

Conceptually:

request.user = authenticatedUser
The rest of the application can therefore consume the authenticated user without knowing how authentication was performed.

For example:

request
  |
  +-- user
       |
       +-- id
       +-- email
       +-- name
       +-- ...
The exact request context type should be defined centrally so application modules can use it consistently.

### Authentication Middleware / Guard
The authentication mechanism should be implemented as a reusable NestJS request-level authentication component.

Its responsibilities are:

Read the session cookie.
Locate the session in the in-memory session store.
Check whether the session is expired.
Retrieve the corresponding user.
Verify the application user still exists and is active.
Refresh the session expiration time.
Attach the authenticated user to the request.
Allow the request to continue.
It must not:

Check user roles.
Check departments.
Check ticket ownership.
Check permissions.
Decide whether a requested resource can be accessed.
Those responsibilities belong to authorization, which is not implemented yet.

Authentication Flow
Initial Login
The complete login flow is:

1. User requests login with microsoft
        |
        v
2. Nexus redirects/initiates Microsoft Entra ID authentication
        |
        v
3. User authenticates with Microsoft
        |
        v
4. Microsoft returns authentication result
        |
        v
5. MicrosoftAuthStrategy validates the result
        |
        v
6. Strategy returns AuthenticatedIdentity
        |
        v
7. Authentication Module asks Users Module to resolve identity
        |
        +-----------------------------+
        |                             |
        | Existing user               | New user
        v                             v
8. Return existing user       8. Create Nexus user
        |                             |
        |                             v
        |                       has_logged = true
        |
        +-------------+---------------+
                      |
                      v
9. If existing user's has_logged = false:
                      |
                      v
              Set has_logged = true
                      |
                      v
10. Create session
                      |
                      v
11. Store session in memory
                      |
                      v
12. Set HTTP-only session cookie
                      |
                      v
13. Return authenticated response
Subsequent Request Flow
After login:

Browser
   |
   | HTTP request + nexus_session cookie
   v
Authentication Component
   |
   v
Read session ID
   |
   v
In-memory Session Store
   |
   v
Find session
   |
   +---- Missing/expired ---> Attach Null to the User property to the passed request
   |
   v
Get user ID
   |
   v
Users Module
   |
   v
Get user
   |
   +---- Missing/inactive ---> Reject request
   |
   v
Refresh session expiration
   |
   v
Attach user to request
   |
   v
Next application component
The application receives an already authenticated request.

### Logout
Nexus should provide a logout operation.

When the user logs out:

The session ID is obtained from the request.
The corresponding session is removed from the in-memory session store.
The session cookie is cleared/expired on the client.
Future requests using that session are rejected.
Logging out from one device must only invalidate that device's session.

For example:

Session A -> Laptop
Session B -> Mobile
Logging out from the laptop removes:

Session A
but leaves:

Session B
active.

The user must also be provided a way to log out from all devices in which all sessions related to the user account are removed on all devices.

### Authentication Module
The authentication module should be organized as its own NestJS module.

A proposed structure is:

src/
├── authentication/
│   ├── authentication.module.ts
│   ├── authentication.controller.ts
│   ├── authentication.service.ts
│   │
│   ├── strategies/
│   │   ├── authentication.strategy.ts
│   │   └── microsoft-auth.strategy.ts
│   │
│   ├── sessions/
│   │   ├── session.service.ts
│   │   ├── session.store.ts
│   │   └── session.entity.ts
│   │
│   ├── guards/
│   │   └── authentication.guard.ts
│   │
│   └── dto/
│       └── ...
│
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── repositories/
│   │   └── users.repository.ts

│
└── database/
    └── ...
The exact files can be adjusted if implementation details make a smaller structure more appropriate.

The important boundaries are:

Authentication
    |
    +-- Provider strategies
    +-- Session management
    +-- Request authentication

Users
    |
    +-- User information
    +-- User lookup
    +-- User provisioning
### Authentication Service Responsibilities
The Authentication service coordinates the authentication process.

It should:

Invoke the selected authentication strategy.
Resolve the application user through the Users module.
Provision a new user when necessary.
Update has_logged when appropriate.
Create a session.
Return authentication/session information.
It should not:

Perform database queries directly.
Implement user persistence itself.
Implement Microsoft-specific authentication logic.
Implement authorization.
Manage tickets.
Session Service Responsibilities
Session management should be isolated from authentication-provider logic.

The Session service should handle:

Session creation.
Session lookup.
Session expiration.
Session refresh.
Session deletion.
Session-to-user mapping.
Multiple simultaneous sessions.
The Session service should not know how the user authenticated.

For example, it should not contain:

if provider == microsoft
A session is created after successful authentication regardless of provider.

Authentication Strategy Responsibilities
Authentication strategies are responsible only for provider-specific authentication.

For Microsoft:

MicrosoftAuthStrategy
is responsible for:

Starting/handling Microsoft authentication.
Validating Microsoft authentication results.
Extracting the provider identity.
Returning the normalized AuthenticatedIdentity.
It must not:

Create Nexus users.
Create sessions.
Set application roles.
Check ticket permissions.
Access tickets.
Users Module Responsibilities
The Users module owns Nexus user data.

It should expose application-level operations such as:

findById()
findByIdentity()
findByEmail()
create()
markAsLoggedIn()
The exact API can be adjusted during implementation.

The Authentication module should communicate with Users through the Users module rather than directly accessing the Users repository/database.

Conceptually:

AuthenticationService
        |
        v
UsersService
        |
        v
UsersRepository
        |
        v
Database
This maintains separation between authentication orchestration and persistence.

### Database Requirements
The current in-memory database architecture is extended with authentication-related data.

The existing Users model should contain the fields already defined by the data model, including:

id
name
email
phone
role
has_logged
active
identity_provider_id
identity_provider_user_id
created_at
updated_at
The exact existing schema should be preserved unless implementation requires an explicit adjustment.

The Identity Providers data should contain:

id
code
name
enabled
created_at
updated_at

No database table should be used for sessions.

### In-Memory Session Storage
Sessions must not be stored in the application database.

The current implementation uses an in-memory session store.

Conceptually:

Map<SessionId, Session>
where:

Session
    sessionId
    userId
    device
    createdAt
    lastAccessedAt
    expiresAt
The session store should be owned by the Authentication module.

Because sessions are in memory, restarting the backend invalidates all active sessions.

This behavior is acceptable for the current implementation because persistent/distributed session storage is explicitly outside the current scope.

### Session Expiration Cleanup
Expired sessions should not remain indefinitely in memory.

The implementation should ensure expired sessions are eventually removed.

The cleanup mechanism may be implemented using a lightweight periodic background process.

However, session expiration must never depend solely on the cleanup process.

A request using an expired session must be rejected even if the expired session has not yet been physically removed from memory.

Therefore:

Session lookup
     |
     v
Is expiresAt <= now?
     |
     +---- Yes ---> Reject and remove
     |
     +---- No ----> Continue

## Implementation Process
The agent must follow this process: 

1- Read the specs first
Read:
- docs/product-specs.md
- docs/architecture.md
- docs/data-model.md

2- Inspect the existing codebase
Identify the current NestJS modules.
Find the existing Users model/repository.
Find the database setup.
Do not start coding until you understand the existing structure.

3- Make sure database schema matches the requirements:
Users
Column	Definition
user_id	PK
email	NOT NULL, UNIQUE
full_name	NOT NULL
phone_number	NULLABLE
role	ENUM(Employee, Agent, Admin), NOT NULL, DEFAULT 'Employee'
is_active	NOT NULL, DEFAULT true
has_logged	NOT NULL, BOOLEAN
identity_provider_id	FK → Identity_Providers.identity_provider_id, NOT NULL
identity_provider_user_id	NOT NULL
created_at	NOT NULL, DEFAULT CURRENT_TIMESTAMP
updated_at	NOT NULL, DEFAULT/ON UPDATE CURRENT_TIMESTAMP

Identity_Providers
Column	Definition
identity_provider_id	PK
code	NOT NULL
name	NOT NULL
active	NOT NULL, DEFAULT true
created_at	NOT NULL, DEFAULT CURRENT_TIMESTAMP

4- Implement the Users boundary
Create/adjust UsersModule.
UsersService owns user operations.
UsersRepository owns persistence.
Expose operations such as:
findById
findByIdentity
findByEmail
create
markAsLoggedIn
Authentication must interact with users through UsersService, not directly with the repository.

5- Create the provider-independent authentication abstraction
Define AuthenticationStrategy.
Define AuthenticatedIdentity.
The authentication module must never depend on Microsoft-specific user objects.
MicrosoftAuthStrategy converts Microsoft's response into AuthenticatedIdentity.

6- Implement MicrosoftAuthStrategy
Handle Microsoft Entra authentication.
Validate the authentication response/token.
Extract the normalized identity.
Keep all Microsoft-specific logic inside this strategy.
It must not create users or sessions.
If there are some fields that require Microsoft configurations, mark them and tell the developer to fill them

7- Implement user provisioning
Given AuthenticatedIdentity:
Look up by identity_provider_id + identity_provider_user_id.
If not found, determine whether an existing preconfigured user should be linked.
Otherwise create a user.
Ensure duplicate users aren't created.
Set has_logged = true.
Reject inactive users.

8- Implement the in-memory Session Service
Map<SessionId, Session>.
Session contains:
sessionId
userId
device
createdAt
lastAccessedAt
expiresAt
Generate cryptographically secure opaque session IDs.
Support multiple simultaneous sessions.
Sliding 7-day inactivity expiration.
Implement session cookies
Cookie contains only the opaque session ID.
HttpOnly
Secure
appropriate SameSite
Never put user ID, role, email, provider tokens, etc. in the cookie.

9- Implement the request authentication guard/middleware
The agent should implement the request pipeline as:

Request
   ↓
Authentication Guard
   ↓
Read nexus_session
   ↓
Find session
   ↓
Missing/expired?
   ├── YES → request.user = null → continue
   └── NO
         ↓
     Find user
         ↓
     Missing/inactive?
         ├── YES → reject
         └── NO
               ↓
          Refresh expiry
               ↓
       request.user = user
               ↓
            continue

Important: an absent/expired session is supposed to result in request.user = null, rather than automatically rejecting the request.

10- Implement logout
Delete the current session.
Clear the cookie.
Don't invalidate other devices.
Add logout-all-devices by deleting all sessions belonging to that user.
Implement expiration cleanup
Periodically remove expired sessions.
But never rely on cleanup for security.
Every session lookup must independently check expiresAt <= now.