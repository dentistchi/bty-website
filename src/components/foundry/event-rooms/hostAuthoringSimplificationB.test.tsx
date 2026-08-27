/** @vitest-environment jsdom */
/**
 * SLICE R4-R8B — THE BUILDER ASKS ONLY WHAT ONLY THE HOST CAN KNOW.
 *
 * Simplification A removed the repeated "shall BTY make this for you?" decisions. What it left
 * behind was a Builder that still asked the Host to make BTY's DESIGN decisions: which learning
 * needs a training contains, whether people should practise in Arena, when to follow up — and,
 * worst of the four, to author the learner's completion question in a box that arrived looking
 * pre-filled. That last one was not merely a question too many. `resolveCompletionCheck` gives a
 * Host-typed sentence absolute precedence, so adjusting one word of BTY's suggestion silently
 * took ownership of the question and the barrier question BTY writes could never render. The
 * mitigation was an instruction — "do not type in that field" — and an instruction like that is
 * the defect stated out loud.
 *
 * WHAT THESE TESTS HOLD:
 *   · six questions, and none of them about BTY's internals;
 *   · the removed fields are DERIVED, not dropped — and frozen where readers look for them;
 *   · a completely fresh, untouched draft reaches BOTH the C16B barrier question and the C17A
 *     next-opportunity decision, with neither attributed to the Host;
 *   · every legacy authority survives: their question, their shared question, their needs, their
 *     Arena and follow-up choices, and their bookmark into a graph that no longer exists.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { readdirSync } from "node:fs";
import { ModuleBuilderShell } from "./ModuleBuilderShell";
import { MODULE_BUILDER_COPY } from "./moduleBuilderCopy";
import {
  BUILDER_STEP_MAX,
  BUILDER_QUESTION_STEP,
  PRIOR_STEP_GRAPH_MAX,
  effectiveArenaRecommended,
  effectiveFollowUpDays,
  effectiveLearningNeeds,
  normalizeLearningNeeds,
  resumeStep,
  stepBlocker,
} from "@/domain/foundry/module/module-builder";
import { buildModuleSnapshot, reviewMissingSections, ALL_BLOCKING_CODES } from "@/domain/foundry/module/module-publish";
import {
  programContextFingerprint,
  programContext,
  programSourceMissing,
  requiredProgramKinds,
  readProvenance,
  attributionKind,
} from "@/domain/foundry/module/program-authorship";
import { classifyRealityIntentReadiness } from "@/domain/foundry/module/reality-intent";
import { journeyCopy } from "@/domain/foundry/module/journeyLocaleCopy";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

const DRAFT = "d-r4r8b";
const ATTEMPT = "1c2f8b5e-4a17-4c93-8b21-7d0e5a3f9c44";

/** A complete fresh draft: the six Host answers and NOTHING else. No needs, no Arena, no
 *  follow-up, no completion question, no shared question — exactly what the Builder now collects. */
const FRESH = {
  title: "Close the Loop on One Commitment",
  problem: "Team huddles end with agreement, but no one clearly owns the next action.",
  audienceType: "everyone",
  recurringMoment: "At the end of a team huddle when there are open action items",
  observableBehavior: "Before the huddle ends, name one owner and one deadline for each open action item.",
  successEvidence: "The huddle notes show a named owner and deadline.",
  evidenceType: "seen",
  materialIntent: "youtube",
  materialText: "https://youtu.be/x",
} as unknown as BuilderAnswers;

const FINGERPRINT = programContextFingerprint(programContext(FRESH)!);
const el = (kind: string, content: string) => ({ kind, content, rationale: "because it fits" });

/** Built from the product's own required list, so the fixture cannot describe a program the
 *  server would never produce — the exact gap that hid an `evidence` blocker in slice A. */
const PROPOSAL = {
  displayTitle: "Close the loop on one commitment",
  elements: requiredProgramKinds(FRESH).map((k) =>
    el(k, k === "observable_standard" ? (FRESH.observableBehavior as string)
      : k === "evidence" ? (FRESH.successEvidence as string)
      : `A model sentence for ${k} that is long enough to clear the floor.`),
  ),
  assumptions: [],
  warnings: [],
  evidenceLanguage: "",
  behaviorContract: {
    actor: "the facilitator",
    trigger: FRESH.recurringMoment as string,
    observableAction: "name one owner and one deadline for each open action item",
    completion: { criterion: FRESH.successEvidence as string },
  },
  scenarioContract: { frame: "others_are_waiting" },
  applicationContract: { applicationMoment: "The next time this happens" },
  completionContract: { verificationTarget: "the_behaviour", responseMode: "name_the_moment" },
  followUpContract: { reviewFocus: "what_you_said", confirmer: "self_report" },
  operationalConstruct: null,
} as never;

