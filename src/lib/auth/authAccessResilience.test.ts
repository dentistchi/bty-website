import { describe, it, expect, vi, afterEach } from "vitest";
import {
  AUTH_BOOT_TIMEOUT_MS,
  AuthReadTimeout,
  isAuthReadTimeout,
  readWithBound,
} from "./boundedSessionRead";
import {
  AUTH_CALLBACK_REASONS,
  authCallbackSupportLine,
  isAuthCallbackReason,
} from "./authCallbackReason";

/**
 * R4-R4B-R1 — A BOUND THAT EXPIRES MEANS "WE DON'T KNOW".
 *
 * The app's whole boot path was unbounded: `AuthContext.refresh()` → `fetchSessionOnce()` →
 * `fetchJson("/api/auth/session")`, plus a second `fetch` inside `restoreNativeSession()`. Neither
 * carried a signal. `loading` clears only in a `finally`, so a request that never SETTLED never
 * cleared it and `/start` held its navy surface forever — no error, nothing to press.
 *
 * The rule these tests defend is the one R4-R2G/H/I/J established for learners and which the auth
 * path never received: a timeout is not a "no" from the server. Treating it as unauthenticated
 * would sign a legitimately signed-in person out because their network hiccuped.
 */

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks(); // the clearTimeout spy must not leak into the next test's globals
});

describe("R4-R4B-R1 · 3/7/8 · the boot read always settles", () => {
  it("3 — a stalled read rejects once the bound expires, instead of hanging", async () => {
    vi.useFakeTimers();
    const p = readWithBound<string>(() => new Promise(() => {}), 100).catch((e) => e);
    await vi.advanceTimersByTimeAsync(150);
    expect(isAuthReadTimeout(await p)).toBe(true);
  });

  it("1 — a fast read is untouched by the bound", async () => {
    await expect(readWithBound(async () => "ok", 5_000)).resolves.toBe("ok");
  });

  it("7 — a REJECTED read propagates its own error, not a timeout", async () => {
    const boom = new Error("500 from server");
    const caught = await readWithBound(async () => {
      throw boom;
    }).catch((e) => e);
    expect(caught).toBe(boom);
    // Crucially NOT reported as "we don't know" — the server did answer.
    expect(isAuthReadTimeout(caught)).toBe(false);
  });

  it("the runner receives a signal it can attach to a fetch", async () => {
    let seen: AbortSignal | null = null;
    await readWithBound(async (signal) => {
      seen = signal;
      return 1;
    });
    expect(seen).toBeInstanceOf(AbortSignal);
    expect(seen!.aborted).toBe(false);
  });

  it("the timer is cleared on a fast settle — no handle left pending for the full bound", async () => {
    vi.useFakeTimers();
    const clear = vi.spyOn(globalThis, "clearTimeout");
    await readWithBound(async () => "quick", 10_000);
    expect(clear).toHaveBeenCalled();
  });

  it("the bound is a real, finite, human-scale number", () => {
    expect(AUTH_BOOT_TIMEOUT_MS).toBeGreaterThan(3_000);
    expect(AUTH_BOOT_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });
});

describe("R4-R4B-R1 · 4/10 · a timeout is never a sign-out", () => {
  it("only OUR bound produces the timeout signal — a foreign AbortError does not", async () => {
    // A caller aborting for its own reasons must not be reported as "couldn't reach BTY".
    const foreign = Object.assign(new Error("aborted elsewhere"), { name: "AbortError" });
    const caught = await readWithBound(async () => {
      throw foreign;
    }).catch((e) => e);
    expect(caught).toBe(foreign);
    expect(isAuthReadTimeout(caught)).toBe(false);
  });

  it("10 — the helper clears no cookie, drops no session and issues no redirect", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/lib/auth/boundedSessionRead.ts", "utf8");
    for (const forbidden of ["document.cookie", "signOut", "logout", "location.assign", "location.href", "router."]) {
      expect(src, `boundedSessionRead must not ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("an AuthReadTimeout is recognisable across a structured-clone boundary", () => {
    // The tag is a plain property, not just an instanceof — so it survives serialization.
    expect(isAuthReadTimeout({ timedOut: true })).toBe(true);
    expect(isAuthReadTimeout(new AuthReadTimeout())).toBe(true);
    expect(isAuthReadTimeout(new Error("nope"))).toBe(false);
    expect(isAuthReadTimeout(null)).toBe(false);
  });
});

describe("R4-R4B-R1 · 11–16 · the callback names its own branch", () => {
  it("11/12/13 — exactly three reasons, one per measured branch", () => {
    expect([...AUTH_CALLBACK_REASONS]).toEqual(["no_code", "exchange_failed", "set_session_failed"]);
  });

  it("14/15 — 'no reason' is representable, so a success carries no diagnostic", () => {
    expect(isAuthCallbackReason(null)).toBe(false);
    expect(isAuthCallbackReason(undefined)).toBe(false);
    expect(isAuthCallbackReason("")).toBe(false);
  });

  it("the set is closed — an unrecognised value is not a reason", () => {
    for (const junk of ["ok", "success", "no_code ", "NO_CODE", 1, {}]) {
      expect(isAuthCallbackReason(junk)).toBe(false);
    }
  });

  it("16 — the support line carries the branch and NOTHING derived from the request", () => {
    for (const r of AUTH_CALLBACK_REASONS) {
      const line = authCallbackSupportLine(r);
      expect(line).toContain(r);
      // No shape that could smuggle a credential or an identity.
      expect(line).not.toMatch(/eyJ|Bearer|access_token|refresh_token|code=|@|[0-9a-f]{8}-[0-9a-f]{4}/i);
      expect(line.length).toBeLessThan(40);
    }
  });
});
