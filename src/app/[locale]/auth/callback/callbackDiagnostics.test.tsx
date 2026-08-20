/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";

/**
 * R4-R4B-R1 — ONE FAILED SIGN-IN MUST NAME ITS OWN BRANCH.
 *
 * `/[locale]/auth/callback` had three distinct failures rendering one identical sentence, so the
 * Founder's report of "인증 처리에 실패했습니다" could not say which fired and the audit could only
 * rank hypotheses. The Supabase redirect allow-list has since been verified present for both
 * origins — which REMOVES the leading hypothesis for `no_code` and leaves the diagnostic as the
 * only way to learn anything from the next failure.
 *
 * These do not repair the web login. Nothing here should: the cause is still unproven, and this
 * slice deliberately instruments rather than guesses.
 */

const CB = "src/app/[locale]/auth/callback/page.client.tsx";
let search = "";
let hash = "";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/auth/callback",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const exchangeCodeForSession = vi.fn();
const setSession = vi.fn();
const getSession = vi.fn();
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: (...a: unknown[]) => exchangeCodeForSession(...a),
      setSession: (...a: unknown[]) => setSession(...a),
      getSession: (...a: unknown[]) => getSession(...a),
    },
  },
}));
vi.mock("@/lib/native/isNative", () => ({ isNative: () => false }));
vi.mock("@/lib/native/accountScopedStorage", () => ({ clearAccountScopedStorage: vi.fn() }));

import AuthCallbackPage from "./page.client";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  search = "";
  hash = "";
});

/** The page navigates on success; jsdom would throw on a real assign, so it is stubbed. */
function stubAssign() {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { pathname: "/en/auth/callback", search, hash, assign: vi.fn(), href: "" },
  });
}

const reasonText = () => screen.queryByTestId("auth-callback-reason")?.textContent ?? null;

describe("R4-R4B-R1 · 11/12/13 · each branch reports itself", () => {
  it("11 — no code, no tokens, no session → no_code", async () => {
    stubAssign();
    getSession.mockResolvedValue({ data: { session: null } });
    render(<AuthCallbackPage />);
    await waitFor(() => expect(reasonText()).toBeTruthy());
    expect(reasonText()).toBe("Reference: no_code");
  });

  it("12 — a code that the exchange refuses → exchange_failed", async () => {
    search = "code=abc123";
    stubAssign();
    exchangeCodeForSession.mockResolvedValue({ error: new Error("pkce mismatch") });
    getSession.mockResolvedValue({ data: { session: null } });
    render(<AuthCallbackPage />);
    await waitFor(() => expect(reasonText()).toBeTruthy());
    expect(reasonText()).toBe("Reference: exchange_failed");
  });

  it("13 — a token pair that setSession refuses → set_session_failed", async () => {
    search = "access_token=at&refresh_token=rt";
    stubAssign();
    setSession.mockResolvedValue({ error: new Error("bad token") });
    getSession.mockResolvedValue({ data: { session: null } });
    render(<AuthCallbackPage />);
    await waitFor(() => expect(reasonText()).toBeTruthy());
    expect(reasonText()).toBe("Reference: set_session_failed");
  });
});

describe("R4-R4B-R1 · 14/15 · success carries no diagnostic", () => {
  it("14 — a successful exchange shows no error and no reason", async () => {
    search = "code=good";
    stubAssign();
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getSession.mockResolvedValue({ data: { session: { user: { id: "u1" }, access_token: "a", refresh_token: "r" } } });
    render(<AuthCallbackPage />);
    await waitFor(() => expect(window.location.assign).toHaveBeenCalled());
    expect(reasonText()).toBeNull();
    expect(screen.queryByText(/인증 처리에 실패했습니다/)).toBeNull();
  });

  it("15 — a RECOVERED session after a failed exchange is not reported as an error", async () => {
    search = "code=stale";
    stubAssign();
    exchangeCodeForSession.mockResolvedValue({ error: new Error("already used") });
    // The client already holds a valid session — the person is signed in despite the exchange.
    getSession.mockResolvedValue({ data: { session: { user: { id: "u1" }, access_token: "a", refresh_token: "r" } } });
    render(<AuthCallbackPage />);
    await waitFor(() => expect(window.location.assign).toHaveBeenCalled());
    expect(reasonText()).toBeNull();
  });
});

describe("R4-R4B-R1 · 16 · the diagnostic leaks nothing", () => {
  it("no code, token, id or email can reach the rendered reason", async () => {
    search = "code=SECRET-AUTH-CODE&next=%2Fen%2Fapp";
    stubAssign();
    exchangeCodeForSession.mockResolvedValue({ error: new Error("boom SECRET-AUTH-CODE") });
    getSession.mockResolvedValue({ data: { session: null } });
    render(<AuthCallbackPage />);
    await waitFor(() => expect(reasonText()).toBeTruthy());
    const body = document.body.textContent ?? "";
    expect(body).not.toContain("SECRET-AUTH-CODE");
    expect(body).not.toMatch(/access_token|refresh_token|eyJ|@/);
  });

  it("the source renders ONLY the closed reason set — never a raw error", () => {
    const src = readFileSync(CB, "utf8");
    expect(src).toContain("authCallbackSupportLine(reason)");
    // The provider's own message must never be surfaced.
    expect(src).not.toMatch(/\{error\.message\}|\{String\(error\)\}|\{e\.message\}/);
  });

  it("the primary product copy is unchanged", () => {
    const src = readFileSync(CB, "utf8");
    expect((src.match(/인증 처리에 실패했습니다\. 다시 시도해주세요\./g) ?? []).length).toBe(3);
  });
});
