import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readYesterdayContext, previousDayKey } from "@/lib/bty/daily/livingResponseYesterday.server";

// Scripted mock: each table resolves its `maybeSingle()` from `script[table]` (or null).
function makeAdmin(script: Record<string, unknown>): SupabaseClient {
  const client = {
    from(table: string) {
      const b: Record<string, unknown> = {
        select: () => b,
        eq: () => b,
        maybeSingle: () => Promise.resolve({ data: table in script ? script[table] : null, error: null }),
      };
      return b;
    },
  };
  return client as unknown as SupabaseClient;
}

describe("previousDayKey", () => {
  it("subtracts one calendar day (UTC), including month/year boundaries", () => {
    expect(previousDayKey("2026-07-13")).toBe("2026-07-12");
    expect(previousDayKey("2026-07-01")).toBe("2026-06-30");
    expect(previousDayKey("2026-01-01")).toBe("2025-12-31");
    expect(previousDayKey("not-a-date")).toBeNull();
  });
});

describe("readYesterdayContext — provenance-safe hidden context", () => {
  it("no yesterday commitment → { existed:false } (generator falls back to today-only)", async () => {
    const admin = makeAdmin({}); // nothing scripted → no commitment
    const y = await readYesterdayContext(admin, "u1", "2026-07-13");
    expect(y).toEqual({ existed: false, relationship: null, livingResponse: null, completed: null });
  });

  it("commitment + settled line + presence → fully populated", async () => {
    const admin = makeAdmin({
      today_relationship_commitments: { id: "c-yest", relationship: "self" },
      today_living_responses: { perspective: "A quiet return still counts.", status: "generated" },
      user_day: { day_key: "2026-07-12" },
    });
    const y = await readYesterdayContext(admin, "u1", "2026-07-13");
    expect(y.existed).toBe(true);
    expect(y.relationship).toBe("self");
    expect(y.livingResponse).toBe("A quiet return still counts.");
    expect(y.completed).toBe(true);
  });

  it("pending yesterday line → livingResponse null (nothing to continue from)", async () => {
    const admin = makeAdmin({
      today_relationship_commitments: { id: "c-yest", relationship: "others" },
      today_living_responses: { perspective: null, status: "pending" },
      // no user_day → completed false (returned=false)
    });
    const y = await readYesterdayContext(admin, "u1", "2026-07-13");
    expect(y.existed).toBe(true);
    expect(y.relationship).toBe("others");
    expect(y.livingResponse).toBeNull();
    expect(y.completed).toBe(false);
  });

  it("carries ONLY machine/own-generated fields (no user PII shape)", async () => {
    const admin = makeAdmin({
      today_relationship_commitments: { id: "c", relationship: "world" },
      today_living_responses: { perspective: "Stewardship takes the form of what is built.", status: "fallback" },
      user_day: { day_key: "2026-07-12" },
    });
    const y = await readYesterdayContext(admin, "u1", "2026-07-13");
    expect(Object.keys(y).sort()).toEqual(["completed", "existed", "livingResponse", "relationship"]);
  });
});
