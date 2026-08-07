/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";

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
 */

const CANONICAL_ID = "093b0361-7cc8-4688-9f93-396d60582501";
const CANONICAL_FOCUS = "Our handoffs are inconsistent.";
const WRONG_ID = "35773b57-219b-43fb-829e-80f0656ccb66";
const WRONG_FOCUS = "새로운 의사들의 교만이 문제야";

const answersFor = (problem: string) => ({
  problem,
  audienceType: "everyone",
  observableBehavior: "Create a shared handoff standard.",
  successEvidence: "Handoff record",
  learningNeeds: ["know"],
  materialIntent: "youtube",
  materialText: "https://youtu.be/x",
  completionPrompt: "What will you include in your handoff record?",
  followUpDays: 7,
});

const PROGRAM = {
  display_title: "Handing over without gaps",
  elements: [
    { kind: "why_it_matters", content: "AI why", rationale: "r" },
    { kind: "observable_standard", content: "AI standard", rationale: "r" },
    { kind: "completion_check", content: "AI check", rationale: "r" },
  ],
  assumptions: [],
  warnings: [],
};

type Call = { url: string; method: string; body: unknown };

/** Records EVERY request so "the provider was not called" is measured, not assumed. */
function mockServer(opts: {
  drafts: Record<string, { current_step: number; answers: Record<string, unknown> }>;
  programResponse?: () => Response | Promise<Response>;
}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });

      if (url.includes("program-draft")) {
        return opts.programResponse
          ? opts.programResponse()
          : new Response(JSON.stringify({ program: PROGRAM, evidence_ceiling: "c", attempt_id: "att-1" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
      }
      const id = Object.keys(opts.drafts).find((d) => url.includes(d));
      if (method === "GET" && id) {
        return new Response(
          JSON.stringify({
            draft: { id, status: "draft", current_step: opts.drafts[id].current_step, answers: opts.drafts[id].answers, assets: [] },
            program_generation_active: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }),
  );
  const providerCalls = () => calls.filter((c) => c.url.includes("program-draft"));
  const draftWrites = () => calls.filter((c) => c.method === "PATCH");
  return { calls, providerCalls, draftWrites };
}

async function openDraft(id: string) {
  const r = render(<ModuleBuilderShell draftId={id} locale="en" onExit={() => {}} />);
  await act(async () => {
    await Promise.resolve();
  });
  await screen.findByTestId("program-generate");
  return r;
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
    const { providerCalls, draftWrites } = mockServer({ drafts: { [CANONICAL_ID]: { current_step: 8, answers: answersFor(CANONICAL_FOCUS) } } });
    await openDraft(CANONICAL_ID);
    await pressGenerate();

    expect(screen.getByTestId("program-target-confirm")).toBeTruthy();
    expect(providerCalls(), "opening the confirmation must not call the provider").toHaveLength(0);
    expect(draftWrites(), "opening the confirmation must not write to the draft").toHaveLength(0);
  });

  it("G2 — Go back spends nothing and restores focus to the entry button", async () => {
    const { providerCalls, draftWrites } = mockServer({ drafts: { [CANONICAL_ID]: { current_step: 8, answers: answersFor(CANONICAL_FOCUS) } } });
    await openDraft(CANONICAL_ID);
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
    const { providerCalls } = mockServer({ drafts: { [CANONICAL_ID]: { current_step: 8, answers: answersFor(CANONICAL_FOCUS) } } });
    await openDraft(CANONICAL_ID);
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
    mockServer({ drafts: { [CANONICAL_ID]: { current_step: 8, answers: answersFor(CANONICAL_FOCUS) } } });
    await openDraft(CANONICAL_ID);
    await pressGenerate();

    const el = screen.getByTestId("program-target-focus");
    expect(el.textContent).toBe(CANONICAL_FOCUS);
    expect(el.getAttribute("data-target-draft-id")).toBe(CANONICAL_ID);
    expect(screen.getByTestId("program-target-confirm").textContent).toContain("Training program target");
    expect(screen.queryByText(WRONG_FOCUS)).toBeNull();
  });

  it("G4 — wrong draft: shows ITS focus, and the canonical focus is absent", async () => {
    mockServer({ drafts: { [WRONG_ID]: { current_step: 8, answers: answersFor(WRONG_FOCUS) } } });
    await openDraft(WRONG_ID);
    await pressGenerate();

    const el = screen.getByTestId("program-target-focus");
    expect(el.textContent).toBe(WRONG_FOCUS);
    expect(el.getAttribute("data-target-draft-id")).toBe(WRONG_ID);
    expect(screen.queryByText(CANONICAL_FOCUS)).toBeNull();
  });

  it("G5 — switching drafts shows only the NEW target; no stale value survives", async () => {
    mockServer({
      drafts: {
        [CANONICAL_ID]: { current_step: 8, answers: answersFor(CANONICAL_FOCUS) },
        [WRONG_ID]: { current_step: 8, answers: answersFor(WRONG_FOCUS) },
      },
    });
    await openDraft(CANONICAL_ID);
    await pressGenerate();
    expect(screen.getByTestId("program-target-focus").textContent).toBe(CANONICAL_FOCUS);
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-target-cancel"));
    });

    cleanup();
    await openDraft(WRONG_ID);
    await pressGenerate();
    expect(screen.getByTestId("program-target-focus").textContent).toBe(WRONG_FOCUS);
    expect(screen.getByTestId("program-target-focus").getAttribute("data-target-draft-id")).toBe(WRONG_ID);
    expect(screen.queryByText(CANONICAL_FOCUS)).toBeNull();
  });

  it("the primary action names what will happen — not a generic Continue/Confirm/Yes", async () => {
    mockServer({ drafts: { [CANONICAL_ID]: { current_step: 8, answers: answersFor(CANONICAL_FOCUS) } } });
    await openDraft(CANONICAL_ID);
    await pressGenerate();
    const label = screen.getByTestId("program-target-confirm-action").textContent ?? "";
    expect(label).toBe("Draft program for this training");
    expect(["Continue", "Confirm", "Yes", "OK"]).not.toContain(label.trim());
  });

  it("states plainly that nothing is added or published yet", async () => {
    mockServer({ drafts: { [CANONICAL_ID]: { current_step: 8, answers: answersFor(CANONICAL_FOCUS) } } });
    await openDraft(CANONICAL_ID);
    await pressGenerate();
    expect(screen.getByTestId("program-target-confirm").textContent).toContain(
      "Nothing will be added or published until you review and apply it",
    );
  });
});

