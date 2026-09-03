/** @vitest-environment jsdom */
/**
 * SLICE R4-R8A — HOST AUTHORING SIMPLIFICATION A.
 *
 * THE MEASURED DEFECT. One training cost the Founder ~50 explicit decisions, ~30 of them after
 * the Builder was finished. Nineteen were the same act repeated: three separate "shall BTY make
 * this for you?" gestures, three adoptions, and twelve `keep mine / use BTY` rows whose answers
 * `initialSectionDecisions` had already computed correctly before they were rendered. Six review
 * layers showed overlapping content; two of them showed the SAME seven learner sections.
 *
 * WHAT THESE TESTS HOLD. Not "the screen is shorter" — that is a consequence and a weak thing to
 * assert. They hold that the decisions are GONE from the canonical flow while the guarantees
 * underneath them are not: provenance still distinguishes the Host's sentences from BTY's, the
 * provider is still spent exactly once per context, publish is still blocked by exactly what
 * blocked it before, and a failed generation still leaves the Host somewhere they can act.
 *
 * The manual path — entry card, target confirmation, section review, keep/use, Apply — is
 * deliberately untouched and still covered by its own suites. `auto` is opt-in; this file is
 * about what the canonical Review opts into.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import { ModuleBuilderShell } from "./ModuleBuilderShell";
import { MODULE_BUILDER_COPY } from "./moduleBuilderCopy";
import {
  PROGRAM_AUTHORSHIP_VERSION,
  programContext,
  programContextFingerprint,
  initialSectionDecisions,
  readProvenance,
} from "@/domain/foundry/module/program-authorship";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

const DRAFT = "d-r4r8a";
const ATTEMPT = "6f1d2c7e-8a41-4f0b-9c33-2b7d5e0a1f42";

/** A complete draft parked on Review with no journey yet — the canonical fresh creation. */
const ANSWERS = {
  title: "Close the Loop on One Commitment",
  problem: "Team huddles end with agreement, but no one clearly owns the next action.",
  audienceType: "everyone",
  recurringMoment: "At the end of a team huddle when there are open action items",
  observableBehavior: "Before the huddle ends, name one owner and one deadline for each open action item.",
  successEvidence: "The huddle notes show a named owner and deadline.",
  evidenceType: "seen",
  learningNeeds: ["decide", "shared_standard"],
  materialIntent: "youtube",
  materialText: "https://youtu.be/x",
  capabilityCandidate: "Accountability",
  arenaRecommended: false,
  followUpDays: 7,
} as unknown as BuilderAnswers;

const FINGERPRINT = programContextFingerprint(programContext(ANSWERS)!);

const el = (kind: string, content: string) => ({ kind, content, rationale: "because it fits" });

const PROPOSAL = {
  displayTitle: "Close the loop on one commitment",
  elements: [
    el("why_it_matters", "When an action leaves a huddle without an owner, the work stalls."),
    el("observable_standard", ANSWERS.observableBehavior as string),
    el("action_decision", "I will name one owner and one deadline before the huddle ends."),
    el("field_application", "At your next huddle, you name one owner and one deadline."),
    el("completion_check", "When is the next time this will come up for you?"),
    el("follow_up", "In seven days you will be asked what you actually said."),
    /*
      WHAT SUCCESS LOOKS LIKE, from the Host's own `successEvidence`. Required whenever they
      wrote one (R4-R5C14A), and the SERVER injects it into every proposal deterministically —
      so a fixture that omits it is a fixture the API could never produce, and publish would be
      blocked for a reason no live draft has.
    */
    el("evidence", ANSWERS.successEvidence as string),
  ],
  assumptions: [],
  warnings: [],
  evidenceLanguage: "",
  behaviorContract: {
    actor: "the facilitator",
    trigger: "At the end of a team huddle when there are open action items",
    observableAction: "name one owner and one deadline for each open action item",
    completion: { criterion: "The huddle notes show a named owner and deadline." },
  },
  scenarioContract: null,
  applicationContract: { applicationMoment: "The next time this happens" },
  completionContract: { verificationTarget: "the_behaviour", responseMode: "name_the_moment" },
  followUpContract: { reviewFocus: "what_you_said", confirmer: "self_report" },
  operationalConstruct: null,
} as never;

