import { describe, it, expect } from "vitest";
import { generateTodayMirror } from "@/lib/bty/today-intelligence/todayMirrorGenerate";
import { runShadow } from "@/lib/bty/today-intelligence/todayMirrorShadow";
import { EMPTY_RECENT_CONTEXT } from "@/domain/daily/todayMirror.types";
import {
  MIRROR_FIXTURES, makeMockMirrorClient, makeUnsafeMirrorClient,
} from "@/lib/bty/today-intelligence/__fixtures__/todayMirrorFixtures";

describe("generateTodayMirror — shadow pipeline (mock client)", () => {
  const client = makeMockMirrorClient();

  it("runs all 20 fixtures with expected lens + outcome", async () => {
    const rows = await runShadow(client, MIRROR_FIXTURES);
    expect(rows).toHaveLength(20);
    for (const row of rows) {
      const fx = MIRROR_FIXTURES.find((f) => f.name === row.name)!;
      expect(row.selectedLens, `lens for ${row.name}`).toBe(fx.expectLens);
      if (fx.expect === "fail_quiet") {
        expect(row.outcome, `${row.name} should fail quiet`).toBe("fail_quiet");
      } else {
        expect(row.outcome, `${row.name} should produce output`).toBe("ok");
      }
      // hard scorecard checks must all pass
      expect(Object.values(row.checks).every(Boolean), `checks for ${row.name}: ${JSON.stringify(row.checks)}`).toBe(true);
    }
  });

  it("restraint cases carry an uncertainty note", async () => {
    for (const fx of MIRROR_FIXTURES.filter((f) => f.expect === "restraint")) {
      const res = await generateTodayMirror({ packet: fx.packet, recent: EMPTY_RECENT_CONTEXT, locale: fx.locale, client });
      expect(res.ok, fx.name).toBe(true);
      if (res.ok) expect(res.response.uncertaintyNote, fx.name).toBeTruthy();
    }
  });

  it("open-contract fixtures never emit a suggested step", async () => {
    for (const fx of MIRROR_FIXTURES.filter((f) => f.packet.openContract)) {
      const res = await generateTodayMirror({ packet: fx.packet, recent: EMPTY_RECENT_CONTEXT, locale: fx.locale, client });
      expect(res.ok, fx.name).toBe(true);
      if (res.ok) expect(res.response.suggestedStep, fx.name).toBeNull();
    }
  });

  it("Korean and English produce equivalent structure (lens, step presence)", async () => {
    const enFx = MIRROR_FIXTURES.find((f) => f.name === "13_english_output")!;
    const koFx = MIRROR_FIXTURES.find((f) => f.name === "12_korean_output")!;
    const en = await generateTodayMirror({ packet: enFx.packet, recent: EMPTY_RECENT_CONTEXT, locale: "en", client });
    const ko = await generateTodayMirror({ packet: koFx.packet, recent: EMPTY_RECENT_CONTEXT, locale: "ko", client });
    expect(en.ok && ko.ok).toBe(true);
    if (en.ok && ko.ok) {
      expect(en.response.lens).toBe(ko.response.lens);
      expect(en.response.suggestedStep === null).toBe(ko.response.suggestedStep === null);
      // KO output actually contains Hangul (parity is real, not English echoed)
      expect(/[가-힣]/.test(ko.response.mirror)).toBe(true);
      expect(/[가-힣]/.test(en.response.mirror)).toBe(false);
    }
  });

  it("fails quiet (no text) on unsafe model output — every unsafe kind", async () => {
    const fx = MIRROR_FIXTURES.find((f) => f.name === "5_missed_then_return")!;
    for (const kind of ["generic", "identity", "count", "choice", "metric"] as const) {
      const res = await generateTodayMirror({
        packet: fx.packet, recent: EMPTY_RECENT_CONTEXT, locale: "en", client: makeUnsafeMirrorClient(kind),
      });
      expect(res.ok, `unsafe:${kind} must be rejected`).toBe(false);
      if (!res.ok) expect(res.reason).toBe("validation_failed");
    }
  });

  it("fails quiet when no client is available (no fabricated fallback)", async () => {
    const fx = MIRROR_FIXTURES.find((f) => f.name === "5_missed_then_return")!;
    const res = await generateTodayMirror({ packet: fx.packet, recent: EMPTY_RECENT_CONTEXT, locale: "en", client: undefined });
    // In CI no LLM env is set → llm_unavailable; never throws, never fabricates.
    expect(res.ok).toBe(false);
  });

  it("evidence ids on a valid result all exist in the packet", async () => {
    const fx = MIRROR_FIXTURES.find((f) => f.name === "7_reexposure_changed")!;
    const res = await generateTodayMirror({ packet: fx.packet, recent: EMPTY_RECENT_CONTEXT, locale: "en", client });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const valid = new Set(fx.packet.confirmedFacts.map((f) => f.id));
      for (const id of res.response.evidenceIds) expect(valid.has(id)).toBe(true);
    }
  });
});
