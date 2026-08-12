/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
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

/*
  One browsing session legitimately keeps an unapplied proposal across mounts (Slice
  3.2L-R11.4K) — which is the feature, and which makes test isolation explicit work.
*/
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const ANSWERS: BuilderAnswers = {
  problem: "Our handoffs are inconsistent.",
  audienceType: "everyone",
  recurringMoment: "at each handoff point",
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
    // A NARRATIVE kind the Host still owns directly. WHY THIS MATTERS stopped being one
    // when the rationale became derived (Slice 3.2L-R9), so the free-text tests use this.
    { kind: "evidence", content: "The handoff record shows the items were stated.", rationale: "states the ceiling" },
  ],
  assumptions: ["Handoffs happen at shift change."],
  warnings: ["A missing workflow step will not be fixed by training."],
  // Derived in production by `deriveEvidenceCeiling`; fixed here for the fixture.
  evidenceLanguage: "Reading or watching the material can show only that people were exposed to it. Nothing here can show that behaviour changed, that it was adopted, or that it lasted.",
  behaviorContract: {
  actor: "the outgoing person",
  trigger: "At the end of every shift",
  observableAction: "states each open item aloud to the person taking over",
  completion: { criterion: "The handover note lists every open item and who now owns it" },
  },
  scenarioContract: null,
  applicationContract: { applicationMoment: "at your next shift change" },
  completionContract: { verificationTarget: "the_behaviour", responseMode: "name_the_moment" },
  followUpContract: { reviewFocus: "what_you_said", confirmer: "self_report" },
  operationalConstruct: { label: "shared handoff standard", noun: "standard", authorityMode: "proposed" },
};

const FP = "fp-canonical";
const ok: ProgramGenerateOutcome = { ok: true, proposal: PROPOSAL, evidenceCeiling: "Reading shows exposure only.", attemptId: "att-1", contextFingerprint: FP };