const jsonRes = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

type ServerOpts = {
  /** What POST /program-draft answers. Default: a successful generation. */
  generate?: () => unknown;
  generateStatus?: number;
  answers?: BuilderAnswers;
  /** Make the adoption PATCH fail, however many times the count says. */
  failPatch?: number;
  answers2?: never;
  /** Which Builder step the draft is parked on. 9 is Review. */
  currentStep?: number;
};

/** Counts what actually reached the network, so "spent once" is measured, not assumed. */
function server(opts: ServerOpts = {}) {
  const calls = { generate: 0, patch: 0, direction: 0, moduleDraft: 0 };
  const patched: Record<string, unknown>[] = [];
  const generateBodies: Record<string, unknown>[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/assets")) return jsonRes({ assets: [] });
    if (u.includes("/directions")) {
      calls.direction += 1;
      return jsonRes({ directions: [] });
    }
    if (u.includes("/module-draft")) {
      calls.moduleDraft += 1;
      return jsonRes({ module_draft: null });
    }
    if (u.includes("/program-draft")) {
      // GET is the read-only resume check; POST is the paid generation.
      if (init?.method !== "POST") return jsonRes({ eligible: true, attempt: null });
      calls.generate += 1;
      generateBodies.push(JSON.parse(String(init?.body ?? "{}")));
      const body = opts.generate
        ? opts.generate()
        : { program: PROPOSAL, evidence_ceiling: "", attempt_id: ATTEMPT, context_fingerprint: FINGERPRINT };
      return jsonRes(body, opts.generateStatus ?? 200);
    }
    if (u.includes(`/modules/${DRAFT}`)) {
      if (init?.method === "PATCH") {
        calls.patch += 1;
        if ((opts.failPatch ?? 0) >= calls.patch) return jsonRes({ error: "save_failed" }, 500);
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
          id: DRAFT,
          status: "draft",
          current_step: opts.currentStep ?? 9,
          answers: opts.answers ?? ANSWERS,
          module_version: 1,
          parent_module_id: null,
          document_asset_ref_present: false,
          created_at: "t",
          updated_at: "t",
        },
      });
    }
    return jsonRes({ ok: true });
  });
  return { fetchMock, calls, patched, generateBodies };
}

function openReview(opts: ServerOpts = {}) {
  const s = server(opts);
  vi.stubGlobal("fetch", s.fetchMock);
  render(<ModuleBuilderShell draftId={DRAFT} locale="en" initialView="review" onExit={() => {}} />);
  return s;
}

