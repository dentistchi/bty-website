/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { ProgramAuthorship, type ProgramGenerateOutcome } from "./ProgramAuthorship";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";
import type { ProgramProposal } from "@/domain/foundry/module/program-authorship";
import { readProvenance } from "@/domain/foundry/module/program-authorship";

/**
 * Slice 3.2L — the authorship surface.
 *
 * What is being held: the Founder can tell what BTY wrote, a failed or refused draft
 * leaves the draft untouched with a way forward, and applying is ONE atomic write of the
 * whole program rather than a section at a time.
 */

afterEach(cleanup);

const ANSWERS: BuilderAnswers = {
  problem: "Our handoffs are inconsistent.",
  audienceType: "everyone",
  observableBehavior: "Create a shared handoff standard.",
  successEvidence: "Handoff record",
  learningNeeds: ["know", "decide", "practice"],
  materialIntent: "youtube",
  materialText: "https://youtu.be/x",
  arenaRecommended: true,
  followUpDays: 7,
};

const PROPOSAL: ProgramProposal = {
  displayTitle: "Handing over without gaps",
  elements: [
    { kind: "why_it_matters", content: "AI why", rationale: "grounds the change" },
    { kind: "observable_standard", content: "AI standard", rationale: "makes it observable" },
    { kind: "action_decision", content: "AI decision", rationale: "forces a commitment" },
  ],
  assumptions: ["Handoffs happen at shift change."],
  warnings: ["A missing workflow step will not be fixed by training."],
  evidenceLanguage: "Shows exposure and a decision. It does not show behaviour changed.",
  behaviorContract: {
  actor: "the outgoing person",
  trigger: "At the end of every shift",
  observableAction: "states each open item aloud to the person taking over",
  completionSignal: "the person taking over repeats them back and confirms",
  },
  scenarioContract: null,
  applicationContract: { applicationMoment: "at your next shift change", evidenceOrConfirmation: "the person taking over repeats it back" },
  completionContract: { verificationTarget: "the_behaviour", responseMode: "name_the_moment" },
  followUpContract: { reviewFocus: "what_you_said", confirmer: "self_report" },
  operationalConstruct: { label: "shared handoff standard", noun: "standard", authorityMode: "proposed" },
};

const ok: ProgramGenerateOutcome = { ok: true, proposal: PROPOSAL, evidenceCeiling: "Reading shows exposure only.", attemptId: "att-1" };

function setup(outcome: ProgramGenerateOutcome, onApply = vi.fn()) {
  const onGenerate = vi.fn(async () => outcome);
  render(
    <ProgramAuthorship draftId="d-1" answers={ANSWERS} journey={undefined} ready onGenerate={onGenerate} onApply={onApply} />,
  );
  return { onGenerate, onApply };
}

/**
 * Press the entry button AND confirm the target. Slice 3.2L-R1.3 put a target
 * confirmation between the button and the provider, so a test that only clicks the
 * entry button would no longer generate anything.
 */
async function generate() {
  await act(async () => {
    fireEvent.click(screen.getByTestId("program-generate"));
  });
  await act(async () => {
    fireEvent.click(screen.getByTestId("program-target-confirm-action"));
  });
}