function setup(outcome: ProgramGenerateOutcome, onApply = vi.fn(), currentFingerprint = FP) {
  const onGenerate = vi.fn(async () => outcome);
  render(
    <ProgramAuthorship
      draftId="d-1"
      answers={ANSWERS}
      journey={undefined}
      ready
      onGenerate={onGenerate}
      onApply={onApply}
      currentContextFingerprint={currentFingerprint}
    />,
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
    render(<ProgramAuthorship draftId="d-1" answers={{}} journey={undefined} ready={false} onGenerate={onGenerate} onApply={vi.fn()} currentContextFingerprint={FP} />);
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
    const block = screen.getByTestId("program-evidence-ceiling");
    const ceiling = block.textContent ?? "";
    /*
      ONE PARAGRAPH (Slice 3.2L-R8.1). This block used to print the API's `evidence_ceiling`
      AND the proposal's `evidenceLanguage` one under the other — two overlapping ceilings
      on the Founder's phone. They were never two authorities: both are
      `deriveEvidenceCeiling(answers)`. The validated one travels with the program, so it is
      the one shown.
    */
    expect(block.querySelectorAll("p")).toHaveLength(1);
    expect(ceiling).not.toContain("Reading shows exposure only.");
    // R8: the ceiling is DERIVED, so its wording comes from the domain, not the model —
    // which is what stops a program claiming competence beside a line denying it.
    expect(ceiling).toContain("Reading or watching the material can show only that people were exposed to it");
    expect(ceiling).toContain("Nothing here can show that behaviour changed, that it was adopted, or that it lasted");
    expect(ceiling).not.toMatch(/equipped to|ready to|competent/i);
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
    expect(journey.elements).toHaveLength(4);
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
      fireEvent.change(screen.getByTestId("program-edit-evidence"), { target: { value: "My own framing of what this shows." } });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-apply"));
    });
    const journey = onApply.mock.calls[0][0];
    const ev = journey.elements.find((e: { kind: string }) => e.kind === "evidence");
    expect(ev.content).toBe("My own framing of what this shows.");
    expect(readProvenance(ev)).toBe("host_edited");
  });

  /**
   * STRUCTURED REVIEW AUTHORITY (Slice 3.2L-R6.1) — replaces R4's raw-edit tests.
   *
   * R4 let the Host retype THE STANDARD and blocked Apply if the rewrite stopped describing
   * a behaviour. R6 then derived five more sections from the same contracts but still shipped
   * six free textareas, so one section could be edited to contradict the others. The Host now
   * adjusts the CONTRACT and every dependent sentence re-renders — the contradiction is
   * unrepresentable rather than detected.
   */
  const openDetails = async (kind: string) => {
    await act(async () => {
      fireEvent.click(screen.getByTestId(`program-details-toggle-${kind}`));
    });
  };
  const setField = async (id: string, value: string) => {
    await act(async () => {
      fireEvent.change(screen.getByTestId(`program-field-${id}`), { target: { value } });
    });
  };

  it("G1: derived sections are read-only text, not free textareas", async () => {
    setup(ok);
    await generate();
    for (const kind of ["observable_standard", "action_decision"]) {
      expect(screen.getByTestId(`program-derived-${kind}`)).toBeTruthy();
      expect(screen.queryByTestId(`program-edit-${kind}`)).toBeNull();
    }
    // WHY THIS MATTERS is DERIVED now (Slice 3.2L-R9) — read-only, like the rest.
    expect(screen.getByTestId("program-derived-why_it_matters")).toBeTruthy();
    expect(screen.queryByTestId("program-edit-why_it_matters")).toBeNull();
    // A narrative kind stays directly editable.
    expect(screen.getByTestId("program-edit-evidence")).toBeTruthy();
  });

  it("G1: changing the ACTION updates EVERY dependent section at once", async () => {
    setup(ok);
    await generate();
    const before = {
      standard: screen.getByTestId("program-derived-observable_standard").textContent ?? "",
      decision: screen.getByTestId("program-derived-action_decision").textContent ?? "",
    };
    await openDetails("observable_standard");
    await setField("action", "reads the open items aloud from the board");
    // The modal takes a BASE form — "must read", never "must reads" — so the rendered sentence
    // carries the de-inflected phrase, which is the point of `baseActionPhrase`.
    expect(screen.getByTestId("program-derived-observable_standard").textContent).toContain("read the open items aloud from the board");
    expect(screen.getByTestId("program-derived-observable_standard").textContent).not.toBe(before.standard);
    // YOUR DECISION is first person, so it carries the ACTION rather than the actor —
    // changing the action is what must move it.
    await setField("action", "reads the open items aloud from the board");
    expect(screen.getByTestId("program-derived-action_decision").textContent).not.toBe(before.decision);
    // …and the verb agrees: "I will read", never "I will reads".
    expect(screen.getByTestId("program-derived-action_decision").textContent).toContain("I will read the open items");
  });

  it("G2: the moment is no longer editable here — it belongs to the Host's own question", async () => {
    /*
      This test used to change `trigger` and assert both derived moments moved with it. Since
      Slice 3.2P-R3.6-R1 the moment is the Host's answer to "When does this usually happen?",
      so there is no control to change — which is a stronger version of the same property: the
      two sections cannot disagree about the occasion because neither can be edited apart from
      it. The same is true of who acts and of what shows completion.
    */
    setup(ok);
    await generate();
    await openDetails("observable_standard");
    for (const gone of ["actor", "trigger", "confirmed-by", "completion"]) {
      expect(screen.queryByTestId(`program-field-${gone}`), gone).toBeNull();
    }
    expect(screen.getByTestId("program-field-action")).toBeTruthy();
  });

  it("G3: no independent drift — apply and the standard always share one behaviour", async () => {
    setup(ok);
    await generate();
    await openDetails("observable_standard");
    await setField("action", "reads the open items aloud from the board");
    // Both sections re-render from the same value; there is no control that could set them apart.
    expect(screen.getByTestId("program-derived-observable_standard").textContent).toContain("read the open items aloud");
    expect(screen.queryByTestId("program-edit-observable_standard")).toBeNull();
    expect(screen.queryByTestId("program-edit-action_decision")).toBeNull();
  });

  it("G7: an incomplete adjustment blocks Apply with plain guidance", async () => {
    const { onApply } = setup(ok);
    await generate();
    await openDetails("observable_standard");
    /*
      THE ONLY EDITABLE DETAIL since 3.2P-R3.6-R1. Who, when and what-confirms are Host answers
      now, edited at their own Builder questions, so the one field this surface still owns is
      the action — and blanking it must still block Apply.
    */
    await setField("action", "");
    const block = screen.getByTestId("program-review-block");
    expect(block.textContent).toContain("turned into a sentence");
    expect(block.textContent).not.toMatch(/contract|validator|behavior_contract/i);
    expect((screen.getByTestId("program-apply") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-apply"));
    });
    expect(onApply).not.toHaveBeenCalled();
  });

  it("G7: a standard adjusted into meta language blocks Apply", async () => {
    setup(ok);
    await generate();
    await openDetails("observable_standard");
    await setField("action", "a shared handoff standard is created and utilized");
    expect(screen.getByTestId("program-review-block").textContent).toContain("could be seen doing");
    expect((screen.getByTestId("program-apply") as HTMLButtonElement).disabled).toBe(true);
  });

  it("G8: provenance says Adjusted by you — never Your rewrite for BTY-rendered text", async () => {
    setup(ok);
    await generate();
    const section = screen.getByTestId("program-section-observable_standard");
    expect(section.textContent).toContain("Drafted by BTY");
    await openDetails("observable_standard");
    await setField("action", "reads the open items aloud from the board");
    expect(section.textContent).toContain("Adjusted by you");
    expect(section.textContent).not.toContain("Your rewrite");
    expect(section.textContent).not.toContain("Drafted by BTY");
  });

  it("G5: Reset restores every contract value and every rendered sentence", async () => {
    setup(ok);
    await generate();
    const original = screen.getByTestId("program-derived-observable_standard").textContent ?? "";
    await openDetails("observable_standard");
    await setField("action", "reads the open items aloud from the board");
    expect(screen.getByTestId("program-derived-observable_standard").textContent).not.toBe(original);
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-reset"));
    });
    expect(screen.getByTestId("program-derived-observable_standard").textContent).toBe(original);
    expect(screen.getByTestId("program-section-observable_standard").textContent).toContain("Drafted by BTY");
    expect(screen.queryByTestId("program-review-block")).toBeNull();
  });

  it("G4: narrative stays editable and keeps its safety checks", async () => {
    setup(ok);
    await generate();
    await act(async () => {
      fireEvent.change(screen.getByTestId("program-edit-evidence"), {
        target: { value: "Completing this guarantees the behaviour is now permanent." },
      });
    });
    expect(screen.getByTestId("program-review-block").textContent).toContain("can’t show");
    expect((screen.getByTestId("program-apply") as HTMLButtonElement).disabled).toBe(true);
  });

  it("G6: Discard after adjustments writes nothing and returns to the entry point", async () => {
    const { onApply } = setup(ok);
    await generate();
    await openDetails("observable_standard");
    await setField("action", "reads the open items aloud from the board");
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-discard"));
    });
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByTestId("program-authorship-entry")).toBeTruthy();
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
        currentContextFingerprint={FP}
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
          currentContextFingerprint={FP}
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

