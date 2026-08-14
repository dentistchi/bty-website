/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { JourneyReading } from "./JourneyReading";
import { toPublicJourney } from "@/domain/foundry/module/journey";
import type { RealityGroundedJourneyV1 } from "@/domain/foundry/module/journey";

/**
 * SLICE 3.2R-R8A — THE PROGRAM WAS PUBLISHED AND NEVER DELIVERED.
 *
 * Canonical v3 (`442b5427`) froze all eight journey elements, including the reflection the
 * generator wrote — "What usually happens when an action needs an owner after a huddle?" — and a
 * PDF learner saw none of them. The document snapshot carried no journey at all, so the entire
 * seven-part program reached the learner as one question, `content.completion_prompt`, under a
 * label that said REFLECTION.
 *
 * The YouTube learner has rendered the journey since 3.2C. This is a delivery gap on one content
 * type, not a schema or authorship problem: nothing needed republishing, no migration, and no
 * proposal changed.
 *
 * ═══ JOURNEY DELIVERY AND REFLECTION EVIDENCE ARE SEPARATE AUTHORITIES ═══
 *
 * After this slice the REFLECT question is VISIBLE. There is still no dedicated reflection
 * answer field, `response_text` still stores the answer to the completion prompt, and REFLECTED
 * is still derived from that. None of that is fixed here and none of it may be claimed. The
 * completion surface deliberately keeps its current wording so the remaining defect stays
 * visible rather than being papered over by a cosmetic relabel. That correction is R8B's.
 */

/** The exact frozen v3 journey, as read from `foundry_event_module.module_snapshot`. */
const V3_JOURNEY = {
  version: 1,
  displayTitle: "Building Accountability in Huddles",
  displayTitleStatus: "grounded",
  elements: [
    ["why_it_matters", "During morning huddles, team members report problems but leave without naming who will act or when the next step will happen. This program introduces one visible way of working: you state the owner, action, and deadline for each agreed item."],
    ["observable_standard", "During morning huddles, you must state the owner, action, and deadline for each agreed item. Completion evidence: The huddle note records one owner and one deadline for every agreed action."],
    ["scenario", "During morning huddles, even when it is not obvious who should take it, you must state the owner, action, and deadline for each agreed item."],
    ["reflection", "What usually happens when an action needs an owner after a huddle?"],
    ["field_application", "The next time this happens, you must state the owner, action, and deadline for each agreed item."],
    ["evidence", "The huddle note records one owner and one deadline for every agreed action."],
    ["completion_check", "What exactly will you say when you state the owner, action, and deadline for each agreed item?"],
    ["follow_up", "In 7 days you will be asked what happened after you were expected to state the owner, action, and deadline for each agreed item. That is your own account of it, not an observation."],
  ].map(([kind, content]) => ({ id: `el_${kind}`, kind, content, grounding: [], confirmationStatus: "grounded" })),
} as unknown as RealityGroundedJourneyV1;

afterEach(cleanup);

describe("[3.2R-R8A] the document learner meets the authored program", () => {
  const journey = toPublicJourney(V3_JOURNEY);

  it("E–J — every authored section a learner should read is rendered", () => {
    render(<JourneyReading journey={journey} locale="en" />);
    for (const [kind, label] of [
      ["why_it_matters", "WHY THIS MATTERS"],
      ["observable_standard", "THE STANDARD"],
      ["scenario", "IN CONTEXT"],
      ["reflection", "REFLECT"],
      ["field_application", "APPLY IT"],
      ["evidence", "WHAT SUCCESS LOOKS LIKE"],
      ["follow_up", "WHAT HAPPENS NEXT"],
    ] as const) {
      expect(screen.getByTestId(`journey-el-${kind}`), kind).toBeTruthy();
      expect(screen.getByText(label), label).toBeTruthy();
    }
  });

  it("the generated REFLECT question itself reaches the screen", () => {
    render(<JourneyReading journey={journey} locale="en" />);
    expect(screen.getByText("What usually happens when an action needs an owner after a huddle?")).toBeTruthy();
  });

  it("D — completion_check is NOT in the reading list; it keeps its own surface", () => {
    render(<JourneyReading journey={journey} locale="en" />);
    expect(screen.queryByTestId("journey-el-completion_check")).toBeNull();
    expect(screen.queryByText("What exactly will you say when you state the owner, action, and deadline for each agreed item?")).toBeNull();
  });

  it("REFLECT and BEFORE YOU FINISH are different questions and must never merge", () => {
    const reflect = V3_JOURNEY.elements.find((e) => e.kind === "reflection")!.content;
    const finish = V3_JOURNEY.elements.find((e) => e.kind === "completion_check")!.content;
    expect(reflect).not.toBe(finish);
    // One asks what already happens; the other asks what you will say. Different evidence.
    expect(reflect.startsWith("What usually happens")).toBe(true);
    expect(finish.startsWith("What exactly will you say")).toBe(true);
  });

  it("the Host's own authorities survive delivery verbatim", () => {
    render(<JourneyReading journey={journey} locale="en" />);
    expect(screen.getAllByText(/During morning huddles/).length).toBeGreaterThan(0);
    expect(screen.getByText(/it is not obvious who should take it/)).toBeTruthy();
    expect(screen.getAllByText(/The huddle note records one owner and one deadline/).length).toBeGreaterThan(0);
    expect(screen.getByText(/not an observation/)).toBeTruthy();
  });

  it("C — a published event with no journey still renders the old flow", () => {
    const { container } = render(<JourneyReading journey={null} locale="en" />);
    expect(container.firstChild, "no journey must render nothing, never a fabricated one").toBeNull();
    const empty = render(<JourneyReading journey={{ displayTitle: "x", elements: [] }} locale="en" />);
    expect(empty.container.firstChild).toBeNull();
  });

  it("B — the projection carries content only: no provenance, no status, no storage", () => {
    /*
      CHECKED BY STRUCTURE, NOT BY SUBSTRING. A first version scanned the serialized JSON for
      forbidden words and failed on "owner" — which appears in the training's own sentence
      "state the owner, action, and deadline". Content is the payload; only the SHAPE can leak.
    */
    expect(Object.keys(journey!).sort()).toEqual(["displayTitle", "elements"]);
    for (const el of journey!.elements) {
      expect(Object.keys(el).sort(), el.kind).toEqual(["content", "id", "kind"]);
    }
  });

  it("P — the label map is the same one the YouTube learner has always used", () => {
    // One presentation authority: extracted, not copied. A second renderer would drift.
    render(<JourneyReading journey={journey} locale="ko" />);
    expect(screen.getByText("성찰")).toBeTruthy();
    expect(screen.getByText("왜 중요한가")).toBeTruthy();
  });
});
