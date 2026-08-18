import { describe, it, expect } from "vitest";
import { decideAdoptionReceipt } from "./adoption-authority";
import { sectionDigest } from "./proposal-digest";
import type { JourneyElementKind } from "./journey";

/**
 * SLICE R4-R2E-R1 — MIXED-AUTHORSHIP ADOPTION INTEGRITY.
 *
 * MEASURED PRODUCTION FAILURE, draft `d04d48e1` / attempt `efdc03f0` (2026-08-17). Every
 * identity check passed — same draft, outcome success, fingerprint byte-identical, newest
 * attempt, authority version `v23` = the current floor — and the adoption was still refused
 * `proposal_mismatch`, because the single aggregate digest covers the title plus ALL eight
 * required kinds, and FOUR of those eight were the Host's own `host_statement` sentences that
 * `initialSectionDecisions` (R4-R2A-R1) correctly opened on KEEP. The Host edited nothing. The
 * default state alone made the digest unmatchable, so no adoption had succeeded anywhere in
 * production since that default shipped — measured: 4 receipts ever, all before `f470ad6a`.
 *
 * FOUNDER RULE, implemented here. A partially preserved program IS a valid adoption. The
 * receipt no longer claims the whole journey is byte-identical to the proposal; it claims the
 * narrower true thing — proposal-derived sections equal the proposal, explicitly preserved Host
 * sections equal the durable pre-adoption content, and there is no third kind of content.
 *
 * WHY THE PROPOSAL IS AN INPUT, AND WHY THAT IS NOT TRUST. Measured: the proposal body is not
 * durable anywhere. `foundry_program_generation_attempts` carries `proposal_digest` and nothing
 * else of the content; the calls row carries `response_sha256` and `response_bytes` — a hash and
 * a count. So per-section comparison is impossible from stored state alone. The reference is
 * therefore supplied with the request and PROVED here against the durable digest before it is
 * read: a caller cannot produce a reference that hashes to the stored value without having the
 * real proposal. Absent or unproven, the strict single-digest rule stands and the claim is
 * refused. Nothing is weakened; one thing is made provable that previously was not.
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

/** The four the Founder's draft carried as grounded `host_statement` — these open on KEEP. */
const HOST_KINDS: JourneyElementKind[] = ["why_it_matters", "observable_standard", "reflection", "completion_check"];

const PROPOSAL_TITLE = "Making Confirmation Calls";

/** What BTY generated for all eight kinds. */
const PROPOSAL: Record<string, string> = {
  why_it_matters: "BTY: bookings without a confirmation call quietly become no-shows.",
  observable_standard: "BTY: the employee makes a confirmation call and works through the checklist.",
  scenario: "After each new patient booking, even when time is running short.",
  reflection: "BTY: what part of the checklist do you skip when you are busy?",
  action_decision: "The next time this happens, I will make a confirmation call.",
  field_application: "The next time this happens, you must make a confirmation call.",
  completion_check: "BTY: which question do you most often forget?",
  follow_up: "In 7 days you will be asked what happened after you called.",
};

/** The Host's own settled sentences, already durable before the program was drafted. */
const PRE_ADOPTION: Record<string, string> = {
  why_it_matters: "No confirmation calls made today",
  observable_standard: "Employees make a confirmation call and follow a checklist.",
  reflection: "In your own words, what is the most important standard from this training?",
  completion_check: "Describe how you will use the checklist to ensure your calls are complete.",
};

/** The journey `applyProgramProposal` produces from the DEFAULT decisions: 4 keep, 4 use. */
function mixedAdopted(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of KINDS) out[k] = HOST_KINDS.includes(k) ? PRE_ADOPTION[k]! : PROPOSAL[k]!;
  return out;
}

const PROPOSAL_DIGEST = sectionDigest(PROPOSAL_TITLE, PROPOSAL, KINDS);

function claim(over: {
  adopted: Record<string, string>;
  adoptedTitle?: string;
  reference?: { displayTitle: string; contentByKind: Record<string, string> } | null;
  preservable?: JourneyElementKind[];
}) {
  const adoptedTitle = over.adoptedTitle ?? PROPOSAL_TITLE;
  return {
    mode: "initial" as const,
    claimedAttemptId: "a1",
    journeyInSamePatch: true,
    durableJourneyPresent: true,
    attempt: {
      id: "a1",
      draftId: "d1",
      outcome: "success",
      contextFingerprint: "fp",
      proposalDigest: PROPOSAL_DIGEST,
      proposalVersion: "program_authorship_v23",
    },
    draftId: "d1",
    currentFingerprint: "fp",
    currentAuthorityVersion: "program_authorship_v23",
    latestSuccessfulAttemptId: "a1",
    adoptedJourneyDigest: sectionDigest(adoptedTitle, over.adopted, KINDS),
    mixedAuthorship: {
      requiredKinds: KINDS,
      adoptedTitle,
      adoptedByKind: over.adopted,
      preAdoptionTitle: PROPOSAL_TITLE,
      preAdoptionByKind: PRE_ADOPTION,
      preservableKinds: over.preservable ?? HOST_KINDS,
      reference:
        over.reference === undefined
          ? { displayTitle: PROPOSAL_TITLE, contentByKind: PROPOSAL }
          : over.reference,
    },
  };
}

