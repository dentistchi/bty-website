import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proposalDigest } from "@/domain/foundry/module/proposal-digest";
import { programContext, programContextFingerprint, requiredProgramKinds, PROGRAM_AUTHORSHIP_VERSION } from "@/domain/foundry/module/program-authorship";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/**
 * SLICE R4-R2E-R1 TEST F — a mixed-authorship adoption, through the REAL route.
 *
 * The domain tests prove the rule. This proves the ROUTE gathers the right evidence: the
 * pre-adoption journey read from the durable row before the write, `preservableKinds` computed
 * from that row's own provenance, and the reference taken from the request body and PROVED.
 * Getting the rule right and wiring it to the wrong state would pass one and fail the Host.
 *
 * Fixture shape is the measured production one: four required kinds already grounded as
 * `host_statement` and kept, the rest taken from the proposal.
 */
const currentUser = vi.fn<() => { id: string } | null>();
const getOwnerDraft = vi.fn();
const updateDraftStep = vi.fn();
const markApplied = vi.fn();
let attemptRow: {
  id: string; draftId: string; outcome: string; proposalVersion: string | null;
  contextFingerprint: string; proposalDigest: string | null;
} | null = null;
let latestSuccessfulAttemptId: string | null = null;

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: async () => ({ user: currentUser(), base: NextResponse.json({ ok: true }) }),
  unauthenticated: () => NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/bty/foundry/events/foundryHostService", () => ({ isActiveFoundryHost: async () => true }));
vi.mock("@/lib/bty/foundry/events/foundryModuleService", () => ({
  getOwnerDraft: (...a: unknown[]) => getOwnerDraft(...a),
  updateDraftStep: (...a: unknown[]) => updateDraftStep(...a),
  deleteDraft: vi.fn(),
}));
vi.mock("@/lib/bty/foundry/events/draftAssetService", () => ({ listDraftAssets: async () => [] }));
vi.mock("@/lib/bty/foundry/events/programGenerationRecorder", () => ({
  PROPOSAL_DIGEST_ENABLED: true,
  readAdoptionFacts: async () => ({ attempt: attemptRow, latestSuccessfulAttemptId }),
  markProgramAttemptApplied: (...a: unknown[]) => markApplied(...a),
  resolveProgramGenerationAuthority: async () => ({ state: "idle" }),
}));

let PATCH: typeof import("./route").PATCH;
beforeAll(async () => { ({ PATCH } = await import("./route")); });

const DRAFT = "f3000000-0000-4000-8000-000000000001";
const ATTEMPT = "f4000000-0000-4000-8000-000000000002";

const ANSWERS: BuilderAnswers = {
  problem: "No confirmation calls made today.",
  audienceType: "everyone",
  recurringMoment: "after each new patient booking",
  observableBehavior: "Employees make a confirmation call and follow a checklist.",
  successEvidence: "A checklist is completed and submitted after each call.",
  evidenceType: "seen",
  learningNeeds: ["know", "decide", "practice"],
  materialIntent: "youtube",
  materialText: "https://youtu.be/x",
  completionPrompt: "Describe how you will use the checklist on your next call.",
  arenaRecommended: true,
  followUpDays: 7,
} as BuilderAnswers;

const REQUIRED = requiredProgramKinds(ANSWERS);
const FINGERPRINT = programContextFingerprint(programContext(ANSWERS)!);

const el = (kind: string, content: string, sourceType: "host_statement" | "ai_proposed") => ({
  id: `el_${kind}`, kind, content, confirmationStatus: "grounded" as const,
  grounding: [{ field: "problem", sourceType }],
});

const TITLE = "Making Confirmation Calls";

