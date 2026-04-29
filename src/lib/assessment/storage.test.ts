import { describe, it, expect, beforeEach, vi } from "vitest";
import { saveResult, loadResult, clearResult } from "./storage";
import type { AssessmentResult } from "./types";

const KEY = "bty_assessment_result_v1";

function makeFakeStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: () => null,
  };
}

const minimalResult: AssessmentResult = {
  version: 1,
  createdAtISO: new Date().toISOString(),
  scores: {
    core_self_esteem: 50,
    self_compassion: 50,
    self_esteem_stability: 50,
    growth_mindset: 50,
    social_self_esteem: 50,
  },
  pattern: "balanced",
  barriers: [],
  recommendedTrack: "Balanced Growth",
  summaryTitle_en: "Title",
  summaryTitle_ko: "제목",
  summaryBody_en: "Body",
  summaryBody_ko: "본문",
};

describe("assessment/storage", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", makeFakeStorage());
  });

  it("loadResult returns null when nothing saved", () => {
    expect(loadResult()).toBeNull();
  });

  it("saveResult then loadResult returns same result", () => {
    saveResult(minimalResult);
    const loaded = loadResult();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(minimalResult.version);
    expect(loaded!.pattern).toBe(minimalResult.pattern);
    expect(loaded!.scores.core_self_esteem).toBe(minimalResult.scores.core_self_esteem);
  });

  it("clearResult then loadResult returns null", () => {
    saveResult(minimalResult);
    clearResult();
    expect(loadResult()).toBeNull();
  });
});
