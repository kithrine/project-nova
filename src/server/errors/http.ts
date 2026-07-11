import { NextResponse } from "next/server";

import { AppError, type AppErrorCode } from "@/server/errors/app-error";

/** Stable HTTP status mapping for typed errors. */
const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  VALIDATION: 400,
  AUTHENTICATION: 401,
  AUTHORIZATION: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  LIFECYCLE: 409,
  INFRASTRUCTURE: 500,
};

/**
 * Map an error to a safe JSON response for Route Handlers.
 * Unexpected errors are logged generically and surfaced as INFRASTRUCTURE —
 * never exposing stack traces or internals (coding-standards.md).
 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: STATUS_BY_CODE[error.code] },
    );
  }

  console.error("Unexpected error", error instanceof Error ? error.name : typeof error);
  return NextResponse.json(
    { error: { code: "INFRASTRUCTURE", message: "Something went wrong on our side." } },
    { status: 500 },
  );
}
