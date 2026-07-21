/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";

const switchAccount = vi.fn(async (..._a: unknown[]) => ({ ok: true, failed: [] as string[] }));
const signOutAccount = vi.fn(async (..._a: unknown[]) => ({ ok: true, failed: [] as string[] }));
vi.mock("@/lib/native/accountSession", () => ({
  switchAccount: (...a: unknown[]) => switchAccount(...a),
  signOutAccount: (...a: unknown[]) => signOutAccount(...a),
}));

import AccountBlock from "./AccountBlock";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function mockSession(email: string | null) {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => (email ? { ok: true, user: { id: "u", email } } : { ok: false }),
  })) as unknown as typeof fetch;
}

describe("AccountBlock (Me tab canonical account surface)", () => {
  it("shows the authenticated email from the session endpoint", async () => {
    mockSession("ywamer2022@gmail.com");
    render(<AccountBlock locale="en" />);
    await waitFor(() => expect(screen.getByTestId("account-email").textContent).toBe("ywamer2022@gmail.com"));
    expect(screen.getByText("Use another account")).toBeTruthy();
    expect(screen.getByText("Sign out")).toBeTruthy();
  });

  it("'Use another account' calls the shared switchAccount(returnTab=foundry)", async () => {
    mockSession("ywamer2022@gmail.com");
    render(<AccountBlock locale="en" />);
    await waitFor(() => screen.getByTestId("account-email"));
    fireEvent.click(screen.getByText("Use another account"));
    await waitFor(() =>
      expect(switchAccount).toHaveBeenCalledWith({ locale: "en", returnTab: "foundry" }),
    );
    expect(signOutAccount).not.toHaveBeenCalled();
  });

  it("'Sign out' calls the shared signOutAccount (no Foundry return)", async () => {
    mockSession("ywamer2022@gmail.com");
    render(<AccountBlock locale="en" />);
    await waitFor(() => screen.getByTestId("account-email"));
    fireEvent.click(screen.getByText("Sign out"));
    await waitFor(() => expect(signOutAccount).toHaveBeenCalledWith({ locale: "en" }));
    expect(switchAccount).not.toHaveBeenCalled();
  });

  it("surfaces an actionable, privacy-safe error on a partial (failed) teardown", async () => {
    mockSession("ywamer2022@gmail.com");
    switchAccount.mockResolvedValueOnce({ ok: false, failed: ["server"] });
    render(<AccountBlock locale="en" />);
    await waitFor(() => screen.getByTestId("account-email"));
    fireEvent.click(screen.getByText("Use another account"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    // no token / provider / id leaked
    expect(screen.getByRole("alert").textContent).not.toMatch(/token|server|google|d0b1af49/i);
  });
});