const jsonRes = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

function server(opts: { answers?: BuilderAnswers; currentStep?: number } = {}) {
  const calls = { generate: 0, patch: 0 };
  const patched: Record<string, unknown>[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/assets")) return jsonRes({ assets: [] });
    if (u.includes("/program-draft")) {
      if (init?.method !== "POST") return jsonRes({ eligible: true, attempt: null });
      calls.generate += 1;
      return jsonRes({ program: PROPOSAL, evidence_ceiling: "", attempt_id: ATTEMPT, context_fingerprint: FINGERPRINT });
    }
    if (u.includes(`/modules/${DRAFT}`)) {
      if (init?.method === "PATCH") {
        calls.patch += 1;
        patched.push(JSON.parse(String(init.body ?? "{}")));
        /*
          Slice R4-R9B — THE REAL RESPONSE KEY. These fixtures answered `program_adoption`, a key
          the shell never reads: it reads `adoption`. So no adoption outcome — success OR refusal
          — was ever asserted from the canonical path, which is how a live `proposal_mismatch`
          reached the Founder through suites that were entirely green.
        */
        return jsonRes({ ok: true, adoption: { ok: true, receipt: "recorded" } });
      }
      return jsonRes({
        draft: {
          id: DRAFT, status: "draft", current_step: opts.currentStep ?? BUILDER_STEP_MAX,
          answers: opts.answers ?? FRESH, module_version: 1, parent_module_id: null,
          document_asset_ref_present: false, created_at: "t", updated_at: "t",
        },
      });
    }
    return jsonRes({ ok: true });
  });
  return { fetchMock, calls, patched };
}

function openReview(opts: Parameters<typeof server>[0] = {}, locale: "en" | "ko" = "en") {
  const s = server(opts);
  vi.stubGlobal("fetch", s.fetchMock);
  render(<ModuleBuilderShell draftId={DRAFT} locale={locale} initialView="review" onExit={() => {}} />);
  return s;
}

/** The Builder itself, opened on the draft's own stored step — `initialView` would force Review. */
function openBuilder(opts: Parameters<typeof server>[0] = {}) {
  const s = server(opts);
  vi.stubGlobal("fetch", s.fetchMock);
  render(<ModuleBuilderShell draftId={DRAFT} locale="en" onExit={() => {}} />);
  return s;
}

/** The journey as it was last written to the draft — the training that will be published. */
function savedJourney(s: ReturnType<typeof server>) {
  const js = s.patched
    .map((p) => (p.answers as Record<string, unknown> | undefined)?.realityGroundedJourneyV1)
    .filter(Boolean) as { elements: { kind: string; content: string }[] }[];
  return js[js.length - 1];
}

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); window.sessionStorage.clear(); });

describe("R4-R8B — six questions, and none about BTY's internals", () => {
  it("T1 — the Builder is six questions and a Review", () => {
    expect(BUILDER_STEP_MAX).toBe(7);
    expect(BUILDER_STEP_MAX - 1).toBeLessThanOrEqual(6);
    // Every input step still gates on its own question; Review never blocks.
    const codes = [1, 2, 3, 4, 5, 6].map((n) => stepBlocker(n, {}));
    expect(codes).toEqual([
      "problem_required", "audience_required", "recurring_moment_required",
      "behavior_required", "evidence_required", "material_intent_required",
    ]);
    expect(stepBlocker(BUILDER_STEP_MAX, {})).toBeNull();
    // The two retired codes cannot be emitted by any step, from any answers.
    for (const dead of ["learning_need_required", "follow_up_required"]) {
      expect(ALL_BLOCKING_CODES).not.toContain(dead);
      for (let n = 1; n <= BUILDER_STEP_MAX; n += 1) expect(stepBlocker(n, {})).not.toBe(dead);
    }
  });

  it("T2/T3 — a fresh draft is never asked to author either learner question", async () => {
    openBuilder({ currentStep: BUILDER_QUESTION_STEP });
    await screen.findByText(MODULE_BUILDER_COPY.en.s6Q);
    expect(screen.queryByTestId("builder-completion-question")).toBeNull();
    expect(screen.queryByTestId("builder-shared-question")).toBeNull();
    // And no suggestion is displayed anywhere either — a shown sentence is an invitation to edit it.
    expect(screen.queryByText(MODULE_BUILDER_COPY.en.s6CompletionPlaceholder)).toBeNull();
  });

  it("T2b — nor is a fresh draft's completion question shown as a Review row to fill in", async () => {
    openReview();
    await screen.findByTestId("program-auto-done");
    fireEvent.click(await screen.findByTestId("all-training-details-toggle"));
    expect(screen.queryByText(MODULE_BUILDER_COPY.en.reviewCompletion)).toBeNull();
  });
});

