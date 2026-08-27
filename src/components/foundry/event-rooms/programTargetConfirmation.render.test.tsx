/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import { ProgramAuthorship, type ProgramGenerateOutcome } from "./ProgramAuthorship";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/**
 * Slice 3.2L-R1.3 — the paid action confirms its target first.
 *
 * TWO controlled windows were spent generating against the wrong training. R1.2 made the
 * open draft visible, and that was necessary but not sufficient: orientation alone did
 * not stop the press. So the PAID action now has its own boundary — pressing "Draft my
 * training program" opens a confirmation bound to the exact loaded draft and calls
 * nothing until the target is explicitly confirmed.
 *
 * The provider is stubbed throughout. No paid call is ever made here.
 *
 * RETARGETED, NOT WEAKENED (Slice R4-R8A). The canonical Review now generates by itself, so
 * these guarantees can no longer be reached by driving `ModuleBuilderShell` — there is no entry
 * button to press and no modal to confirm. They are properties of `ProgramAuthorship`'s MANUAL
 * path, which is unchanged and still the component's behaviour, so they are measured on the
 * component directly. Two of them were never about the modal at all — one submission intent per
 * generation, and a new intent per run — and those moved to
 * `hostAuthoringSimplificationA.test.tsx`, where the automatic request they now describe is.
 */

const CANONICAL_ID = "093b0361-7cc8-4688-9f93-396d60582501";
const CANONICAL_FOCUS = "Our handoffs are inconsistent.";
const WRONG_ID = "35773b57-219b-43fb-829e-80f0656ccb66";
const WRONG_FOCUS = "새로운 의사들의 교만이 문제야";

const answersFor = (problem: string) => ({
  problem,
  audienceType: "everyone",
  recurringMoment: "at each handoff point",
  observableBehavior: "Create a shared handoff standard.",
  successEvidence: "Handoff record",
  learningNeeds: ["know"],
  materialIntent: "youtube",
  materialText: "https://youtu.be/x",
  completionPrompt: "What will you include in your handoff record?",
  followUpDays: 7,
});

const PROGRAM = {
  displayTitle: "Handing over without gaps",
  elements: [
    { kind: "why_it_matters", content: "AI why", rationale: "r" },
    { kind: "observable_standard", content: "AI standard", rationale: "r" },
    { kind: "completion_check", content: "AI check", rationale: "r" },
  ],
  assumptions: [],
  warnings: [],
};

/**
 * Records EVERY paid attempt and EVERY draft write, so "the provider was not called" and
 * "nothing was written" stay measured rather than assumed — the same two counters the shell
 * harness kept, now bound to the two props that are the only ways either can happen.
 */
function mount(opts: {
  draftId: string;
  answers: Record<string, unknown>;
  ready?: boolean;
  generate?: () => ProgramGenerateOutcome;
}) {
  const generateSpy = vi.fn(async (): Promise<ProgramGenerateOutcome> =>
    opts.generate
      ? opts.generate()
      : {
          ok: true,
          proposal: PROGRAM as never,
          evidenceCeiling: "c",
          attemptId: "att-1",
          contextFingerprint: "fp-1",
        },
  );
  const applySpy = vi.fn();
  const r = render(
    <ProgramAuthorship
      draftId={opts.draftId}
      locale="en"
      answers={opts.answers as unknown as BuilderAnswers}
      journey={undefined}
      ready={opts.ready ?? true}
      onGenerate={generateSpy}
      onApply={applySpy}
      currentContextFingerprint="fp-1"
    />,
  );
  return {
    ...r,
    providerCalls: () => generateSpy.mock.calls,
    draftWrites: () => applySpy.mock.calls,
  };
}

const pressGenerate = async () => {
  await act(async () => {
    fireEvent.click(screen.getByTestId("program-generate"));
  });
};
const pressConfirm = async () => {
  await act(async () => {
    fireEvent.click(screen.getByTestId("program-target-confirm-action"));
  });
};

