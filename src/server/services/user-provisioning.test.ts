import { describe, expect, it } from "vitest";

import { mapClerkUserPayload, type ClerkUserPayload } from "./user-provisioning";

const basePayload: ClerkUserPayload = {
  id: "user_clerk_123",
  email_addresses: [
    { id: "em_2", email_address: "Second@Example.com" },
    { id: "em_1", email_address: "Primary@Example.com" },
  ],
  primary_email_address_id: "em_1",
  first_name: "Ada",
  last_name: "Lovelace",
};

describe("mapClerkUserPayload", () => {
  it("selects the primary email address and lowercases it", () => {
    const mapped = mapClerkUserPayload(basePayload);
    expect(mapped).toEqual({
      clerkUserId: "user_clerk_123",
      email: "primary@example.com",
      displayName: "Ada Lovelace",
    });
  });

  it("falls back to the first email when no primary id matches", () => {
    const mapped = mapClerkUserPayload({ ...basePayload, primary_email_address_id: null });
    expect(mapped?.email).toBe("second@example.com");
  });

  it("falls back to the email local part when names are missing", () => {
    const mapped = mapClerkUserPayload({
      ...basePayload,
      first_name: null,
      last_name: null,
    });
    expect(mapped?.displayName).toBe("Primary");
  });

  it("uses a partial name when only one name field exists", () => {
    const mapped = mapClerkUserPayload({ ...basePayload, last_name: null });
    expect(mapped?.displayName).toBe("Ada");
  });

  it("returns null when the payload has no email addresses", () => {
    const mapped = mapClerkUserPayload({ ...basePayload, email_addresses: [] });
    expect(mapped).toBeNull();
  });
});
