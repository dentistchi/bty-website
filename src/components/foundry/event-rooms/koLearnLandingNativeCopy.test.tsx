/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LearnDoors } from "./LearnDoors";
import { MODULE_BUILDER_COPY } from "./moduleBuilderCopy";
import { EVENT_ROOMS_COPY } from "./copy";

/**
 * THE KOREAN LEARN LANDING, READ AS KOREAN.
 *
 * FOUNDER DEVICE. The header repaired by R4-R5C15 reads naturally, and the cards underneath it
 * still read like a translated system diagram: the create door said "현장의 실제 문제를 팀을 위한
 * 명확한 트레이닝으로 만드세요", the event door "팀이 참여할 실제 순간을 여세요". These are the
 * FIRST four things a Korean user sees.
 *
 * MEASURED BEFORE REWORDING - every door traced to what it actually opens:
 *
 *   학습 기록      onOpenMyLearning -> foundryView "my-learning"      what I have finished
 *   훈련 만들기    startNewDraft -> POST /foundry/modules -> Builder  author a training
 *   팀 모으기      onOpenEvent -> "event-create" -> EventCreateClient   a real gathering, QR check-in
 *   내가 연 자리   onOpenMyEvents -> "event-list" -> EventHostList     who turned up
 *   (quick)         onQuickEvent -> CreateFoundryEventForm            a room from one video/PDF
 *
 * ONE WORD WAS DOING TWO JOBS. The two landing doors meant a Reality Event - people in a room,
 * scanning a QR - while the quick-start button underneath means a Foundry training room built
 * from one video. Same word, different things, three taps apart. The doors now say what they
 * open; the quick path says what it skips.
 *
 * THE QUICK DOOR IS NOT REDUNDANT, and was checked before being kept: `startNewDraft` POSTs a
 * module draft and lands in the Builder, while `onQuickEvent` renders `CreateFoundryEventForm`,
 * which requires a video or a document and never creates a draft. Two different products, so
 * COPY REPAIR ONLY - no door was removed.
 *
 * KO ONLY. English is untouched, and so is every route, handler and capability gate.
 */

const koDoors = () => {
  render(<LearnDoors locale="ko" canCreate onOpenLearning={() => {}} onCreate={() => {}} onOpenEvent={() => {}} onOpenMyEvents={() => {}} />);
  return screen.getByTestId("learn-doors").textContent ?? "";
};

const SOURCE = readFileSync(join(process.cwd(), "src/components/foundry/event-rooms/LearnDoors.tsx"), "utf8");

afterEach(() => cleanup());

describe("[KO Learn landing T1-T3] the translated phrases are gone", () => {
  it("T1 the header the Founder already passed is untouched", () => {
    const header = readFileSync(join(process.cwd(), "src/components/app-shell/LearnHeader.tsx"), "utf8");
    expect(header).toContain("어떤 걸 더 잘하고 싶으세요?");
  });

  it("T2 no Reality-Event vocabulary on the KO landing", () => {
    expect(koDoors()).not.toContain("리얼리티 이벤트");
    expect(MODULE_BUILDER_COPY.ko.quickLead).not.toContain("리얼리티");
  });

  it("T3 no translated phrases survive", () => {
    const text = koDoors();
    for (const phrase of ["실제 순간", "현장의 실제 문제", "명확한 트레이닝", "참여 현황"]) {
      expect(text, phrase).not.toContain(phrase);
    }
  });
});