describe("R4-R8B — the removed questions are derived, not dropped", () => {
  it("T4 — learning needs are derived, and an explicit set still wins", () => {
    expect(effectiveLearningNeeds(FRESH)).toContain("decide");
    expect(effectiveLearningNeeds({ ...FRESH, learningNeeds: ["know"] })).toEqual(["know"]);
    // The literal reader still answers the other question: what did the Host store.
    expect(normalizeLearningNeeds(FRESH)).toEqual([]);
  });

  it("T5 — the Arena recommendation is derived from the rule that was already printed", () => {
    expect(effectiveArenaRecommended(FRESH)).toBe(true);
    expect(effectiveArenaRecommended({ ...FRESH, arenaRecommended: false })).toBe(false);
  });

  it("T6 — follow-up defaults to 7 days, and every explicit choice including none is kept", () => {
    expect(effectiveFollowUpDays(FRESH)).toBe(7);
    for (const d of [0, 7, 30] as const) {
      expect(effectiveFollowUpDays({ ...FRESH, followUpDays: d })).toBe(d);
    }
    // A corrupt value is not a schedule — treated as unset, exactly as programContext already did.
    expect(effectiveFollowUpDays({ ...FRESH, followUpDays: 5 as never })).toBe(7);
    // Nothing to design around ⇒ no invented schedule.
    expect(effectiveFollowUpDays({})).toBe(0);
  });

  it("T6b — the derived design is FROZEN into the snapshot the runtime reads", () => {
    /*
      `readEventFollowUpDays` reads `module_snapshot.followUpDays` and returns null when the key
      is absent. Deriving correctly but never freezing would have left every training created
      after this slice with no Apply window and no follow-up obligation, silently.
    */
    const snap = buildModuleSnapshot(FRESH);
    expect(snap.followUpDays).toBe(7);
    expect(snap.learningNeeds).toContain("decide");
    expect(snap.arenaRecommended).toBe(true);
  });
});

describe("R4-R8B — a fresh draft reaches both BTY-owned questions by itself", () => {
  it("T7/T8/T9 — the barrier and the next-opportunity decision, neither of them the Host's", async () => {
    const s = openReview();
    await screen.findByTestId("program-auto-done");
    await waitFor(() => expect(s.patched.length).toBeGreaterThan(0));
    const saved = savedJourney(s);

    const barrier = saved.elements.find((e) => e.kind === "completion_check")!;
    const decision = saved.elements.find((e) => e.kind === "action_decision")!;
    expect(barrier.content).toBe(journeyCopy("en").completionBarrier);
    expect(decision.content).toBe(journeyCopy("en").decision);

    /*
      T9 — THE PROVENANCE HALF, which is the whole reason the Builder field had to go. Neither
      question may be attributed to the Host: `host_statement` on either would mean the trap
      still exists, just further downstream.
    */
    for (const [name, e] of [["barrier", barrier], ["decision", decision]] as const) {
      expect(readProvenance(e as never), name).not.toBe("host_statement");
      expect(attributionKind(e as never), name).not.toBe("from_host");
    }
  });

  it("T7b — and in Korean, which is the language the failure was measured in", async () => {
    const s = openReview({}, "ko");
    await screen.findByTestId("program-auto-done");
    await waitFor(() => expect(s.patched.length).toBeGreaterThan(0));
    const saved = savedJourney(s);
    expect(saved.elements.find((e) => e.kind === "completion_check")!.content).toBe(
      "실제 업무에서 이것을 행동으로 옮기기 어렵게 만드는 것은 무엇일까요?",
    );
    expect(saved.elements.find((e) => e.kind === "action_decision")!.content).toBe(
      "이것을 가장 먼저 해볼 상황은 언제인가요? 그때 무엇을 하겠어요?",
    );
  });

  it("T7c — and does so with no instruction about what not to touch: publish is reachable", async () => {
    openReview();
    await screen.findByTestId("program-auto-done");
    await waitFor(() => expect(screen.queryByTestId("journey-publish-blocked")).toBeNull());
    await waitFor(() => expect((screen.getByTestId("publish-cta") as HTMLButtonElement).disabled).toBe(false));
  });
});

