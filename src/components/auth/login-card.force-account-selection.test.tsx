/** @vitest-environment jsdom */
/**
 * LoginCard native account-switch (Slice 3.1B-3E). On the native Google path, the
 * account-switch entry (`forceAccountSelection` prop, set from `?switch=1`) must pass
 * `forceAccountSelection: true` to SocialLogin.login so the iOS chooser appears; a normal
 * login must NOT pass it (byte-unchanged). The nonce/idToken/Supabase/server/Keychain flow
 * is untouched either way.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signInWithIdToken = vi.fn().mockResolvedValue({
  data: { session: { access_token: "a", refresh_token: "r", expires_at: 1 } },
  error: null,
});
vi.mock("@/lib/supabase", () => ({
  supabase: {},
  getSupabase: () => ({ auth: { signInWithIdToken } }),
}));
vi.mock("@/lib/native/isNative", () => ({ isNative: () => true }));
vi.mock("@/lib/native/durableSession", () => ({ storeNativeSession: vi.fn(async () => {}) }));

import LoginCard from "./login-card";

const socialLogin = vi.fn().mockResolvedValue({ result: { idToken: "id-token" } });
const socialInit = vi.fn().mockResolvedValue(undefined);
const assign = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  socialLogin.mockResolvedValue({ result: { idToken: "id-token" } });
  (window as unknown as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
    Plugins: { SocialLogin: { initialize: socialInit, login: socialLogin } },
  };
  Object.defineProperty(window, "location", {
    value: { assign, pathname: "/en/app", search: "", hash: "", origin: "https://x" },
    writable: true,
  });
  global.fetch = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
});

describe("LoginCard native — forceAccountSelection", () => {
  it("switch entry passes forceAccountSelection:true to the native Google login", async () => {
    render(<LoginCard locale="en" nextPath="/en/app?tab=foundry" forceAccountSelection />);
    fireEvent.click(screen.getByText("Continue with Google"));
    await waitFor(() => expect(socialLogin).toHaveBeenCalled());
    const opts = socialLogin.mock.calls[0][0];
    expect(opts.provider).toBe("google");
    expect(opts.options.forceAccountSelection).toBe(true);
    // existing nonce flow preserved
    expect(typeof opts.options.nonce).toBe("string");
    expect(opts.options.forcePrompt).toBe(true);
  });

  it("normal login (no prop) does NOT pass forceAccountSelection", async () => {
    render(<LoginCard locale="en" nextPath="/en/app" />);
    fireEvent.click(screen.getByText("Continue with Google"));
    await waitFor(() => expect(socialLogin).toHaveBeenCalled());
    const opts = socialLogin.mock.calls[0][0];
    expect("forceAccountSelection" in opts.options).toBe(false);
    expect(opts.options.forcePrompt).toBe(true);
  });

  it("cancelled chooser (login rejects) does NOT navigate to the app (no false success)", async () => {
    socialLogin.mockRejectedValueOnce(new Error("user_cancelled"));
    render(<LoginCard locale="en" nextPath="/en/app?tab=foundry" forceAccountSelection />);
    fireEvent.click(screen.getByText("Continue with Google"));
    await waitFor(() => expect(socialLogin).toHaveBeenCalled());
    // no navigation to nextPath — the user stays on login, error surfaced
    expect(assign).not.toHaveBeenCalled();
  });
});