/** Walk the shell from step 1, which is where the two removed generators used to live. */
function openBuilder(opts: ServerOpts = {}) {
  const s = server({ currentStep: 1, ...opts });
  vi.stubGlobal("fetch", s.fetchMock);
  render(<ModuleBuilderShell draftId={DRAFT} locale="en" onExit={() => {}} />);
  return s;
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("R4-R8A — the two subordinate generators are unreachable", () => {
  it("T1 — the problem step offers no direction generator", async () => {
    openBuilder();
    await screen.findByTestId("builder-problem-input");
    expect(screen.queryByTestId("direction-copilot")).toBeNull();
    expect(screen.queryByTestId("copilot-trigger")).toBeNull();
    /*
      SOURCE-LEVEL TOO, and this is the assertion that matters. A step the walk never reaches
      renders nothing, so "not on screen" alone would pass with the copilot fully wired. The
      shell must not construct the surface at all.
    */
    const shell = readFileSync("src/components/foundry/event-rooms/ModuleBuilderShell.tsx", "utf8");
    expect(shell).not.toMatch(/<DirectionCopilot/);
  });

  it("T2 — no step renders the module-draft generator", async () => {
    openBuilder();
    await screen.findByTestId("builder-problem-input");
    expect(screen.queryByTestId("module-draft-copilot")).toBeNull();
    const shell = readFileSync("src/components/foundry/event-rooms/ModuleBuilderShell.tsx", "utf8");
    expect(shell).not.toMatch(/<ModuleDraftCopilot/);
  });

  it("T2b — the components and their routes still exist, so legacy work is not deleted", () => {
    // "Unreachable, not deleted" is the dispatch's own boundary. A later slice removes them
    // after its own reference measurement; this one must not.
    const files = readdirSync("src/components/foundry/event-rooms");
    expect(files).toContain("DirectionCopilot.tsx");
    expect(files).toContain("ModuleDraftCopilot.tsx");
    expect(readdirSync("src/app/api/bty/foundry/modules/[id]")).toEqual(
      expect.arrayContaining(["directions", "module-draft"]),
    );
  });
});

describe("R4-R8A — one generator, running itself", () => {
  it("T4 — generation starts on Review with no gesture, and no entry card is shown", async () => {
    const s = openReview();
    await screen.findByTestId("program-auto-done");
    expect(s.calls.generate).toBe(1);
    expect(screen.queryByTestId("program-authorship-entry")).toBeNull();
    expect(screen.queryByTestId("program-target-confirm")).toBeNull();
  });

  it("T5 — one mount, one context, one provider call", async () => {
    const s = openReview();
    await screen.findByTestId("program-auto-done");
    // Settle every queued effect; the count must not move.
    await waitFor(() => expect(s.calls.patch).toBeGreaterThan(0));
    expect(s.calls.generate).toBe(1);
  });

  it("T19 — a resumable cached proposal is reused instead of regenerated", async () => {
    const { writeCachedProposal } = await import("./proposalContinuity");
    writeCachedProposal(DRAFT, {
      attemptId: ATTEMPT,
      contextFingerprint: FINGERPRINT,
      proposal: PROPOSAL,
      evidenceCeiling: "",
      authorityVersion: PROGRAM_AUTHORSHIP_VERSION,
    } as never);
    const s = openReview();
    await screen.findByTestId("program-auto-done");
    /*
      THE WHOLE POINT OF `resumeSettled`. Without it the automatic effect fires while the
      server is still being asked whether the cached attempt is adoptable, and the Host pays
      for a second program they will never see.
    */
    expect(s.calls.generate).toBe(0);
  });

  it("T4b — starting by itself does not make LOOKING at a draft write to it", async () => {
    /*
      FOUND BY THIS SLICE, IN THE SUITE THAT EXISTS FOR IT (R11.4E). `generateProgram` flushed
      the autosaver before every generation — correct when a Host gesture preceded it, since
      anything they typed has to land before the server's stale guard sees it. Automatic
      generation turned that into a write on arrival: opening Review by deep link flushed a
      byte-identical snapshot, and a link stopped being a way of merely looking.
    */
    const s = openReview();
    await screen.findByTestId("program-auto-done");
    const writesBeforeAnyEdit = s.patched.length;
    expect(s.calls.generate).toBe(1);
    // The ONE write is the adoption itself, which is a change the Host asked for by creating.
    expect(writesBeforeAnyEdit).toBeGreaterThan(0);
    const bodies = s.patched.map((p) => JSON.stringify(p));
    expect(bodies.every((b) => b.includes("realityGroundedJourneyV1"))).toBe(true);
  });

  it("T5b — the automatic request still carries a fresh intent and this draft's fingerprint", async () => {
    /*
      MOVED HERE FROM THE TARGET-CONFIRMATION SUITE (Slice R4-R8A). That suite measured this
      through a modal the canonical flow no longer has; the guarantee it was measuring — one
      submission intent, bound to the authority the proposal is written from — belongs to the
      request, not to the screen that used to precede it, so it moves rather than lapses.
    */
    const s = openReview();
    await screen.findByTestId("program-auto-done");
    expect(s.generateBodies).toHaveLength(1);
    const body = s.generateBodies[0] as { submission_intent_id?: string; context_fingerprint?: string };
    expect(body.submission_intent_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(body.context_fingerprint).toBe(FINGERPRINT);
  });

  it("T5d — a second run issues a NEW submission intent, never a replay", async () => {
    // Also moved from the target-confirmation suite. A replayed intent is what the server's
    // unique index refuses, so sending the same one twice would look like a lost generation.
    let fail = true;
    const s = openReview({
      generate: () => {
        if (fail) {
          fail = false;
          // Slice R4-R9A — the server's verdict travels with the failure now, and only a
          // retryable one offers a retry. A provider outage is exactly that.
          return { error: "provider_unavailable", retryable: true, recovery_mode: "transient_retry", recovery_target: null };
        }
        return { program: PROPOSAL, evidence_ceiling: "", attempt_id: ATTEMPT, context_fingerprint: FINGERPRINT };
      },
      generateStatus: 200,
    });
    await screen.findByTestId("program-auto-failed");
    fireEvent.click(screen.getByTestId("program-auto-retry"));
    await waitFor(() => expect(s.generateBodies.length).toBe(2));
    const [a1, b1] = s.generateBodies as { submission_intent_id: string }[];
    expect(b1.submission_intent_id).not.toBe(a1.submission_intent_id);
  });

  it("T5c — a training that already has its program buys nothing on reload", async () => {
    /*
      Covers three cases with one condition: reopening Review after adoption, a v2 revision
      that inherited its parent's complete journey, and a hand-built journey. A generation
      here would overwrite published wording nobody asked to change.
    */
    const { requiredProgramKinds } = await import("@/domain/foundry/module/program-authorship");
    // Built from the SAME predicate the guard consults, so the fixture cannot be complete by
    // the test's opinion and incomplete by the product's.
    const complete = {
      version: 1,
      displayTitle: "Close the loop on one commitment",
      displayTitleStatus: "grounded",
      elements: requiredProgramKinds(ANSWERS).map((kind) => ({
        id: `x-${kind}`,
        kind,
        content: "Already written.",
        grounding: [{ sourceType: "ai_proposed", field: "problem" }],
        confirmationStatus: "grounded",
      })),
    };
    const s = openReview({ answers: { ...ANSWERS, realityGroundedJourneyV1: complete } as unknown as BuilderAnswers });
    await screen.findByTestId("journey-preview");
    expect(s.calls.generate).toBe(0);
    expect(screen.queryByTestId("program-auto-working")).toBeNull();
    expect(screen.queryByTestId("program-authorship-entry")).toBeNull();
  });

  it("T3 — no keep/use control is rendered anywhere in the canonical flow", async () => {
    openReview();
    await screen.findByTestId("program-auto-done");
    const copy = MODULE_BUILDER_COPY.en;
    for (const label of [copy.paKeepYours, copy.paUseBtyDraft, copy.paApplyCta]) {
      expect(screen.queryByText(label)).toBeNull();
    }
    expect(document.querySelectorAll('[data-testid^="program-keep-"]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-testid^="program-use-"]')).toHaveLength(0);
    expect(screen.queryByTestId("program-review")).toBeNull();
  });
});

describe("R4-R8A — the generated program becomes the working draft", () => {
  it("T6 — what BTY wrote is saved as the journey, without an adoption gesture", async () => {
    const s = openReview();
    await screen.findByTestId("program-auto-done");
    await waitFor(() => expect(s.patched.length).toBeGreaterThan(0));
    const journeys = s.patched
      .map((p) => (p.answers as Record<string, unknown> | undefined)?.realityGroundedJourneyV1)
      .filter(Boolean) as { elements: { kind: string; content: string }[] }[];
    expect(journeys.length).toBeGreaterThan(0);
    /*
      THE PROPERTY, NOT THE SENTENCE. BTY renders seven of the nine kinds itself, so pinning
      the model's `action_decision` string here would assert that the renderer had been
      bypassed — the opposite of the contract. What must hold is that the generated program
      landed in the draft whole, and that BTY owns the sections it wrote.
    */
    const saved = journeys[journeys.length - 1] as unknown as {
      elements: { kind: string; content: string }[];
    };
    for (const kind of ["why_it_matters", "action_decision", "field_application", "completion_check", "follow_up", "evidence"]) {
      const found = saved.elements.find((e) => e.kind === kind);
      expect(found, kind).toBeTruthy();
      expect(found!.content.trim().length).toBeGreaterThan(0);
    }
    const decision = saved.elements.find((e) => e.kind === "action_decision");
    expect(readProvenance(decision as never)).toBe("ai_proposed");
  });

  it("T7 — a Host-owned section is preserved, exactly as initialSectionDecisions says", async () => {
    /*
      THE DIFFERENTIAL. `observable_standard` is the Host's own `observableBehavior`; the
      journey the shell seeds marks it `host_statement`. `keep` is therefore the correct
      decision, and the automatic path must reach it WITHOUT being told — that is the claim
      that the toggles were never carrying the guarantee.
    */
    const seeded = (await import("@/domain/foundry/module/journey")).mapAnswersToJourney(ANSWERS);
    const decisions = initialSectionDecisions(seeded, PROPOSAL as never);
    expect(decisions.observable_standard).toBe("keep");
    expect(decisions.action_decision).toBe("use");

    const s = openReview({ answers: { ...ANSWERS, realityGroundedJourneyV1: seeded } as BuilderAnswers });
    await screen.findByTestId("program-auto-done");
    await waitFor(() => expect(s.patched.length).toBeGreaterThan(0));
    const journeys = s.patched
      .map((p) => (p.answers as Record<string, unknown> | undefined)?.realityGroundedJourneyV1)
      .filter(Boolean) as { elements: { kind: string; content: string }[] }[];
    const saved = journeys[journeys.length - 1];
    const standard = saved.elements.find((e) => e.kind === "observable_standard");
    expect(standard?.content).toBe(ANSWERS.observableBehavior);
    expect(readProvenance(standard as never)).toBe("host_statement");
  });

  it("T8 — editing a BTY sentence in the one preview makes it the Host's", async () => {
    const s = openReview();
    await screen.findByTestId("program-auto-done");
    const box = await screen.findByTestId("journey-edit-action_decision");
    fireEvent.change(box, { target: { value: "I will name the owner out loud." } });
    await waitFor(() => {
      const journeys = s.patched
        .map((p) => (p.answers as Record<string, unknown> | undefined)?.realityGroundedJourneyV1)
        .filter(Boolean) as { elements: { kind: string; content: string }[] }[];
      const last = journeys[journeys.length - 1];
      const d = last.elements.find((e) => e.kind === "action_decision");
      expect(d?.content).toBe("I will name the owner out loud.");
      expect(readProvenance(d as never)).toBe("host_edited");
    });
  });
});

describe("R4-R8A — one review surface, one final decision", () => {
  it("T9 — the learner sections are rendered once, not by two surfaces", async () => {
    openReview();
    await screen.findByTestId("program-auto-done");
    await screen.findByTestId("journey-preview");
    // The read-only mirror of the same seven sections is gone with the review it belonged to.
    expect(screen.queryByTestId("program-applied-draft")).toBeNull();
    expect(screen.queryByTestId("program-applied-toggle")).toBeNull();
    expect(document.querySelectorAll('[data-testid^="program-section-"]')).toHaveLength(0);
  });

  it("T10 — the Builder-source details are collapsed and stay collapsed on their own", async () => {
    openReview();
    await screen.findByTestId("program-auto-done");
    const toggle = await screen.findByTestId("all-training-details-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("T11/T12 — participation is the last control before the one final CTA", async () => {
    openReview();
    await screen.findByTestId("program-auto-done");
    const cta = await screen.findByTestId("publish-cta");
    expect(cta.textContent).toBe(MODULE_BUILDER_COPY.en.publishCta);
    expect(MODULE_BUILDER_COPY.en.publishCta).toBe("Create training");
    expect(MODULE_BUILDER_COPY.ko.publishCta).toBe("훈련 만들기");

    const participation = await screen.findByTestId("participation-mode");
    // DOM ORDER, not styling: nothing may render between the choice and the button.
    expect(participation.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("T11b — the learner title arrives confirmed, so it is not one more thing to approve", async () => {
    /*
      The metric this slice is judged on is decisions AFTER the Builder, and a title still
      carrying "needs confirmation" would quietly be one of them — plus a publish blocker. The
      adoption grounds it, and Publish is reachable without the Host approving a name BTY wrote
      from their own problem statement.
    */
    openReview();
    await screen.findByTestId("program-auto-done");
    await screen.findByTestId("journey-title-ok");
    expect(screen.queryByTestId("journey-title-confirm")).toBeNull();
    // No blocker list at all: nothing is outstanding once the program is in.
    await waitFor(() => expect(screen.queryByTestId("journey-publish-blocked")).toBeNull());
    await waitFor(() =>
      expect((screen.getByTestId("publish-cta") as HTMLButtonElement).disabled).toBe(false),
    );
  });

  it("T18 — the Korean flow reaches the same states with Korean words", async () => {
    const s = server();
    vi.stubGlobal("fetch", s.fetchMock);
    render(<ModuleBuilderShell draftId={DRAFT} locale="ko" initialView="review" onExit={() => {}} />);
    const done = await screen.findByTestId("program-auto-done");
    expect(done.textContent).toBe(MODULE_BUILDER_COPY.ko.paAutoDone);
    expect(MODULE_BUILDER_COPY.ko.paAutoDone).toBe("BTY가 초안을 만들었습니다.");
    expect(screen.queryByTestId("program-authorship-entry")).toBeNull();
  });
});

describe("R4-R8A — legacy drafts are not migrated, rewritten or broken", () => {
  it("T14 — a draft carrying copilot, clarification and adoption state still loads", async () => {
    /*
      The three kinds of state the removed surfaces used to write all live in `answers`, and are
      read by the Builder's own fields — never by the surfaces. A draft that has them must open
      with them intact, and must not be re-generated over.
    */
    const { requiredProgramKinds } = await import("@/domain/foundry/module/program-authorship");
    const legacy = {
      ...ANSWERS,
      capabilityCandidate: "Accountability",
      clarification: { answers: [{ dimension: "target", value: "team leads" }] },
      programAdoptionV1: { attemptId: ATTEMPT },
      realityGroundedJourneyV1: {
        version: 1,
        displayTitle: "A training from before this slice",
        displayTitleStatus: "grounded",
        elements: requiredProgramKinds(ANSWERS).map((kind) => ({
          id: `l-${kind}`,
          kind,
          content: "Written before the simplification.",
          grounding: [{ sourceType: "ai_proposed", field: "problem" }],
          confirmationStatus: "grounded",
        })),
      },
    } as unknown as BuilderAnswers;

    const s = openReview({ answers: legacy });
    await screen.findByTestId("journey-preview");
    expect(s.calls.generate, "a legacy program must never be silently replaced").toBe(0);
    const title = (await screen.findByTestId("journey-title-input")) as HTMLInputElement;
    expect(title.value).toBe("A training from before this slice");
    // And the two removed generators are not offered to it either.
    expect(screen.queryByTestId("direction-copilot")).toBeNull();
    expect(screen.queryByTestId("module-draft-copilot")).toBeNull();
  });

  it("T15 — a legacy Host completionPrompt still outranks the derived question", async () => {
    /*
      Domain-level, because that is where the rule lives and where a legacy draft's guarantee
      has to hold regardless of which screen is on top of it. Option B removes the field from
      the Builder; until then a Host who wrote one keeps it.
    */
    const { resolveCompletionCheck } = await import("@/domain/foundry/module/program-authorship");
    expect(resolveCompletionCheck("What will you change tomorrow?", "BTY's derived question")).toBe(
      "What will you change tomorrow?",
    );
    expect(resolveCompletionCheck("", "BTY's derived question")).toBe("BTY's derived question");
    expect(resolveCompletionCheck(undefined, "BTY's derived question")).toBe("BTY's derived question");
  });
});

describe("R4-R8A — failure leaves a way out, and publish truth is untouched", () => {
  it("T17 — a RETRYABLE provider failure offers retry, and retry spends exactly once more", async () => {
    /*
      NARROWED BY SLICE R4-R9A, and this test is why that slice exists. It used to assert that a
      failure offered BOTH "다시 시도" and "직접 계속하기" — against a stub that succeeds on retry,
      so it proved the client re-POSTs and nothing more. On a live Korean draft the refusal was
      deterministic: the retry made a real second provider call, received a genuinely different
      program, and hit the identical rule. And "직접 계속하기" seeded a journey with four of eight
      required sections and a Create button that could never enable.

      So the retry belongs to failures that decided nothing about the training, and the manual
      path belongs nowhere. `recoveryTruth.test.tsx` holds the non-retryable half.
    */
    const s = openReview({
      generate: () => ({ error: "provider_unavailable", retryable: true, recovery_mode: "transient_retry", recovery_target: null }),
      generateStatus: 503,
    });
    await screen.findByTestId("program-auto-failed");
    expect(s.calls.generate).toBe(1);
    expect(screen.queryByTestId("program-auto-manual"), "the dead path is offered nowhere").toBeNull();
    fireEvent.click(screen.getByTestId("program-auto-retry"));
    await waitFor(() => expect(s.calls.generate).toBe(2));
  });

  it("T17b — a refusal with no established retryability offers NO retry and NO manual continue", async () => {
    /*
      REPLACES "continuing without a program leaves an editable, publishable training" — measured
      false on draft `adb75f6a`: it left four of eight sections and a permanently disabled Create.
      An unestablished verdict is treated as non-retryable, which is the safe direction: a
      withheld retry costs a tap, an offered one that cannot succeed costs a provider call.
    */
    openReview({ generate: () => ({ error: "invalid_output", refusal: "non_observable_standard" }), generateStatus: 502 });
    await screen.findByTestId("program-auto-blocked");
    expect(screen.queryByTestId("program-auto-retry")).toBeNull();
    expect(screen.queryByTestId("program-auto-manual")).toBeNull();
    expect(screen.getByTestId("program-blocked-repair")).toBeTruthy();
  });

  it("T13 — the publish gate is the same predicate it was before this slice", () => {
    const shell = readFileSync("src/components/foundry/event-rooms/ModuleBuilderShell.tsx", "utf8");
    expect(shell).toContain(
      "const notReady = missing.length > 0 || journeyBlockers.length > 0 || generationPending;",
    );
    // And the one inline blocker area still sits with the CTA rather than being duplicated.
    expect(shell).toContain("<MissingSummary missing={missing} onEdit={onEdit} t={t} />");
  });

  it("T16 — this slice adds no migration", () => {
    const known = new Set(readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")));
    // The newest migration at the time this slice shipped. A later slice adding one must name
    // it here deliberately rather than have this guard quietly go vacuous.
    expect(known.has("20260827000000_foundry_deferred_completion_claim_v1.sql")).toBe(true);
    // Later slices legitimately ship SQL. Naming them keeps the guard's real job -- catching a
    // migration smuggled in unnoticed -- while stopping it from failing on every future slice.
    const KNOWN_LATER = [
      "20260828000000_bty_action_capture_v1.sql",
      "20260829000000_bty_microsoft_identity_resolver_v1.sql",
      "20260901000000_bty_action_capture_triage_v1.sql",
      "20260902000000_bty_tracked_announcements_v1.sql",
      "20260903000000_foundry_host_grant_provenance_v1.sql",
      "20260904000000_bty_platform_admin_grants_v1.sql",
      "20260905000000_bty_action_capture_saved_at_v1.sql",
    ];
    const newer = [...known]
      .filter((f) => f > "20260827000000_foundry_deferred_completion_claim_v1.sql")
      .filter((f) => !KNOWN_LATER.includes(f));
    expect(newer).toEqual([]);
  });
});
