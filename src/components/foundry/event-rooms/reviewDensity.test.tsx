/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { JourneyPreview } from "./JourneyPreview";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";
import type { RealityGroundedJourneyV1 } from "@/domain/foundry/module/journey";

/**
 * SLICE R4-R2E-R3 — REVIEW DENSITY.
 *
 * The Founder's report: Review became understandable and then became crowded. Four separate
 * things said "you can edit here" — the `LEARNER PREVIEW` eyebrow, a `YOURS TO EDIT` chip, a
 * sentence, and a per-field `EDITABLE` badge — above a field whose gold treatment already said
 * it. Provenance sat on the same line as the section name, competing with it.
 *
 * THESE TESTS PIN THE MEANING THAT MUST SURVIVE THE TIDYING, not the spacing. Nothing here
 * asserts a padding value or a class string, because that is how a layout test becomes a
 * maintenance tax without becoming a safety net. What is asserted is what the Founder would
 * lose if the simplification went too far: the fields still edit, the provenance is still there
 * and still says the same thing, and the accessible names survive the badges being deleted.
 */
const FIXTURE: BuilderAnswers = {
  problem: "During huddles people leave without naming who will act.",
  recurringMoment: "at each handoff point",
  observableBehavior: "The owner repeats the action and deadline aloud before the huddle ends.",
  successEvidence: "The huddle note records one owner and one deadline per action.",
  completionPrompt: "After your next huddle, what action had a named owner?",
};

const el = (kind: string, content: string, sourceType: string) => ({
  id: `el_${kind}`, kind, content,
  grounding: [{ sourceType, field: "problem" }],
  confirmationStatus: "grounded" as const,
});

const JOURNEY = {
  version: 1,
  displayTitle: "End every huddle with an owner",
  displayTitleStatus: "grounded",
  elements: [
    el("why_it_matters", "People leave huddles without an owner.", "host_statement"),
    el("observable_standard", "The huddle leader names one owner and one deadline.", "ai_proposed"),
    el("completion_check", "What will you say at the next huddle?", "host_edited"),
  ],
} as unknown as RealityGroundedJourneyV1;

function Host({ spy }: { spy?: (p: BuilderAnswers) => void }) {
  const [answers, setAnswers] = useState<BuilderAnswers>({ ...FIXTURE, realityGroundedJourneyV1: JOURNEY });
  return (
    <JourneyPreview
      locale="en"
      answers={answers}
      onPatch={(partial) => { spy?.(partial); setAnswers((prev) => ({ ...prev, ...partial })); }}
      onApprovableChange={() => {}}
    />
  );
}

afterEach(() => cleanup());

describe("[R4-R2E-R3] the tidying kept every meaning", () => {
  it("1 — the learner-facing fields are still editable, and edits still persist", () => {
    const spy = vi.fn();
    render(<Host spy={spy} />);
    const box = () => screen.getByTestId("journey-edit-observable_standard") as HTMLTextAreaElement;
    expect(box().tagName).toBe("TEXTAREA");
    expect(box().readOnly).toBe(false);
    expect(box().disabled).toBe(false);

    fireEvent.change(box(), { target: { value: "The leader says the owner's name out loud." } });
    expect(box().value).toBe("The leader says the owner's name out loud.");
    expect(spy).toHaveBeenCalled();
  });

  it("2 — provenance is still present on every section, and still means the same thing", () => {
    render(<Host />);
    // Present, and still carrying its machine-readable class — the R4-R2E-R2 attribution rule
    // reads this, so a cosmetic slice must not disturb it.
    expect(screen.getByTestId("journey-grounded-why_it_matters").textContent).toMatch(/From your/i);
    expect(screen.getByTestId("journey-grounded-why_it_matters").getAttribute("data-provenance")).toBe("from_host");
    expect(screen.getByTestId("journey-grounded-observable_standard").textContent).toMatch(/Drafted by BTY/i);
    expect(screen.getByTestId("journey-grounded-completion_check").textContent).toMatch(/Your edit/i);
  });

  it("3 — the learner's own words are visually the larger thing, not the metadata", () => {
    /*
      The one size assertion in this file, and it is a RELATIVE one: whatever the exact values
      become, the text the learner reads may never render smaller than the label describing where
      it came from. That is the Founder's G3 in a form a test can hold.
    */
    render(<Host />);
    const content = screen.getByTestId("journey-edit-observable_standard").className;
    const provenance = screen.getByTestId("journey-grounded-observable_standard").className;
    const rem = (c: string) => Number(/text-\[([\d.]+)rem\]/.exec(c)?.[1] ?? (/(^|\s)text-sm(\s|$)/.test(c) ? 0.875 : 1));
    expect(rem(content)).toBeGreaterThan(rem(provenance));
  });

  it("4 — deleting the badges cost no accessible name", () => {
    render(<Host />);
    // The title's name comes from its <label htmlFor>, each field's from its aria-label.
    expect(screen.getByLabelText("Learner title")).toBeTruthy();
    expect(screen.getByLabelText(/The standard — the learner reads this/)).toBeTruthy();
    expect(screen.getByLabelText(/Why this matters — the learner reads this/)).toBeTruthy();
    // …and the removed chips really are gone, so the repetition cannot creep back unnoticed.
    expect(screen.queryByTestId("journey-editable-chip")).toBeNull();
    expect(screen.queryByText("Editable")).toBeNull();
  });

  it("the one kept explanation still tells the Host what this screen is for", () => {
    render(<Host />);
    expect(screen.getByTestId("journey-preview").textContent).toMatch(/text you can rewrite/i);
  });

  it("a section still needing confirmation keeps its call to action in the header", () => {
    // "Needs confirmation" is a thing to DO, so it did not move to the footnote with provenance.
    const needy = {
      ...JOURNEY,
      elements: [{ ...(JOURNEY.elements[0] as object), content: "", confirmationStatus: "needs_confirmation" }],
    } as unknown as RealityGroundedJourneyV1;
    render(
      <JourneyPreview
      locale="en"
        answers={{ ...FIXTURE, realityGroundedJourneyV1: needy }}
        onPatch={() => {}}
        onApprovableChange={() => {}}
      />,
    );
    expect(screen.getByTestId("journey-needs-why_it_matters")).toBeTruthy();
    expect(screen.queryByTestId("journey-grounded-why_it_matters")).toBeNull();
  });
});
