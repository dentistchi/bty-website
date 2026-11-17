/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LearnDoors } from "./LearnDoors";
import { CreateFoundryEventForm } from "./CreateFoundryEventForm";

const SOURCE = readFileSync(join(process.cwd(), "src/components/foundry/event-rooms/LearnDoors.tsx"), "utf8");

afterEach(() => cleanup());

function renderDoors(locale: "ko" | "en") {
  render(
    <LearnDoors
      locale={locale}
      canCreate
      canOpenLiveEvent
      onOpenLearning={() => {}}
      onCreate={() => {}}
      onOpenQuickTraining={() => {}}
      onOpenEvent={() => {}}
      onOpenMyEvents={() => {}}
    />,
  );
}

describe("Learn landing copy", () => {
  it("keeps the Korean learner heading on the Learn landing", () => {
    const header = readFileSync(join(process.cwd(), "src/components/app-shell/LearnHeader.tsx"), "utf8");
    expect(header).toContain("어떤 걸 더 잘하고 싶으세요?");
  });

  it("groups the Korean training methods separately from the live QR event", () => {
    renderDoors("ko");

    const section = within(screen.getByTestId("training-creation"));
    expect(section.getByRole("heading", { name: "훈련 만들기" })).toBeTruthy();
    expect(section.getByTestId("door-create-training").textContent).toContain("단계별로 훈련 설계");
    expect(section.getByTestId("door-quick-training").textContent).toContain("자료로 훈련 만들기");
    expect(section.queryByTestId("door-open-event")).toBeNull();
    expect(screen.getByTestId("door-open-event").textContent).toContain("현장 이벤트 열기");
    expect(screen.getByTestId("door-open-event").textContent).toContain("팀 모임에서 QR 코드로 참여를 기록하세요.");
    expect(screen.getByTestId("door-my-learning").textContent).toContain("마친 학습");
    expect(screen.queryByTestId("door-my-events")).toBeNull();
  });

  it("uses short, natural Korean without internal architecture vocabulary", () => {
    renderDoors("ko");
    const text = screen.getByTestId("learn-doors").textContent ?? "";
    for (const phrase of [
      "실제 순간", "현장의 실제 문제", "명확한 트레이닝", "참여 현황",
      "Foundry", "파운드리", "모듈", "저니", "프로그램", "리얼리티",
    ]) {
      expect(text, phrase).not.toContain(phrase);
    }
    for (const id of ["door-my-learning", "door-create-training", "door-quick-training", "door-open-event"]) {
      expect((screen.getByTestId(id).textContent ?? "").length, id).toBeLessThanOrEqual(60);
    }
  });

  it("describes the separate roles in English too", () => {
    renderDoors("en");
    const section = within(screen.getByTestId("training-creation"));
    expect(section.getByRole("heading", { name: "Create training" })).toBeTruthy();
    expect(section.getByTestId("door-create-training").textContent).toContain("Build step by step");
    expect(section.getByTestId("door-quick-training").textContent).toContain("Use existing material");
    expect(screen.getByTestId("door-my-learning").textContent).toContain("Learning history");
    expect(screen.getByTestId("door-open-event").textContent).toContain("Open a live event");
    expect(screen.getByTestId("door-open-event").textContent).toContain("Record participation at a team gathering with a QR code.");
    expect(screen.queryByTestId("door-my-events")).toBeNull();
  });

  it("keeps the history, guided-builder, live-event and quick-training callbacks", () => {
    for (const anchor of [
      'data-testid="door-my-learning"',
      'data-testid="door-create-training"',
      'data-testid="door-quick-training"',
      'data-testid="door-open-event"',
      "onClick={onOpenLearning}",
      "onClick={onCreate}",
      "onClick={onOpenQuickTraining}",
      "onClick={onOpenEvent}",
    ]) {
      expect(SOURCE, anchor).toContain(anchor);
    }
  });
});

describe("Korean quick-training form copy", () => {
  it("names the title and action as training", () => {
    render(<CreateFoundryEventForm locale="ko" onCreated={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("heading", { name: "빠른 훈련 만들기" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "훈련 제목" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "훈련 만들기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "퀴즈 추가" })).toBeTruthy();
    expect(screen.queryByText(/이벤트/)).toBeNull();
  });
});
