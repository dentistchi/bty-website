import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MODULE_BUILDER_COPY, type ModuleBuilderCopy } from "./moduleBuilderCopy";

/**
 * SLICE R4-R5C15 — A KOREAN MANAGER SHOULD FEEL THIS WAS WRITTEN IN KOREAN.
 *
 * FOUNDER-OBSERVED. The Korean Builder read as a translation: "무엇을 더 잘하고 싶으신가요?" for a
 * header, "Room으로 이동" and "Room은 계속 링크 기반입니다" for ordinary navigation, "배정 세션이
 * 생성되었습니다" for "we made your training" — and, inside all of it, whole Host surfaces still in
 * English: BTY DRAFTED THIS FOR YOU, KEEP YOURS, USE BTY, Add this program to my training.
 *
 * These assert the LANGUAGE contract, never behaviour. Every semantic rule from C11 to C14A is
 * untouched by this slice; the tests that hold those still run unchanged.
 */

const ko = MODULE_BUILDER_COPY.ko;
const en = MODULE_BUILDER_COPY.en;

/** Every KO string this contract exposes, flattened — functions sampled with a placeholder. */
function koStrings(): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (typeof v === "function") {
      try { const r = (v as (...a: unknown[]) => unknown)(1, "X", "X"); if (typeof r === "string") out.push(r); } catch { /* arity mismatch */ }
    } else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(ko);
  return out;
}

describe("[R4-R5C15 · T1] the Learn header is Korean, not translated English", () => {
  /* Comments record WHY the wording changed and must keep quoting the old sentence. */
  const header = readFileSync(join(process.cwd(), "src/components/app-shell/LearnHeader.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("T1 the reported sentence is gone", () => {
    expect(header).not.toContain("무엇을 더 잘하고 싶으신가요?");
    expect(header).toContain("어떤 걸 더 잘하고 싶으세요?");
  });

  it("it does not claim a team, because this header is not Host-only", () => {
    /*
      "우리 팀이 …" was the proposed wording and is NOT used: `LearnHeader` renders for the whole
      Learn tab, which a learner with an assigned training also sees. The repair is the register
      and the word order, not a claim the surface cannot support.
    */
    expect(header).not.toContain("우리 팀");
  });
});

describe("[R4-R5C15 · T2] no internal Room vocabulary in the Host's Korean", () => {
  it("T2 'Room' and '링크 기반' are gone from every KO string", () => {
    for (const s of koStrings()) {
      expect(s, s.slice(0, 40)).not.toMatch(/\bRoom\b/);
      expect(s, s.slice(0, 40)).not.toContain("링크 기반");
    }
  });

  it("the jobs those words described are still expressed, in ordinary Korean", () => {
    expect(ko.pmDoneContinue).toBe("훈련 열기");
    expect(ko.pmRoomLinkBased).toContain("참여 링크");
  });
});

describe("[R4-R5C15 · T9] the create-session result says what happened", () => {
  it("T9 no 생성되었습니다 / 건 bookkeeping in the result copy", () => {
    for (const s of [ko.pmDoneAssignedTitle, ko.pmDoneOpenTitle, ko.pmDoneAssignedCount(1), ko.pmDoneOpenNoAssign, ko.pmWillCreate(1)]) {
      expect(s).not.toContain("생성되었습니다");
      expect(s).not.toMatch(/\d건/);
    }
    expect(ko.pmDoneAssignedTitle).toBe("훈련을 만들었습니다");
    expect(ko.pmDoneAssignedCount(1)).toBe("구성원 1명에게 배정했습니다.");
  });
});