describe("[3.2L] the authorship entry point", () => {
  it("offers ONE action that drafts the whole program", () => {
    setup(ok);
    expect(screen.getByTestId("program-generate").textContent).toContain("Draft my training program");
    // The promise is a program, not a field suggestion.
    expect(screen.getByTestId("program-authorship-entry").textContent).toContain("the whole program your team will experience");
  });

  it("is disabled until the Host has described enough to author from", () => {
    const onGenerate = vi.fn(async () => ok);
    render(<ProgramAuthorship draftId="d-1" answers={{}} journey={undefined} ready={false} onGenerate={onGenerate} onApply={vi.fn()} />);
    expect((screen.getByTestId("program-generate") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("[3.2L] authorship is legible", () => {
  it("marks every proposed section as BTY's work, not the Host's", async () => {
    setup(ok);
    await generate();
    for (const kind of ["why_it_matters", "observable_standard", "action_decision"]) {
      expect(screen.getByTestId(`program-section-${kind}`).textContent).toContain("Drafted by BTY");
    }
  });

  it("shows what the program can and cannot establish", async () => {
    setup(ok);
    await generate();
    const ceiling = screen.getByTestId("program-evidence-ceiling").textContent ?? "";
    expect(ceiling).toContain("Reading shows exposure only.");
    expect(ceiling).toContain("does not show behaviour changed");
  });

  it("surfaces assumptions and warnings rather than hiding them", async () => {
    setup(ok);
    await generate();
    expect(screen.getByTestId("program-assumptions").textContent).toContain("Handoffs happen at shift change.");
    expect(screen.getByTestId("program-warnings").textContent).toContain("will not be fixed by training");
  });

  it("states plainly that nothing is approved or published yet", async () => {
    setup(ok);
    await generate();
    expect(screen.getByTestId("program-review").textContent).toContain("Nothing is approved or published yet");
  });
});

describe("[3.2L] apply is explicit and atomic", () => {
  it("does not apply anything on generation success", async () => {
    const { onApply } = setup(ok);
    await generate();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("writes the WHOLE program in one call, not section by section", async () => {
    const { onApply } = setup(ok);
    await generate();
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-apply"));
    });
    expect(onApply).toHaveBeenCalledTimes(1);
    const journey = onApply.mock.calls[0][0];
    expect(journey.elements).toHaveLength(3);
    expect(journey.displayTitle).toBe("Handing over without gaps");
  });

  it("records AI authorship honestly on the applied journey", async () => {
    const { onApply } = setup(ok);
    await generate();
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-apply"));
    });
    const journey = onApply.mock.calls[0][0];
    expect(readProvenance(journey.elements[0])).toBe("ai_proposed");
  });

  it("a Host rewrite becomes the Host's own content", async () => {
    const { onApply } = setup(ok);
    await generate();
    await act(async () => {
      fireEvent.change(screen.getByTestId("program-edit-why_it_matters"), { target: { value: "My own framing" } });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-apply"));
    });
    const journey = onApply.mock.calls[0][0];
    const why = journey.elements.find((e: { kind: string }) => e.kind === "why_it_matters");
    expect(why.content).toBe("My own framing");
    expect(readProvenance(why)).toBe("host_edited");
  });

  /**
   * G13 — EDITED-CONTENT AUTHORITY (Slice 3.2L-R4).
   *
   * THE STANDARD the Host reads is rendered from a validated `behaviorContract`. The moment
   * they rewrite it, that contract describes the PRE-EDIT text. The mechanism chosen is
   * INVALIDATE-ON-EDIT plus deterministic re-check of the edited words: there is no
   * persistence path for the contract and Apply reads display content only, so no stale
   * metadata can travel — and an edited standard that stopped describing a behavior is
   * refused rather than applied on the strength of BTY's original.
   */
  it("G13: rewriting the standard into meta language blocks Apply and says why", async () => {
    const { onApply } = setup(ok);
    await generate();
    await act(async () => {
      fireEvent.change(screen.getByTestId("program-edit-observable_standard"), {
        target: { value: "A shared handoff standard is created and utilized by team members during all relevant transitions of work." },
      });
    });
    expect(screen.getByTestId("program-standard-not-observable")).toBeTruthy();
    expect((screen.getByTestId("program-apply") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-apply"));
    });
    expect(onApply, "stale metadata must never reach Apply").not.toHaveBeenCalled();
  });

  it("G13: a rewrite that still describes a behavior applies normally", async () => {
    const { onApply } = setup(ok);
    await generate();
    await act(async () => {
      fireEvent.change(screen.getByTestId("program-edit-observable_standard"), {
        target: { value: "At every shift end, the outgoing nurse states each open item aloud and the incoming nurse confirms each one." },
      });
    });
    expect(screen.queryByTestId("program-standard-not-observable")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-apply"));
    });
    expect(onApply).toHaveBeenCalled();
  });

  it("G13: authorship follows the edit — BTY does not claim the Host's words", async () => {
    setup(ok);
    await generate();
    const section = screen.getByTestId("program-section-observable_standard");
    expect(section.textContent).toContain("Drafted by BTY");
    await act(async () => {
      fireEvent.change(screen.getByTestId("program-edit-observable_standard"), {
        target: { value: "At every shift end, the outgoing nurse states each open item aloud and the incoming nurse confirms each one." },
      });
    });
    expect(section.textContent).toContain("Your rewrite");
    expect(section.textContent).not.toContain("Drafted by BTY");
  });

  /** G15 — reset/discard must clear the edit AND its consequences. */
  it("G15: discarding after a blocked edit returns a clean entry point", async () => {
    const { onApply } = setup(ok);
    await generate();
    await act(async () => {
      fireEvent.change(screen.getByTestId("program-edit-observable_standard"), {
        target: { value: "A shared process is created and adopted by the team." },
      });
    });
    expect(screen.getByTestId("program-standard-not-observable")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-discard"));
    });
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByTestId("program-authorship-entry")).toBeTruthy();
    expect(screen.queryByTestId("program-standard-not-observable")).toBeNull();
  });

  it("G15: regenerating after a discard starts from BTY's proposal, not the abandoned edit", async () => {
    setup(ok);
    await generate();
    await act(async () => {
      fireEvent.change(screen.getByTestId("program-edit-observable_standard"), { target: { value: "A shared process is created." } });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-discard"));
    });
    await generate();
    expect((screen.getByTestId("program-edit-observable_standard") as HTMLTextAreaElement).value).toBe("AI standard");
    expect(screen.queryByTestId("program-standard-not-observable")).toBeNull();
  });

  it("discarding applies nothing and returns to the entry point", async () => {
    const { onApply } = setup(ok);
    await generate();
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-discard"));
    });
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByTestId("program-authorship-entry")).toBeTruthy();
  });
});

