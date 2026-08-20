import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * R4-R4B-R2 — A RETURNING USER MUST NOT BE SENT BACK TO GOOGLE.
 *
 * `middleware.ts` gates on the httpOnly server cookie and nothing else. The browser meanwhile holds
 * a live Supabase session (`persistSession` + `autoRefreshToken`) that the web path never consulted:
 * the restore effect on the login landing was `isNative()`-gated. So a lapsed cookie sent people to
 * Google even though they held a perfectly good session — and every one of those trips produced
 * another "You shared some Google Account data with BTY" email.
 *
 * The rule these pin: A MISSING SERVER COOKIE IS NOT NO SESSION. Middleware is not weakened — it
 * still trusts only the cookie — but the cookie can now be re-seated from a session the user
 * genuinely holds, through the bridge that already existed.
 */

const getSession = vi.fn();
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: (...a: unknown[]) => getSession(...a) } } }));

import { restoreWebSession } from "./webSessionRestore";

const VALID = {
  data: { session: { access_token: "AT-REDACTED", refresh_token: "RT-REDACTED", user: { id: "u1" } } },
  error: null,
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("R4-R4B-R2 · 1/12 · a live browser session re-seats the cookie", () => {
  it("1 — posts the existing tokens to the EXISTING bridge and reports restored", async () => {
    getSession.mockResolvedValue(VALID);
    await expect(restoreWebSession()).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/auth/session");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).credentials).toBe("include");
  });

  it("12 — no new endpoint, no new store: the bridge is the only thing called", async () => {
    getSession.mockResolvedValue(VALID);
    await restoreWebSession();
    for (const [url] of fetchMock.mock.calls) expect(url).toBe("/api/auth/session");
  });

  it("only the SERVER's confirmation counts as restored", async () => {
    getSession.mockResolvedValue(VALID);
    // 200 but the route says it did not seat the cookie.
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: false }) });
    await expect(restoreWebSession()).resolves.toBe(false);
  });

  it("an HTTP failure is not a restore", async () => {
    getSession.mockResolvedValue(VALID);
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: true }) });
    await expect(restoreWebSession()).resolves.toBe(false);
  });
});

describe("R4-R4B-R2 · 2/3 · no usable session falls through to sign-in", () => {
  it("2 — no session at all → false, and the bridge is never called", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(restoreWebSession()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("3 — a session missing either token is not usable", async () => {
    for (const session of [
      { access_token: "AT", refresh_token: "" },
      { access_token: "", refresh_token: "RT" },
      {},
    ]) {
      getSession.mockResolvedValue({ data: { session }, error: null });
      await expect(restoreWebSession()).resolves.toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("3 — a getSession error falls through rather than throwing into the launch", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: new Error("refresh failed") });
    await expect(restoreWebSession()).resolves.toBe(false);
  });
});

describe("R4-R4B-R2 · 13/14 · it cannot hang and cannot loop", () => {
  it("13 — a stalled session read settles to false once the bound expires", async () => {
    vi.useFakeTimers();
    getSession.mockImplementation(() => new Promise(() => {}));
    const p = restoreWebSession();
    await vi.advanceTimersByTimeAsync(13_000);
    // "We could not restore" — never "you are signed out".
    await expect(p).resolves.toBe(false);
  });

  it("13 — a stalled bridge POST also settles to false", async () => {
    vi.useFakeTimers();
    getSession.mockResolvedValue(VALID);
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const p = restoreWebSession();
    await vi.advanceTimersByTimeAsync(13_000);
    await expect(p).resolves.toBe(false);
  });

  it("14 — one attempt only: it never retries itself", async () => {
    getSession.mockResolvedValue(VALID);
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false }) });
    await restoreWebSession();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getSession).toHaveBeenCalledTimes(1);
  });
});

describe("R4-R4B-R2 · 10/11 · it establishes nothing of its own", () => {
  it("10 — it reads only the session the client already holds; no id is passed in", async () => {
    getSession.mockResolvedValue(VALID);
    await restoreWebSession();
    // getSession takes no arguments — there is no seam through which another user could be named.
    expect(getSession.mock.calls[0]).toEqual([]);
  });

  it("11 — the helper sets no cookie itself; the server owns the attributes", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/lib/auth/webSessionRestore.ts", "utf8");
    expect(src).not.toMatch(/document\.cookie\s*=/);
    expect(src).not.toContain("localStorage");
    expect(src).not.toContain("sessionStorage");
    // Exactly one endpoint.
    expect([...src.matchAll(/fetch\(\s*"([^"]+)"/g)].map((m) => m[1])).toEqual(["/api/auth/session"]);
  });
});