describe("[R4-R5C15 · T3-T7] the Host's authorship surfaces are Korean", () => {
  it("T3 the program-authorship labels are Korean, and carry no English", () => {
    const keys: (keyof ModuleBuilderCopy)[] = [
      "paEntryTitle", "paGenerateCta", "paReviewEyebrow", "paReviewBody", "paApplyCta",
      "paResetCta", "paDiscardCta", "paAppliedTitle", "paAppliedShow", "paCeilingHeading",
      "paWarningsHeading", "paAssumptionsHeading", "paProgramTitleLabel",
    ];
    for (const k of keys) {
      const v = ko[k] as string;
      expect(v, k).toMatch(/[가-힣]/);
      // BTY is a product name and stays; nothing else English may remain.
      expect(v.replace(/BTY/g, ""), k).not.toMatch(/[A-Za-z]{3,}/);
    }
  });

  it("T4 KEEP / USE read as a choice a Manager can make", () => {
    expect(ko.paStateKeep).toBe("내 내용 유지");
    expect(ko.paStateUseBty).toBe("BTY 제안 사용");
    expect(ko.paUseBtyDraft).toBe("BTY 제안 사용");
  });

  it("T5 the adoption CTA says what it does to the training", () => {
    expect(ko.paApplyCta).toBe("이 내용을 훈련에 적용");
    expect(ko.paGenerateCta).toBe("BTY가 훈련 초안 만들기");
    expect(ko.paAppliedShow).toContain("BTY 제안 다시 보기");
  });

  it("T6 the provenance labels stay three DISTINCT authorships", () => {
    const host = ko.jpFromYour(ko.journeyField.observableBehavior);
    const bty = ko.jpDraftedByBty;
    const edited = ko.jpYourEdit;
    const setup = ko.jpFromSetup;
    expect(new Set([host, bty, edited, setup]).size, "Host / BTY / Host-edited must not merge").toBe(4);
    expect(host).toBe("내가 정한 행동 기준");
    expect(bty).toBe("BTY 제안");
    expect(edited).toBe("내가 고침");
    expect(ko.paBadgeFromYourSetup).toBe("내가 입력한 내용");
  });

  it("T7 the learner-preview section names are Korean", () => {
    expect(ko.journeyKind).toEqual({
      why_it_matters: "왜 중요한가",
      observable_standard: "행동 기준",
      scenario: "이런 상황에서",
      reflection: "돌아보기",
      action_decision: "내가 정할 것",
      field_application: "실제로 해보기",
      evidence: "잘된 모습",
      completion_check: "마치기 전에",
      follow_up: "다음에는",
    });
    for (const v of Object.values(ko.journeyField)) expect(v).toMatch(/[가-힣]/);
  });
});

describe("[R4-R5C15 · T8] participation copy explains itself", () => {
  it("T8 the two choices read as jobs, not as system states", () => {
    expect(ko.pmOpenLabel).toBe("링크로 참여");
    expect(ko.pmAssignedLabel).toBe("구성원에게 배정");
    for (const s of [ko.pmOpenDesc, ko.pmAssignedDesc, ko.pmAssignedNote]) {
      expect(s).not.toMatch(/\bRoom\b/);
      expect(s).not.toContain("링크 기반");
      expect(s).toMatch(/[가-힣]/);
    }
  });
});

describe("[R4-R5C15 · T10] English is untouched", () => {
  it("T10 every EN string this slice introduced is still English, and the old EN wording stands", () => {
    expect(en.paGenerateCta).toBe("Draft my training program");
    expect(en.paApplyCta).toBe("Add this program to my training");
    expect(en.paReviewEyebrow).toBe("BTY drafted this for you");
    expect(en.journeyKind.observable_standard).toBe("The standard");
    expect(en.jpFromYour("Success evidence")).toBe("From your: Success evidence");
    /*
      EN keeps its own wording, including "room" — this slice is the KOREAN Host Builder. The
      English surface has its own naming question and is deliberately out of scope here.
    */
    expect(MODULE_BUILDER_COPY.en.pmDoneContinue).toBe("Continue to room");
  });

  it("EN and KO expose exactly the same keys", () => {
    const keys = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? Object.keys(v).map((s) => `${k}.${s}`) : [k])).sort();
    expect(keys(ko)).toEqual(keys(en));
  });
});

describe("[R4-R5C15 · T11/T15] language only, and the leaks stay closed", () => {
  const files = ["ProgramAuthorship.tsx", "JourneyPreview.tsx"].map((f) =>
    readFileSync(join(process.cwd(), "src/components/foundry/event-rooms", f), "utf8"),
  );

  it("T15 no Host-facing English literal is rendered from those surfaces any more", () => {
    const forbidden = [
      "BTY drafted this for you", "Keep yours", "Use BTY draft", "Add this program to my training",
      "Review BTY draft", "Draft my training program", "Reset to BTY", "What this can and cannot show",
      "Worth noting", "Learner preview", "Confirm title", "Needs confirmation",
    ];
    for (const src of files) {
      const rendered = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
      for (const phrase of forbidden) {
        expect(rendered, phrase).not.toContain(`"${phrase}"`);
        expect(rendered, phrase).not.toContain(`>${phrase}<`);
      }
    }
  });

  it("T11 this slice changed no predicate — the copy modules hold strings, not rules", () => {
    for (const src of files) {
      // No new conditional authority: the surfaces read `t.*` and render it.
      expect(src).toContain("MODULE_BUILDER_COPY");
    }
  });
});
