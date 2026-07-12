import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  commitTodayRelationship,
  getTodayCommitment,
} from "@/lib/bty/daily/todayRelationshipCommitment.server";
import { ensureUserDay } from "@/lib/bty/daily/userDay";
import { userDayKey } from "@/domain/daily/userDayKey";

const TABLE = "today_relationship_commitments";

type Script = {
  profileTz?: string | null; // arena_profiles.timezone
  upsertRowsByTable?: Record<string, unknown[]>; // rows returned by upsert(...).select() per table
  existingRow?: Record<string, unknown> | null; // TABLE existing row for maybeSingle read
};

type Capture = { upserts: Array<{ table: string; payload: Record<string, unknown>; opts: unknown }> };

// Minimal chainable Supabase mock. upsert(...).select() is awaited (thenable); select().eq()…
// .maybeSingle() resolves via maybeSingle. Differentiates by table + whether upsert() was called.
function makeAdmin(script: Script, cap: Capture): SupabaseClient {
  const client = {
    from(table: string) {
      let didUpsert = false;
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        update: () => builder,
        upsert: (payload: Record<string, unknown>, opts: unknown) => {
          didUpsert = true;
          cap.upserts.push({ table, payload, opts });
          return builder;
        },
        maybeSingle: () => {
          if (table === "arena_profiles") {
            return Promise.resolve({
              data: script.profileTz ? { timezone: script.profileTz } : null,
              error: null,
            });
          }
          return Promise.resolve({ data: script.existingRow ?? null, error: null });
        },
        then: (resolve: (v: { data: unknown[]; error: null }) => void) => {
          if (didUpsert) {
            resolve({ data: script.upsertRowsByTable?.[table] ?? [], error: null });
          } else {
            resolve({ data: [], error: null }); // e.g. arena_profiles.update().eq() awaited
          }
        },
      };
      return builder;
    },
  };
  return client as unknown as SupabaseClient;
}

const INSTANT = new Date("2026-07-12T20:30:00.000Z"); // 2026-07-13 05:30 KST → BTY day 2026-07-13
const TZ = "Asia/Seoul";

function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    relationship: "self",
    suggested_relationship: null,
    day_key: userDayKey(INSTANT, TZ, 5),
    confirmed_at: INSTANT.toISOString(),
    locale: "en",
    timezone_snapshot: TZ,
    tz_fallback: false,
    ...over,
  };
}