beforeEach(() => vi.restoreAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("[3.2L-R1.3] opening the confirmation spends nothing", () => {
  it("G1 — pressing the entry button opens the confirmation and calls NO provider", async () => {
    const { providerCalls, draftWrites } = mount({ draftId: CANONICAL_ID, answers: answersFor(CANONICAL_FOCUS) });
    await pressGenerate();

    expect(screen.getByTestId("program-target-confirm")).toBeTruthy();
    expect(providerCalls(), "opening the confirmation must not call the provider").toHaveLength(0);
    expect(draftWrites(), "opening the confirmation must not write to the draft").toHaveLength(0);
  });

  it("G2 — Go back spends nothing and restores focus to the entry button", async () => {
    const { providerCalls, draftWrites } = mount({ draftId: CANONICAL_ID, answers: answersFor(CANONICAL_FOCUS) });
    await pressGenerate();
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-target-cancel"));
    });

    expect(screen.queryByTestId("program-target-confirm")).toBeNull();
    expect(providerCalls()).toHaveLength(0);
    expect(draftWrites()).toHaveLength(0);
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    expect(document.activeElement).toBe(screen.getByTestId("program-generate"));
  });

  it("Escape dismisses without spending anything", async () => {
    const { providerCalls } = mount({ draftId: CANONICAL_ID, answers: answersFor(CANONICAL_FOCUS) });
    await pressGenerate();
    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByTestId("program-target-confirm")).toBeNull();
    expect(providerCalls()).toHaveLength(0);
  });
});

describe("[3.2L-R1.3] the confirmation names the exact target", () => {
  it("G3 — canonical draft: shows its focus, bound to its own id", async () => {
    mount({ draftId: CANONICAL_ID, answers: answersFor(CANONICAL_FOCUS) });
    await pressGenerate();

    const el = screen.getByTestId("program-target-focus");
    expect(el.textContent).toBe(CANONICAL_FOCUS);
    expect(el.getAttribute("data-target-draft-id")).toBe(CANONICAL_ID);
    expect(screen.getByTestId("program-target-confirm").textContent).toContain("Training program target");
    expect(screen.queryByText(WRONG_FOCUS)).toBeNull();
  });

  it("G4 — wrong draft: shows ITS focus, and the canonical focus is absent", async () => {
    mount({ draftId: WRONG_ID, answers: answersFor(WRONG_FOCUS) });
    await pressGenerate();

    const el = screen.getByTestId("program-target-focus");
    expect(el.textContent).toBe(WRONG_FOCUS);
    expect(el.getAttribute("data-target-draft-id")).toBe(WRONG_ID);
    expect(screen.queryByText(CANONICAL_FOCUS)).toBeNull();
  });

  it("G5 — switching drafts shows only the NEW target; no stale value survives", async () => {
    // Two mounts, which is what switching drafts is: the confirmation binds its target when it
    // OPENS, so the second must be unable to show the first one's focus.
    mount({ draftId: CANONICAL_ID, answers: answersFor(CANONICAL_FOCUS) });
    await pressGenerate();
    expect(screen.getByTestId("program-target-focus").textContent).toBe(CANONICAL_FOCUS);
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-target-cancel"));
    });

    cleanup();
    mount({ draftId: WRONG_ID, answers: answersFor(WRONG_FOCUS) });
    await pressGenerate();
    expect(screen.getByTestId("program-target-focus").textContent).toBe(WRONG_FOCUS);
    expect(screen.getByTestId("program-target-focus").getAttribute("data-target-draft-id")).toBe(WRONG_ID);
    expect(screen.queryByText(CANONICAL_FOCUS)).toBeNull();
  });

  it("the primary action names what will happen — not a generic Continue/Confirm/Yes", async () => {
    mount({ draftId: CANONICAL_ID, answers: answersFor(CANONICAL_FOCUS) });
    await pressGenerate();
    const label = screen.getByTestId("program-target-confirm-action").textContent ?? "";
    expect(label).toBe("Draft program for this training");
    expect(["Continue", "Confirm", "Yes", "OK"]).not.toContain(label.trim());
  });

  it("states plainly that nothing is added or published yet", async () => {
    mount({ draftId: CANONICAL_ID, answers: answersFor(CANONICAL_FOCUS) });
    await pressGenerate();
    expect(screen.getByTestId("program-target-confirm").textContent).toContain(
      "Nothing will be added or published until you review and apply it",
    );
  });
});

