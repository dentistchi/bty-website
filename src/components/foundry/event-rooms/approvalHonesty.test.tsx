/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";

/**
 * SLICE 3.2L-R11.4G PART 8/9 — what "Approve & create session" actually approves.
 *
 * MEASURED, not assumed: `approveDraft` runs `builderApprovalErrors` (the Builder's own
 * steps) plus a PDF-material check, and never reads `realityGroundedJourneyV1`. Publishing
 * does the same. A BTY program is therefore OPTIONAL — a Host-authored-only training is a
 * legitimate, intended product, and the server is correct to allow it.
 *
 * The UI was the misleading part. Right after a refusal that says "Nothing was added", the
 * CTA is enabled and silent about the fact that the program is not in the training.
 */
const DRAFT_ID = "d0000000-0000-4000-8000-000000000001";

/** The canonical shape: 7 required kinds, a 4-element host-authored seed journey. */
const ANSWERS = {
  problem: "Our handoffs are inconsistent.",
  audienceType: "everyone",
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

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (typeof url === "string" && url.includes("/program-draft")) {
      return { ok: true, json: async () => ({ pending: false }) } as unknown as Response;
    }
    return {
      ok: true,
      json: async () => ({ draft: { id: DRAFT_ID, status: "draft", currentStep: 7, answers: ANSWERS, assets: [] } }),
    } as unknown as Response;
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("[3.2L-R11.4G] the approval CTA says what it approves", () => {
  it("with the program absent, the Host is told the training is built from their own sections", async () => {
    render(<ModuleBuilderShell draftId={DRAFT_ID} locale="en" initialView="review" onExit={() => {}} />);
    const note = await screen.findByTestId("publish-without-program", {}, { timeout: 5000 });
    const text = note.textContent ?? "";
    expect(text).toMatch(/from the sections you wrote/i);
    expect(text).toMatch(/was not added/i);
    // It names how many program sections are absent — 7 required, 3 of them present.
    expect(text).toMatch(/4 remaining sections/);
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
    for (const kind of ["scenario", "action_decision", "field_application", "follow_up"]) {
      complete.realityGroundedJourneyV1.elements.push({
        id: `el_${kind}`, kind, content: "A grounded sentence for this section.",
        confirmationStatus: "grounded", grounding: [{ field: "problem", sourceType: "host_statement" }],
      });
    }
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (typeof url === "string" && url.includes("/program-draft")) {
        return { ok: true, json: async () => ({ pending: false }) } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({ draft: { id: DRAFT_ID, status: "draft", currentStep: 7, answers: complete, assets: [] } }),
      } as unknown as Response;
    }));
    render(<ModuleBuilderShell draftId={DRAFT_ID} locale="en" initialView="review" onExit={() => {}} />);
    await screen.findByTestId("publish-cta", {}, { timeout: 5000 });
    expect(screen.queryByTestId("publish-without-program")).toBeNull();
  });
});