describe("[KO Learn landing T4] each card is one obvious, distinct job", () => {
  it("T4 the four doors name four different jobs", () => {
    render(<LearnDoors locale="ko" canCreate onOpenLearning={() => {}} onCreate={() => {}} onOpenEvent={() => {}} onOpenMyEvents={() => {}} />);
    const t = (id: string) => screen.getByTestId(id).textContent ?? "";
    /*
      THREE doors now, not four: the legacy QR "내가 만든 이벤트" door was retired from the UI in IA
      simplification V1. It opened a different product (`bty_events`, 0 rows in production) from the
      training sessions beside it, and two unrelated things called "이벤트" on one screen was most of
      what made this landing confusing. The rule this test holds — every door names a DIFFERENT job
      — is unchanged and now easier to satisfy honestly.
    */
    const [learn, create, open] = ["door-my-learning", "door-create-training", "door-open-event"].map(t);

    expect(learn).toContain("마친 학습");
    expect(create).toContain("반복되는 문제");
    expect(open).toContain("팀이 참여할");
    expect(screen.queryByTestId("door-my-events"), "the legacy QR door is gone").toBeNull();

    expect(new Set([learn, create, open]).size).toBe(3);
    /*
      FOUNDER-CORRECTED, then narrowed by IA simplification V1. The original pair was "open a
      Reality Event" and "check who joined the ones I opened"; the second of those was the legacy
      QR door, now retired from the UI. The surviving door keeps the ordinary word — the defect was
      always the OVERLOADING of "이벤트" across two unrelated products, not the word itself, and
      retiring one of them is what actually removed the overload.
    */
    expect(open).toContain("만드세요");
  });

  it("uses no architecture vocabulary in Korean either", () => {
    const text = koDoors();
    for (const term of ["Foundry", "파운드리", "모듈", "저니", "프로그램", "리얼리티"]) {
      expect(text, term).not.toContain(term);
    }
  });
});

describe("[KO Learn landing T5-T6] nothing but words moved", () => {
  it("T5 no handler, testid or capability gate changed", () => {
    for (const anchor of [
      'data-testid="door-my-learning"',
      'data-testid="door-create-training"',
      'data-testid="door-open-event"',
      "onClick={onOpenLearning}",
      "onClick={onCreate}",
    ]) {
      expect(SOURCE, anchor).toContain(anchor);
    }
  });

  it("T6 English is byte-identical to what shipped", () => {
    render(<LearnDoors locale="en" canCreate onOpenLearning={() => {}} onCreate={() => {}} onOpenEvent={() => {}} onOpenMyEvents={() => {}} />);
    const en = screen.getByTestId("learn-doors").textContent ?? "";
    expect(en).toContain("Learning history");
    expect(en).toContain("Turn a real workplace issue into clear training for your team.");
    expect(en).toContain("Open a real moment for your team to participate in.");
    // The legacy QR "My events" door's copy is no longer rendered — the door was retired from the
    // UI. Its STRING is still in the copy table, unchanged, for the day Live Experience returns.
    expect(en).not.toContain("See participation in the Reality Events you opened.");
    // ...but its STRING is still in LearnDoors' own copy table, untouched, for the day Live
    // Experience returns with a deliberate design.
    expect(readFileSync("src/components/foundry/event-rooms/LearnDoors.tsx", "utf8"))
      .toContain("See participation in the Reality Events you opened.");
    expect(MODULE_BUILDER_COPY.en.quickLead).toBe("Need to launch something quickly?");
    expect(EVENT_ROOMS_COPY.en.createCta).toBe("Create quick event");
    expect(EVENT_ROOMS_COPY.en.createQuickNote).toBe("Skip guided setup.");
  });
});

describe("[KO Learn landing T7-T8] length, and the quick door", () => {
  it("T7 every KO card is short enough for a phone", () => {
    render(<LearnDoors locale="ko" canCreate onOpenLearning={() => {}} onCreate={() => {}} onOpenEvent={() => {}} onOpenMyEvents={() => {}} />);
    for (const id of ["door-my-learning", "door-create-training", "door-open-event"]) {
      expect((screen.getByTestId(id).textContent ?? "").length, id).toBeLessThanOrEqual(60);
    }
  });

  it("T8 the quick door is KEPT and says what it skips", () => {
    expect(MODULE_BUILDER_COPY.ko.quickLead).toBe("바로 시작해야 하나요?");
    expect(EVENT_ROOMS_COPY.ko.createCta).toBe("자료로 바로 시작하기");
    expect(EVENT_ROOMS_COPY.ko.createQuickNote).toBe("영상이나 자료 하나로 훈련을 바로 시작하세요.");
    // The quick door is a TRAINING door: it must not borrow the Reality-Event word.
    expect(EVENT_ROOMS_COPY.ko.createCta).not.toContain("이벤트");
    expect(EVENT_ROOMS_COPY.ko.createQuickNote).not.toContain("이벤트");
    expect(MODULE_BUILDER_COPY.ko.quickLead).not.toContain("이벤트");
  });
});