describe("R4-R8B — historical meaning is immutable", () => {
  const LEGACY = {
    ...FRESH,
    completionPrompt: "What two things should be clear before a huddle ends?",
    sharedQuestion: "How do you close a huddle today?",
    learningNeeds: ["know"],
    arenaRecommended: false,
    followUpDays: 0,
  } as unknown as BuilderAnswers;

  it("T10/T11 — a legacy draft's own two questions are preserved AND still rendered", async () => {
    openBuilder({ answers: LEGACY, currentStep: BUILDER_QUESTION_STEP });
    const box = (await screen.findByTestId("builder-completion-question")).querySelector("textarea")!;
    expect((box as HTMLTextAreaElement).value).toBe(LEGACY.completionPrompt);
    const shared = (await screen.findByTestId("builder-shared-question")).querySelector("textarea")!;
    expect((shared as HTMLTextAreaElement).value).toBe(LEGACY.sharedQuestion);
    // The seed keeps it as the HOST's, not BTY's.
    expect(buildModuleSnapshot(LEGACY).completionPrompt).toBe(LEGACY.completionPrompt);
  });

  it("T11b — and a legacy Host's design choices are never overwritten by a derivation", () => {
    expect(effectiveLearningNeeds(LEGACY)).toEqual(["know"]);
    expect(effectiveArenaRecommended(LEGACY)).toBe(false);
    expect(effectiveFollowUpDays(LEGACY)).toBe(0);
    const snap = buildModuleSnapshot(LEGACY);
    expect(snap.followUpDays).toBe(0);
    expect(snap.arenaRecommended).toBe(false);
    expect(snap.learningNeeds).toEqual(["know"]);
  });

  it("T12 — every bookmark written under the nine-screen graph opens on a step that exists", () => {
    expect([resumeStep(6), resumeStep(7), resumeStep(8), resumeStep(9)]).toEqual([6, 7, 7, 7]);
    for (let stored = 1; stored <= PRIOR_STEP_GRAPH_MAX; stored += 1) {
      const landed = resumeStep(stored);
      expect(landed, `stored ${stored}`).toBeLessThanOrEqual(BUILDER_STEP_MAX);
      expect(landed, `stored ${stored}`).toBeLessThanOrEqual(stored); // never sent further forward
    }
  });

  it("T12b — and a draft bookmarked past the end of the Builder still opens", async () => {
    openReview({ answers: LEGACY, currentStep: PRIOR_STEP_GRAPH_MAX });
    expect(await screen.findByTestId("publish-cta")).toBeTruthy();
  });
});