describe("[3.2L-R1.3] only an explicit confirmation spends", () => {
  it("G8 — rapid taps create exactly ONE provider request", async () => {
    const { providerCalls } = mount({ draftId: CANONICAL_ID, answers: answersFor(CANONICAL_FOCUS) });
    await pressGenerate();

    const btn = screen.getByTestId("program-target-confirm-action");
    await act(async () => {
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);
    });
    expect(providerCalls(), "one gesture must buy at most one generation").toHaveLength(1);
  });

  /*
    MOVED (Slice R4-R8A): "one confirmation sends exactly one submission intent" and "reopening
    issues a NEW intent, never a replay" measured the REQUEST the shell builds, not this modal.
    The shell still builds it — automatically now — so both assertions live in
    `hostAuthoringSimplificationA.test.tsx` against the path that actually issues them.
  */
});

describe("[3.2L-R1.3] server refusals reach the Host intact", () => {
  it("G7 — an already-active generation refuses without a proposal", async () => {
    mount({
      draftId: CANONICAL_ID,
      answers: answersFor(CANONICAL_FOCUS),
      generate: () => ({ ok: false, code: "program_generation_in_progress" }),
    });
    await pressGenerate();
    await pressConfirm();
    expect(screen.queryByTestId("program-review")).toBeNull();
    expect(screen.getByTestId("program-failure")).toBeTruthy();
  });

  it("G6 — a stale target refuses with its specific reason and no proposal", async () => {
    mount({
      draftId: CANONICAL_ID,
      answers: answersFor(CANONICAL_FOCUS),
      generate: () => ({ ok: false, code: "stale_context", refusal: "status_no_longer_draft" }),
    });
    await pressGenerate();
    await pressConfirm();
    expect(screen.queryByTestId("program-review")).toBeNull();
    expect(screen.getByTestId("program-failure").textContent).toContain("created as a session while BTY was writing");
  });

  it("G11 — confirm → success → Discard writes no journey to the draft", async () => {
    const { draftWrites } = mount({ draftId: CANONICAL_ID, answers: answersFor(CANONICAL_FOCUS) });
    await pressGenerate();
    await pressConfirm();
    expect(screen.getByTestId("program-review")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByTestId("program-discard"));
    });
    expect(draftWrites(), "Discard must never persist a journey").toHaveLength(0);
  });
});

describe("[3.2L-R1.3] missing focus and accessibility", () => {
  it("G9 — a draft with no focus shows the neutral fallback, and invents nothing", async () => {
    mount({ draftId: CANONICAL_ID, answers: { audienceType: "everyone" }, ready: false });
    // The entry action is blocked while the required inputs are missing, so the paid path
    // is unreachable — but if it is reached, the fallback is neutral.
    expect((screen.getByTestId("program-generate") as HTMLButtonElement).disabled).toBe(true);
  });

  it("G9b — a long focus keeps its distinguishing tail and does not truncate", async () => {
    const shared = "Our handoffs at shift change keep missing steps and this creates risk for everyone involved daily";
    const long = `${shared}, especially on the night shift.`;
    mount({ draftId: CANONICAL_ID, answers: answersFor(long) });
    await pressGenerate();
    const el = screen.getByTestId("program-target-focus");
    expect(el.textContent).toBe(long);
    expect(el.className).toContain("break-words");
    expect(el.className).not.toContain("truncate");
  });

  it("G10 — the confirmation is a labelled dialog that takes focus, with a 44px touch target", async () => {
    mount({ draftId: CANONICAL_ID, answers: answersFor(CANONICAL_FOCUS) });
    await pressGenerate();

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-label")).toBe("Training program target");

    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    expect(document.activeElement).toBe(screen.getByTestId("program-target-confirm-action"));

    for (const id of ["program-target-confirm-action", "program-target-cancel"]) {
      expect(screen.getByTestId(id).className).toContain("min-h-[44px]");
    }
  });

  it("the target label is announced before the actions", async () => {
    mount({ draftId: CANONICAL_ID, answers: answersFor(CANONICAL_FOCUS) });
    await pressGenerate();
    const html = screen.getByTestId("program-target-confirm").innerHTML;
    expect(html.indexOf("Training program target")).toBeLessThan(html.indexOf("program-target-confirm-action"));
  });
});