/** What BTY generated — all required kinds. */
const PROPOSAL_CONTENT: Record<string, string> = {
  why_it_matters: "BTY: a booking without a confirmation call quietly becomes a no-show.",
  observable_standard: "BTY: the employee calls and works through the checklist.",
  scenario: "After each new patient booking, even when time is running short.",
  action_decision: "The next time this happens, I will make a confirmation call.",
  field_application: "At your next booking, you make the confirmation call.",
  completion_check: "BTY: which question do you most often forget?",
  follow_up: "In seven days you will be asked what happened after you called.",
  reflection: "BTY: what do you skip when you are busy?",
};

/** The Host's own settled sentences, already on the row before the program was drafted. */
const HOST_KEPT: Record<string, string> = {
  why_it_matters: "No confirmation calls made today",
  observable_standard: "Employees make a confirmation call and follow a checklist.",
  completion_check: "Describe how you will use the checklist to ensure your calls are complete.",
};

const PRE_ADOPTION_JOURNEY = {
  version: 1 as const,
  displayTitle: TITLE,
  displayTitleStatus: "grounded" as const,
  elements: Object.entries(HOST_KEPT).map(([k, v]) => el(k, v, "host_statement")),
};

const EXACT_DIGEST = proposalDigest(
  {
    displayTitle: TITLE,
    elements: REQUIRED.map((k) => ({ kind: k, content: PROPOSAL_CONTENT[k] ?? "", rationale: "" })),
    assumptions: [], warnings: [],
  } as never,
  REQUIRED,
);

/** The reference the client sends: the proposal, untouched. */
const REFERENCE = {
  displayTitle: TITLE,
  elements: REQUIRED.map((k) => ({ kind: k, content: PROPOSAL_CONTENT[k] ?? "" })),
};

/** The journey `applyProgramProposal` produces from the DEFAULT decisions: keep host, use BTY. */
function mixedJourney() {
  return {
    version: 1 as const,
    displayTitle: TITLE,
    displayTitleStatus: "grounded" as const,
    elements: REQUIRED.map((k) =>
      k in HOST_KEPT ? el(k, HOST_KEPT[k]!, "host_statement") : el(k, PROPOSAL_CONTENT[k] ?? "", "ai_proposed"),
    ),
  };
}

function draftRow(answers: Record<string, unknown>) {
  return {
    id: DRAFT, owner_user_id: "owner-1", status: "draft", current_step: 9, answers,
    module_version: 1, parent_module_id: null, document_asset_ref: null,
    approved_at: null, published_at: null, program_id: null,
    created_at: "2026-08-17T00:00:00Z", updated_at: "2026-08-17T00:00:00Z",
  };
}

