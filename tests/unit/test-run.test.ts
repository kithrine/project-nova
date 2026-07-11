import { describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

describe("createTestRunId", () => {
  it("produces unique identifiers across many calls", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => createTestRunId()));
    expect(ids.size).toBe(1000);
  });

  it("uses the given prefix", () => {
    expect(createTestRunId("integration")).toMatch(/^integration_/);
  });
});

describe("testScopedName", () => {
  it("embeds the run id so cleanup can target only this run's rows", () => {
    const runId = createTestRunId();
    const name = testScopedName(runId, "Sunny Paws Shelter");
    expect(name).toContain("Sunny Paws Shelter");
    expect(name).toContain(runId);
  });
});
