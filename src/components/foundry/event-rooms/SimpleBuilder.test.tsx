/** @vitest-environment jsdom */
/**
 * FOUNDRY SIMPLE MODE — Slice 2 surface. ProgramAuthorship is replaced by a stand-in that does what
 * its automatic mode does (generate on mount, then adopt), so these tests pin SimpleBuilder's own
 * contract: two steps, hidden fields never rendered, at most ONE repair, truthful infrastructure
 * failures, and Edit details as the only way out of a second refusal.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import type { ProgramGenerateOutcome, ProgramApplyOutcome } from "./ProgramAuthorship";

vi.mock("./ProgramAuthorship", () => ({
  ProgramAuthorship: (p: { onGenerate: () => Promise<ProgramGenerateOutcome>; onApply: (...a: unknown[]) => Promise<ProgramApplyOutcome> }) => {
    useEffect(() => {
      void (async () => {
        const g = await p.onGenerate();
        if (g.ok) await p.onApply({ version: 1, elements: [] }, g.attemptId, undefined, {});
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div data-testid="program-authorship-auto" />;
  },
}));

import SimpleBuilder from "./SimpleBuilder";

afterEach(cleanup);

const SUGGESTION = {
  title: "Early problem check",
  behavior: "checks one thing that could interrupt patient care and fixes it",
  when: "before the first patient of the day",
  successEvidence: "HIDDEN-EVIDENCE the teammate hears which item was fixed",
};
const PROPOSAL_OK: ProgramGenerateOutcome = { ok: true, proposal: {} as never, evidenceCeiling: "", attemptId: "a-1", contextFingerprint: "f" };
const REFUSED = (refusal: string, step = 4): ProgramGenerateOutcome =>
  ({ ok: false, code: "invalid_output", refusal, retryable: false, recovery: { field: "observableBehavior", step } }) as ProgramGenerateOutcome;

function setup(opts: { generate?: ProgramGenerateOutcome[]; locale?: "en" | "ko"; guidanceFails?: boolean; suggestFails?: boolean; answers?: Record<string, unknown> } = {}) {
  const saved: Record<string, unknown>[] = [];
  const outcomes = [...(opts.generate ?? [PROPOSAL_OK])];
  const onGenerate = vi.fn(async (_repair?: string) => outcomes.shift() ?? PROPOSAL_OK);
  const onApply = vi.fn(async () => ({ status: "adopted" }) as ProgramApplyOutcome);
  const onEditDetails = vi.fn();
  const fetchImpl = vi.fn(async (url: string) => {
    if (url.endsWith("/simple-suggestion")) {
      return opts.suggestFails ? new Response("{}", { status: 502 }) : new Response(JSON.stringify({ suggestion: SUGGESTION }), { status: 200 });
    }
    if (url.endsWith("/simple-guidance")) {
      if (opts.guidanceFails) throw new Error("network");
      return new Response(JSON.stringify({ guidance: "Generated guidance text for the team.", source: "generated" }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
  const answers = (opts.answers ?? {}) as never;
  const utils = render(
    <SimpleBuilder
      draftId="d-1"
      locale={opts.locale ?? "en"}
      answers={answers}
      onSave={(p) => saved.push(p as Record<string, unknown>)}
      onGenerate={onGenerate}
      onApply={onApply as never}
      programAuthorshipProps={{} as never}
      publishPanel={<div data-testid="publish-panel">publish</div>}
      onEditDetails={onEditDetails}
      fetchImpl={fetchImpl}
    />,
  );
  return { ...utils, saved, onGenerate, onApply, onEditDetails, fetchImpl };
}

async function toSuggestion() {
  fireEvent.change(screen.getByTestId("simple-goal"), { target: { value: "Check one preventable problem before the first patient arrives." } });
  fireEvent.click(screen.getByTestId("simple-continue"));
  await screen.findByTestId("simple-suggestion");
}
async function toCreate() {
  await toSuggestion();
  fireEvent.click(screen.getByTestId("simple-use-this"));
  fireEvent.click(await screen.findByTestId("simple-create"));
}

describe("SIMPLE FLOW", () => {
  it("1. step 1 is ONE textarea and nothing else to fill in", () => {
    const { container } = setup();
    expect(screen.getByText("What do you want people to do better?")).toBeTruthy();
    expect(container.querySelectorAll("textarea")).toHaveLength(1);
    expect(container.querySelectorAll("input, select")).toHaveLength(0);
    expect((screen.getByTestId("simple-continue") as HTMLButtonElement).disabled).toBe(true);
  });

  it("2/3/11. Continue returns ONE suggestion; only behavior + when are shown — never the hidden title or evidence", async () => {
    const { container } = setup();
    await toSuggestion();
    expect(screen.getByTestId("simple-behavior").textContent).toBe(SUGGESTION.behavior);
    expect(screen.getByTestId("simple-when").textContent).toBe(SUGGESTION.when);
    expect(container.textContent).not.toContain("HIDDEN-EVIDENCE");
    expect(container.textContent).not.toContain(SUGGESTION.title);
    expect(container.textContent).not.toMatch(/evidence|verification|observable|rubric/i);
  });

  it("4. Use this → Create training", async () => {
    setup();
    await toSuggestion();
    fireEvent.click(screen.getByTestId("simple-use-this"));
    expect(await screen.findByTestId("simple-create")).toBeTruthy();
  });

  it("5. Edit changes the behaviour and moment in one small surface", async () => {
    setup();
    await toSuggestion();
    fireEvent.click(screen.getByTestId("simple-edit"));
    const b = screen.getByTestId("simple-edit-behavior") as HTMLTextAreaElement;
    expect(b.value).toBe(SUGGESTION.behavior);
    fireEvent.change(b, { target: { value: "names one thing that could slow the first patient and fixes it" } });
    fireEvent.click(screen.getByTestId("simple-edit-done"));
    expect((await screen.findByTestId("simple-ready")).textContent).toContain("names one thing that could slow the first patient");
  });

  it("6/21/22. Create saves the confirmed inputs, the hidden fields and the defaults (everyone, BTY-written guidance)", async () => {
    const { saved } = setup();
    await toCreate();
    await screen.findByTestId("simple-review");
    expect(saved[0]).toEqual({
      builderMode: "simple",
      problem: "Check one preventable problem before the first patient arrives.",
      title: SUGGESTION.title,
      observableBehavior: SUGGESTION.behavior,
      recurringMoment: SUGGESTION.when,
      successEvidence: SUGGESTION.successEvidence,
      audienceType: "everyone",
      materialIntent: "written",
    });
    await waitFor(() => expect(saved.some((p) => p.materialText === "Generated guidance text for the team.")).toBe(true));
  });

  it("22. a failed guidance call still leaves usable written material (deterministic fallback)", async () => {
    const { saved } = setup({ guidanceFails: true });
    await toCreate();
    await waitFor(() => expect(saved.some((p) => typeof p.materialText === "string" && (p.materialText as string).includes(SUGGESTION.behavior))).toBe(true));
  });

  it("7. Review is compact: title, what they'll learn, what they'll do, when, time — and the publish panel", async () => {
    const answers = { title: "Early problem check", observableBehavior: SUGGESTION.behavior, recurringMoment: SUGGESTION.when, successEvidence: SUGGESTION.successEvidence,
      realityGroundedJourneyV1: { version: 1, elements: [{ id: "w", kind: "why_it_matters", content: "Small problems found early do not reach a patient.", confirmationStatus: "grounded" }] },
      programAdoptionV1: { attemptId: "a-1" }, materialText: "Guidance." };
    const { container } = setup({ answers });
    expect(screen.getByTestId("simple-review-title").textContent).toBe("Early problem check");
    expect(screen.getByTestId("simple-review-learn").textContent).toBe("Small problems found early do not reach a patient.");
    expect(screen.getByTestId("simple-review-behavior").textContent).toBe(SUGGESTION.behavior);
    expect(screen.getByTestId("simple-review-when").textContent).toBe(SUGGESTION.when);
    expect(screen.getByTestId("simple-review-time").textContent).toMatch(/About \d+ min/);
    expect(screen.getByTestId("publish-panel")).toBeTruthy();
    expect(container.textContent).not.toContain("HIDDEN-EVIDENCE");
  });

  it("8. Edit details from Review opens the detailed builder", async () => {
    const { onEditDetails } = setup({ answers: { title: "t", realityGroundedJourneyV1: { version: 1, elements: [] }, programAdoptionV1: { attemptId: "a" } } });
    fireEvent.click(screen.getByTestId("simple-review-edit-details"));
    expect(onEditDetails).toHaveBeenCalledWith();
  });
});

describe("REFUSAL CONTAINMENT", () => {
  it("13/14. a first content refusal is repaired ONCE with its code, invisibly, and continues to Review", async () => {
    const { onGenerate, container } = setup({ generate: [REFUSED("non_observable_standard"), PROPOSAL_OK] });
    await toCreate();
    await screen.findByTestId("simple-review");
    expect(onGenerate).toHaveBeenCalledTimes(2);
    expect(onGenerate.mock.calls[0]).toEqual([]);
    expect(onGenerate.mock.calls[1]).toEqual(["non_observable_standard"]);
    expect(container.textContent).not.toMatch(/non_observable|refus/i);
  });

  it("15/16/17/18. a second refusal → 'This needs a little more detail' → Edit details at the server's recovery step; no code, no retry loop", async () => {
    const { onGenerate, onEditDetails, container } = setup({ generate: [REFUSED("non_observable_standard"), REFUSED("evidence_overclaim", 5)] });
    await toCreate();
    await screen.findByTestId("simple-needs-detail");
    expect(screen.getByText("Training saved. BTY needs a little more detail to finish it.")).toBeTruthy();
    expect(container.textContent).not.toMatch(/evidence_overclaim|non_observable|refus|invalid_output|Retry/i);
    expect(screen.queryByTestId("simple-create-retry")).toBeNull();
    expect(onGenerate).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByTestId("simple-edit-details"));
    expect(onEditDetails).toHaveBeenCalledWith(5);
  });

  it("infrastructure failures are NOT turned into editing: truthful message, retry allowed, no repair spent", async () => {
    const { onGenerate } = setup({ generate: [{ ok: false, code: "provider_error" }] });
    await toCreate();
    await screen.findByTestId("simple-create-failed");
    expect(screen.queryByTestId("simple-needs-detail")).toBeNull();
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("a suggestion failure is reported truthfully and can be retried", async () => {
    setup({ suggestFails: true });
    fireEvent.change(screen.getByTestId("simple-goal"), { target: { value: "x" } });
    fireEvent.click(screen.getByTestId("simple-continue"));
    expect(await screen.findByTestId("simple-suggest-failed")).toBeTruthy();
    expect(screen.getByTestId("simple-continue").textContent).toBe("Retry");
  });
});

describe("KO", () => {
  it("renders the Korean two-step copy", () => {
    setup({ locale: "ko" });
    expect(screen.getByText("사람들이 무엇을 더 잘하게 만들고 싶나요?")).toBeTruthy();
    expect(screen.getByTestId("simple-continue").textContent).toBe("계속");
  });
});
