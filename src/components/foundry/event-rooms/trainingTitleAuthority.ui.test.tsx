/** @vitest-environment jsdom */
/**
 * TRAINING TITLE AUTHORITY V1 — BOTH TITLE CONTROLS WRITE THE ONE CANONICAL NAME.
 *
 * The domain half (`trainingTitleAuthority.test.ts`) proves publish reads `answers.title`. That is
 * only half a guarantee: if a Host renames their training in Review and the rename lands solely on
 * `journey.displayTitle`, publish faithfully reads a STALE name and the Founder's defect returns
 * wearing different clothes. These are the two surfaces where a title can be typed.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { JourneyPreview } from "./JourneyPreview";
import { mapAnswersToJourney } from "@/domain/foundry/module/journey";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

const HOST_TITLE = "회의 후 실행 확인하기";
const EDITED_TITLE = "회의 실행 항목 확인하기";

const ANSWERS = (over: Partial<BuilderAnswers> = {}): BuilderAnswers =>
  ({
    title: HOST_TITLE,
    problem: "회의에서 할 일을 정해도 담당자와 마감일을 분명히 확인하지 않아 실행이 빠진다.",
    audienceType: "leaders",
    recurringMoment: "회의가 끝나기 전에 다음 할 일을 정할 때",
    observableBehavior: "회의가 끝나기 전에 각 할 일의 담당자와 마감일을 확인한다.",
    successEvidence: "각 할 일마다 담당자와 마감일이 정해져 있다.",
    evidenceType: "seen",
    materialIntent: "written",
    materialText: "한 장짜리 안내",
    ...over,
  }) as unknown as BuilderAnswers;

afterEach(() => cleanup());

describe("[Title Authority V1] renaming in Review writes the canonical title", () => {
  it("a confirmed title lands on answers.title AND on the journey, in ONE patch", () => {
    const onPatch = vi.fn();
    const answers = ANSWERS({
      realityGroundedJourneyV1: mapAnswersToJourney(ANSWERS(), "ko"),
    } as Partial<BuilderAnswers>);

    render(
      <JourneyPreview locale="ko" answers={answers} onPatch={onPatch} onApprovableChange={() => {}} />,
    );

    fireEvent.change(screen.getByTestId("journey-title-input"), { target: { value: EDITED_TITLE } });
    fireEvent.click(screen.getByTestId("journey-title-confirm"));

    const patch = onPatch.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    /*
      BOTH, IN THE SAME CALL. Two patches would be two chances for a rename to half-land, and the
      draft list and the published room would disagree again in exactly the measured way.
    */
    expect(patch.title, "the Host's rename must reach the field publish reads").toBe(EDITED_TITLE);
    expect((patch.realityGroundedJourneyV1 as { displayTitle: string }).displayTitle).toBe(EDITED_TITLE);
    expect((patch.realityGroundedJourneyV1 as { displayTitleStatus: string }).displayTitleStatus).toBe("grounded");
  });

  it("an untouched title is not rewritten by merely opening Review", () => {
    const onPatch = vi.fn();
    const journey = mapAnswersToJourney(ANSWERS(), "ko");
    render(
      <JourneyPreview
        locale="ko"
        answers={ANSWERS({ realityGroundedJourneyV1: journey } as Partial<BuilderAnswers>)}
        onPatch={onPatch}
        onApprovableChange={() => {}}
      />,
    );
    // Whatever else the preview may persist on mount, it never invents a name change.
    for (const call of onPatch.mock.calls) {
      const p = call[0] as Record<string, unknown>;
      if ("title" in p) expect(p.title).toBe(HOST_TITLE);
    }
  });
});
