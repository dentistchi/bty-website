/**
 * resilienceService — getResilienceEntries, parsePeriodDays 단위 테스트.
 * Mocked Supabase. Real domain aggregation.
 */
import { describe, it, expect } from "vitest";
import { getResilienceEntries, parsePeriodDays } from "./resilienceService";
import type { SupabaseClient } from "@supabase/supabase-js";

type SelectResult = { data: unknown[] | null; error: { message: string } | null };

function mockSupabase(selectResult: SelectResult): SupabaseClient {
  const chain: Record<string, unknown> = {
    from: () => chain,
    select: () => chain,
    eq: () => chain,
    order: () => Promise.resolve(selectResult),
  };
  return chain as unknown as SupabaseClient;
}

describe("resilienceService", () => {
  describe("parsePeriodDays", () => {
    it("returns undefined for null", () => {
      expect(parsePeriodDays(null)).toBeUndefined();
    });

    it("returns undefined for non-numeric string", () => {
      expect(parsePeriodDays("abc")).toBeUndefined();
    });

    it("returns undefined for 0", () => {
      expect(parsePeriodDays("0")).toBeUndefined();
    });

    it("returns undefined for negative", () => {
      expect(parsePeriodDays("-5")).toBeUndefined();
    });

    it("parses valid integer", () => {
      expect(parsePeriodDays("30")).toBe(30);
    });

    it("clamps to 365", () => {
      expect(parsePeriodDays("999")).toBe(365);
    });

    it("returns 1 for '1'", () => {
      expect(parsePeriodDays("1")).toBe(1);
    });
  });

  describe("getResilienceEntries", () => {
    it("returns empty entries when no rows", async () => {
      const sb = mockSupabase({ data: [], error: null });
      const r = await getResilienceEntries(sb, "u1");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.entries).toEqual([]);
    });

    it("returns empty entries when data is null", async () => {
      const sb = mockSupabase({ data: null, error: null });
      const r = await getResilienceEntries(sb, "u1");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.entries).toEqual([]);
    });

    it("returns error when DB fails", async () => {
      const sb = mockSupabase({ data: null, error: { message: "timeout" } });
      const r = await getResilienceEntries(sb, "u1");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("timeout");
    });

    it("aggregates rows into daily entries", async () => {
      const sb = mockSupabase({
        data: [
          { energy: 5, created_at: "2026-03-01T10:00:00Z" },
          { energy: 1, created_at: "2026-03-02T08:00:00Z" },
          { energy: 3, created_at: "2026-03-03T12:00:00Z" },
        ],
        error: null,
      });
      const r = await getResilienceEntries(sb, "u1");
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.entries).toHaveLength(3);
        expect(r.entries[0]).toMatchObject({ date: "2026-03-01", level: "high", source: "letter" });
        expect(r.entries[1]).toMatchObject({ date: "2026-03-02", level: "low" });
        expect(r.entries[2]).toMatchObject({ date: "2026-03-03", level: "mid" });
      }
    });

    it("respects periodDays filter", async () => {
      const sb = mockSupabase({
        data: [
          { energy: 5, created_at: "2026-03-01T10:00:00Z" },
          { energy: 3, created_at: "2026-03-05T10:00:00Z" },
          { energy: 1, created_at: "2026-03-08T10:00:00Z" },
        ],
        error: null,
      });
      const r = await getResilienceEntries(sb, "u1", 3);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.entries.length).toBeLessThanOrEqual(3);
        expect(r.entries.every((e) => e.date >= "2026-03-06")).toBe(true);
      }
    });

    it("handles null energy rows", async () => {
      const sb = mockSupabase({
        data: [{ energy: null, created_at: "2026-03-01T10:00:00Z" }],
        error: null,
      });
      const r = await getResilienceEntries(sb, "u1");
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.entries).toHaveLength(1);
        expect(r.entries[0].level).toBe("mid");
      }
    });
  });
});