describe("[3.2L-R11] the Apply boundary", () => {
  it("G15: a proposal written from older answers cannot silently overwrite them", async () => {
    const onApply = vi.fn();
    setup(ok, onApply, "fp-CHANGED-after-generation");
    await generate();
    expect(screen.getByTestId("program-stale-block").textContent).toContain("answers changed after BTY wrote this");
    expect((screen.getByTestId("program-apply") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-apply"));
    });
    expect(onApply).not.toHaveBeenCalled();
  });

  it("G14: navigation-only movement leaves an otherwise valid proposal applicable", async () => {
    // The fingerprint is built from ANSWERS only — current_step and updated_at are not in it.
    const { onApply } = setup(ok, vi.fn(), FP);
    await generate();
    expect(screen.queryByTestId("program-stale-block")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-apply"));
    });
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("G8: the dev fixture's Apply carries no attempt id, so no live attempt can be stamped", async () => {
    const onApply = vi.fn();
    const fixtureOutcome = { ...ok, attemptId: null };
    setup(fixtureOutcome as typeof ok, onApply);
    await generate();
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-apply"));
    });
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][1]).toBeNull();
  });

  it("Apply hands the attempt id through, so adoption can be recorded", async () => {
    const { onApply } = setup(ok);
    await generate();
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-apply"));
    });
    expect(onApply.mock.calls[0][1]).toBe("att-1");
  });

  it("G13: Apply cannot fire twice from one review", async () => {
    const { onApply } = setup(ok);
    await generate();
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-apply"));
    });
    expect(screen.queryByTestId("program-apply")).toBeNull();
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});

