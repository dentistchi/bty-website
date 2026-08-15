/** @vitest-environment jsdom */
/**
 * SLICE 3.2R-R2.4 — the Apply boundary must never look like it worked.
 *
 * The Founder reviewed a correct v23 program, went to add it, and the database received
 * NOTHING: no event, no journey, no marker, `applied_at` null on both attempts, `updated_at`
 * older than the generation itself. No partial write anywhere — a clean zero-write failure.
 *
 * Attempt binding was cleared as the cause by code-path proof: `showProposal` is the ONLY writer
 * of `proposal` and `attemptId`, and both callers pass one object from one source, so a v23
 * proposal can never be submitted under a v22 attempt id.
 *
 * What was wrong was the failure boundary. Three faults, all provable here:
 *   1. a non-ok response set no reason, so a 409 was reported as "Your connection dropped".
 *   2. `clearCachedProposal` ran unconditionally, destroying the reviewed work on refusal.
 *   3. a missing outcome defaulted to "adopted", and a throw left the surface stuck.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { ProgramAuthorship } from "./ProgramAuthorship";
import { writeCachedProposal, readCachedProposal } from "./proposalContinuity";
import { PROGRAM_AUTHORSHIP_VERSION } from "@/domain/foundry/module/program-authorship";

const DRAFT = "ee79e3b3-2ed5-42d0-acf8-552765a8a12d";
const V23_ATTEMPT = "4b16dbd1-c50b-44c3-b857-ca8e8801e20c";
const FINGERPRINT = "fp-current";

const ANSWERS = {
  title: "Close the Loop on One Commitment",
  problem: "Team huddles sometimes end with agreement, but no one clearly owns the next action.",
  audienceType: "everyone",
  recurringMoment: "At the end of a team huddle when there are open action items",
  observableBehavior: "Before the huddle ends, name one owner and one deadline for each open action item.",
  successEvidence: "The huddle notes show a named owner and deadline.",
  evidenceType: "seen",
  learningNeeds: ["decide", "shared_standard"],
  materialIntent: "youtube",
  materialText: "https://youtu.be/x",
  completionPrompt: "What two things should be clear before a huddle ends?",
  arenaRecommended: false,
  followUpDays: 7,
} as never;

const el = (kind: string, content: string) => ({ kind, content, rationale: "because it fits" });

const PROPOSAL = {
  displayTitle: "Close the loop on one commitment",
  elements: [
    el("why_it_matters", "When an action leaves a huddle without an owner, the work stalls."),
    el("observable_standard", "Before the huddle ends, the facilitator names one owner and one deadline."),
    el("action_decision", "I will name one owner and one deadline before the huddle ends."),
    el("field_application", "At your next huddle, you name one owner and one deadline."),
    el("completion_check", "What two things should be clear before a huddle ends?"),
    el("follow_up", "In seven days you will be asked what you actually said."),
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

/** Seed the continuity cache so the review surface restores WITHOUT a generation call. */
function seedCache() {
  writeCachedProposal(DRAFT, {
    attemptId: V23_ATTEMPT,
    contextFingerprint: FINGERPRINT,
    proposal: PROPOSAL,
    evidenceCeiling: "",
    authorityVersion: PROGRAM_AUTHORSHIP_VERSION,
  } as never);
}

function mount(onApply: (j: unknown, a: string | null) => Promise<unknown>) {
  return render(
    <ProgramAuthorship
      draftId={DRAFT}
      answers={ANSWERS}
      journey={undefined}
      ready
      onGenerate={vi.fn()}
      onCheckResume={vi.fn(async () => true)}
      currentContextFingerprint={FINGERPRINT}
      adoptionRefusal={null}
      onApply={onApply as never}
      onPendingChange={vi.fn()}
    />,
  );
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe("the reviewed proposal and its attempt id are one object", () => {
  it("Apply submits the SAME attempt id the restored proposal came with", async () => {
    /*
      The stale-binding hypothesis, tested directly: whatever proposal is on screen, the id sent
      is the one that arrived with it. `showProposal` is the only writer of both.
    */
    seedCache();
    const onApply = vi.fn(async (_j: unknown, _a: string | null) => ({ status: "adopted" }));
    mount(onApply);
    fireEvent.click(await screen.findByTestId("program-apply"));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(onApply.mock.calls[0]![1]).toBe(V23_ATTEMPT);
  });
});

describe("a refusal is reported as a refusal", () => {
  it("a refused adoption does NOT claim the program was added", async () => {
    seedCache();
    mount(vi.fn(async () => ({ status: "refused" })));
    fireEvent.click(await screen.findByTestId("program-apply"));
    const panel = await screen.findByTestId("program-apply-refused");
    expect(panel.textContent).toContain("wasn’t added");
    expect(screen.queryByTestId("program-applied")).toBeNull();
  });

  it("a save failure does NOT blame the connection, and says the draft is unchanged", async () => {
    seedCache();
    mount(vi.fn(async () => ({ status: "save_failed" })));
    fireEvent.click(await screen.findByTestId("program-apply"));
    const panel = await screen.findByTestId("program-apply-save-failed");
    expect(panel.textContent).not.toMatch(/connection dropped/i);
    expect(panel.textContent).toMatch(/nothing was saved/i);
    expect(panel.textContent).toMatch(/draft is unchanged/i);
  });

  it("a MISSING outcome is a failure, never an assumed success", async () => {
    seedCache();
    mount(vi.fn(async () => undefined));
    fireEvent.click(await screen.findByTestId("program-apply"));
    expect(await screen.findByTestId("program-apply-save-failed")).toBeTruthy();
    expect(screen.queryByTestId("program-applied")).toBeNull();
  });

  it("a THROWN error becomes a visible state, never a stuck spinner", async () => {
    seedCache();
    mount(vi.fn(async () => { throw new Error("network down"); }));
    fireEvent.click(await screen.findByTestId("program-apply"));
    expect(await screen.findByTestId("program-apply-save-failed")).toBeTruthy();
  });
});

describe("the reviewed work survives a failure", () => {
  it("a refused Apply KEEPS the cached proposal, so the Host can retry", async () => {
    seedCache();
    mount(vi.fn(async () => ({ status: "refused" })));
    fireEvent.click(await screen.findByTestId("program-apply"));
    await screen.findByTestId("program-apply-refused");
    expect(readCachedProposal(DRAFT, FINGERPRINT)).not.toBeNull();
  });

  it("a save failure KEEPS the cached proposal", async () => {
    seedCache();
    mount(vi.fn(async () => ({ status: "save_failed" })));
    fireEvent.click(await screen.findByTestId("program-apply"));
    await screen.findByTestId("program-apply-save-failed");
    expect(readCachedProposal(DRAFT, FINGERPRINT)).not.toBeNull();
  });

  it("a SUCCESSFUL adoption clears it — the work is finished", async () => {
    seedCache();
    mount(vi.fn(async () => ({ status: "adopted" })));
    fireEvent.click(await screen.findByTestId("program-apply"));
    await screen.findByTestId("program-applied");
    expect(readCachedProposal(DRAFT, FINGERPRINT)).toBeNull();
  });

  it("a receipt-pending adoption also clears it — the journey is durable", async () => {
    seedCache();
    mount(vi.fn(async () => ({ status: "adopted_receipt_pending" })));
    fireEvent.click(await screen.findByTestId("program-apply"));
    await screen.findByTestId("program-applied-pending");
    expect(readCachedProposal(DRAFT, FINGERPRINT)).toBeNull();
  });
});
