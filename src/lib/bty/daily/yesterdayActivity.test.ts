import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadYesterdayActivity } from "./yesterdayActivity.server";

/**
 * Slice A — Yesterday presence reads the column that exists.
 *
 * `user_day` carries `opened_at` and no `created_at`. The old query asked for `created_at`, so
 * PostgREST answered 42703 on every call and presence reported FALSE for everyone from 2026-07-26
 * onward — invisibly, because `safeCount` turns a refusal into "source unavailable", which is the
 * correct shape for a real outage and therefore indistinguishable from one.
 *
 * These pin the column, prove the fail-soft contract still holds, and keep the dependency out.
 */

const SRC = join(process.cwd(), "src/lib/bty/daily/yesterdayActivity.server.ts");

/** Records the filters each table was queried with, so the COLUMN is observable. */
function fakeAdmin(opts: { userDay?: { count: number | null; error: unknown } } = {}) {
  const filters: Record<string, string[]> = {};
  const admin = {
    from(table: string) {
      filters[table] ??= [];
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        gte: (col: string) => { filters[table].push(`gte:${col}`); return chain; },
        lt: (col: string) => { filters[table].push(`lt:${col}`); return chain; },
        not: () => chain,
        order: () => chain,
        limit: () => chain,
        then: (res: (v: unknown) => unknown) =>
          res(table === "user_day" ? (opts.userDay ?? { count: 1, error: null }) : { count: 0, error: null, data: [] }),
      };
      return chain;
    },
  };
  return { admin: admin as never, filters };
}

describe("presence uses opened_at", () => {
  it("filters user_day on opened_at, never created_at", async () => {
    const { admin, filters } = fakeAdmin();
    await loadYesterdayActivity(admin, "u1", new Date("2026-09-25T12:00:00Z"), "America/Los_Angeles");
    expect(filters.user_day).toEqual(["gte:opened_at", "lt:opened_at"]);
    expect(filters.user_day.join(" ")).not.toContain("created_at");
  });

  it("reports presence true when a row exists in the window", async () => {
    const { admin } = fakeAdmin({ userDay: { count: 1, error: null } });
    const r = await loadYesterdayActivity(admin, "u1", new Date("2026-09-25T12:00:00Z"), "America/Los_Angeles");
    expect(r.presence).toBe(true);
  });

  it("reports presence false when no row exists — an answer, not an outage", async () => {
    const { admin } = fakeAdmin({ userDay: { count: 0, error: null } });
    const r = await loadYesterdayActivity(admin, "u1", new Date("2026-09-25T12:00:00Z"), "America/Los_Angeles");
    expect(r.presence).toBe(false);
  });

  it("stays fail-soft: a refused read degrades to false and never throws", async () => {
    const { admin } = fakeAdmin({ userDay: { count: null, error: { code: "42703" } } });
    const r = await loadYesterdayActivity(admin, "u1", new Date("2026-09-25T12:00:00Z"), "America/Los_Angeles");
    expect(r.presence).toBe(false);
    // The other categories are unaffected by the presence source failing.
    expect(r).toHaveProperty("trainingsCompleted");
    expect(r).toHaveProperty("centerReflections");
  });

  it("leaves the OTHER tables' created_at alone — they really have that column", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).toMatch(/from\("dear_me_letters"\)[\s\S]{0,160}created_at/);
    expect(src).toMatch(/from\("foundry_event_training_progress"\)[\s\S]{0,200}completed_at/);
  });

  it("has no user_day.created_at dependency anywhere in this path", () => {
    // Comments are stripped: this file EXPLAINS the old defect, and the explanation is not the bug.
    const code = readFileSync(SRC, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const m = code.match(/from\("user_day"\)[^;]*/);
    expect(m, "user_day query not found").toBeTruthy();
    expect(m![0]).not.toContain("created_at");
    expect(m![0]).toContain("opened_at");
  });
});