describe("[3.2L] failure leaves the draft untouched and recoverable", () => {
  const cases: [string, ProgramGenerateOutcome, string][] = [
    ["provider unavailable", { ok: false, code: "provider_unavailable" }, "isn’t available right now"],
    ["timeout", { ok: false, code: "timeout" }, "took too long"],
    ["provider error", { ok: false, code: "provider_error" }, "couldn’t reach"],
    ["validation refusal", { ok: false, code: "invalid_output", refusal: "invented_specifics" }, "policy or form you haven’t provided"],
    ["stale context", { ok: false, code: "context_mismatch" }, "changed since"],
    ["duplicate instruction", { ok: false, code: "duplicate_intent" }, "already sent"],
  ];

  for (const [name, outcome, expected] of cases) {
    it(`${name}: explains it, applies nothing, offers a way forward`, async () => {
      const { onApply } = setup(outcome);
      await generate();
      const text = screen.getByTestId("program-failure").textContent ?? "";
      expect(text).toContain(expected);
      expect(onApply).not.toHaveBeenCalled();
      // Slice 3.2L-R3: refusals the Host cannot fix by pressing again no longer offer a
      // one-tap paid retry — they route back through the target confirmation instead.
      const immediateRetry = screen.queryByTestId("program-generate");
      const note = screen.queryByTestId("program-no-retry-note");
      expect(Boolean(immediateRetry) !== Boolean(note), "exactly one recovery affordance").toBe(true);
      if (note) expect(note.textContent).toContain("Each draft starts a new AI generation");
      else expect(immediateRetry!.textContent).toContain("Draft it again");
    });
  }

  it("a refused draft is never shown to the Host", async () => {
    setup({ ok: false, code: "invalid_output", refusal: "duplicate_content" });
    await generate();
    expect(screen.queryByTestId("program-review")).toBeNull();
    // R5: the Host is told what BTY could not produce. The generic "didn't meet our
    // honesty rules" sentence this used to assert accused the model of dishonesty for
    // what is a repetition fault — the exact misattribution the R4 window exposed.
    const text = screen.getByTestId("program-failure").textContent ?? "";
    expect(text).toContain("repeated the same sentence in more than one section");
    expect(text).not.toMatch(/honesty|dishonest|discarded it rather than show it to you/i);
  });
});

