/** @vitest-environment jsdom */
/**
 * LoginCard OAuth init — #20 fix. signInWithOAuth must pass
 * queryParams.prompt="select_account" so an active Google/Microsoft SSO session
 * cannot silently re-authenticate the user immediately after logout.
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
  it("Continue with Google passes prompt=select_account (and is the only provider by default)", async () => {
    render(<LoginCard locale="en" nextPath="/en/bty" />);
    // Default (no env): Google only — Microsoft + Phone hidden.
    expect(screen.queryByText("Continue with Microsoft")).toBeNull();
    expect(screen.queryByText("Continue with Phone")).toBeNull();
    fireEvent.click(screen.getByText("Continue with Google"));
    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "google",
          options: expect.objectContaining({
            queryParams: { prompt: "select_account" },
          }),
        })
      );
    });
  });

  it("with NEXT_PUBLIC_BTY_AUTH_PROVIDERS='google,microsoft': Microsoft (azure) visible + forces the account chooser", async () => {
    process.env.NEXT_PUBLIC_BTY_AUTH_PROVIDERS = "google,microsoft";
    render(<LoginCard locale="en" nextPath="/en/bty" />);
    fireEvent.click(screen.getByText("Continue with Microsoft"));
    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "azure",
          options: expect.objectContaining({
            queryParams: { prompt: "select_account" },
          }),
        })
      );
    });
  });

  it("with NEXT_PUBLIC_BTY_AUTH_PROVIDERS='phone': Phone OTP entry visible, Google hidden", () => {
    process.env.NEXT_PUBLIC_BTY_AUTH_PROVIDERS = "phone";
    render(<LoginCard locale="en" nextPath="/en/bty" />);
    expect(screen.getByText("Continue with Phone")).toBeTruthy();
    expect(screen.queryByText("Continue with Google")).toBeNull();
  });
});
