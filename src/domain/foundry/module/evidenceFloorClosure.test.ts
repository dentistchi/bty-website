import { describe, it, expect } from "vitest";
import { assertsOverclaimByPolicy, EVIDENCE_POLICY } from "./evidence-policy";

/**
 * SLICE 3.2P-A4-R3 — A FLOOR THAT CLAIMS TO BE DETERMINISTIC HAS TO BE.
 *
 * A4-R2 measured four semantic over-claims that the production predicate does not refuse, and
 * deliberately left them: that slice's authorized defect was the prompt. They are recorded here
 * as what they are — false negatives in a floor the server claims to enforce. Reflection
 * neutrality is prompt-enforced BY DESIGN and says so; evidence truth is not.
 *
 * THE CORPUS IS THE CONTRACT. Every widening below was chosen against this whole set, not
 * against the four sentences, because a rule tuned to four strings is four exceptions wearing a
 * regex. Labels are semantic: does this sentence ASSERT an outcome, a habit, a proof or a
 * readiness the program cannot show?
 */

/** UNSAFE — an assertion the program cannot support. */
const UNSAFE: [string, string][] = [
  // ── CAUSAL / CREATE ────────────────────────────────────────────────────────
  ["Manager reinforcement will create consistent follow-through.", "create"],
  ["This process will create better accountability.", "create"],
  ["The training creates reliable execution.", "create"],
  ["A policy change will create consistent handoffs.", "create"],
  // ── REDUCE / OUTCOME ───────────────────────────────────────────────────────
  ["This training will reduce missed handoffs.", "reduce"],
  ["The program reduces communication failures.", "reduce"],
  ["Training will reduce errors across the team.", "reduce"],
  ["This approach will reduce unfinished actions.", "reduce"],
  // ── HABITUAL ───────────────────────────────────────────────────────────────
  ["Participants will consistently assign an owner.", "habit"],
  ["Learners will always assign deadlines.", "habit"],
  ["The team will routinely assign responsibility.", "habit"],
  ["After training, participants assign owners consistently.", "habit"],
  // ── MASTERY ────────────────────────────────────────────────────────────────
  ["Mastering Accountability in Every Meeting", "mastery"],
  ["Mastering Consistent Handoffs", "mastery"],
  ["Participants will master this behavior.", "mastery"],
  ["This program builds mastery of the standard.", "mastery"],
  // ── A4-R2's fourteen, carried forward verbatim ─────────────────────────────
  ["A policy change will improve communication.", "outcome"],
  ["A shared workflow ensures accountability across shifts.", "outcome"],
  ["This leads to better outcomes for the team.", "outcome"],
  ["The team now reliably follows the standard.", "habit"],
  ["This produces sustained change in how the team works.", "habit"],
  ["Participants are ready to implement the standard.", "readiness"],
  ["Learners are equipped to handle this independently.", "readiness"],
  ["Participants now fully understand the standard.", "readiness"],
  ["This program guarantees every action has an owner.", "guarantee"],
  ["Completing the training guarantees consistent follow-up.", "guarantee"],
  ["The follow-up confirms sustained adoption.", "proof"],
  ["This demonstrates improvement in how items are closed.", "proof"],
  ["Participants are equipped to apply the standard afterwards.", "readiness"],
  ["The team consistently performs the agreed follow-up.", "habit"],
];

/**
 * SAFE — an instruction, a practice step, a limitation, or a denial.
 *
 * THE POINT OF THE WIDENING IS THAT THESE STILL PASS. "create", "reduce", "assign" and
 * "mastering" are ordinary words; the rules must keep depending on the claim SHAPE, not on the
 * vocabulary. Several of these are here because they are the nearest safe neighbour of a
 * sentence three lines above them.
 */
const SAFE: [string, string][] = [
  // ── CREATE, as an action or a denial ───────────────────────────────────────
  ["Create a checklist for the huddle.", "create-action"],
  ["Participants create an action note during practice.", "create-action"],
  ["The exercise asks learners to create a draft.", "create-action"],
  ["Creating a checklist is outside the scope of this training.", "create-limitation"],
  ["The program does not create evidence that behavior changed.", "create-denial"],
  ["Agree on the required fields and create a shared handoff record.", "create-future-action"],
  // ── REDUCE, as an instruction or an unknown ────────────────────────────────
  ["Reduce the list to three items during the exercise.", "reduce-action"],
  ["Ask learners to reduce the draft to one sentence.", "reduce-action"],
  ["Training alone cannot reduce staffing shortages.", "reduce-limitation"],
  ["Whether missed handoffs are reduced must be observed later.", "reduce-unknown"],
  ["The program does not prove that errors were reduced.", "reduce-denial"],
  // ── ASSIGN, as practice or an unknown ──────────────────────────────────────
  ["Practice how to assign an owner.", "assign-practice"],
  ["Ask participants to assign an owner in the scenario.", "assign-practice"],
  ["The learner decides whom to assign during practice.", "assign-practice"],
  ["The program does not show that participants consistently assign owners.", "assign-denial"],
  ["Whether owners are assigned consistently must be observed later.", "assign-unknown"],
  ["Leaders have the authority to assign owners.", "assign-assumption"],
  // ── MASTERY, denied or irrelevant ──────────────────────────────────────────
  ["Practicing Accountability in Meetings", "title-practice"],
  ["Accountability Practice", "title-practice"],
  ["Learning to Name an Owner and Deadline", "title-practice"],
  ["Mastery is not established by this training.", "mastery-denial"],
  ["The program does not show that the skill was mastered.", "mastery-denial"],
  ["Mastering the scheduling software is not required for this exercise.", "mastery-irrelevant"],
  ["Use the master checklist during practice.", "master-noun"],
  // ── A4-R2's fifteen, carried forward verbatim ──────────────────────────────
  ["Training alone cannot ensure consistency.", "limitation"],
  ["Training alone will not fix a staffing shortage.", "limitation"],
  ["A shared workflow may also be needed.", "condition"],
  ["Staffing coverage may need to be addressed separately.", "condition"],
  ["Access to the scheduling system is outside this training's control.", "condition"],
  ["This training does not establish whether the behavior was used in practice.", "unknown"],
  ["Nothing here shows what happens after the session.", "unknown"],
  ["Participants are able to attend the session.", "assumption-neutral"],
  ["There is time in the meeting to confirm each item.", "assumption-neutral"],
  ["Naming an Owner for Every Agreed Action", "title-capability"],
  ["Closing the Loop on Reported Problems", "title-problem"],
  ["What to say when nobody volunteers", "title-problem"],
  ["This training does not replace a written escalation policy.", "warning-limitation"],
  ["Whether the standard is used at all is reviewed later, not here.", "warning-limitation"],
];

