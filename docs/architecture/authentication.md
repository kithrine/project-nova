# Authentication

## Provider

Clerk handles:

- Sign-in
- Sessions
- Email verification
- Account security
- User provisioning events

## Internal user record

A Clerk user ID maps to a Project Nova `User`.

Clerk authentication does not determine application authorization.

## Provisioning

A verified Clerk webhook:

- Creates or updates the internal user
- Stores the Clerk user ID
- Never trusts unsigned webhook payloads
- Uses idempotent event processing

## Protected routes

- Participant routes require linked participant identity where applicable.
- Shelter routes require active shelter membership.
- Operations routes require Nova membership and permissions.
