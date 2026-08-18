import { describe, it, expect } from "vitest";
import { decideAdoptionReceipt } from "./adoption-authority";
import { sectionDigest } from "./proposal-digest";
import type { JourneyElementKind } from "./journey";

/**
 * SLICE R4-R2E-R2 — REVIEW REWRITE INTEGRITY.
 *
 * THE CONTRADICTION, from the Founder's device. The Learner Preview says "Every gold box below
 * is text you can rewrite." Rewriting one then refused the adoption, and the refusal told the
 * Host to add the program "without rewriting the sections". The product invited an action and
 * then punished it.
 *
 * FOUNDER DECISION: a rewrite made deliberately in Review is a valid final program state. Three
 * outcomes are legitimate per section — KEEP, USE BTY, REWRITE — in any mixture.
 *
 * MEASURED MODEL (this is what the rule is built on, not an assumption):
 *
 *   · Durable per-section provenance ALREADY EXISTS — `grounding[0].sourceType`, one of
 *     `host_statement` / `ai_proposed` / `host_edited` / `deterministic_derived`. It is frozen
 *     into the published snapshot. `applyProgramProposal` writes `ai_proposed` for USE BTY, the
 *     prior provenance for KEEP, and `provenanceAfterHostEdit(...)` — host-authored — for a
 *     rewrite. So the truth this slice must protect is already representable. NO SCHEMA NEEDED.
 *
 *   · The Review keep/use/rewrite decision is TRANSIENT CLIENT STATE. Measured: `decisions`
 *     never reaches `onPatch`, no persisted field holds it, and `SectionDecision` appears in no
 *     durable model. It is therefore a DECLARATION when transmitted, never durable evidence.
 *
 *   · The receipt's anti-forgery purpose (R11.2's own header) is that "any schema-valid journey
 *     could take that attempt's receipt, because nothing durable said what the attempt actually
 *     produced". The threat is a FALSE CLAIM OF BTY AUTHORSHIP — not a Host writing their own
 *     words into their own draft.
 *
 * THE ONE UNBYPASSABLE RULE, and why it is the right one. The request is authenticated as the
 * owning Host and scoped to their own draft, so "did a Host write this?" needs no proof — there
 * is no other party. What must never happen is that new words are attributed to BTY. Hence:
 * CONTENT THAT IS NOT THE PROPOSAL'S MAY NEVER CARRY A MACHINE PROVENANCE. That holds against
 * every caller, honest or not, and it is what these tests pin.
 *
 * The per-section declarations are checked too (D and E), and they are honest integrity checks
 * on a cooperating client — NOT a boundary against a hostile one. Once REWRITE is a legitimate
 * outcome for any section, a hostile caller simply declares REWRITE; what it still cannot do is
 * have that content called BTY's. That difference is stated plainly rather than implied.
 */

const KINDS: JourneyElementKind[] = [
  "why_it_matters",
  "observable_standard",
  "scenario",
  "reflection",
  "action_decision",
  "field_application",
  "completion_check",
  "follow_up",
];

const HOST_KINDS: JourneyElementKind[] = ["why_it_matters", "observable_standard", "reflection", "completion_check"];
const TITLE = "Making Confirmation Calls";

const PROPOSAL: Record<string, string> = {
  why_it_matters: "BTY: bookings without a confirmation call quietly become no-shows.",
  observable_standard: "BTY: the employee calls and works through the checklist.",
  scenario: "After each new patient booking, even when time is running short.",
  reflection: "BTY: what part of the checklist do you skip when you are busy?",
  action_decision: "The next time this happens, I will make a confirmation call.",
  field_application: "The next time this happens, you must make a confirmation call.",
  completion_check: "BTY: which question do you most often forget?",
  follow_up: "In 7 days you will be asked what happened after you called.",
};

const PRE_ADOPTION: Record<string, string> = {
  why_it_matters: "No confirmation calls made today",
  observable_standard: "Employees make a confirmation call and follow a checklist.",
  reflection: "In your own words, what is the most important standard from this training?",
  completion_check: "Describe how you will use the checklist to ensure your calls are complete.",
};

const PROPOSAL_DIGEST = sectionDigest(TITLE, PROPOSAL, KINDS);

/** The Founder's device shape: 4 kept Host sections, 4 taken from the proposal. */
function mixed(): { content: Record<string, string>; provenance: Record<string, string>; decisions: Record<string, string> } {
  const content: Record<string, string> = {};
  const provenance: Record<string, string> = {};
  const decisions: Record<string, string> = {};
  for (const k of KINDS) {
    if (HOST_KINDS.includes(k)) {
      content[k] = PRE_ADOPTION[k]!;
      provenance[k] = "host_statement";
      decisions[k] = "keep";
    } else {
      content[k] = PROPOSAL[k]!;
      provenance[k] = "ai_proposed";
      decisions[k] = "use";
    }
  }
  return { content, provenance, decisions };
}

