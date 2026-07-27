import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadYesterdayActivity } from "./yesterdayActivity.server";

type Row = Record<string, unknown>;

/**
 * B3A.2B-R1 — canonical source corrections. Fake admin over the exact query shapes:
 * arena_profiles (tz), foundry_event_training_progress (completion via completed_at),
 * foundry_events (first-run creation), dear_me_letters, user_day.
 */
function makeAdmin(seed: Record<string, Row[]>) {
  function from(table: string) {
    const rows = seed[table] ?? [];
    const q = {
      _filters: [] as Array<{ op: string; c: string; v: unknown }>,
      _head: false,
      select(_cols?: unknown, opts?: { head?: boolean }) {
        this._head = opts?.head === true;
        return this;
      },
      eq(c: string, v: unknown) { this._filters.push({ op: "eq", c, v }); return this; },
      gte(c: string, v: unknown) { this._filters.push({ op: "gte", c, v }); return this; },
      lt(c: string, v: unknown) { this._filters.push({ op: "lt", c, v }); return this; },
      not(c: string, _is: string, v: unknown) { this._filters.push({ op: "not", c, v }); return this; },
      update() { throw new Error("no write expected in test"); },
      _match() {
        return rows.filter((r) =>
          this._filters.every((f) => {
            const cell = r[f.c];
            if (f.op === "eq") return cell === f.v;
            if (f.op === "gte") return cell != null && String(cell) >= String(f.v);
            if (f.op === "lt") return cell != null && String(cell) < String(f.v);
            if (f.op === "not") return cell !== f.v; // "is null" → keep non-null
            return true;
          }),
        );
      },
      maybeSingle() { return Promise.resolve({ data: this._match()[0] ?? null, error: null }); },
      then(res: (v: { data: Row[] | null; count: number | null; error: null }) => unknown) {
        const m = this._match();
        return Promise.resolve(this._head ? { data: null, count: m.length, error: null } : { data: m, count: m.length, error: null }).then(res);
      },
    };
    return q;
  }
  return { from } as unknown as SupabaseClient;
}

const U = "user-1";
const NOW = new Date("2026-07-27T20:00:00Z"); // LA (PDT) → yesterday BTY window [2026-07-26T12:00Z, 2026-07-27T12:00Z)
const profileLA = { arena_profiles: [{ user_id: U, timezone: "America/Los_Angeles" }] };

describe("loadYesterdayActivity — R1 canonical sources", () => {
  it("Correction 1: counts completions by completed_at (XP-independent); incomplete/other-user/other-day excluded", async () => {
    const admin = makeAdmin({
      ...profileLA,
      foundry_event_training_progress: [
        { linked_user_id: U, completed_at: "2026-07-26T15:00:00Z" }, // in window ✓
        { linked_user_id: U, completed_at: null }, // incomplete → excluded
        { linked_user_id: U, completed_at: "2026-07-25T15:00:00Z" }, // before window → excluded
        { linked_user_id: "other", completed_at: "2026-07-26T16:00:00Z" }, // other user → excluded
      ],
    });
    const c = await loadYesterdayActivity(admin, U, NOW, null);
    expect(c.trainingsCompleted).toBe(1); // XP ledger not consulted at all
  });

  it("Correction 2: counts a Program at its FIRST owned Run in-window; later runs / other-day-first / null-program excluded", async () => {
    const admin = makeAdmin({
      ...profileLA,
      foundry_events: [
        { owner_user_id: U, program_id: "A", created_at: "2026-07-26T13:00:00Z" }, // A first run in-window ✓
        { owner_user_id: U, program_id: "A", created_at: "2026-07-27T01:00:00Z" }, // A second run → +0
        { owner_user_id: U, program_id: "B", created_at: "2026-07-25T13:00:00Z" }, // B first run before window → +0
        { owner_user_id: U, program_id: "C", created_at: "2026-07-26T20:00:00Z" }, // C first run in-window ✓
        { owner_user_id: U, program_id: null, created_at: "2026-07-26T14:00:00Z" }, // legacy (no program) → excluded
        { owner_user_id: "other", program_id: "Z", created_at: "2026-07-26T14:00:00Z" }, // other owner → excluded
      ],
    });
    const c = await loadYesterdayActivity(admin, U, NOW, null);
    expect(c.trainingsCreated).toBe(2); // A + C
  });

  it("Center (broad dear_me_letters) counted; presence only when a user_day row exists", async () => {
    const withPresence = await loadYesterdayActivity(
      makeAdmin({ ...profileLA, dear_me_letters: [{ user_id: U, created_at: "2026-07-26T14:00:00Z" }], user_day: [{ user_id: U, created_at: "2026-07-26T14:00:00Z" }] }),
      U, NOW, null,
    );
    expect(withPresence.centerReflections).toBe(1);
    expect(withPresence.presence).toBe(true);

    const noPresence = await loadYesterdayActivity(makeAdmin({ ...profileLA }), U, NOW, null);
    expect(noPresence.presence).toBe(false); // no user_day → never "You showed up"
    expect(noPresence.trainingsCompleted).toBe(0);
    expect(noPresence.trainingsCreated).toBe(0);
  });
});
