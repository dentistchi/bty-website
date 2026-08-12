import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proposalDigest } from "@/domain/foundry/module/proposal-digest";
import { programContext, programContextFingerprint, requiredProgramKinds, PROGRAM_AUTHORSHIP_VERSION } from "@/domain/foundry/module/program-authorship";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/**
 * SLICE 3.2L-R11.4K-R1 PART 3/4 — the tamper guard, through the REAL adoption route.
 *
 * R11.4K argued that a tampered cached proposal would be refused because the server
 * recomputes the digest. Arguing is not proving, and `proposalDigest()` returning two
 * different hashes is not proof either — the claim is about the ROUTE. So this drives
 * `PATCH /api/bty/foundry/modules/[id]` itself, with an isolated fixture attempt, and
 * asserts what the Host and the ledger end up with.
 *
 * Nothing here touches canonical draft 093b0361 or attempt 496302b6.
 */
const currentUser = vi.fn<() => { id: string } | null>();
const getOwnerDraft = vi.fn();
const updateDraftStep = vi.fn();
const markApplied = vi.fn();
/** The fixture attempt row the recorder would read. */
let attemptRow: {
  id: string;
  draftId: string;
  outcome: string;
  /** Slice 3.2P-W4-R1 — the acceptance contract the attempt was generated under. */
  proposalVersion: string | null;
  contextFingerprint: string;
  proposalDigest: string | null;
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

const DRAFT = "f1000000-0000-4000-8000-000000000001";
const ATTEMPT = "f2000000-0000-4000-8000-000000000002";

const ANSWERS: BuilderAnswers = {
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
} as BuilderAnswers;

const REQUIRED = requiredProgramKinds(ANSWERS);
/** What the ROUTE recomputes from these answers — the attempt must carry exactly this. */
const FINGERPRINT = programContextFingerprint(programContext(ANSWERS)!);

const el = (kind: string, content: string) => ({
  id: `el_${kind}`,
  kind,
  content,
  confirmationStatus: "grounded" as const,
  grounding: [{ field: "problem", sourceType: "host_statement" as const }],
});

/** The exact proposal the fixture attempt produced. */
const JOURNEY = {
  version: 1 as const,
  displayTitle: "Handing over without gaps",
  displayTitleStatus: "grounded" as const,
  elements: [
    el("why_it_matters", "When a handover misses a step, the next person starts without knowing what changed."),
    el("observable_standard", "The outgoing person states each open item aloud."),
    el("scenario", "The shift ran late and two people are already waiting."),
    el("action_decision", "I will decide which open items I always state aloud."),
    el("field_application", "At your next handover, you state the open items before leaving."),
    el("completion_check", "What will you say aloud at your next handover?"),
    el("follow_up", "In seven days you will be asked what you actually said."),
  ],
};

/** The digest the SERVER recorded when that proposal was authored. */
const EXACT_DIGEST = proposalDigest(
  {
    displayTitle: JOURNEY.displayTitle,
    elements: JOURNEY.elements.map((e) => ({ kind: e.kind, content: e.content, rationale: "" })),
    assumptions: [],
    warnings: [],
  } as never,
  REQUIRED,
);

function draftRow(answers: Record<string, unknown>) {
  return {
    id: DRAFT,
    owner_user_id: "owner-1",
    status: "draft",
    current_step: 7,
    answers,
    module_version: 1,
    parent_module_id: null,
    document_asset_ref: null,
    approved_at: null,
    published_at: null,
    program_id: null,
    created_at: "2026-08-08T00:00:00Z",
    updated_at: "2026-08-08T00:00:00Z",
  };
}

async function patchWith(journey: typeof JOURNEY) {
  const answers = { ...ANSWERS, realityGroundedJourneyV1: journey, programAdoptionV1: { attemptId: ATTEMPT } };
  getOwnerDraft.mockResolvedValue(draftRow(ANSWERS as never));
  updateDraftStep.mockImplementation(async (_a, _u, _i, patch) => ({
    ok: true,
    value: draftRow(patch.answers as Record<string, unknown>),
  }));
  const req = new NextRequest(`http://localhost/api/bty/foundry/modules/${DRAFT}`, {
    method: "PATCH",
    body: JSON.stringify({ answers, current_step: 7 }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await PATCH(req, { params: Promise.resolve({ id: DRAFT }) });
  return { res, body: (await res.json()) as { adoption?: { ok: boolean; reason?: string; receipt?: string }; draft?: { answers?: Record<string, unknown> } }, patched: updateDraftStep.mock.calls.at(-1)?.[3] };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockReturnValue({ id: "owner-1" });
  markApplied.mockResolvedValue(true);
  attemptRow = { id: ATTEMPT, draftId: DRAFT, outcome: "success", contextFingerprint: FINGERPRINT, proposalDigest: EXACT_DIGEST, proposalVersion: PROGRAM_AUTHORSHIP_VERSION };
  latestSuccessfulAttemptId = ATTEMPT;
});

describe("[3.2L-R11.4K-R1] tamper → proposal_mismatch, through the real route", () => {
  it("the EXACT proposal is adopted and the receipt is recorded", async () => {
    const { body, patched } = await patchWith(JOURNEY);
    expect(body.adoption?.ok, JSON.stringify(body.adoption)).toBe(true);
    expect((patched as { answers: Record<string, unknown> }).answers.programAdoptionV1).toBeTruthy();
    expect(markApplied).toHaveBeenCalledTimes(1);
  });

  it("ONE changed character is refused with proposal_mismatch — and nothing is adopted", async () => {
    const tampered = JSON.parse(JSON.stringify(JOURNEY)) as typeof JOURNEY;
    // One character. Not a rewrite, not a new section — the smallest possible difference.
    tampered.elements[0].content = tampered.elements[0].content.replace("misses", "misseS");

    const { body, patched } = await patchWith(tampered);

    expect(body.adoption?.ok).toBe(false);
    expect(body.adoption?.reason).toBe("proposal_mismatch");
    // The marker is STRIPPED from the write: the row never says it adopted this.
    expect((patched as { answers: Record<string, unknown> }).answers.programAdoptionV1).toBeUndefined();
    // No receipt is stamped, so applied_at is never written.
    expect(markApplied, "a refused claim must not touch the ledger").not.toHaveBeenCalled();
    // The Host's other work still saved — a refused receipt has never been a reason to lose it.
    expect((patched as { answers: Record<string, unknown> }).answers.realityGroundedJourneyV1).toBeTruthy();
  });

  it("an attempt with no recorded identity can never be adopted, tampered or not", async () => {
    attemptRow = { id: ATTEMPT, draftId: DRAFT, outcome: "success", contextFingerprint: FINGERPRINT, proposalDigest: null, proposalVersion: PROGRAM_AUTHORSHIP_VERSION };
    const { body } = await patchWith(JOURNEY);
    expect(body.adoption?.ok).toBe(false);
    expect(body.adoption?.reason).toBe("proposal_mismatch");
    expect(markApplied).not.toHaveBeenCalled();
  });

  it("invalidation never rewrites history: a refusal writes nothing to the attempts ledger", async () => {
    const tampered = JSON.parse(JSON.stringify(JOURNEY)) as typeof JOURNEY;
    tampered.displayTitle = `${tampered.displayTitle}.`;
    await patchWith(tampered);
    expect(markApplied).not.toHaveBeenCalled();
  });
});
