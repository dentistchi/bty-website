import { describe, it, expect } from "vitest";
import { looksSensitive, isSafeBriefSentence, isSafeBrief, NEUTRAL_BRIEF } from "./todayBriefSafety";

/** Slice 3.1B-3J — the two AI safety gates + neutral fallback. */

describe("looksSensitive (pre-LLM gate)", () => {
  it("detects emails, phones, long ids, and DOB-like dates", () => {
    expect(looksSensitive("contact jane@example.com about it")).toBe(true);
    expect(looksSensitive("call +1 (415) 555-1234 today")).toBe(true);
    expect(looksSensitive("chart 0093122 flagged")).toBe(true);
    expect(looksSensitive("born 1984-03-02")).toBe(true);
  });
  it("passes ordinary reflective text", () => {
    expect(looksSensitive("Yesterday it felt hard to make sure everyone understood the goal.")).toBe(false);
    expect(looksSensitive("어제는 팀이 같은 방향을 이해하는지 확인하는 일이 중요했다.")).toBe(false);
  });
});

describe("isSafeBriefSentence (post-generation gate)", () => {
  it("rejects diagnostic / personality / health / loyalty language", () => {
    for (const bad of [
      "You are antisocial.",
      "You avoid conflict.",
      "You have low emotional intelligence.",
      "You appear depressed.",
      "You are not a people person.",
      "This reveals your personality.",
      "당신은 반사회적입니다.",
      "우울해 보입니다.",
    ]) {
      expect(isSafeBriefSentence(bad)).toBe(false);
    }
  });
  it("accepts calm, practical, non-diagnostic sentences", () => {
    expect(isSafeBriefSentence("Yesterday, making sure the team understood the same goal felt important.")).toBe(true);
    expect(isSafeBriefSentence("Today, ask one person to explain the goal in their own words.")).toBe(true);
  });
  it("rejects empty or overlong output", () => {
    expect(isSafeBriefSentence("")).toBe(false);
    expect(isSafeBriefSentence("x".repeat(300))).toBe(false);
  });
  it("isSafeBrief requires BOTH sentences safe", () => {
    expect(isSafeBrief("A calm observation.", "A practical suggestion.")).toBe(true);
    expect(isSafeBrief("A calm observation.", "You are antisocial.")).toBe(false);
  });
});

describe("NEUTRAL_BRIEF", () => {
  it("has EN + KO fallback copy (safety fallback, not interpretation)", () => {
    expect(NEUTRAL_BRIEF.en.yesterdayObservation).toMatch(/reflection/i);
    expect(NEUTRAL_BRIEF.ko.todaySuggestion).toContain("행동");
  });
});