describe("[R4-R2E-R1] A — the measured production failure, reproduced", () => {
  it("the default 4-keep / 4-use journey is NOT byte-identical to the proposal", () => {
    /*
      The fact underneath the whole defect, stated on its own so it cannot be mistaken for a
      test artefact: with the R4-R2A-R1 defaults and ZERO Host edits, the adopted journey and
      the proposal have different digests. Any rule that requires them to be equal refuses a
      legitimate adoption.
    */
    expect(sectionDigest(PROPOSAL_TITLE, mixedAdopted(), KINDS)).not.toBe(PROPOSAL_DIGEST);
  });

  it("with NO proven reference the strict rule still refuses it — fail closed", () => {
    // This is exactly what production did, and what must still happen when the reference is
    // absent, unverifiable, or forged. The repair adds a way to PROVE the claim, never a way
    // to skip proving it.
    const d = decideAdoptionReceipt(claim({ adopted: mixedAdopted(), reference: null }));
    expect(d).toEqual({ ok: false, reason: "proposal_mismatch" });
  });
});

describe("[R4-R2E-R1] B — a mixed-authorship adoption is valid", () => {
  it("KEEP sections equal the pre-adoption content, REPLACE sections equal the proposal", () => {
    expect(decideAdoptionReceipt(claim({ adopted: mixedAdopted() }))).toEqual({ ok: true });
  });

  it("the proposal's title and the Host's own durable title are both accepted", () => {
    /*
      SUPERSEDED IN PART BY R4-R2E-R2, and recorded rather than quietly dropped. R1 also asserted
      that a THIRD title was refused, as part of "no third, unaccounted-for content". The Founder
      has since decided that a rewrite made deliberately in Review is a valid final state, and
      renaming the program is the most ordinary such rewrite. The title carries no authorship
      field, so a new one cannot become a false claim about who wrote it — the restriction was
      protecting an attribution that does not exist for the title.

      The refusal case now lives in `reviewRewriteIntegrity.test.ts` as an ACCEPTANCE case. What
      R1 established and R2 leaves fully intact is asserted here.
    */
    expect(decideAdoptionReceipt(claim({ adopted: mixedAdopted(), adoptedTitle: PROPOSAL_TITLE }))).toEqual({ ok: true });
    expect(decideAdoptionReceipt(claim({ adopted: mixedAdopted(), adoptedTitle: "Making Confirmation Calls" }))).toEqual({ ok: true });
  });
});

describe("[R4-R2E-R1] C/D — forgery protection is not weakened", () => {
  it("C — a KEEP section moved off its pre-adoption value is refused", () => {
    const tampered = { ...mixedAdopted(), observable_standard: "Something nobody ever wrote." };
    expect(decideAdoptionReceipt(claim({ adopted: tampered }))).toEqual({ ok: false, reason: "proposal_mismatch" });
  });

  it("D — a REPLACE section moved off the proposal value is refused", () => {
    const tampered = { ...mixedAdopted(), scenario: "A scenario BTY never proposed." };
    expect(decideAdoptionReceipt(claim({ adopted: tampered }))).toEqual({ ok: false, reason: "proposal_mismatch" });
  });

  it("a section may only be KEPT when the DURABLE pre-adoption element was preservable", () => {
    /*
      The KEEP branch is gated on server-side provenance, never on the content matching by luck
      and never on anything the client asserts. Same journey, same values — only the durable
      provenance differs, and that alone decides.
    */
    const d = decideAdoptionReceipt(claim({ adopted: mixedAdopted(), preservable: [] }));
    expect(d).toEqual({ ok: false, reason: "proposal_mismatch" });
  });

  it("a reference that does not hash to the durable digest is not evidence", () => {
    const forged = { displayTitle: PROPOSAL_TITLE, contentByKind: { ...PROPOSAL, scenario: "forged" } };
    const d = decideAdoptionReceipt(claim({ adopted: mixedAdopted(), reference: forged }));
    expect(d).toEqual({ ok: false, reason: "proposal_mismatch" });
  });

  it("a forged reference cannot launder a forged journey, even when they agree", () => {
    // The attacker's best move: supply a journey AND a matching reference. The digest is the
    // gate, and it is computed from the DURABLE attempt row.
    const forgedContent = { ...mixedAdopted(), action_decision: "I will do whatever I like." };
    const d = decideAdoptionReceipt(
      claim({
        adopted: forgedContent,
        reference: { displayTitle: PROPOSAL_TITLE, contentByKind: forgedContent },
      }),
    );
    expect(d).toEqual({ ok: false, reason: "proposal_mismatch" });
  });
});

describe("[R4-R2E-R1] E — an unedited full adoption still succeeds", () => {
  it("every section taken from the proposal digests exactly, as before", () => {
    const full = { ...PROPOSAL };
    const d = decideAdoptionReceipt(claim({ adopted: full }));
    expect(d).toEqual({ ok: true });
    // And it does so through the ORIGINAL exact-identity path, not the mixed one.
    expect(sectionDigest(PROPOSAL_TITLE, full, KINDS)).toBe(PROPOSAL_DIGEST);
  });

  it("a full adoption still succeeds with no mixed evidence supplied at all", () => {
    const c = claim({ adopted: { ...PROPOSAL } }) as Record<string, unknown>;
    delete c.mixedAuthorship;
    expect(decideAdoptionReceipt(c as never)).toEqual({ ok: true });
  });
});

describe("[R4-R2E-R1] the earlier gates still run first", () => {
  it("a moved context is context_moved, never re-described as a mismatch", () => {
    const c = { ...claim({ adopted: mixedAdopted() }), currentFingerprint: "moved" };
    expect(decideAdoptionReceipt(c)).toEqual({ ok: false, reason: "context_moved" });
  });

  it("an outdated authority version is still refused after a valid mixed adoption proves", () => {
    const c = claim({ adopted: mixedAdopted() });
    c.attempt.proposalVersion = "program_authorship_v9";
    expect(decideAdoptionReceipt(c)).toEqual({ ok: false, reason: "proposal_no_longer_valid" });
  });
});
