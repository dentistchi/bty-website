import { describe, expect, it, vi, beforeEach } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  bearerFromAuthorization,
  bearerGlobalOption,
  withBearerFallback,
} from "@/lib/supabase/bearerTransport";

/**
 * The second transport, and the guard that stops it being missed a FOURTH time (Slice A0.2).
 *
 * The history this file exists to end:
 *   A0          taught `requireUser`              — the routes composing it worked
 *   A0-RUNTIME2 taught `getSupabaseServer`        — reported as 74 routes; it was 12
 *   A0.2        found `getSupabaseServerClient`   — 61 routes, still refusing in the Teams tab
 *
 * The "74" came from `grep -l "getSupabaseServer"`, which matches `getSupabaseServerClient` as a
 * SUBSTRING. Two visible symptoms happened to sit in the smaller bucket, so the repair looked
 * complete while 61 routes stayed broken until a Founder tapped one of them.
 *
 * So the enumeration is no longer done by hand: the last test walks every server-side factory in
 * the repo and requires it to use the shared transport. A new factory fails here rather than
 * shipping another silent hole.
 */

describe("bearerFromAuthorization", () => {
  it("reads a bearer, and nothing else", () => {
    expect(bearerFromAuthorization("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(bearerFromAuthorization("bearer abc")).toBe("abc");
  });

  it("refuses absent, blank and non-bearer schemes", () => {
    for (const v of [null, undefined, "", "   ", "Basic abc", "Bearer", "Bearer   "]) {
      expect(bearerFromAuthorization(v), `value ${JSON.stringify(v)}`).toBeNull();
    }
  });
});

describe("bearerGlobalOption", () => {
  it("attaches the header so RLS reads act as the token's owner", () => {
    expect(bearerGlobalOption("tok")).toEqual({ global: { headers: { Authorization: "Bearer tok" } } });
  });

  it("adds NOTHING without a bearer — a plain web request is byte-identical to before", () => {
    expect(bearerGlobalOption(null)).toEqual({});
  });
});

describe("withBearerFallback — the cookie path is always first", () => {
  const getUser = vi.fn();
  /** The only surface `withBearerFallback` touches, typed loosely so the test needs no real client. */
  const client = () => ({ auth: { getUser } }) as unknown as Parameters<typeof withBearerFallback>[0];

  beforeEach(() => getUser.mockReset());

  it("returns the cookie user and never consults the bearer", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "cookie" } }, error: null });
    const c = withBearerFallback(client(), "tok");
    expect((await c.auth.getUser()).data.user).toEqual({ id: "cookie" });
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(getUser).toHaveBeenCalledWith();
  });

  it("falls back to the bearer only when the cookie yields nothing", async () => {
    getUser
      .mockResolvedValueOnce({ data: { user: null }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: "bearer" } }, error: null });
    const c = withBearerFallback(client(), "tok");
    expect((await c.auth.getUser()).data.user).toEqual({ id: "bearer" });
    expect(getUser).toHaveBeenNthCalledWith(2, "tok");
  });

  it("passes an explicit getUser(jwt) straight through", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "explicit" } }, error: null });
    const c = withBearerFallback(client(), "tok");
    await c.auth.getUser("chosen");
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(getUser).toHaveBeenCalledWith("chosen");
  });

  it("is a no-op without a bearer — the client is returned untouched", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const c = withBearerFallback(client(), null);
    expect((await c.auth.getUser()).data.user).toBeNull();
    expect(getUser).toHaveBeenCalledTimes(1);
  });
});

describe("EVERY server-side Supabase factory uses the shared transport", () => {
  /**
   * Enumerated from source, not from memory. This is the check that would have caught A0-RUNTIME2's
   * miss on the day it was made.
   */
  it("no factory constructs a server client without the bearer fallback", () => {
    const files = execFileSync(
      "grep",
      ["-rl", "createServerClient(", "src/lib", "--include=*.ts"],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .filter(Boolean)
      .filter((f) => !/\.test\.ts$/.test(f));

    expect(files.length).toBeGreaterThan(0);

    const offenders = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      // The module that DEFINES the helper is allowed not to call it.
      if (f.endsWith("bearerTransport.ts")) return false;
      return !src.includes("withBearerFallback");
    });

    expect(
      offenders,
      `these build a server Supabase client without the shared bearer transport, so every route ` +
        `using them will 401 in the Teams tab: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});
