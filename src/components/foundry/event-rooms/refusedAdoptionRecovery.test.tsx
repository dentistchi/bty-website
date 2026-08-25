/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { ProgramAuthorship } from "./ProgramAuthorship";
import { MODULE_BUILDER_COPY } from "./moduleBuilderCopy";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/**
 * SLICE R4-R5C14A-R3 — A CORRECT REFUSAL MUST NOT BE A DEAD END.
 *
 * FOUNDER-OBSERVED on the real Korean training "리더의 행동". The first adoption succeeded at
 * 11:04. The Host then edited the completion question and tried to adopt again on the
 * already-spent attempt, and the server refused — correctly, and with their edits safely saved.
 *
 * Then the screen stopped helping. `apply()` sets `phase` to "applied" whatever the outcome, and
 * "Draft my training program" is rendered only in `idle`/`failed` — so the refusal replaced the
 * one surface that could recover from it. Measured on the shipped panel: ZERO actions. The Host
 * could not get back to drafting without closing and reopening the app.
 *
 * Nothing about the refusal is relaxed here. What is added is the way out.
 */

const ANSWERS = {
  problem: "Leaders ask for a standard they do not hold themselves.",
  audienceType: "leaders",
  recurringMoment: "Whenever you ask the team for a standard",
  observableBehavior: "Check that you are already doing what you are about to ask for.",
  successEvidence: "A team member can name a recent time you did it first.",
  learningNeeds: ["shared_standard"],
  followUpDays: 7,
  materialIntent: "written",
  materialText: "Read the one-page leadership standard.",
} as unknown as BuilderAnswers;

const PROPOSAL = {
  displayTitle: "Ask for nothing you do not already do",
  elements: [
    { kind: "observable_standard", content: ANSWERS.observableBehavior as string, rationale: "" },
    { kind: "action_decision", content: "The next time this happens, what will you do differently?", rationale: "" },
  ],
  behaviorContract: {
    actor: "you",
    trigger: ANSWERS.recurringMoment as string,
    observableAction: "check that you already do what you ask for",
    completion: { criterion: ANSWERS.successEvidence as string },
  },
  scenarioContract: null,
  applicationContract: null,
  completionContract: null,
  followUpContract: null,
  operationalConstruct: null,
  assumptions: [],
  warnings: [],
  evidenceLanguage: "",
} as never;

const FP = "fingerprint-v1";

/** The shipped wiring: the parent owns the refusal and clears it on request. */
function Harness({ refusal = "proposal_mismatch" as string | null }) {
  const [adoptionRefusal, setAdoptionRefusal] = (globalThis as never as { __r: typeof useStateShim })
    ? useStateShim(refusal)
    : useStateShim(refusal);
  return (
    <ProgramAuthorship
      draftId="d-1"
      locale="en"
      answers={ANSWERS}
      journey={undefined}
      ready
      onGenerate={vi.fn(async () => ({ ok: true as const, proposal: PROPOSAL, evidenceCeiling: "c", attemptId: "a-2", contextFingerprint: FP }))}
      onCheckResume={vi.fn(async () => false)}
      currentContextFingerprint={FP}
      adoptionRefusal={adoptionRefusal}
      onDismissRefusal={() => setAdoptionRefusal(null)}
      onApply={vi.fn(async () => ({ status: "refused" as const }))}
      onPendingChange={vi.fn()}
    />
  );
}
// A local useState so the harness mirrors the shell without importing React's default export twice.
import { useState as useStateShim } from "react";

afterEach(cleanup);

const SRC = readFileSync(join(process.cwd(), "src/components/foundry/event-rooms/ProgramAuthorship.tsx"), "utf8");
const CODE = SRC.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Drive the surface into the exact state the Founder was stuck in. */
async function intoRefusedState() {
  render(<Harness />);
  await act(async () => {
    fireEvent.click(screen.getByTestId("program-generate"));
  });
  await act(async () => {
    fireEvent.click(screen.getByTestId("program-target-confirm-action"));
  });
  await waitFor(() => expect(screen.queryByTestId("program-review")).toBeTruthy());
  await act(async () => {
    fireEvent.click(screen.getByTestId("program-apply"));
  });
  return screen.findByTestId("program-apply-refused");
}