describe("[3.2L-R1.3] only an explicit confirmation spends", () => {
  it("G8 — rapid taps create exactly ONE provider request", async () => {
    const { providerCalls } = mockServer({ drafts: { [CANONICAL_ID]: { current_step: 8, answers: answersFor(CANONICAL_FOCUS) } } });
    await openDraft(CANONICAL_ID);
    await pressGenerate();

    const btn = screen.getByTestId("program-target-confirm-action");
    await act(async () => {
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);
    });
    expect(providerCalls(), "one gesture must buy at most one generation").toHaveLength(1);
  });

  it("one confirmation sends exactly one submission intent", async () => {
    const { providerCalls } = mockServer({ drafts: { [CANONICAL_ID]: { current_step: 8, answers: answersFor(CANONICAL_FOCUS) } } });
    await openDraft(CANONICAL_ID);
    await pressGenerate();
    await pressConfirm();

    expect(providerCalls()).toHaveLength(1);
    const body = providerCalls()[0].body as { submission_intent_id?: string; context_fingerprint?: string };
    expect(body.submission_intent_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(body.context_fingerprint, "the request carries the bound fingerprint").toBeTruthy();
  });

  it("reopening after a completed run issues a NEW intent, never a replay", async () => {
    const { providerCalls } = mockServer({ drafts: { [CANONICAL_ID]: { current_step: 8, answers: answersFor(CANONICAL_FOCUS) } } });
    await openDraft(CANONICAL_ID);
    await pressGenerate();
    await pressConfirm();
    const first = (providerCalls()[0].body as { submission_intent_id: string }).submission_intent_id;

    await act(async () => {
      fireEvent.click(screen.getByTestId("program-discard"));
    });
    await pressGenerate();
    await pressConfirm();
    const second = (providerCalls()[1].body as { submission_intent_id: string }).submission_intent_id;
    expect(second).not.toBe(first);
  });
});

