import { describe, it, expect } from "vitest";
import {
  requiredLearnerReflection,
  resolveReflectionResponse,
  validateReflectionResponse,
} from "./foundry-training";
import { reflectionEstablished, establishedEvidence } from "./learner-evidence";
import { journeyReflection } from "@/domain/foundry/module/journey";
import type { RealityGroundedJourneyV1 } from "@/domain/foundry/module/journey";

/**
 * SLICE 3.2R-R8B — A COMMITMENT WAS STANDING IN FOR A REFLECTION.
 *
 * R8A made the published REFLECT question visible to a PDF learner: "What usually happens when
 * an action needs an owner after a huddle?". The only answer they could give was to a different
 * question — the completion check, "What exactly will you say…" — stored in `response_text`
 * under a label that said REFLECTION. That answer was what established REFLECTED. Examining
 * current practice and committing to a sentence are different acts, and the ladder was recording
 * the second as evidence of the first.
 *
 * ═══ THE ACTIVATION AUTHORITY IS DISTINCTNESS, AND THE LIVE DATA IS WHY ═══
 *
 * The obvious rule — "the journey has a reflection ⇒ demand an answer" — is wrong, and staging
 * proves it. Of three published journey events, v1 (`07c9623e`) froze a reflection element whose
 * content is EXACTLY its own shared question. Under the naive rule that event would show a
 * second box asking a question the learner is already answering, and its one COMPLETED
 * participant would be sitting under a contract it never met. The rule implemented here asks for
 * an answer only when the reflection is genuinely a third question, so v1 never qualifies.
 *
 * Every input is frozen at publish. No event id, no title, no program, no date.
 */

const V1_SHARED = "In your own words, what is the most important standard from this training?";
const V3_REFLECT = "What usually happens when an action needs an owner after a huddle?";
const V3_FINISH = "What exactly will you say when you state the owner, action, and deadline for each agreed item?";

describe("[3.2R-R8B] U — which published events ask for a reflection", () => {
  it("v3 qualifies: a reflection distinct from BOTH other questions", () => {
    expect(requiredLearnerReflection(V3_REFLECT, V3_FINISH, V1_SHARED)).toBe(V3_REFLECT);
  });

  it("v1 does NOT qualify — its reflection IS its shared question", () => {
    /*
      MEASURED ON LIVE STAGING, not imagined. This single row is the reason the rule is
      distinctness and not presence. Getting it wrong would have asked one real learner the same
      question twice and put a completed record under a contract it never met.
    */
    expect(requiredLearnerReflection(V1_SHARED, "What specific phrases will you use in the next huddle?", V1_SHARED)).toBeNull();
  });

  it("a reflection identical to the completion prompt does not qualify either", () => {
    expect(requiredLearnerReflection(V3_FINISH, V3_FINISH, null)).toBeNull();
  });

  it("sameness is read the way a person reads it — case, spacing, surrounding blanks", () => {
    expect(requiredLearnerReflection(V3_REFLECT, null, `  ${V3_REFLECT.toUpperCase()}  `)).toBeNull();
    expect(requiredLearnerReflection(V3_REFLECT, null, V3_REFLECT.replace(/ /g, "   "))).toBeNull();
  });

  it("H/J — an event with no journey at all keeps its old contract exactly", () => {
    // 25 of 28 published modules on staging. Nothing is required, nothing is stored.
    expect(requiredLearnerReflection(null, "What is one thing you'll apply?", null)).toBeNull();
    expect(requiredLearnerReflection(undefined, undefined, undefined)).toBeNull();
    expect(requiredLearnerReflection("   ", "prompt", null)).toBeNull();
  });

  it("only a GROUNDED reflection element counts — never one still awaiting the Host", () => {
    const j = (status: string) =>
      ({
        version: 1,
        displayTitle: "t",
        displayTitleStatus: "grounded",
        elements: [{ id: "el_reflection", kind: "reflection", content: V3_REFLECT, grounding: [], confirmationStatus: status }],
      }) as unknown as RealityGroundedJourneyV1;
    expect(journeyReflection(j("grounded"))).toBe(V3_REFLECT);
    expect(journeyReflection(j("needs_confirmation")), "never shown ⇒ never owed").toBeNull();
  });
});

describe("[3.2R-R8B] B/G — the gate a completion has to pass", () => {
  it("B/G — a qualifying event REFUSES completion without a reflection", () => {
    for (const missing of [undefined, null, "", "   ", 42]) {
      const r = resolveReflectionResponse(V3_REFLECT, missing);
      expect(r.ok, JSON.stringify(missing)).toBe(false);
      if (!r.ok) expect(r.reason).toBe("reflection_required");
    }
  });

  it("a legacy event ignores the field entirely rather than storing a stray answer", () => {
    const r = resolveReflectionResponse(null, "something the client sent anyway");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value, "nothing to store when nothing was asked").toBeNull();
  });

  it("the answer is bounded and cleaned like every other learner answer", () => {
    const ok = validateReflectionResponse("  Nobody owns it,\nso it just drifts.  ");
    expect(ok.ok && ok.value).toBe("Nobody owns it,\nso it just drifts.");
    const long = validateReflectionResponse("a".repeat(1001));
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.reason).toBe("response_too_long");
  });
});

describe("[3.2R-R8B] C/D/E — what establishes REFLECTED, before and after", () => {
  it("C — on a new-contract row the reflection establishes it", () => {
    expect(reflectionEstablished({ newReflectionContract: true, learnerReflection: true, completionResponse: true })).toBe(true);
  });

  it("D — the completion-check answer alone does NOT, and that is the whole slice", () => {
    expect(reflectionEstablished({ newReflectionContract: true, learnerReflection: false, completionResponse: true })).toBe(false);
  });

  it("E — a shared answer is nowhere in this decision; it cannot establish anything", () => {
    // Shared Understanding is Host-visible understanding. It is not an input here by construction.
    expect(reflectionEstablished({ newReflectionContract: true, learnerReflection: false, completionResponse: false })).toBe(false);
  });

  it("J/K — a legacy row still reflects, and nothing about it is rewritten", () => {
    /*
      THE TEMPORAL BOUNDARY. 30 rows on staging carry a response_text; every one predates the
      split, and its answer means what its room asked. Reading them under the new contract would
      retroactively strip REFLECTED from people who did the work.
    */
    expect(reflectionEstablished({ newReflectionContract: false, learnerReflection: false, completionResponse: true })).toBe(true);
    expect(reflectionEstablished({ newReflectionContract: false, learnerReflection: false, completionResponse: false })).toBe(false);
  });

  it("and the ladder still refuses everything until the training is finished", () => {
    const facts = {
      completed: false,
      reflection: true,
      decision: false,
      practiceCompleted: false,
      appliedReported: false,
      independentlyObserved: false,
      sustained: false,
    };
    expect(establishedEvidence(facts)).toEqual([]);
    expect(establishedEvidence({ ...facts, completed: true })).toEqual(["exposed", "reflected"]);
  });
});