const refuses = (t: string) => assertsOverclaimByPolicy(t) !== null;

describe("[3.2P-A4-R3] the evidence floor, measured whole", () => {
  it("every over-claim in the corpus is refused", () => {
    const fn = UNSAFE.filter(([t]) => !refuses(t));
    const tp = UNSAFE.length - fn.length;
    for (const [t, g] of fn) console.log(`  FN (${g}) ${JSON.stringify(t)}`);
    console.log(`UNSAFE tp=${tp} fn=${fn.length} of ${UNSAFE.length}  recall=${(tp / UNSAFE.length).toFixed(3)}`);
    expect(fn.map(([t]) => t), "false negative — a claim the floor lets through").toEqual([]);
  });

  it("and no instruction, practice step, limitation or denial is refused", () => {
    /*
      THE WHOLE RISK OF WIDENING, in one assertion. "create", "reduce", "assign" and "mastering"
      appear throughout honest training prose. If a widening reads vocabulary instead of claim
      shape, this fails before anything ships.
    */
    const fp = SAFE.filter(([t]) => refuses(t));
    for (const [t, g] of fp) console.log(`  FP (${g}) ${assertsOverclaimByPolicy(t)!.id} ${JSON.stringify(t)}`);
    console.log(`SAFE tn=${SAFE.length - fp.length} fp=${fp.length} of ${SAFE.length}`);
    expect(fp.map(([t]) => t), "false positive — honest prose refused").toEqual([]);
  });

  it("precision and recall over the whole corpus", () => {
    const tp = UNSAFE.filter(([t]) => refuses(t)).length;
    const fp = SAFE.filter(([t]) => refuses(t)).length;
    const fn = UNSAFE.length - tp;
    const tn = SAFE.length - fp;
    console.log(`CORPUS tp=${tp} fp=${fp} fn=${fn} tn=${tn} precision=${(tp / (tp + fp)).toFixed(3)} recall=${(tp / (tp + fn)).toFixed(3)}`);
    expect(tp / (tp + fp)).toBe(1);
    expect(tp / (tp + fn)).toBe(1);
  });
});

describe("[3.2P-A4-R3] the guards that make the widening safe", () => {
  it("negation still exempts a denial, whichever side it sits on", () => {
    for (const t of [
      "The program does not create evidence that behavior changed.",
      "Training alone cannot reduce staffing shortages.",
      "The program does not show that participants consistently assign owners.",
      "Mastery is not established by this training.",
      "Mastering the scheduling software is not required for this exercise.",
    ]) {
      expect(refuses(t), t).toBe(false);
    }
  });

  it("the prospective frame still exempts a question about what is unknown", () => {
    for (const t of [
      "Whether missed handoffs are reduced must be observed later.",
      "Whether owners are assigned consistently must be observed later.",
      "Whether the standard is used at all is reviewed later, not here.",
    ]) {
      expect(refuses(t), t).toBe(false);
    }
  });

  it("a denial is never turned into an assertion — the backward guard is unchanged", () => {
    /*
      A trailing negator must NOT exempt a sentence that asserts first and qualifies after.
      "This ensures consistency, not confusion." is an assertion; if a forward-looking guard
      ever applies to a causal rule, this is where it shows up as a false negative.
    */
    expect(refuses("This ensures consistency, not confusion."), "assertion qualified afterwards").toBe(true);
    expect(refuses("Participants are now competent, not merely aware.")).toBe(true);
  });
});

describe("[3.2P-A4-R3] one policy, unforked", () => {
  it("every rule still carries a promptLine, a sample pair and a family", () => {
    const families = new Set(EVIDENCE_POLICY.map((r) => r.family));
    for (const r of EVIDENCE_POLICY) {
      expect(r.promptLine.length, r.id).toBeGreaterThan(0);
      expect(assertsOverclaimByPolicy(r.forbiddenSample)?.id, `${r.id} sample not refused`).toBeTruthy();
      expect(assertsOverclaimByPolicy(r.legalRewrite), `${r.id} rewrite refused`).toBeNull();
    }
    // No new family was invented: the five ways of over-claiming are unchanged.
    expect([...families].sort()).toEqual(["guarantee", "habit", "outcome", "proof", "readiness"]);
  });
});
