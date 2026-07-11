import { randomUUID } from "node:crypto";

/**
 * Shared-nonproduction-database test isolation (Story 1.3; ADR-006).
 *
 * Local dev and preview share ONE nonproduction database, so tests must:
 *   - tag every row they create with a unique test-run identifier,
 *   - clean up ONLY rows carrying their own identifier,
 *   - never truncate tables or assume the database is empty.
 */

/** Unique, sortable-ish identifier for one test run. */
export function createTestRunId(prefix = "testrun"): string {
  return `${prefix}_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

/** Scope a human-readable name (org name, email local-part, ...) to a test run. */
export function testScopedName(testRunId: string, name: string): string {
  return `${name} [${testRunId}]`;
}
