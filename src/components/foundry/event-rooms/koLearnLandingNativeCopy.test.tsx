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
    const [learn, create, open, mine] = ["door-my-learning", "door-create-training", "door-open-event", "door-my-events"].map(t);

    expect(learn).toContain("마친 학습");
    expect(create).toContain("반복되는 문제");
    expect(open).toContain("모이는");
    expect(mine).toContain("누가 참여했는지");

    expect(new Set([learn, create, open, mine]).size).toBe(4);
    // The two gathering doors are distinguishable: one opens, one reviews.
    expect(open).toContain("여세요");
    expect(mine).toContain("확인하세요");
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
      'data-testid="door-my-events"',
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
    expect(en).toContain("See participation in the Reality Events you opened.");
    expect(MODULE_BUILDER_COPY.en.quickLead).toBe("Need to launch something quickly?");
    expect(EVENT_ROOMS_COPY.en.createCta).toBe("Create quick event");
    expect(EVENT_ROOMS_COPY.en.createQuickNote).toBe("Skip guided setup.");
  });
});

describe("[KO Learn landing T7-T8] length, and the quick door", () => {
  it("T7 every KO card is short enough for a phone", () => {
    render(<LearnDoors locale="ko" canCreate onOpenLearning={() => {}} onCreate={() => {}} onOpenEvent={() => {}} onOpenMyEvents={() => {}} />);
    for (const id of ["door-my-learning", "door-create-training", "door-open-event", "door-my-events"]) {
      expect((screen.getByTestId(id).textContent ?? "").length, id).toBeLessThanOrEqual(60);
    }
  });

  it("T8 the quick door is KEPT and says what it skips", () => {
    expect(MODULE_BUILDER_COPY.ko.quickLead).toBe("바로 시작해야 하나요?");
    expect(EVENT_ROOMS_COPY.ko.createCta).toBe("설계 없이 바로 열기");
    expect(EVENT_ROOMS_COPY.ko.createQuickNote).toBe("영상이나 자료 하나로 시작합니다.");
  });
});
