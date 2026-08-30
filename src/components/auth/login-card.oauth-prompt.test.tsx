/** @vitest-environment jsdom */
/**
 * LoginCard OAuth init.
 *
 * R4-R4B-R2 INVERTED THE FIRST TWO ASSERTIONS, and they are inverted rather than deleted so the
 * record of what changed survives (the R4-R2E-R2 precedent).
 *
 * They pinned #20: `prompt="select_account"` on EVERY sign-in, so an active SSO session could not
 * silently re-authenticate "immediately after logout". The concern was real and is still served —
 * but the guard was applied universally, so every RETURNING user was pushed through a full
 * interactive account chooser and Google emailed them "You shared some Google Account data with
 * BTY" each time. That is the defect this slice removes.
 *
 * The chooser now belongs to the state it was written for: an EXPLICIT switch (`?switch=1` →
 * `forceAccountSelection`). Normal sign-in sends no `queryParams`. Logout safety is unchanged,
 * because `accountSession.signOutAccount` still tears down every session layer and routes to
 * `?switch=1`, which still forces the chooser.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockSignInWithOAuth = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase", () => ({
  // truthy `supabase` → LoginCard treats auth as configured
  supabase: {},
  getSupabase: () => ({ auth: { signInWithOAuth: mockSignInWithOAuth } }),
}));

import LoginCard from "./login-card";

afterEach(() => {
  cleanup();
  mockSignInWithOAuth.mockClear();
  delete process.env.NEXT_PUBLIC_BTY_AUTH_PROVIDERS;
});

describe("LoginCard — OAuth prompt", () => {
  it("normal Continue with Google does NOT force the chooser (and Google is the only provider by default)", async () => {
    render(<LoginCard locale="en" nextPath="/en/bty" />);
    // Default (no env): Google only — Microsoft + Phone hidden.
    expect(screen.queryByText("Continue with Microsoft")).toBeNull();
    expect(screen.queryByText("Continue with Phone")).toBeNull();
    fireEvent.click(screen.getByText("Continue with Google"));
    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "google" })
      );
    });
    const options = mockSignInWithOAuth.mock.calls[0]![0].options;
    // The whole point: a returning user is not pushed through an account chooser.
    expect(options.queryParams).toBeUndefined();
  });

  it("an EXPLICIT switch DOES force the chooser", async () => {
    render(<LoginCard locale="en" nextPath="/en/bty" forceAccountSelection />);
    fireEvent.click(screen.getByText("Continue with Google"));
    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "google",
          options: expect.objectContaining({ queryParams: { prompt: "select_account" } }),
        })
      );
    });
  });

  it("with NEXT_PUBLIC_BTY_AUTH_PROVIDERS='google,microsoft': Microsoft (azure) visible, and follows the SAME rule", async () => {
    process.env.NEXT_PUBLIC_BTY_AUTH_PROVIDERS = "google,microsoft";
    render(<LoginCard locale="en" nextPath="/en/bty" />);
    fireEvent.click(screen.getByText("Continue with Microsoft"));
    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: "azure" }));
    });
    // One rule for every provider — the chooser is for switching, not for signing in.
    expect(mockSignInWithOAuth.mock.calls[0]![0].options.queryParams).toBeUndefined();
  });

  it("with NEXT_PUBLIC_BTY_AUTH_PROVIDERS='phone': Phone OTP entry visible, Google hidden", () => {
    process.env.NEXT_PUBLIC_BTY_AUTH_PROVIDERS = "phone";
    render(<LoginCard locale="en" nextPath="/en/bty" />);
    expect(screen.getByText("Continue with Phone")).toBeTruthy();
    expect(screen.queryByText("Continue with Google")).toBeNull();
  });
});

/**
 * MICROSOFT-FIRST CUTOVER (Slice R1C-B-2R / M1).
 *
 * BTY's canonical identity is the Entra pair (tid, oid). Microsoft states the `profile` scope is
 * REQUIRED to receive `oid`. Before this slice the call passed no scopes at all, so `oid` would
 * never arrive and every future Teams lookup would resolve to NOT_LINKED — with no error anywhere
 * to notice. These assertions exist so that failure can never be reintroduced silently.
 */
describe("LoginCard — Microsoft scopes", () => {
  it("Continue with Microsoft requests openid profile email", async () => {
    process.env.NEXT_PUBLIC_BTY_AUTH_PROVIDERS = "google,microsoft";
    render(<LoginCard locale="en" nextPath="/en/bty" />);
    fireEvent.click(screen.getByText("Continue with Microsoft"));
    await waitFor(() => {
      const arg = mockSignInWithOAuth.mock.calls[0][0] as {
        provider: string;
        options?: { scopes?: string };
      };
      expect(arg.provider).toBe("azure");
      expect(arg.options?.scopes ?? "").toContain("profile");
      expect(arg.options?.scopes).toBe("openid profile email");
    });
  });

  it("Google is UNTOUCHED — it must not inherit Microsoft scopes", async () => {
    process.env.NEXT_PUBLIC_BTY_AUTH_PROVIDERS = "google,microsoft";
    render(<LoginCard locale="en" nextPath="/en/bty" />);
    fireEvent.click(screen.getByText("Continue with Google"));
    await waitFor(() => {
      const arg = mockSignInWithOAuth.mock.calls[0][0] as {
        provider: string;
        options?: { scopes?: string };
      };
      expect(arg.provider).toBe("google");
      expect(arg.options?.scopes, "Google carries no scopes override").toBeUndefined();
    });
  });
});
