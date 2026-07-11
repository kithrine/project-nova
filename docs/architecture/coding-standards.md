# Coding Standards

## TypeScript

- Strict mode
- No unexplained `any`
- Explicit domain types
- Zod validation at server boundaries
- Stable error codes

## React and Next.js

- Server Components by default
- Client Components only for browser interaction
- Keep components focused
- No Prisma in components
- No domain rules in actions

## Naming

- Components: PascalCase
- Functions and variables: camelCase
- Files: kebab-case
- Permission codes: `resource.action`
- Database enums: SCREAMING_SNAKE_CASE

## Errors

- Expected errors return typed results
- Unexpected errors are logged and surfaced through boundaries
- Never expose stack traces or secrets

## Logging

Use structured IDs and request IDs. Never log sensitive record contents.
