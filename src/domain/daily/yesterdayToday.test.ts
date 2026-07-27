import { describe, it, expect } from "vitest";
import { buildYesterdaySummary } from "./yesterdaySummary";
import { normalizeTodayItems, todayVisible, TODAY_TOP_N, type TodayItem } from "./todayList";

describe("buildYesterdaySummary — truthful, plural-correct, omit-zero", () => {
  it("composes multiple non-zero categories with correct grammar + compact line", () => {
    const s = buildYesterdaySummary({ trainingsCompleted: 2, trainingsCreated: 1, centerReflections: 1 }, "en");
    expect(s.sentence).toBe("You completed 2 trainings, created 1 training, and reflected in Center.");
    expect(s.compact).toBe("2 learned · 1 created · 1 Center reflection");
  });

  it("singular for 1 training", () => {
    expect(buildYesterdaySummary({ trainingsCompleted: 1 }, "en").sentence).toBe("You completed 1 training yesterday.".replace(" yesterday", ""));
  });

  it("two categories joined with 'and', no compact when <2 parts", () => {
    const s = buildYesterdaySummary({ trainingsCreated: 2, centerReflections: 1 }, "en");
    expect(s.sentence).toBe("You created 2 trainings and reflected in Center.");
    const one = buildYesterdaySummary({ trainingsCompleted: 3 }, "en");
    expect(one.compact).toBeNull(); // single category → no compact duplicate
  });

  it("plural Center reflections", () => {
    expect(buildYesterdaySummary({ centerReflections: 2 }, "en").sentence).toBe("You completed 2 Center reflections.");
  });

  it("OMITS a category whose source is unavailable (undefined) or zero", () => {
    const s = buildYesterdaySummary({ trainingsCompleted: 1, trainingsCreated: undefined, centerReflections: 0 }, "en");
    expect(s.sentence).toBe("You completed 1 training.");
  });

  it("zero everything → presence sentence ONLY when proven, else truthful neutral", () => {
    expect(buildYesterdaySummary({ trainingsCompleted: 0, presence: true }, "en").sentence).toBe("You showed up yesterday.");
    expect(buildYesterdaySummary({ trainingsCompleted: 0 }, "en").sentence).toBe("No completed activity was recorded yesterday.");
  });

  it("never leaks internal terms", () => {
    const s = buildYesterdaySummary({ trainingsCompleted: 2, trainingsCreated: 1, centerReflections: 1 }, "en");
    for (const term of ["Program", "Run", "Event", "Foundry", "ledger", "progress"]) expect(s.sentence).not.toContain(term);
  });

  it("ko composes correctly", () => {
    expect(buildYesterdaySummary({ trainingsCompleted: 2, trainingsCreated: 1 }, "ko").sentence).toContain("트레이닝");
    expect(buildYesterdaySummary({}, "ko").sentence).toBe("어제 완료된 활동이 기록되지 않았습니다.");
  });
});

const item = (id: string, title = "t"): TodayItem => ({ stableId: id, category: "REQUIRED", state: "assigned", title, deepLink: `/x/${id}` });

describe("normalizeTodayItems — dedup by identity, not title", () => {
  it("collapses the same stableId, preserves order", () => {
    const out = normalizeTodayItems([item("a"), item("b"), item("a"), item("c")]);
    expect(out.map((i) => i.stableId)).toEqual(["a", "b", "c"]);
  });
  it("keeps two DIFFERENT items that share a title", () => {
    const out = normalizeTodayItems([item("a", "Same title"), item("b", "Same title")]);
    expect(out.length).toBe(2);
  });
});

describe("todayVisible — display rule (0/1-3/4+, show more/less)", () => {
  const mk = (k: number) => Array.from({ length: k }, (_, i) => item(`i${i}`));
  it("0 items → empty, no more", () => {
    const r = todayVisible(mk(0), false);
    expect(r.visible.length).toBe(0);
    expect(r.hasMore).toBe(false);
  });
  it("1–3 items → show all, no 'show more'", () => {
    for (const k of [1, 2, 3]) {
      const r = todayVisible(mk(k), false);
      expect(r.visible.length).toBe(k);
      expect(r.hasMore).toBe(false);
    }
  });
  it("4 items collapsed → exactly 3 + show more", () => {
    const r = todayVisible(mk(4), false);
    expect(r.visible.length).toBe(TODAY_TOP_N);
    expect(r.hasMore).toBe(true);
  });
  it("4+ expanded → all; collapsing restores the SAME first three in order", () => {
    const items = mk(6);
    expect(todayVisible(items, true).visible.length).toBe(6);
    const collapsed = todayVisible(items, false).visible;
    expect(collapsed.map((i) => i.stableId)).toEqual(["i0", "i1", "i2"]);
  });
});