describe("commitTodayRelationship — insert-only, first-commit-wins", () => {
  it("A. no existing row → inserts one and returns created", async () => {
    const cap: Capture = { upserts: [] };
    const admin = makeAdmin({ profileTz: TZ, upsertRowsByTable: { [TABLE]: [row()] } }, cap);
    const res = await commitTodayRelationship(admin, "u1", INSTANT, "self", {
      suggestedRelationship: "others",
      locale: "en",
      deviceTz: null,
    });
    expect(res.status).toBe("created");
    expect(res.commitment.relationship).toBe("self");
    // exactly one TABLE upsert, insert-only (ignoreDuplicates)
    const tableUpserts = cap.upserts.filter((u) => u.table === TABLE);
    expect(tableUpserts).toHaveLength(1);
    expect(tableUpserts[0].opts).toMatchObject({ onConflict: "user_id,day_key", ignoreDuplicates: true });
    expect(tableUpserts[0].payload.user_id).toBe("u1");
    expect(tableUpserts[0].payload.relationship).toBe("self");
  });

  it("B. existing row, SAME relationship → no overwrite, returns exists", async () => {
    const cap: Capture = { upserts: [] };
    // upsert returns [] (conflict → nothing inserted); existing row is same relationship
    const admin = makeAdmin(
      { profileTz: TZ, upsertRowsByTable: { [TABLE]: [] }, existingRow: row({ relationship: "self" }) },
      cap,
    );
    const res = await commitTodayRelationship(admin, "u1", INSTANT, "self", {
      suggestedRelationship: null,
      locale: "en",
      deviceTz: null,
    });
    expect(res.status).toBe("exists");
    expect(res.commitment.relationship).toBe("self");
  });

  it("C. existing row, DIFFERENT relationship → never overwrites, returns locked with canonical", async () => {
    const cap: Capture = { upserts: [] };
    const admin = makeAdmin(
      { profileTz: TZ, upsertRowsByTable: { [TABLE]: [] }, existingRow: row({ relationship: "others" }) },
      cap,
    );
    const res = await commitTodayRelationship(admin, "u1", INSTANT, "self", {
      suggestedRelationship: null,
      locale: "en",
      deviceTz: null,
    });
    expect(res.status).toBe("locked");
    expect(res.commitment.relationship).toBe("others"); // canonical existing, not the attempted 'self'
  });

  it("day_key EQUALS the user_day key for the same (instant, tz) — one canonical BTY day", async () => {
    const cap: Capture = { upserts: [] };
    const admin = makeAdmin(
      { profileTz: TZ, upsertRowsByTable: { [TABLE]: [row()], user_day: [{ id: "d1" }] } },
      cap,
    );
    await commitTodayRelationship(admin, "u1", INSTANT, "self", {
      suggestedRelationship: null,
      locale: "en",
      deviceTz: null,
    });
    const dayResult = await ensureUserDay(admin, "u1", INSTANT, null);

    const commitKey = cap.upserts.find((u) => u.table === TABLE)!.payload.day_key;
    const userDayUpsertKey = cap.upserts.find((u) => u.table === "user_day")!.payload.day_key;
    expect(commitKey).toBe(userDayKey(INSTANT, TZ, 5));
    expect(commitKey).toBe(dayResult.dayKey);
    expect(commitKey).toBe(userDayUpsertKey);
  });

  it("UTC fallback when no profile/device tz — key computed on UTC", async () => {
    const cap: Capture = { upserts: [] };
    const admin = makeAdmin({ profileTz: null, upsertRowsByTable: { [TABLE]: [row({ timezone_snapshot: "UTC", tz_fallback: true, day_key: userDayKey(INSTANT, "UTC", 5) })] } }, cap);
    await commitTodayRelationship(admin, "u1", INSTANT, "self", {
      suggestedRelationship: null,
      locale: null,
      deviceTz: null,
    });
    const payload = cap.upserts.find((u) => u.table === TABLE)!.payload;
    expect(payload.timezone_snapshot).toBe("UTC");
    expect(payload.tz_fallback).toBe(true);
    expect(payload.day_key).toBe(userDayKey(INSTANT, "UTC", 5));
  });
});

describe("getTodayCommitment", () => {
  it("returns the current-day commitment when present", async () => {
    const cap: Capture = { upserts: [] };
    const admin = makeAdmin({ profileTz: TZ, existingRow: row({ relationship: "world" }) }, cap);
    const c = await getTodayCommitment(admin, "u1", INSTANT, null);
    expect(c?.relationship).toBe("world");
    expect(c?.dayKey).toBe(userDayKey(INSTANT, TZ, 5));
  });

  it("returns null when there is no commitment today", async () => {
    const cap: Capture = { upserts: [] };
    const admin = makeAdmin({ profileTz: TZ, existingRow: null }, cap);
    const c = await getTodayCommitment(admin, "u1", INSTANT, null);
    expect(c).toBeNull();
  });
});

describe("PROVIDER ZERO-CALL — commitment code imports no generation/LLM surface", () => {
  const forbidden = /today-intelligence\/todayMirror|todayMirror(Generate|AdmittedGenerate|Prompt|Policy)|lib\/bty\/llm|generateTodayMirror|admitTodayMirror|pilotShadow/;
  const files = [
    "src/lib/bty/daily/todayRelationshipCommitment.server.ts",
    "src/domain/daily/todayRelationshipCommitment.ts",
    "src/app/api/me/today/commit/route.ts",
  ];
  for (const rel of files) {
    it(`${rel} references no AI/generation module`, () => {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      expect(src).not.toMatch(forbidden);
    });
  }
});
