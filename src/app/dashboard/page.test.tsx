import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: vi.fn().mockResolvedValue({
    primaryEmailAddress: { emailAddress: "participant@synthetic.example" },
  }),
}));

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <button type="button">Account</button>,
}));

import DashboardPage from "./page";

describe("DashboardPage (authenticated placeholder)", () => {
  it("renders the signed-in state with the user's email", async () => {
    render(await DashboardPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "You're signed in" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("user-email")).toHaveTextContent(
      "participant@synthetic.example",
    );
  });
});
