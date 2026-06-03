/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TeamMembershipForm from "./TeamMembershipForm";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockFetch(status: number, body: unknown = {}) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

describe("TeamMembershipForm", () => {
  it("renders the submission form when there is no existing request", () => {
    render(<TeamMembershipForm locale="en" initialRequest={null} />);
    expect(screen.getByTestId("membership-form")).toBeTruthy();
    expect(screen.getByTestId("membership-submit")).toBeTruthy();
    expect(screen.getByLabelText(/Join date/i)).toBeTruthy();
  });

  it("disables leader_started_at until role=leader is selected", () => {
    render(<TeamMembershipForm locale="en" initialRequest={null} />);
    const leaderDate = screen.getByLabelText(/Leadership start date/i) as HTMLInputElement;
    expect(leaderDate.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Leader"));
    expect(leaderDate.disabled).toBe(false);
  });

  it("shows the success state after a 200 submit", async () => {
    mockFetch(200, { ok: true, status: "pending" });
    render(<TeamMembershipForm locale="en" initialRequest={null} />);
    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: "Jane Doe" } });
    fireEvent.change(screen.getByLabelText(/Join date/i), { target: { value: "2024-01-01" } });
    fireEvent.submit(screen.getByTestId("membership-form"));
    await waitFor(() => expect(screen.getByTestId("membership-success")).toBeTruthy());
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/arena/membership-request",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows an error and no success on a 5xx submit failure", async () => {
    mockFetch(500, { error: "boom" });
    render(<TeamMembershipForm locale="en" initialRequest={null} />);
    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: "Jane Doe" } });
    fireEvent.change(screen.getByLabelText(/Join date/i), { target: { value: "2024-01-01" } });
    fireEvent.submit(screen.getByTestId("membership-form"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.queryByTestId("membership-success")).toBeNull();
  });

  it("renders pending status (no form) when initialRequest is pending", () => {
    render(
      <TeamMembershipForm
        locale="en"
        initialRequest={{ job_function: "staff", joined_at: "2024-01-01", leader_started_at: null, status: "pending" }}
      />,
    );
    expect(screen.getByTestId("membership-status")).toBeTruthy();
    expect(screen.queryByTestId("membership-form")).toBeNull();
  });

  it("renders approved status with the approved date", () => {
    render(
      <TeamMembershipForm
        locale="en"
        initialRequest={{
          job_function: "leader",
          joined_at: "2024-01-01",
          leader_started_at: "2024-06-01",
          status: "approved",
          approved_at: "2026-05-20T00:00:00Z",
        }}
      />,
    );
    const status = screen.getByTestId("membership-status");
    expect(status).toBeTruthy();
    expect(status.textContent).toContain("Approved on");
  });
});
