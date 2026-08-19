import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readUserTzContext, resolveUserTzContext } from "./userDay";

/**
 * R4-R3A — the READ-ONLY timezone twin.
 *
 * Precedence is proven HERE rather than through the route, because here it is deterministic: the
 * function returns the zone it chose, so the assertion is about the actual decision instead of a
 * downstream side effect that could hold for either branch.
 *
 * The writing resolver is included in the last test purely as a contrast — to show the ONLY
 * difference between the two is the persistence, and that its behaviour was not altered.
 */

const USER = "u1";

function admin(profileTz: string | null, onWrite: (what: string) => void) {
  const from = (table: string) => {
    const q: Record<string, unknown> = {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      maybeSingle() {
        return Promise.resolve({ data: table === "arena_profiles" ? { timezone: profileTz } : null, error: null });
      },
      update() {
        onWrite(`${table}.update`);
        return q;
      },
      insert() {
        onWrite(`${table}.insert`);
        return q;
      },
      upsert() {
        onWrite(`${table}.upsert`);
        return q;
      },
      delete() {
        onWrite(`${table}.delete`);
        return q;
      },
      then(res: (v: unknown) => unknown) {
        return Promise.resolve({ data: null, error: null }).then(res);
      },
    };
    return q;
  };
  return { from } as unknown as SupabaseClient;
}

describe("R4-R3A · readUserTzContext — same precedence, no persistence", () => {
  it("a valid STORED profile timezone wins over the device hint", async () => {
    const r = await readUserTzContext(admin("Asia/Seoul", () => {}), USER, "America/Los_Angeles");
    expect(r).toEqual({ timezone: "Asia/Seoul", tzFallback: false });
  });

  it("with no stored profile tz, a valid device hint is used", async () => {
    const r = await readUserTzContext(admin(null, () => {}), USER, "America/Los_Angeles");
    expect(r).toEqual({ timezone: "America/Los_Angeles", tzFallback: false });
  });

  it("a malformed stored tz is ignored, and the valid hint is used instead", async () => {
    const r = await readUserTzContext(admin("Mars/Olympus", () => {}), USER, "Asia/Seoul");
    expect(r).toEqual({ timezone: "Asia/Seoul", tzFallback: false });
  });

  it("malformed or missing everything falls back to UTC, flagged as a fallback", async () => {
    expect(await readUserTzContext(admin(null, () => {}), USER, "Not/AZone")).toEqual({ timezone: "UTC", tzFallback: true });
    expect(await readUserTzContext(admin(null, () => {}), USER, null)).toEqual({ timezone: "UTC", tzFallback: true });
    expect(await readUserTzContext(admin("", () => {}), USER, undefined)).toEqual({ timezone: "UTC", tzFallback: true });
  });

  it("NEVER writes — not even when it resolves a brand-new device zone", async () => {
    const writes: string[] = [];
    const r = await readUserTzContext(admin(null, (w) => writes.push(w)), USER, "America/Los_Angeles");
    expect(r.timezone).toBe("America/Los_Angeles");
    expect(writes).toEqual([]);
  });

  it("CONTRAST: the canonical writing resolver still persists, and is unchanged", async () => {
    /*
      This is the behaviour that made a second function necessary. It is correct on the learner
      surfaces that use it — capturing the zone once makes every later BTY day-key right — and it
      is deliberately left exactly as it was.
    */
    const writes: string[] = [];
    const r = await resolveUserTzContext(admin(null, (w) => writes.push(w)), USER, "America/Los_Angeles");
    expect(r.timezone).toBe("America/Los_Angeles");
    expect(writes).toEqual(["arena_profiles.update"]);
  });
});