describe("R4-R8B — publish truth is re-anchored, not relaxed", () => {
  it("T13 — the Review readiness list drops only what can no longer be missing", () => {
    expect(reviewMissingSections(FRESH)).toEqual([]);
    const bare = reviewMissingSections({ materialIntent: "pdf" }).map((r) => r.section);
    expect(bare).toEqual(["title", "problem", "audience", "recurringMoment", "behavior", "evidence"]);
    // Neither derived field can produce a row, from any answers.
    for (const override of [{ learningNeeds: [] }, { followUpDays: undefined }] as Partial<BuilderAnswers>[]) {
      const sections = reviewMissingSections({ ...FRESH, ...override }).map((r) => r.section);
      expect(sections).not.toContain("learning");
      expect(sections).not.toContain("followUp");
    }
  });

  it("T14 — the generation boundary is the same five source questions it always was", () => {
    expect(programSourceMissing(FRESH)).toEqual([]);
    const { observableBehavior, ...withoutBehaviour } = FRESH as Record<string, unknown>;
    void observableBehavior;
    expect(programSourceMissing(withoutBehaviour as BuilderAnswers)).toContain("behavior_required");
    // It never consulted the removed screens, and still does not.
    expect(programSourceMissing({ ...FRESH, learningNeeds: [], followUpDays: undefined })).toEqual([]);
  });

  it("T15 — the Reality-intent disclosure still fires, on the DERIVED intent", () => {
    /*
      This is the one that would have failed silently. `followUpRequested` and
      `decisionRequested` used to read the raw fields; a fresh draft stores neither, so both would
      have read false and the gap disclosure — the thing that tells a Host their training cannot
      yet deliver what they asked for — would simply never appear again.
    */
    const r = classifyRealityIntentReadiness(FRESH, undefined);
    expect(r.followUpRequested).toBe(true);
    expect(r.decisionRequested).toBe(true);
    expect(r.missing).toEqual(["field_action", "decision"]);
    // And an explicit opt-out is still honoured.
    expect(classifyRealityIntentReadiness({ ...FRESH, followUpDays: 0 }, undefined).followUpRequested).toBe(false);
  });

  it("T15b — the program a fresh training requires still contains the loop's own sections", () => {
    const required = requiredProgramKinds(FRESH);
    for (const kind of ["action_decision", "field_application", "follow_up", "completion_check"]) {
      expect(required, kind).toContain(kind);
    }
  });

  it("T16 — the publish gate is byte-identical, and the blocker map is still total", async () => {
    const { readFileSync } = await import("node:fs");
    const shell = readFileSync("src/components/foundry/event-rooms/ModuleBuilderShell.tsx", "utf8");
    expect(shell).toContain(
      "const notReady = missing.length > 0 || journeyBlockers.length > 0 || generationPending;",
    );
    for (const code of ALL_BLOCKING_CODES) {
      expect(reviewMissingSections({}, [code]).length, code).toBeGreaterThan(0);
    }
  });

  it("T17 — this slice adds no migration", () => {
    const known = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql"));
    const newest = "20260827000000_foundry_deferred_completion_claim_v1.sql";
    expect(known).toContain(newest);
    expect(known.filter((f) => f > newest)).toEqual([]);
  });
});

describe("R4-R8B — slice A's shape is unchanged", () => {
  it("T18 — one generation per fresh Review, as before", async () => {
    const s = openReview();
    await screen.findByTestId("program-auto-done");
    await waitFor(() => expect(s.calls.patch).toBeGreaterThan(0));
    expect(s.calls.generate).toBe(1);
  });

  it("T19/T20 — one working preview, then participation, then one CTA", async () => {
    openReview();
    await screen.findByTestId("program-auto-done");
    await screen.findByTestId("journey-preview");
    // No second surface showing the same sections, and no keep/use anywhere.
    expect(screen.queryByTestId("program-review")).toBeNull();
    expect(document.querySelectorAll('[data-testid^="program-keep-"]')).toHaveLength(0);

    const participation = await screen.findByTestId("participation-mode");
    const cta = await screen.findByTestId("publish-cta");
    expect(cta.textContent).toBe(MODULE_BUILDER_COPY.en.publishCta);
    expect(participation.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("T3b — the Shared Understanding path keeps an entry point, empty and optional", async () => {
    /*
      FOUND WHILE BUILDING THIS SLICE. Removing the Builder field alone would have taken the whole
      Shared Understanding path out of reach for every new training, silently: nothing derives the
      question, so "BTY derives it where needed" would have meant it never happens again. The box
      moved to the working preview instead — empty, optional, and with no BTY sentence in it to
      adjust, which is the difference between an entry point and the trap this slice removed.
    */
    const s = openReview();
    await screen.findByTestId("program-auto-done");
    fireEvent.click(await screen.findByTestId("all-training-details-toggle"));
    const box = (await screen.findByTestId("review-control-shared")) as HTMLTextAreaElement;
    expect(box.value).toBe("");
    fireEvent.change(box, { target: { value: "How do you close a huddle today?" } });
    await waitFor(() => {
      const last = s.patched[s.patched.length - 1]?.answers as Record<string, unknown> | undefined;
      expect(last?.sharedQuestion).toBe("How do you close a huddle today?");
    });
  });

  it("T20b — the three derived choices remain changeable, under the details disclosure", async () => {
    const s = openReview();
    await screen.findByTestId("program-auto-done");
    fireEvent.click(await screen.findByTestId("all-training-details-toggle"));
    expect(await screen.findByTestId("review-control-learning")).toBeTruthy();
    expect(screen.getByTestId("review-control-arena")).toBeTruthy();
    expect(screen.getByTestId("review-control-follow")).toBeTruthy();

    // An override is a real write, indistinguishable from a Host who had been asked.
    fireEvent.click(screen.getByTestId("review-follow-0"));
    await waitFor(() => {
      const last = s.patched[s.patched.length - 1]?.answers as Record<string, unknown> | undefined;
      expect(last?.followUpDays).toBe(0);
    });
  });
});