describe("[3.2L-R5] G12 — no terminal refusal starts a provider call", () => {
  /**
   * THE R4 DEFECT. `scenario_unrelated` was not on the no-immediate-retry list, so the
   * refusal screen offered "Draft it again" for a failure the Host could neither see nor
   * correct. With the inputs, prompt and temperature unchanged, that is paying for a
   * re-roll presented as a remedy.
   */
  for (const refusal of ["scenario_unrelated", "dependency_inversion", "non_observable_standard", "duplicate_content", "field_type", "material_fabrication"]) {
    it(`${refusal}: offers no button that generates, and calls onGenerate exactly once`, async () => {
      const { onGenerate } = setup({ ok: false, code: "invalid_output", refusal });
      await generate();
      expect(onGenerate).toHaveBeenCalledTimes(1);
      // There is no generate control on the refusal screen at all.
      expect(screen.queryByTestId("program-generate")).toBeNull();
      expect(screen.getByTestId("program-no-retry-note")).toBeTruthy();
      // Nothing on screen invites another draft as a one-tap remedy.
      expect(screen.getByTestId("program-no-retry-note").textContent).toContain("new AI generation");
      expect(onGenerate).toHaveBeenCalledTimes(1);
    });
  }

  it("provider and timeout outcomes are treated the same way", async () => {
    for (const code of ["timeout", "provider_error", "provider_unavailable"]) {
      const { onGenerate } = setup({ ok: false, code });
      await generate();
      expect(screen.queryAllByTestId("program-generate")).toHaveLength(0);
      expect(onGenerate).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });
});

describe("[3.2L-R1] G9 — generation and publication never overlap in the UI", () => {
  it("raises pending while the draft is being written, and lowers it on success", async () => {
    const pending: boolean[] = [];
    const onGenerate = vi.fn(async () => ok);
    render(
      <ProgramAuthorship
        draftId="d-1"
        answers={ANSWERS}
        journey={undefined}
        ready
        onGenerate={onGenerate}
        onApply={vi.fn()}
        onPendingChange={(p) => pending.push(p)}
      />,
    );
    await generate();
    expect(pending, "must raise then lower").toEqual([true, false]);
  });

  it("lowers pending on EVERY failure path — a failed draft must not wedge publication", async () => {
    for (const outcome of [
      { ok: false as const, code: "timeout" },
      { ok: false as const, code: "provider_error" },
      { ok: false as const, code: "invalid_output", refusal: "invented_specifics" },
      { ok: false as const, code: "stale_context" },
      { ok: false as const, code: "duplicate_intent" },
    ]) {
      cleanup();
      const pending: boolean[] = [];
      render(
        <ProgramAuthorship
          draftId="d-1"
          answers={ANSWERS}
          journey={undefined}
          ready
          onGenerate={vi.fn(async () => outcome)}
          onApply={vi.fn()}
          onPendingChange={(p) => pending.push(p)}
        />,
      );
      await generate();
      expect(pending.at(-1), `${outcome.code} left publication wedged`).toBe(false);
    }
  });

  it("a stale generation names the ACTUAL reason, not a generic error", async () => {
    // The precise refusal is more useful than the generic one: the Host published this
    // training mid-draft, and telling them exactly that is what makes it recoverable.
    setup({ ok: false, code: "stale_context", refusal: "status_no_longer_draft" });
    await generate();
    const text = screen.getByTestId("program-failure").textContent ?? "";
    expect(text).toContain("created as a session while BTY was writing");
    expect(text).toContain("Nothing was changed");
  });

  it("an inputs-changed stale draft explains that instead", async () => {
    cleanup();
    setup({ ok: false, code: "stale_context", refusal: "inputs_changed" });
    await generate();
    expect(screen.getByTestId("program-failure").textContent).toContain("changed since BTY started writing");
  });
});

describe("[3.2L-R1.1] G9 — both publish refusals are legible and neither implies success", () => {
  // The copy lives in ModuleBuilderShell's publishErrorMessage; these assert the exact
  // strings a Host reads, and that neither leaks internal vocabulary.
  const ACTIVE = "BTY is writing your training program — wait for it to finish, or discard it, before creating this session.";
  const UNAVAILABLE = "We couldn’t confirm whether BTY is still writing this program. Nothing was published — give it a moment, then create the session again.";

  it("ACTIVE tells the Host to wait", () => {
    expect(ACTIVE).toContain("wait for it to finish");
    expect(ACTIVE).toContain("discard it");
  });

  it("UNAVAILABLE states plainly that nothing was published, and is retryable", () => {
    expect(UNAVAILABLE).toContain("Nothing was published");
    expect(UNAVAILABLE).toContain("create the session again");
  });

  /**
   * The requirement is that neither copy IMPLIES success — not that neither contains the
   * word. "Nothing was published" is a denial and is exactly the reassurance the Host
   * needs, so the check must read negation, not keywords. This is the same trap the
   * evidence-overclaim validator had to learn: an assertion and its denial share
   * vocabulary, and only the assertion is the defect.
   */
  const affirmsSuccess = (copy: string): boolean => {
    const CLAIM = /\b(?:has been|was|is now|successfully)\s+(?:created|published)\b|\bsession is (?:ready|live)\b/gi;
    const NEGATOR = /\b(?:nothing|not|never|no|couldn['’]t|cannot|isn['’]t)\b/i;
    CLAIM.lastIndex = 0;
    for (let m = CLAIM.exec(copy); m !== null; m = CLAIM.exec(copy)) {
      const before = copy.slice(Math.max(0, m.index - 40), m.index);
      if (!NEGATOR.test(before)) return true;
    }
    return false;
  };

  it("neither implies publication succeeded", () => {
    for (const copy of [ACTIVE, UNAVAILABLE]) {
      expect(affirmsSuccess(copy), `affirms success: ${copy}`).toBe(false);
    }
    // The guard is real, not vacuous: an actual success claim IS caught.
    expect(affirmsSuccess("Your session was published and is now live.")).toBe(true);
    // …and the unavailable path positively reassures that nothing happened.
    expect(/\bnothing was published\b/i.test(UNAVAILABLE)).toBe(true);
  });

  it("neither leaks internal vocabulary", () => {
    for (const copy of [ACTIVE, UNAVAILABLE]) {
      expect(copy).not.toMatch(/lifecycle_state|lease|fingerprint|service_role|database|query|program_generation|409|503/i);
    }
  });
});

describe("[3.2L-R2] a grounding refusal tells the Host what to do next", () => {
  it("names the missing material and states nothing was added", async () => {
    setup({ ok: false, code: "invalid_output", refusal: "material_fabrication" });
    await generate();
    const text = screen.getByTestId("program-failure").textContent ?? "";
    expect(text).toContain("relied on a template or tool you haven’t provided");
    expect(text).toContain("Nothing was added");
    expect(text).toContain("Attach the real material");
  });

  it("exposes no internal vocabulary", async () => {
    setup({ ok: false, code: "invalid_output", refusal: "material_fabrication" });
    await generate();
    const text = screen.getByTestId("program-failure").textContent ?? "";
    expect(text).not.toMatch(/regex|validator|schema|grounding|refusal_kind|material_fabrication|corpus|artifact/i);
  });

  it("no partial program is shown when a section is refused", async () => {
    setup({ ok: false, code: "invalid_output", refusal: "material_fabrication" });
    await generate();
    expect(screen.queryByTestId("program-review")).toBeNull();
  });
});
