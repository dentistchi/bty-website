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
};

const ok: ProgramGenerateOutcome = { ok: true, proposal: PROPOSAL, evidenceCeiling: "Reading shows exposure only.", attemptId: "att-1" };

function setup(outcome: ProgramGenerateOutcome, onApply = vi.fn()) {
  const onGenerate = vi.fn(async () => outcome);
  render(
    <ProgramAuthorship answers={ANSWERS} journey={undefined} ready onGenerate={onGenerate} onApply={onApply} />,
  );
  return { onGenerate, onApply };
}

async function generate() {
  await act(async () => {
    fireEvent.click(screen.getByTestId("program-generate"));
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
    render(<ProgramAuthorship answers={{}} journey={undefined} ready={false} onGenerate={onGenerate} onApply={vi.fn()} />);
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
    ["validation refusal", { ok: false, code: "invalid_output", refusal: "invented_specifics" }, "honesty rules"],
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
      expect(screen.getByTestId("program-generate").textContent).toContain("Draft it again");
    });
  }

  it("a refused draft is never shown to the Host", async () => {
    setup({ ok: false, code: "invalid_output", refusal: "material_fabrication" });
    await generate();
    expect(screen.queryByTestId("program-review")).toBeNull();
    expect(screen.getByTestId("program-failure").textContent).toContain("discarded it rather than show it to you");
  });
});

describe("[3.2L-R1] G9 — generation and publication never overlap in the UI", () => {
  it("raises pending while the draft is being written, and lowers it on success", async () => {
    const pending: boolean[] = [];
    const onGenerate = vi.fn(async () => ok);
    render(
      <ProgramAuthorship
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
