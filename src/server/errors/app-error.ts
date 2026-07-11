/**
 * Typed application errors (Story 1.5) — the seven classes from
 * docs/architecture/api-service-design.md, with stable codes
 * (docs/architecture/coding-standards.md). Messages are safe for users:
 * never include stack traces, secrets, or sensitive record contents.
 */

export type AppErrorCode =
  | "VALIDATION"
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "LIFECYCLE"
  | "CONFLICT"
  | "NOT_FOUND"
  | "INFRASTRUCTURE";

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message = "The submitted data is not valid.") {
    super("VALIDATION", message);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "You need to sign in to continue.") {
    super("AUTHENTICATION", message);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "You don't have permission to do this.") {
    super("AUTHORIZATION", message);
  }
}

export class LifecycleError extends AppError {
  constructor(message = "This action isn't available in the record's current state.") {
    super("LIFECYCLE", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "This change conflicts with the current state. Refresh and try again.") {
    super("CONFLICT", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "We couldn't find that record.") {
    super("NOT_FOUND", message);
  }
}

export class InfrastructureError extends AppError {
  constructor(message = "Something went wrong on our side. Please try again.") {
    super("INFRASTRUCTURE", message);
  }
}
