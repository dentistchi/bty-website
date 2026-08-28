/**
 * KO ACTION CONTRACT V1 — the prompt half (Slice R4-R10A).
 *
 * MEASURED BEFORE THIS EXISTED: `isKo` appeared exactly twice in the whole prompt builder — its
 * own definition, and one line saying "Write ALL participant-facing text in Korean". The action
 * CONTRACT fields are not participant-facing text, every example for them was English, and every
 * WRONG example teaching the authority boundary was English too. A model returning English action
 * fields for a Korean training was conforming to the prompt as written.
 *
 * Asserted CLAUSE BY CLAUSE, never as a snapshot: the wording of a prompt should be free to
 * improve, and a snapshot test would make every improvement look like a regression.
 */
import { describe, it, expect } from "vitest";
import { systemPrompt } from "./programAuthorshipService";

const REQUIRED = ["why_it_matters", "observable_standard", "action_decision", "completion_check"];
const build = (locale: "en" | "ko") =>
  systemPrompt(locale, REQUIRED, "ceiling", { exists: [], contentsVerified: false } as never, [], [], "성공 기준", "회의가 끝나기 전에");

describe("R4-R10A — the KO prompt names the ACTION contract", () => {
  const ko = build("ko");

  it("names both action fields", () => {
    expect(ko).toContain("action_verb");
    expect(ko).toContain("action_detail");
  });

  it("requires them in Korean specifically, not only 'participant-facing text'", () => {
    expect(ko).toMatch(/action_verb and action_detail in KOREAN/i);
  });

  it("forbids naming WHO, WHEN, and the success evidence", () => {
    expect(ko).toMatch(/NEVER name WHO/i);
    expect(ko).toMatch(/NEVER name WHEN/i);
    expect(ko).toMatch(/NEVER repeat the host's success evidence/i);
  });

  it("teaches the boundary with KOREAN examples, not only English ones", () => {
    expect(ko).toContain("담당자와 마감일을 확인한다");
    expect(ko).toContain("팀 리더가 담당자와 마감일을 확인한다");
    expect(ko).toContain("회의가 끝나기 전에 담당자와 마감일을 확인한다");
  });

  it("states the acronym allowance, so the fix is never read as 'no Latin characters'", () => {
    for (const term of ["KPI", "CRM", "QR", "Slack"]) expect(ko, term).toContain(term);
  });

  it("keeps the existing global language line", () => {
    expect(ko).toContain("Write ALL participant-facing text in Korean.");
  });

  it("leaves the English prompt unchanged in shape", () => {
    const en = build("en");
    expect(en).toContain("Write ALL participant-facing text in English.");
    // The KO-only contract block must not leak into an English training.
    expect(en).not.toMatch(/action_verb and action_detail in KOREAN/i);
    expect(en).not.toContain("담당자와 마감일을 확인한다");
  });
});