describe("[R4-R5C14A-R3 · T1-T4] a refused adoption offers one way out", () => {
  it("T1/T3 the refusal panel explains itself AND carries exactly one recovery action", async () => {
    const panel = await intoRefusedState();
    // 1 — nothing new was adopted; 2 — the Host's other changes are safe.
    expect(screen.getByTestId("program-refused-headline").textContent).toContain("Your other changes were saved.");
    // 3/4 — why the old draft cannot be used, and the one action that fixes it.
    expect(screen.getByTestId("program-refused-recovery").textContent).toBe(MODULE_BUILDER_COPY.en.programRefusedRecovery);
    const buttons = panel.querySelectorAll("button");
    expect(buttons.length, "exactly one action, not zero and not a second generator").toBe(1);
    expect(buttons[0].getAttribute("data-testid")).toBe("program-refused-retry");
  });

  it("T4 tapping it returns to the existing generation entry", async () => {
    await intoRefusedState();
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-refused-retry"));
    });
    expect(screen.getByTestId("program-authorship-entry")).toBeTruthy();
    expect(screen.getByTestId("program-generate")).toBeTruthy();
    expect((screen.getByTestId("program-generate") as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId("program-apply-refused")).toBeNull();
  });

  it("T5 it starts no generation on its own — the existing confirmation still stands between", async () => {
    const onGenerate = vi.fn(async () => ({ ok: true as const, proposal: PROPOSAL, evidenceCeiling: "c", attemptId: "a-2", contextFingerprint: FP }));
    render(
      <ProgramAuthorship
        draftId="d-1" locale="en" answers={ANSWERS} journey={undefined} ready
        onGenerate={onGenerate} onCheckResume={vi.fn(async () => false)} currentContextFingerprint={FP}
        adoptionRefusal="proposal_mismatch" onDismissRefusal={vi.fn()}
        onApply={vi.fn(async () => ({ status: "refused" as const }))} onPendingChange={vi.fn()}
      />,
    );
    // The refusal panel is reachable from a cold mount too, because the parent still holds it.
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-generate"));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-target-confirm-action"));
    });
    await waitFor(() => expect(screen.queryByTestId("program-review")).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-apply"));
    });
    onGenerate.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-refused-retry"));
    });
    expect(onGenerate, "no provider call from the recovery tap itself").not.toHaveBeenCalled();
    // …and the Target confirmation is still what stands between the CTA and a generation.
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-generate"));
    });
    expect(screen.getByTestId("program-target-confirm-action")).toBeTruthy();
    expect(onGenerate).not.toHaveBeenCalled();
  });
});

describe("[R4-R5C14A-R3 · T7/T8/T10/T11] what the recovery must not do", () => {
  it("T7 the stale proposal is discarded, not carried back into the entry surface", async () => {
    await intoRefusedState();
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-refused-retry"));
    });
    // Nothing of the refused review survives — no review, no adopted panel, no apply control.
    for (const gone of ["program-review", "program-applied", "program-apply", "program-reset"]) {
      expect(screen.queryByTestId(gone), gone).toBeNull();
    }
  });

  it("T8 a fresh generation restores the normal review flow", async () => {
    await intoRefusedState();
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-refused-retry"));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-generate"));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-target-confirm-action"));
    });
    await waitFor(() => expect(screen.queryByTestId("program-review")).toBeTruthy());
    expect(screen.getByTestId("program-apply")).toBeTruthy();
  });

  it("T10 exactly one generation CTA exists at a time", async () => {
    await intoRefusedState();
    expect(screen.queryAllByTestId("program-generate").length).toBe(0);
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-refused-retry"));
    });
    expect(screen.queryAllByTestId("program-generate").length).toBe(1);
    expect(screen.queryAllByTestId("program-refused-retry").length).toBe(0);
  });

  it("T11 no internal vocabulary reaches the Host, in either language", () => {
    for (const loc of ["en", "ko"] as const) {
      const shown = `${MODULE_BUILDER_COPY[loc].programRefusedRecovery} ${MODULE_BUILDER_COPY[loc].programRefusedRecoveryCta}`.toLowerCase();
      for (const internal of ["fingerprint", "attempt", "proposal version", "stale", "source identity", "adoption marker", "journey", "grounding"]) {
        expect(shown, `${loc}/${internal}`).not.toContain(internal);
      }
      expect(MODULE_BUILDER_COPY[loc].programRefusedRecoveryCta.length).toBeGreaterThan(1);
    }
  });
});

describe("[R4-R5C14A-R3 · T9] the shipped panel, and its reach on a phone", () => {
  it("the recovery action ships in the refusal branch — not only in the harness", () => {
    expect(CODE).toContain('data-testid="program-refused-retry"');
    expect(CODE).toMatch(/<button[\s\S]{0,400}data-testid="program-refused-retry"/);
    expect(CODE).toContain("onClick={recoverFromRefusal}");
    // It is a real control, never a disabled one: the Host reaches it precisely because they
    // are stuck, so nothing else may switch it off.
    const btn = CODE.slice(CODE.indexOf('data-testid="program-refused-retry"') - 400, CODE.indexOf('data-testid="program-refused-retry"') + 200);
    expect(btn).not.toContain("disabled");
  });

  it("T9 the tap target meets the size the rest of the Builder uses", () => {
    const btn = CODE.slice(CODE.indexOf("onClick={recoverFromRefusal}"), CODE.indexOf("onClick={recoverFromRefusal}") + 500);
    expect(btn).toMatch(/py-2\.5|min-h-\[44px\]/);
  });

  it("T12 the successful adoption path is untouched", () => {
    // The success panel and its disclosure are unchanged; only the refusal branch gained a control.
    expect(CODE).toContain('data-testid="program-applied"');
    expect(CODE).toContain('data-testid="program-applied-toggle"');
  });

  it("the refusal itself is unchanged — recovery clears the SURFACE, never the rule", () => {
    // `proposalIsStale` and the apply guard are the integrity, and neither is touched here.
    expect(CODE).toMatch(/if \(!proposal \|\| reviewBlock \|\| proposalIsStale\) return;/);
    const handler = CODE.slice(CODE.indexOf("const recoverFromRefusal"), CODE.indexOf("const cancelConfirmation"));
    expect(handler).toContain("clearCachedProposal(draftId)");
    /*
      It clears the SURFACE. It never re-attempts an adoption, never relaxes the staleness rule,
      and never reaches the apply path — `setAdoptedDraftOpen(false)` is UI tidying, not adoption.
    */
    expect(handler).not.toMatch(/onApply\(/);
    expect(handler).not.toMatch(/proposalIsStale/);
    expect(handler).not.toMatch(/applyProgramProposal/);
  });
});