/** …and then the Host rewrites one learner-facing section, exactly as the UI invites. */
function mixedWithRewrite(kind: JourneyElementKind = "field_application", text = "At your next booking, call the patient before you do anything else.") {
  const m = mixed();
  m.content[kind] = text;
  m.provenance[kind] = "host_edited";
  m.decisions[kind] = "edit";
  return m;
}

function claim(m: { content: Record<string, string>; provenance: Record<string, string>; decisions?: Record<string, string> }, over: {
  title?: string;
  reference?: { displayTitle: string; contentByKind: Record<string, string> } | null;
  preservable?: JourneyElementKind[];
  withDeclarations?: boolean;
} = {}) {
  const title = over.title ?? TITLE;
  return {
    mode: "initial" as const,
    claimedAttemptId: "a1",
    journeyInSamePatch: true,
    durableJourneyPresent: true,
    attempt: {
      id: "a1", draftId: "d1", outcome: "success", contextFingerprint: "fp",
      proposalDigest: PROPOSAL_DIGEST, proposalVersion: "program_authorship_v23",
    },
    draftId: "d1",
    currentFingerprint: "fp",
    currentAuthorityVersion: "program_authorship_v23",
    latestSuccessfulAttemptId: "a1",
    adoptedJourneyDigest: sectionDigest(title, m.content, KINDS),
    mixedAuthorship: {
      requiredKinds: KINDS,
      adoptedTitle: title,
      adoptedByKind: m.content,
      adoptedProvenanceByKind: m.provenance,
      preAdoptionTitle: TITLE,
      preAdoptionByKind: PRE_ADOPTION,
      preservableKinds: over.preservable ?? HOST_KINDS,
      declarations: over.withDeclarations === false ? undefined : m.decisions,
      reference: over.reference === undefined ? { displayTitle: TITLE, contentByKind: PROPOSAL } : over.reference,
    },
  };
}

describe("[R4-R2E-R2] A — the Founder's rewrite, refused by the pre-repair authority", () => {
  it("a rewritten section is not the proposal's and not the durable value, so R1 refuses it", () => {
    /*
      THE RED CASE. Under R4-R2E-R1 a section had to match one of exactly two sources. A rewrite
      matches neither by definition, so the adoption the UI invited could not be recorded. This
      asserts the arithmetic that made it inevitable — it holds no matter how the rule changes.
    */
    const m = mixedWithRewrite();
    expect(m.content.field_application).not.toBe(PROPOSAL.field_application);
    expect(m.content.field_application).not.toBe(PRE_ADOPTION.field_application ?? "");
    // And with no declarations — the R1 world exactly — it is still refused.
    const d = decideAdoptionReceipt(claim(m, { withDeclarations: false }));
    expect(d).toEqual({ ok: false, reason: "proposal_mismatch" });
  });
});

describe("[R4-R2E-R2] B/C — the legitimate mixtures are adoptable", () => {
  it("B — KEEP + USE BTY succeeds, as R1 established", () => {
    expect(decideAdoptionReceipt(claim(mixed()))).toEqual({ ok: true });
  });

  it("C — KEEP + USE BTY + REWRITE succeeds", () => {
    expect(decideAdoptionReceipt(claim(mixedWithRewrite()))).toEqual({ ok: true });
  });

  it("C — several rewrites at once are still one valid adoption", () => {
    const m = mixedWithRewrite();
    m.content.scenario = "When the schedule is full and the phone is already ringing.";
    m.provenance.scenario = "host_edited";
    m.decisions.scenario = "edit";
    expect(decideAdoptionReceipt(claim(m))).toEqual({ ok: true });
  });

  it("C — a Host may retitle the program in Review", () => {
    // The title carries no authorship field, so a new one cannot become a false BTY claim.
    expect(decideAdoptionReceipt(claim(mixedWithRewrite(), { title: "Calling Every New Booking" }))).toEqual({ ok: true });
  });

  it("an unedited full adoption still proves by exact identity alone", () => {
    const content = { ...PROPOSAL };
    const provenance = Object.fromEntries(KINDS.map((k) => [k, "ai_proposed"]));
    expect(decideAdoptionReceipt(claim({ content, provenance }))).toEqual({ ok: true });
  });
});

