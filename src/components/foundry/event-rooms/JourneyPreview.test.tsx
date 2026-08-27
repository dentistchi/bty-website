/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { JourneyPreview } from "./JourneyPreview";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

const FIXTURE: BuilderAnswers = {
  problem: "During huddles people leave without naming who will act or when.",
  recurringMoment: "at each handoff point",
  observableBehavior: "The owner repeats the action and deadline aloud before the huddle ends.",
  successEvidence: "The huddle note records one owner and one deadline per action.",
  completionPrompt: "After your next huddle, what action had a named owner and deadline?",
};

afterEach(() => cleanup());

describe("JourneyPreview — Host control + approval gate (B3A)", () => {
  it("shows the learner preview grounded to Host fields; blocks approval until the title is confirmed", () => {
    const onPatch = vi.fn();
    const onApprovableChange = vi.fn();
    render(<JourneyPreview locale="en" answers={FIXTURE} onPatch={onPatch} onApprovableChange={onApprovableChange} />);

    // seeds the derived Journey so the draft becomes Journey-enabled
    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({ realityGroundedJourneyV1: expect.any(Object) }), true);
    // grounded elements show provenance, not a needs badge
    expect(screen.getByTestId("journey-grounded-why_it_matters").textContent).toContain("From your");
    expect(screen.getByTestId("journey-preview-el-why_it_matters")).toBeTruthy();
    // title starts needs_confirmation → NOT approvable
    expect(onApprovableChange).toHaveBeenLastCalledWith(false);

    fireEvent.change(screen.getByTestId("journey-title-input"), { target: { value: "Owning the next step" } });
    fireEvent.click(screen.getByTestId("journey-title-confirm"));
    // now title + all elements grounded → approvable
    expect(onApprovableChange).toHaveBeenLastCalledWith(true);
  });

  it("flags a missing required element needs_confirmation and clears it on Host edit", () => {
    const onApprovableChange = vi.fn();
    render(
      <JourneyPreview
      locale="en"
        /*
          Slice R4-R8B — the UNRESOLVED example moved from the completion question to the problem.
          BTY writes the completion check itself when the Host never authored one, so emptying
          `completionPrompt` no longer produces an unconfirmed element; emptying `problem` does,
          and the gate under test — an unresolved element blocks approval until the Host writes it
          — is unchanged.
        */
        answers={{ ...FIXTURE, problem: "" }}
        onPatch={vi.fn()}
        onApprovableChange={onApprovableChange}
      />,
    );
    expect(screen.getByTestId("journey-needs-why_it_matters")).toBeTruthy();
    expect(onApprovableChange).toHaveBeenLastCalledWith(false);

    // Host writes the section in their own words → grounded
    fireEvent.change(screen.getByTestId("journey-edit-why_it_matters"), { target: { value: "Actions leave the huddle unowned." } });
    // confirm the title too
    fireEvent.change(screen.getByTestId("journey-title-input"), { target: { value: "Owning the next step" } });
    fireEvent.click(screen.getByTestId("journey-title-confirm"));
    expect(onApprovableChange).toHaveBeenLastCalledWith(true);
    expect(screen.queryByTestId("journey-needs-why_it_matters")).toBeNull();
  });
});
