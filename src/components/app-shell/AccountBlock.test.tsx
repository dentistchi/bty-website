/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";

// Slice 3.1B-3N-5B.1: Switch launches the Google chooser DIRECTLY (no teardown-first, no login card).
const startGoogleOAuth = vi.fn(async (..._a: unknown[]) => ({ status: "redirecting" as const }));
const signOutAccount = vi.fn(async (..._a: unknown[]) => ({ ok: true, failed: [] as string[] }));
vi.mock("@/lib/native/googleOAuth", () => ({ startGoogleOAuth: (...a: unknown[]) => startGoogleOAuth(...a) }));
vi.mock("@/lib/native/accountSession", () => ({ signOutAccount: (...a: unknown[]) => signOutAccount(...a) }));

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
  it("(15) shows the authenticated email + 'Switch account' + 'Sign out'", async () => {
    mockSession("ywamer2022@gmail.com");
    render(<AccountBlock locale="en" />);
    await waitFor(() => expect(screen.getByTestId("account-email").textContent).toBe("ywamer2022@gmail.com"));
    expect(screen.getByText("Switch account")).toBeTruthy();
    expect(screen.getByText("Sign out")).toBeTruthy();
  });

  it("(3)(4)(11) 'Switch account' launches the provider chooser directly, next=Today, force-chooser", async () => {
    mockSession("ywamer2022@gmail.com");
    render(<AccountBlock locale="en" />);
    await waitFor(() => screen.getByTestId("account-email"));
    fireEvent.click(screen.getByTestId("account-switch"));
    await waitFor(() =>
      expect(startGoogleOAuth).toHaveBeenCalledWith({
        locale: "en",
        nextPath: "/en/app?tab=today",
        forceAccountSelection: true,
      }),
    );
    expect(signOutAccount).not.toHaveBeenCalled();
  });

  it("(13) 'Sign out' still calls the shared signOutAccount (unchanged)", async () => {
    mockSession("ywamer2022@gmail.com");
    render(<AccountBlock locale="en" />);
    await waitFor(() => screen.getByTestId("account-email"));
    fireEvent.click(screen.getByTestId("account-signout"));
    await waitFor(() => expect(signOutAccount).toHaveBeenCalledWith({ locale: "en" }));
    expect(startGoogleOAuth).not.toHaveBeenCalled();
  });

  it("(5)(6) a non-redirecting result keeps the user here with a privacy-safe error", async () => {
    mockSession("ywamer2022@gmail.com");
    startGoogleOAuth.mockResolvedValueOnce({ status: "error", detail: "provider-cancelled" } as never);
    render(<AccountBlock locale="en" />);
    await waitFor(() => screen.getByTestId("account-email"));
    fireEvent.click(screen.getByTestId("account-switch"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).not.toMatch(/token|provider|google|cancelled/i);
  });

  it("(16) a rapid double-tap starts only ONE switch", async () => {
    mockSession("ywamer2022@gmail.com");
    // never resolve → stays in-flight so the second tap must be ignored
    startGoogleOAuth.mockImplementationOnce(() => new Promise(() => {}));
    render(<AccountBlock locale="en" />);
    await waitFor(() => screen.getByTestId("account-email"));
    const btn = screen.getByTestId("account-switch");
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId("switching-overlay")).toBeTruthy());
    expect(startGoogleOAuth).toHaveBeenCalledTimes(1);
  });
});
