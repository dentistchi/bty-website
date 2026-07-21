/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Shared account-session action (Slice 3.1B-3E). Proves ONE implementation drives both
 * surfaces: the native teardown order (provider → keychain → server), the return-to-Foundry
 * switch hand-off with switch=1, sign-out landing on plain login, and honest partial-failure
 * handling (a failed SERVER logout does NOT navigate and reports ok:false).
 */

const isNative = vi.fn(() => false);
const clearNativeSession = vi.fn(async () => {});
vi.mock("./isNative", () => ({ isNative: () => isNative() }));
vi.mock("./durableSession", () => ({ clearNativeSession: () => clearNativeSession() }));

import { switchAccount, signOutAccount, tearDownAccountSession } from "./accountSession";

const assign = vi.fn();
const socialLogout = vi.fn(async () => {});
const socialInit = vi.fn(async () => {});
let fetchOk = true;

beforeEach(() => {
  vi.clearAllMocks();
  isNative.mockReturnValue(false);
  fetchOk = true;
  // window.location.assign — jsdom's is a noop that warns; replace with a spy.
  Object.defineProperty(window, "location", {
    value: { assign, pathname: "/en/app", search: "", hash: "" },
    writable: true,
  });
  (window as unknown as { Capacitor?: unknown }).Capacitor = {
    Plugins: { SocialLogin: { initialize: socialInit, logout: socialLogout } },
  };
  global.fetch = vi.fn(async () => ({ ok: fetchOk })) as unknown as typeof fetch;
});

afterEach(() => {
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
});

describe("tearDownAccountSession", () => {
  it("web: clears keychain + server, no provider logout", async () => {
    const failed = await tearDownAccountSession();
    expect(clearNativeSession).toHaveBeenCalledOnce();
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST" }));
    expect(socialLogout).not.toHaveBeenCalled();
    expect(failed).toEqual([]);
  });

  it("native: calls SocialLogin.logout(provider=google) + keychain + server", async () => {
    isNative.mockReturnValue(true);
    const failed = await tearDownAccountSession();
    expect(socialInit).toHaveBeenCalledWith({ google: expect.objectContaining({ mode: "online" }) });
    expect(socialLogout).toHaveBeenCalledWith({ provider: "google" });
    expect(clearNativeSession).toHaveBeenCalledOnce();
    expect(failed).toEqual([]);
  });

  it("records a provider failure without throwing (non-fatal layer)", async () => {
    isNative.mockReturnValue(true);
    socialLogout.mockRejectedValueOnce(new Error("boom"));
    const failed = await tearDownAccountSession();
    expect(failed).toContain("provider");
    // keychain + server still attempted
    expect(clearNativeSession).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalled();
  });
});

describe("switchAccount", () => {
  it("navigates to login with next=/{locale}/app?tab=foundry and switch=1", async () => {
    const r = await switchAccount({ locale: "en", returnTab: "foundry" });
    expect(r.ok).toBe(true);
    expect(assign).toHaveBeenCalledOnce();
    const url = assign.mock.calls[0][0] as string;
    expect(url).toContain("/en/bty/login?next=");
    expect(url).toContain(encodeURIComponent("/en/app?tab=foundry"));
    expect(url).toContain("switch=1");
  });

  it("full-page navigation (assign, not SPA state) → prior in-memory state cannot persist", async () => {
    await switchAccount({ locale: "ko" });
    expect(assign).toHaveBeenCalledOnce();
    expect((assign.mock.calls[0][0] as string).startsWith("/ko/bty/login")).toBe(true);
  });

  it("HONEST partial failure: a failed SERVER logout does NOT navigate and returns ok:false", async () => {
    fetchOk = false;
    const r = await switchAccount({ locale: "en" });
    expect(r.ok).toBe(false);
    expect(r.failed).toContain("server");
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("signOutAccount", () => {
  it("lands on plain login (no next, no switch, no Foundry auto-return)", async () => {
    const r = await signOutAccount({ locale: "en" });
    expect(r.ok).toBe(true);
    expect(assign).toHaveBeenCalledWith("/en/bty/login");
    const url = assign.mock.calls[0][0] as string;
    expect(url).not.toContain("next=");
    expect(url).not.toContain("switch=");
  });

  it("server-logout failure does not navigate + reports ok:false", async () => {
    fetchOk = false;
    const r = await signOutAccount({ locale: "en" });
    expect(r.ok).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
});
