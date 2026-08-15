/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";

/**
 * SLICE 3.2L-R11.4G PART 8/9 — what "Approve & create session" actually approves.
 *
 * MEASURED, not assumed: `approveDraft` runs `builderApprovalErrors` (the Builder's own
 * steps) plus a PDF-material check, and never reads `realityGroundedJourneyV1`. Publishing
 * did the same. A BTY program is therefore OPTIONAL — a Host-authored-only training is a
 * legitimate, intended product, and the server is correct to allow it.
 *
 * The UI was the misleading part. Right after a refusal that says "Nothing was added", the
 * CTA is enabled and silent about the fact that the program is not in the training.
 *
 * NARROWED BY THE 3.2P-R2.1 PRODUCT DECISION. "Optional" now holds only for a draft that is
 * NOT under the Guided journey contract. A JOURNEY-ENABLED draft must satisfy the required
 * kinds its own Host intent implies before it may publish — server-enforced — so the fixture
 * these three tests use carries no journey, which is the case that remains legitimate. The
 * journey-enabled counterpart is asserted at the bottom of this file, where it is now blocked.
 */
const DRAFT_ID = "d0000000-0000-4000-8000-000000000001";

/** The canonical shape: 7 required kinds, a 4-element host-authored seed journey. */
const ANSWERS = {
  // Slice 3.2R-R2.1 — a complete draft carries a NAME distinct from its problem.
  title: "Read Back Before Sign-Off",
  problem: "Our handoffs are inconsistent.",
  audienceType: "everyone",
  recurringMoment: "at each handoff point",
  observableBehavior: "Create a shared handoff standard.",
  successEvidence: "Handoff record",
  evidenceType: "seen",
  learningNeeds: ["know", "decide", "practice"],
  materialIntent: "youtube",
  materialText: "https://youtu.be/x",
  completionPrompt: "What specific elements will you include in your handoff record?",
  arenaRecommended: true,
  followUpDays: 7,
  realityGroundedJourneyV1: {
    version: 1,
    displayTitle: "Handing over without gaps",
    displayTitleStatus: "grounded",
    elements: [
      { id: "el_why_it_matters", kind: "why_it_matters", content: "Our handoffs are inconsistent.", confirmationStatus: "grounded", grounding: [{ field: "problem", sourceType: "host_statement" }] },
      { id: "el_observable_standard", kind: "observable_standard", content: "Create a shared handoff standard.", confirmationStatus: "grounded", grounding: [{ field: "observableBehavior", sourceType: "host_statement" }] },
      { id: "el_evidence", kind: "evidence", content: "Handoff record", confirmationStatus: "grounded", grounding: [{ field: "successEvidence", sourceType: "host_statement" }] },
      { id: "el_completion_check", kind: "completion_check", content: "What specific elements will you include?", confirmationStatus: "grounded", grounding: [{ field: "completionPrompt", sourceType: "host_statement" }] },
    ],
  },
};

/** The same Host intent WITHOUT the journey contract — the case that stays legitimate. */
const ANSWERS_NO_JOURNEY = (() => {
  const a = JSON.parse(JSON.stringify(ANSWERS)) as Record<string, unknown>;
  delete a.realityGroundedJourneyV1;
  return a;
})();

function serve(answers: unknown) {
  return vi.fn(async (url: string) => {
    if (typeof url === "string" && url.includes("/program-draft")) {
      return { ok: true, json: async () => ({ pending: false }) } as unknown as Response;
    }
    return {
      ok: true,
      json: async () => ({ draft: { id: DRAFT_ID, status: "draft", currentStep: 7, answers, assets: [] } }),
    } as unknown as Response;
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", serve(ANSWERS_NO_JOURNEY));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("[3.2L-R11.4G] the approval CTA says what it approves", () => {
  it("with the program absent, the Host is told the training is built from their own sections", async () => {
    render(<ModuleBuilderShell draftId={DRAFT_ID} locale="en" initialView="review" onExit={() => {}} />);
    const note = await screen.findByTestId("publish-without-program", {}, { timeout: 5000 });
    const text = note.textContent ?? "";
    expect(text).toMatch(/from the sections you wrote/i);
    expect(text).toMatch(/was not added/i);
    // It names how many program sections are absent. With no journey at all, that is every
    // kind this Host's intent requires: seven.
    expect(text).toMatch(/7 remaining sections/);
  });

  it("the CTA stays ENABLED — a host-authored-only training is legitimate, and the server allows it", async () => {
    render(<ModuleBuilderShell draftId={DRAFT_ID} locale="en" initialView="review" onExit={() => {}} />);
    const cta = await screen.findByTestId("publish-cta", {}, { timeout: 5000 });
    await waitFor(() => expect((cta as HTMLButtonElement).disabled).toBe(false));
  });

  it("no false success: the note never claims the program was added", async () => {
    render(<ModuleBuilderShell draftId={DRAFT_ID} locale="en" initialView="review" onExit={() => {}} />);
    const note = await screen.findByTestId("publish-without-program", {}, { timeout: 5000 });
    expect(note.textContent ?? "").not.toMatch(/added to your training|program is ready|includes the program/i);
  });

  it("a training whose program IS complete shows no such note", async () => {
    const complete = JSON.parse(JSON.stringify(ANSWERS));
    // Canonical order — the structural validator refuses out-of-order elements.
    complete.realityGroundedJourneyV1.elements = [
      "why_it_matters", "observable_standard", "scenario", "action_decision",
      "field_application", "evidence", "completion_check", "follow_up",
    ].map((kind) => ({
      id: `el_${kind}`, kind, content: "A grounded sentence for this section.",
      confirmationStatus: "grounded", grounding: [{ field: "problem", sourceType: "host_statement" }],
    }));
    vi.stubGlobal("fetch", serve(complete));
    render(<ModuleBuilderShell draftId={DRAFT_ID} locale="en" initialView="review" onExit={() => {}} />);
    await screen.findByTestId("publish-cta", {}, { timeout: 5000 });
    expect(screen.queryByTestId("publish-without-program")).toBeNull();
  });
});

describe("[3.2P-R2.1] the same draft UNDER the journey contract is now blocked", () => {
  it("a journey-enabled draft missing required kinds disables the CTA and names them", async () => {
    /*
      This is the behaviour change the locked product decision entails, stated plainly: the
      4-element host-authored journey above was publishable and is not any more. "A program is
      optional" survives only for a draft with no journey contract at all — the test above.
    */
    vi.stubGlobal("fetch", serve(ANSWERS));
    render(<ModuleBuilderShell draftId={DRAFT_ID} locale="en" initialView="review" onExit={() => {}} />);
    const cta = await screen.findByTestId("publish-cta", {}, { timeout: 5000 });
    await waitFor(() => expect((cta as HTMLButtonElement).disabled).toBe(true));
    const items = screen.getAllByTestId("journey-blocker-item").map((n) => n.textContent ?? "");
    expect(items.length).toBeGreaterThan(0);
    expect(items.join(" | ")).toMatch(/is missing from the program/i);
    // And the "created from your own sections" note is correctly NOT shown — it would be
    // describing an outcome that can no longer happen for this draft.
    expect(screen.queryByTestId("publish-without-program")).toBeNull();
  });
});
