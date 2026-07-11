import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NextRequest } from "next/server";

const verifyWebhook = vi.hoisted(() => vi.fn());
const provisionClerkUser = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs/webhooks", () => ({ verifyWebhook }));
vi.mock("@/server/services/user-provisioning", async (importOriginal) => {
  const actual = await importOriginal<object>();
  return { ...actual, provisionClerkUser };
});

import { POST } from "./route";

const request = {} as NextRequest;

const userCreatedEvent = {
  type: "user.created",
  data: {
    id: "user_clerk_e2e",
    email_addresses: [{ id: "em_1", email_address: "new@example.com" }],
    primary_email_address_id: "em_1",
    first_name: "New",
    last_name: "User",
  },
};

describe("Clerk webhook handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unsigned/invalid payload and writes nothing", async () => {
    verifyWebhook.mockRejectedValueOnce(new Error("bad signature"));

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(provisionClerkUser).not.toHaveBeenCalled();
  });

  it("provisions the user for a verified user.created event", async () => {
    verifyWebhook.mockResolvedValueOnce(userCreatedEvent);
    provisionClerkUser.mockResolvedValueOnce({ userId: "u1", created: true });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(provisionClerkUser).toHaveBeenCalledTimes(1);
    expect(provisionClerkUser).toHaveBeenCalledWith({
      clerkUserId: "user_clerk_e2e",
      email: "new@example.com",
      displayName: "New User",
    });
  });

  it("updates on user.updated events", async () => {
    verifyWebhook.mockResolvedValueOnce({ ...userCreatedEvent, type: "user.updated" });
    provisionClerkUser.mockResolvedValueOnce({ userId: "u1", created: false });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(provisionClerkUser).toHaveBeenCalledTimes(1);
  });

  it("acknowledges but ignores unrelated event types", async () => {
    verifyWebhook.mockResolvedValueOnce({ type: "session.created", data: {} });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(provisionClerkUser).not.toHaveBeenCalled();
  });
});
