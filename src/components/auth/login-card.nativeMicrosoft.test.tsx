/** @vitest-environment jsdom */
/**
 * M1-R1 — NATIVE Microsoft OAuth launch.
 *
 * The device symptom was a permanent "연결 중…" spinner. The cause was not an error: it was
 * SUCCESS with nothing done. `skipBrowserRedirect: isNative()` told Supabase not to navigate, the
 * returned `{ url }` was never read, and no branch cleared the busy state.
 *
 * These tests pin the two halves that were missing — the launch, and the failure exit — so the
 * stall cannot come back silently.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSignInWithOAuth = vi.fn();
vi.mock("@/lib/supabase", () => ({
  supabase: {},
  getSupabase: () => ({ auth: { signInWithOAuth: mockSignInWithOAuth } }),
}));

const mockIsNative = vi.fn(() => false);
vi.mock("@/lib/native/isNative", () => ({ isNative: () => mockIsNative() }));

import LoginCard from "./login-card";

const assign = vi.fn();

beforeEach(() => {
  process.env.NEXT_PUBLIC_BTY_AUTH_PROVIDERS = "google,microsoft";
  mockSignInWithOAuth.mockReset();
  assign.mockReset();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, assign, origin: "https://bty.test" },
  });
});
afterEach(() => {
  cleanup();
  mockIsNative.mockReturnValue(false);
  delete process.env.NEXT_PUBLIC_BTY_AUTH_PROVIDERS;
});

describe("Native Microsoft OAuth", () => {
  it("NATIVE: the returned authorize URL is actually opened (the stall fix)", async () => {
    mockIsNative.mockReturnValue(true);
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: "https://login.microsoftonline.com/t/oauth2/v2.0/authorize?x=1" },
      error: null,
    });
    render(<LoginCard locale="en" nextPath="/en/app" />);
    fireEvent.click(screen.getByText("Continue with Microsoft"));

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalled();
      const arg = mockSignInWithOAuth.mock.calls[0][0] as {
        provider: string;
        options?: { skipBrowserRedirect?: boolean; scopes?: string };
      };
      expect(arg.provider).toBe("azure");
      expect(arg.options?.skipBrowserRedirect, "native suppresses Supabase's own nav").toBe(true);
      expect(arg.options?.scopes).toBe("openid profile email");
      // THE REPAIR: something must open it.
      expect(assign).toHaveBeenCalledWith("https://login.microsoftonline.com/t/oauth2/v2.0/authorize?x=1");
    });
  });

  it("NATIVE: no url and no error clears the busy state instead of spinning forever", async () => {
    mockIsNative.mockReturnValue(true);
    mockSignInWithOAuth.mockResolvedValue({ data: { url: null }, error: null });
    render(<LoginCard locale="en" nextPath="/en/app" />);
    fireEvent.click(screen.getByText("Continue with Microsoft"));

    await waitFor(() => {
      expect(assign, "nothing to open").not.toHaveBeenCalled();
      // The button is interactive again — the person can retry rather than stare at a spinner.
      const btn = screen.getByText("Continue with Microsoft").closest("button");
      expect(btn?.getAttribute("aria-busy")).not.toBe("true");
    });
  });

  it("WEB: unchanged — Supabase navigates itself, we do not double-navigate", async () => {
    mockIsNative.mockReturnValue(false);
    mockSignInWithOAuth.mockResolvedValue({ data: { url: null }, error: null });
    render(<LoginCard locale="en" nextPath="/en/app" />);
    fireEvent.click(screen.getByText("Continue with Microsoft"));

    await waitFor(() => {
      const arg = mockSignInWithOAuth.mock.calls[0][0] as { options?: { skipBrowserRedirect?: boolean } };
      expect(arg.options?.skipBrowserRedirect, "web lets Supabase redirect in-page").toBe(false);
      expect(assign).not.toHaveBeenCalled();
    });
  });

  it("Google native still returns early through its own SDK path — untouched", async () => {
    mockIsNative.mockReturnValue(true);
    render(<LoginCard locale="en" nextPath="/en/app" />);
    fireEvent.click(screen.getByText("Continue with Google"));
    await waitFor(() => {
      // Google native never reaches signInWithOAuth; it uses the SocialLogin bridge.
      expect(mockSignInWithOAuth).not.toHaveBeenCalled();
    });
  });
});