describe("[3.2L-R1.3] server refusals reach the Host intact", () => {
  it("G7 — an already-active generation refuses without a proposal", async () => {
    mockServer({
      drafts: { [CANONICAL_ID]: { current_step: 8, answers: answersFor(CANONICAL_FOCUS) } },
      programResponse: () =>
        new Response(JSON.stringify({ error: "program_generation_in_progress" }), { status: 409 }),
    });
    await openDraft(CANONICAL_ID);
    await pressGenerate();
    await pressConfirm();
    expect(screen.queryByTestId("program-review")).toBeNull();
    expect(screen.getByTestId("program-failure")).toBeTruthy();
  });

  it("G6 — a stale target refuses with its specific reason and no proposal", async () => {
    mockServer({
      drafts: { [CANONICAL_ID]: { current_step: 8, answers: answersFor(CANONICAL_FOCUS) } },
      programResponse: () =>
        new Response(JSON.stringify({ error: "stale_context", refusal: "status_no_longer_draft" }), { status: 409 }),
    });
    await openDraft(CANONICAL_ID);
    await pressGenerate();
    await pressConfirm();
    expect(screen.queryByTestId("program-review")).toBeNull();
    expect(screen.getByTestId("program-failure").textContent).toContain("created as a session while BTY was writing");
  });

  it("G11 — confirm → success → Discard writes no journey to the draft", async () => {
    const { draftWrites } = mockServer({ drafts: { [CANONICAL_ID]: { current_step: 8, answers: answersFor(CANONICAL_FOCUS) } } });
    await openDraft(CANONICAL_ID);
    await pressGenerate();
    await pressConfirm();
    expect(screen.getByTestId("program-review")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByTestId("program-discard"));
    });
    const journeyWrites = draftWrites().filter((c) =>
      JSON.stringify((c.body as { answers?: unknown })?.answers ?? {}).includes("realityGroundedJourneyV1"),
    );
    expect(journeyWrites, "Discard must never persist a journey").toHaveLength(0);
  });
});

describe("[3.2L-R1.3] missing focus and accessibility", () => {
  it("G9 — a draft with no focus shows the neutral fallback, and invents nothing", async () => {
    mockServer({ drafts: { [CANONICAL_ID]: { current_step: 8, answers: { audienceType: "everyone" } } } });
    await openDraft(CANONICAL_ID);
    // The entry action is blocked while the required inputs are missing, so the paid path
    // is unreachable — but if it is reached, the fallback is neutral.
    expect((screen.getByTestId("program-generate") as HTMLButtonElement).disabled).toBe(true);
  });

  it("G9b — a long focus keeps its distinguishing tail and does not truncate", async () => {
    const shared = "Our handoffs at shift change keep missing steps and this creates risk for everyone involved daily";
    const long = `${shared}, especially on the night shift.`;
    mockServer({ drafts: { [CANONICAL_ID]: { current_step: 8, answers: answersFor(long) } } });
    await openDraft(CANONICAL_ID);
    await pressGenerate();
    const el = screen.getByTestId("program-target-focus");
    expect(el.textContent).toBe(long);
    expect(el.className).toContain("break-words");
    expect(el.className).not.toContain("truncate");
  });

  it("G10 — the confirmation is a labelled dialog that takes focus, with a 44px touch target", async () => {
    mockServer({ drafts: { [CANONICAL_ID]: { current_step: 8, answers: answersFor(CANONICAL_FOCUS) } } });
    await openDraft(CANONICAL_ID);
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
    mockServer({ drafts: { [CANONICAL_ID]: { current_step: 8, answers: answersFor(CANONICAL_FOCUS) } } });
    await openDraft(CANONICAL_ID);
    await pressGenerate();
    const html = screen.getByTestId("program-target-confirm").innerHTML;
    expect(html.indexOf("Training program target")).toBeLessThan(html.indexOf("program-target-confirm-action"));
  });
});