async function patchWith(journey: ReturnType<typeof mixedJourney>, reference: unknown, preAdoption = PRE_ADOPTION_JOURNEY, decisions?: unknown) {
  const answers = { ...ANSWERS, realityGroundedJourneyV1: journey, programAdoptionV1: { attemptId: ATTEMPT } };
  // The DURABLE row before this write — it already carries the Host's own sections.
  getOwnerDraft.mockResolvedValue(draftRow({ ...ANSWERS, realityGroundedJourneyV1: preAdoption } as never));
  updateDraftStep.mockImplementation(async (_a, _u, _i, patch) => ({
    ok: true, value: draftRow(patch.answers as Record<string, unknown>),
  }));
  const req = new NextRequest(`http://localhost/api/bty/foundry/modules/${DRAFT}`, {
    method: "PATCH",
    body: JSON.stringify({
      answers, current_step: 9,
      ...(reference === undefined ? {} : { adoption_reference: reference }),
      ...(decisions === undefined ? {} : { adoption_decisions: decisions }),
    }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await PATCH(req, { params: Promise.resolve({ id: DRAFT }) });
  return {
    res,
    body: (await res.json()) as { adoption?: { ok: boolean; reason?: string; receipt?: string } },
    patched: updateDraftStep.mock.calls.at(-1)?.[3] as { answers: Record<string, unknown> } | undefined,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockReturnValue({ id: "owner-1" });
  markApplied.mockResolvedValue(true);
  attemptRow = { id: ATTEMPT, draftId: DRAFT, outcome: "success", contextFingerprint: FINGERPRINT, proposalDigest: EXACT_DIGEST, proposalVersion: PROGRAM_AUTHORSHIP_VERSION };
  latestSuccessfulAttemptId = ATTEMPT;
});

describe("[R4-R2E-R1] F — mixed-authorship adoption through the real route", () => {
  it("stamps the receipt, keeps the marker, and marks the attempt applied exactly once", async () => {
    const { body, patched } = await patchWith(mixedJourney(), REFERENCE);

    expect(body.adoption?.ok, JSON.stringify(body.adoption)).toBe(true);
    expect(body.adoption?.receipt).toBe("recorded");
    expect(patched!.answers.programAdoptionV1).toEqual({ attemptId: ATTEMPT });
    expect(markApplied).toHaveBeenCalledTimes(1);
    // And the Host's own sentences survived the adoption unchanged.
    const written = patched!.answers.realityGroundedJourneyV1 as { elements: { kind: string; content: string }[] };
    expect(written.elements.find((e) => e.kind === "why_it_matters")?.content).toBe(HOST_KEPT.why_it_matters);
    expect(written.elements.find((e) => e.kind === "scenario")?.content).toBe(PROPOSAL_CONTENT.scenario);
  });

  it("WITHOUT the reference the same request is refused — the route does not infer authorship", async () => {
    const { body, patched } = await patchWith(mixedJourney(), undefined);
    expect(body.adoption?.ok).toBe(false);
    expect(body.adoption?.reason).toBe("proposal_mismatch");
    expect(patched!.answers.programAdoptionV1).toBeUndefined();
    expect(markApplied).not.toHaveBeenCalled();
  });

  it("a substituted section is still refused even WITH a valid reference", async () => {
    const tampered = mixedJourney();
    tampered.elements = tampered.elements.map((e) =>
      e.kind === "scenario" ? { ...e, content: "A scenario BTY never wrote." } : e,
    );
    const { body, patched } = await patchWith(tampered, REFERENCE);
    expect(body.adoption?.ok).toBe(false);
    expect(body.adoption?.reason).toBe("proposal_mismatch");
    expect(patched!.answers.programAdoptionV1).toBeUndefined();
    expect(markApplied).not.toHaveBeenCalled();
  });

  it("a KEEP claim over a section the row never owned is refused", async () => {
    /*
      Same journey, same reference — only the DURABLE provenance differs. `ai_proposed`
      pre-adoption content is not the Host's to preserve, so the KEEP branch is unavailable and
      the section must match the proposal, which it does not.
    */
    const notHostOwned = {
      ...PRE_ADOPTION_JOURNEY,
      elements: Object.entries(HOST_KEPT).map(([k, v]) => el(k, v, "ai_proposed")),
    };
    const { body } = await patchWith(mixedJourney(), REFERENCE, notHostOwned);
    expect(body.adoption?.ok).toBe(false);
    expect(body.adoption?.reason).toBe("proposal_mismatch");
  });

  it("a reference that does not hash to the durable digest is ignored, not trusted", async () => {
    const forged = { displayTitle: TITLE, elements: REQUIRED.map((k) => ({ kind: k, content: k === "scenario" ? "forged" : PROPOSAL_CONTENT[k] ?? "" })) };
    const { body } = await patchWith(mixedJourney(), forged);
    expect(body.adoption?.ok).toBe(false);
    expect(body.adoption?.reason).toBe("proposal_mismatch");
  });

  it("a malformed reference cannot crash the route — it falls back to the strict rule", async () => {
    for (const junk of [42, "nope", { displayTitle: 1 }, { displayTitle: "t", elements: [{ kind: 5 }] }, { elements: [] }]) {
      const { res, body } = await patchWith(mixedJourney(), junk);
      expect(res.status).toBe(200);
      expect(body.adoption?.ok).toBe(false);
      expect(body.adoption?.reason).toBe("proposal_mismatch");
    }
  });
});


/** The declarations the real client sends alongside a default keep/use adoption. */
const DECLARATIONS = Object.fromEntries(REQUIRED.map((k) => [k, k in HOST_KEPT ? "keep" : "use"]));

describe("[R4-R2E-R2] H — a rewritten section survives the route as the Host's own", () => {
  it("KEEP + USE BTY + REWRITE stamps exactly one receipt and persists the rewritten journey", async () => {
    const REWRITE = "At your next booking, call the patient before you do anything else.";
    const journey = mixedJourney();
    journey.elements = journey.elements.map((e) =>
      e.kind === "field_application" ? el(e.kind, REWRITE, "host_statement") : e,
    );
    const decisions = { ...DECLARATIONS, field_application: "edit" };

    const { body, patched } = await patchWith(journey, REFERENCE, PRE_ADOPTION_JOURNEY, decisions);

    expect(body.adoption?.ok, JSON.stringify(body.adoption)).toBe(true);
    expect(body.adoption?.receipt).toBe("recorded");
    expect(markApplied).toHaveBeenCalledTimes(1);
    expect(patched!.answers.programAdoptionV1).toEqual({ attemptId: ATTEMPT });

    // The Host's new words are what is durable — not replaced, not reverted to the proposal.
    const written = patched!.answers.realityGroundedJourneyV1 as { elements: { kind: string; content: string; grounding: { sourceType: string }[] }[] };
    const rewritten = written.elements.find((e) => e.kind === "field_application")!;
    expect(rewritten.content).toBe(REWRITE);
    // …and they are recorded as the HOST's, never as BTY's.
    expect(rewritten.grounding[0].sourceType).toBe("host_statement");
    // The kept and the BTY-taken sections are untouched beside it.
    expect(written.elements.find((e) => e.kind === "why_it_matters")!.content).toBe(HOST_KEPT.why_it_matters);
    expect(written.elements.find((e) => e.kind === "scenario")!.content).toBe(PROPOSAL_CONTENT.scenario);
  });

  it("the same rewrite labelled `ai_proposed` is REFUSED by the route", async () => {
    const journey = mixedJourney();
    journey.elements = journey.elements.map((e) =>
      e.kind === "field_application" ? el(e.kind, "Words BTY never wrote.", "ai_proposed") : e,
    );
    const decisions = { ...DECLARATIONS, field_application: "edit" };

    const { body, patched } = await patchWith(journey, REFERENCE, PRE_ADOPTION_JOURNEY, decisions);

    expect(body.adoption?.ok).toBe(false);
    expect(body.adoption?.reason).toBe("proposal_mismatch");
    expect(patched!.answers.programAdoptionV1).toBeUndefined();
    expect(markApplied).not.toHaveBeenCalled();
  });

  it("a declared KEEP that does not keep is refused through the route", async () => {
    const journey = mixedJourney();
    journey.elements = journey.elements.map((e) =>
      e.kind === "why_it_matters" ? el(e.kind, "Not what the row held.", "host_statement") : e,
    );
    const { body } = await patchWith(journey, REFERENCE, PRE_ADOPTION_JOURNEY, DECLARATIONS);
    expect(body.adoption?.ok).toBe(false);
    expect(body.adoption?.reason).toBe("proposal_mismatch");
  });

  it("junk declarations are dropped, returning that section to the strict rule", async () => {
    const journey = mixedJourney();
    journey.elements = journey.elements.map((e) =>
      e.kind === "field_application" ? el(e.kind, "Words BTY never wrote.", "host_statement") : e,
    );
    for (const junk of [{ field_application: "whatever" }, { field_application: 7 }, "nope", 42, null]) {
      const { res, body } = await patchWith(journey, REFERENCE, PRE_ADOPTION_JOURNEY, junk);
      expect(res.status).toBe(200);
      expect(body.adoption?.ok).toBe(false);
      expect(body.adoption?.reason).toBe("proposal_mismatch");
    }
  });
});