describe("[R4-R2E-R2] D/E — a declaration must be kept", () => {
  it("D — content declared KEEP that is not the durable value is refused", () => {
    const m = mixed();
    m.content.observable_standard = "Something the row never held.";
    m.provenance.observable_standard = "host_edited";
    // The declaration still says `keep`. A keep that does not keep is refused.
    expect(decideAdoptionReceipt(claim(m))).toEqual({ ok: false, reason: "proposal_mismatch" });
  });

  it("E — content declared USE BTY that is not the proposal value is refused", () => {
    const m = mixed();
    m.content.scenario = "A scenario BTY never proposed.";
    m.provenance.scenario = "host_edited";
    expect(decideAdoptionReceipt(claim(m))).toEqual({ ok: false, reason: "proposal_mismatch" });
  });

  it("the same content declared REWRITE instead is accepted — the declaration is the difference", () => {
    /*
      Stated openly, because it is the honest limit of D and E: they bind a cooperating client.
      A caller that declares REWRITE gets the Founder's third outcome, which is legitimate. What
      no caller can do is have that content attributed to BTY — that is the test below.
    */
    const m = mixed();
    m.content.scenario = "A scenario BTY never proposed.";
    m.provenance.scenario = "host_edited";
    m.decisions.scenario = "edit";
    expect(decideAdoptionReceipt(claim(m))).toEqual({ ok: true });
  });

  it("with no declarations at all, the strict two-source rule still governs", () => {
    const m = mixed();
    m.content.scenario = "A scenario BTY never proposed.";
    m.provenance.scenario = "host_edited";
    expect(decideAdoptionReceipt(claim(m, { withDeclarations: false }))).toEqual({ ok: false, reason: "proposal_mismatch" });
  });
});

describe("[R4-R2E-R2] F/G — new words are never BTY's, whatever the caller says", () => {
  it("F — rewritten content labelled `ai_proposed` is REFUSED", () => {
    // The forgery this slice must make impossible: arbitrary text wearing BTY's name.
    const m = mixedWithRewrite();
    m.provenance.field_application = "ai_proposed";
    expect(decideAdoptionReceipt(claim(m))).toEqual({ ok: false, reason: "proposal_mismatch" });
  });

  it("F — nor may it be labelled `deterministic_derived`", () => {
    const m = mixedWithRewrite();
    m.provenance.field_application = "deterministic_derived";
    expect(decideAdoptionReceipt(claim(m))).toEqual({ ok: false, reason: "proposal_mismatch" });
  });

  it("F — declaring REWRITE does not buy a machine label either", () => {
    const m = mixed();
    m.content.scenario = "Words BTY never wrote.";
    m.provenance.scenario = "ai_proposed";
    m.decisions.scenario = "edit";
    expect(decideAdoptionReceipt(claim(m))).toEqual({ ok: false, reason: "proposal_mismatch" });
  });

  it("F — a KEPT section keeps its own host provenance and is accepted", () => {
    const m = mixed();
    m.provenance.why_it_matters = "host_edited"; // the Host had edited it in an earlier session
    expect(decideAdoptionReceipt(claim(m))).toEqual({ ok: true });
  });

  it("F — a section matching the proposal may be labelled host-authored (it under-claims, never over-claims)", () => {
    const m = mixed();
    m.provenance.scenario = "host_edited";
    expect(decideAdoptionReceipt(claim(m))).toEqual({ ok: true });
  });

  it("G — a forged proposal reference is still not evidence", () => {
    const forged = { displayTitle: TITLE, contentByKind: { ...PROPOSAL, scenario: "forged" } };
    expect(decideAdoptionReceipt(claim(mixedWithRewrite(), { reference: forged }))).toEqual({ ok: false, reason: "proposal_mismatch" });
  });

  it("G — a forged journey with a matching forged reference is still refused", () => {
    const m = mixedWithRewrite();
    expect(
      decideAdoptionReceipt(claim(m, { reference: { displayTitle: TITLE, contentByKind: m.content } })),
    ).toEqual({ ok: false, reason: "proposal_mismatch" });
  });

  it("G — with no reference at all nothing is provable, rewrite or not", () => {
    expect(decideAdoptionReceipt(claim(mixedWithRewrite(), { reference: null }))).toEqual({ ok: false, reason: "proposal_mismatch" });
  });

  it("a KEEP over a section the durable row never owned is still refused", () => {
    expect(decideAdoptionReceipt(claim(mixed(), { preservable: [] }))).toEqual({ ok: false, reason: "proposal_mismatch" });
  });
});

describe("[R4-R2E-R2] the earlier gates are untouched", () => {
  it("a moved context is still context_moved", () => {
    expect(decideAdoptionReceipt({ ...claim(mixedWithRewrite()), currentFingerprint: "moved" })).toEqual({
      ok: false,
      reason: "context_moved",
    });
  });

  it("an outdated authority version is still proposal_no_longer_valid", () => {
    const c = claim(mixedWithRewrite());
    c.attempt.proposalVersion = "program_authorship_v9";
    expect(decideAdoptionReceipt(c)).toEqual({ ok: false, reason: "proposal_no_longer_valid" });
  });
});