describe("[3.2L-R11.3A] the surface never claims an adoption the server refused", () => {
  it("G10: an authority refusal replaces the added confirmation", async () => {
    const onGenerate = vi.fn(async () => ok);
    const { rerender } = render(
      <ProgramAuthorship
        draftId="d-1"
        answers={ANSWERS}
        journey={undefined}
        ready
        onGenerate={onGenerate}
        onApply={vi.fn()}
        currentContextFingerprint={FP}
      />,
    );
    await generate();
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-apply"));
    });
    // Optimistically "added" — that is the existing UX and it stays.
    expect(screen.getByTestId("program-applied")).toBeTruthy();

    // …until the save comes back carrying the server's refusal.
    rerender(
      <ProgramAuthorship
        draftId="d-1"
        answers={ANSWERS}
        journey={undefined}
        ready
        onGenerate={onGenerate}
        onApply={vi.fn()}
        currentContextFingerprint={FP}
        adoptionRefusal="context_moved"
      />,
    );
    expect(screen.queryByTestId("program-applied")).toBeNull();
    const refused = screen.getByTestId("program-apply-refused").textContent ?? "";
    expect(refused).toContain("wasn’t added");
    expect(refused).toContain("Your other changes were saved");
    // No internal vocabulary reaches the Host.
    expect(refused).not.toMatch(/context_moved|proposal_mismatch|attempt|digest/i);
  });
});

describe("[3.2L-R11.3B] the surface waits for the server before saying added", () => {
  const setupApply = (onApply: ReturnType<typeof vi.fn>) => {
    render(
      <ProgramAuthorship
        draftId="d-1"
        answers={ANSWERS}
        journey={undefined}
        ready
        onGenerate={vi.fn(async () => ok)}
        onApply={onApply}
        currentContextFingerprint={FP}
      />,
    );
  };

  it("G13: ADDED is never rendered before the server establishes adoption", async () => {
    let release: (v: { status: "adopted" }) => void = () => undefined;
    const onApply = vi.fn(() => new Promise<{ status: "adopted" }>((r) => { release = r; }));
    setupApply(onApply);
    await generate();
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-apply"));
    });
    // In flight: honest "adding", and nothing claiming it is done.
    expect(screen.getByTestId("program-applying")).toBeTruthy();
    expect(screen.queryByTestId("program-applied")).toBeNull();
    await act(async () => { release({ status: "adopted" }); });
    expect(screen.getByTestId("program-applied")).toBeTruthy();
  });

  it("G14: an authority refusal says so, in the Host's words", async () => {
    setupApply(vi.fn(async () => ({ status: "refused" as const })));
    await generate();
    await act(async () => { fireEvent.click(screen.getByTestId("program-apply")); });
    expect(screen.queryByTestId("program-applied")).toBeNull();
    const t = screen.getByTestId("program-apply-refused").textContent ?? "";
    expect(t).toContain("wasn’t added");
    expect(t).toContain("Your other changes were saved");
    expect(t).not.toMatch(/proposal_mismatch|context_moved|superseded|attempt|digest|fingerprint/i);
  });

  it("G15: a pending receipt is a distinct, truthful state — added, still finishing", async () => {
    setupApply(vi.fn(async () => ({ status: "adopted_receipt_pending" as const })));
    await generate();
    await act(async () => { fireEvent.click(screen.getByTestId("program-apply")); });
    const t = screen.getByTestId("program-applied-pending").textContent ?? "";
    expect(t).toContain("Added to your training");
    expect(t).toContain("Finishing the record");
    expect(t).not.toMatch(/receipt|stamp|applied_at|attempt/i);
    expect(screen.queryByTestId("program-apply-refused")).toBeNull();
  });

  it("a save that never landed does not claim anything was added", async () => {
    setupApply(vi.fn(async () => ({ status: "save_failed" as const })));
    await generate();
    await act(async () => { fireEvent.click(screen.getByTestId("program-apply")); });
    const t = screen.getByTestId("program-apply-save-failed").textContent ?? "";
    expect(t).toContain("wasn’t added");
    expect(screen.queryByTestId("program-applied")).toBeNull();
  });
});
