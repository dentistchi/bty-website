/**
 * letterService — submitLetter, getLetterHistory 단위 테스트.
 * Mocked Supabase. 비즈니스 로직 미변경.
 */
import { describe, it, expect } from "vitest";
import { submitLetter, getLetterHistory } from "./letterService";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockSupabase(opts: {
  insertResult?: { data: unknown; error: { message: string } | null };
  selectResult?: { data: unknown[]; error: { message: string } | null };
}): SupabaseClient {
  const { insertResult, selectResult } = opts;
  const chain: Record<string, unknown> = {
    from: () => chain,
    insert: () => chain,
    select: () => chain,
    single: () => Promise.resolve(insertResult ?? { data: { id: "letter-1" }, error: null }),
    eq: () => chain,
    order: () => chain,
    limit: () => Promise.resolve(selectResult ?? { data: [], error: null }),
  };
  return chain as unknown as SupabaseClient;
}

describe("letterService", () => {
  describe("submitLetter", () => {
    it("rejects empty body", async () => {
      const sb = mockSupabase({});
      const r = await submitLetter(sb, { userId: "u1", body: "" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("body_empty");
    });

    it("rejects whitespace-only body", async () => {
      const sb = mockSupabase({});
      const r = await submitLetter(sb, { userId: "u1", body: "   " });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("body_empty");
    });

    it("rejects body > 2000 chars", async () => {
      const sb = mockSupabase({});
      const r = await submitLetter(sb, { userId: "u1", body: "a".repeat(2001) });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("text_too_long");
    });

    it("returns ok with letterId and reply on valid input", async () => {
      const sb = mockSupabase({ insertResult: { data: { id: "lid-1" }, error: null } });
      const r = await submitLetter(sb, { userId: "u1", body: "안녕하세요" });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.letterId).toBe("lid-1");
        expect(typeof r.reply).toBe("string");
        expect(r.reply.length).toBeGreaterThan(0);
      }
    });

    it("infers ko locale from Korean text", async () => {
      const sb = mockSupabase({ insertResult: { data: { id: "lid-2" }, error: null } });
      const r = await submitLetter(sb, { userId: "u1", body: "오늘 하루" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.reply).toContain("편지");
    });

    it("infers en locale from English text", async () => {
      const sb = mockSupabase({ insertResult: { data: { id: "lid-3" }, error: null } });
      const r = await submitLetter(sb, { userId: "u1", body: "hello world" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.reply).toContain("Thank you");
    });

    it("uses explicit locale when provided", async () => {
      const sb = mockSupabase({ insertResult: { data: { id: "lid-4" }, error: null } });
      const r = await submitLetter(sb, { userId: "u1", body: "test", locale: "ko" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.reply).toContain("편지");
    });
  });

  describe("getLetterHistory", () => {
    it("returns empty array when no data", async () => {
      const sb = mockSupabase({ selectResult: { data: [], error: null } });
      const r = await getLetterHistory(sb, "u1");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.letters).toEqual([]);
    });

    it("maps DB rows to LetterWithReply", async () => {
      const sb = mockSupabase({
        selectResult: {
          data: [
            { id: "l1", locale: "ko", body: "text", reply: "reply", created_at: "2026-03-09T00:00:00Z" },
          ],
          error: null,
        },
      });
      const r = await getLetterHistory(sb, "u1");
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.letters).toHaveLength(1);
        expect(r.letters[0]).toMatchObject({
          id: "l1",
          body: "text",
          reply: "reply",
          locale: "ko",
          createdAt: "2026-03-09T00:00:00Z",
        });
      }
    });

    it("returns error when DB fails", async () => {
      const sb = mockSupabase({ selectResult: { data: [], error: { message: "db fail" } } });
      const r = await getLetterHistory(sb, "u1");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("db fail");
    });
  });
});
