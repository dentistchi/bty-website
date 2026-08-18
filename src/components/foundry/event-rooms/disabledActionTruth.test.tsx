/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";
import { programSourceMissing, programContext } from "@/domain/foundry/module/program-authorship";
import { MODULE_BUILDER_COPY as COPY } from "./moduleBuilderCopy";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/**
 * SLICE R4-R2F — DISABLED-ACTION TRUTH.
 *
 * MEASURED DEFECT. "Draft my training program" is disabled by `programContext(answers) !== null`,
 * which requires steps 1–5: problem, audience (+ detail where the audience needs one), the
 * recurring moment, the behaviour and the evidence. The sentence under it named FOUR of those and
 * silently omitted the recurring moment — the one thing 36 of 40 production drafts actually lack
 * (R4-R2D's own ledger). A Host with a complete draft but no moment was told to add four things
 * they had already written.
 *
 * The repair is not new copy. It is a single derived result — `programSourceMissing` — that the
 * button state and the explanation both read, so they cannot describe different requirements.
 * The sentences themselves are the Builder's OWN approved per-step lines, reused rather than
 * rewritten.
 */
const jsonRes = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** A draft complete in every respect EXCEPT the one under test. */
const COMPLETE = {
  title: "Confirmation calls",
  problem: "No confirmation calls are made after a new booking.",
  audienceType: "everyone",
  recurringMoment: "after each new patient booking",
  observableBehavior: "Employees make a confirmation call and follow a checklist.",
  successEvidence: "A checklist is completed and submitted after each call.",
  learningNeeds: ["decide"],
  materialIntent: "youtube",
  materialText: "https://youtu.be/x",
  completionPrompt: "Describe how you will use the checklist.",
  arenaRecommended: false,
  followUpDays: 7,
} as unknown as BuilderAnswers;

function server(answers: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/assets")) return jsonRes({ assets: [] });
    if (u.includes("/program-draft")) return jsonRes({ attempt: null });
    if (u.includes("/api/bty/foundry/modules/")) {
      return jsonRes({ draft: { id: "d1", status: "draft", current_step: 9, answers, module_version: 1, parent_module_id: null, document_asset_ref_present: false, created_at: "t", updated_at: "t" } });
    }
    return jsonRes({});
  });
}

async function openReview(answers: Record<string, unknown>) {
  vi.stubGlobal("fetch", server(answers));
  render(<ModuleBuilderShell draftId="d1" locale="en" initialView="review" onExit={() => {}} />);
  return await screen.findByTestId("program-authorship-entry");
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("[R4-R2F] the reason matches the predicate that is actually blocking", () => {
  it("1 — a missing recurring moment disables Draft, and the reason NAMES it", async () => {
    const { recurringMoment, ...withoutMoment } = COMPLETE as Record<string, unknown>;
    void recurringMoment;
    await openReview(withoutMoment);

    const button = screen.getByTestId("program-generate") as HTMLButtonElement;
    expect(button.disabled, "the button must actually be disabled").toBe(true);

    const reason = screen.getByTestId("program-not-ready-reason").textContent ?? "";
    // The Builder's own approved sentence for this requirement — not a re-write, not a list.
    expect(reason).toBe(COPY.en.sMomentBlocker);
    // The measured falsehood, pinned out: it must no longer recite four unrelated requirements.
    expect(reason).not.toMatch(/problem, who it’s for, the behaviour and the evidence/i);
  });

  it("2 — adding the moment removes that reason and re-enables the action", async () => {
    await openReview(COMPLETE as unknown as Record<string, unknown>);
    await waitFor(() => expect((screen.getByTestId("program-generate") as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByTestId("program-not-ready-reason")).toBeNull();
  });

  it("4 — for EVERY single missing requirement, the reason is that requirement's own sentence", async () => {
    /*
      The anti-drift test. Not one example: every field the predicate consults, each removed on
      its own, asserting the sentence the Host is shown is the one belonging to the blocker the
      domain actually reported. This is what makes "disabled because X while the UI says Y"
      unreachable rather than merely unobserved.
    */
    const expected: Record<string, string> = {
      problem: COPY.en.s1Blocker,
      audienceType: COPY.en.s2Blocker,
      recurringMoment: COPY.en.sMomentBlocker,
      observableBehavior: COPY.en.s3Blocker,
      successEvidence: COPY.en.s4Blocker,
    };
    for (const [field, sentence] of Object.entries(expected)) {
      const answers = { ...(COMPLETE as unknown as Record<string, unknown>) };
      delete answers[field];
      // The domain and the screen must agree about what is missing.
      expect(programSourceMissing(answers as BuilderAnswers).length, `${field} should block`).toBeGreaterThan(0);
      expect(programContext(answers as BuilderAnswers), `${field} should block generation`).toBeNull();

      await openReview(answers);
      expect((screen.getByTestId("program-generate") as HTMLButtonElement).disabled, field).toBe(true);
      expect(screen.getByTestId("program-not-ready-reason").textContent, field).toBe(sentence);
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  it("the audience DETAIL requirement gets its own sentence, not the audience one", async () => {
    // A Host who chose "a job group" but did not say which is blocked for a different reason
    // than one who chose nothing — and must not be told to choose again.
    const answers = { ...(COMPLETE as unknown as Record<string, unknown>), audienceType: "job_group" };
    await openReview(answers);
    expect((screen.getByTestId("program-generate") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("program-not-ready-reason").textContent).toBe(COPY.en.s2DetailBlocker);
    expect(screen.getByTestId("program-not-ready-reason").textContent).not.toBe(COPY.en.s2Blocker);
  });

  it("7 — the underlying required-field rules did not move", () => {
    // The slice repairs the EXPLANATION, never what is required. `programContext` is still null
    // for exactly the same inputs, which is what every other caller depends on.
    expect(programContext(COMPLETE)).not.toBeNull();
    expect(programSourceMissing(COMPLETE)).toEqual([]);
    for (const field of ["problem", "audienceType", "recurringMoment", "observableBehavior", "successEvidence"]) {
      const a = { ...(COMPLETE as unknown as Record<string, unknown>) };
      delete a[field];
      expect(programContext(a as BuilderAnswers), field).toBeNull();
    }
    // …and a step the program does not author from still does not block it.
    const noFollowUp = { ...(COMPLETE as unknown as Record<string, unknown>) };
    delete noFollowUp.followUpDays;
    expect(programContext(noFollowUp as BuilderAnswers)).not.toBeNull();
  });
});

describe("[R4-R2F] 5 — no internal field name reaches Host-facing Builder copy", () => {
  it("the copy tables contain no implementation identifiers", () => {
    const RAW = ["recurringMoment", "followUpDays", "evidenceType", "programAdoptionV1", "materialIntent",
      "audienceDetail", "observableBehavior", "successEvidence", "capabilityCandidate", "realityGroundedJourneyV1"];
    const strings: string[] = [];
    const walk = (v: unknown) => {
      if (typeof v === "string") strings.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(COPY);
    for (const raw of RAW) {
      const hit = strings.find((str) => str.includes(raw));
      expect(hit, `"${raw}" leaked into Host-facing copy: ${hit}`).toBeUndefined();
    }
  });
});
