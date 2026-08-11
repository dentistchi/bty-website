import { AUDIENCE_TYPES_NEEDING_DETAIL, type AudienceType, type BuilderAnswers } from "./module-builder";
import { nounStem } from "./program-coherence";

/**
 * WHO THIS TRAINING IS FOR IS THE HOST'S DECISION (Slice 3.2P-R3.2).
 *
 * THE LIVE DEFECT. W3 generated successfully for a draft whose Host audience is `leaders`, and
 * the accepted behaviour contract read `actor: "a team member"` with
 * `completion.confirmed_by: "the team lead"`. Neither traces to anything the Host wrote: the
 * source names "team members" only as the people who REPORT problems and leave without naming
 * an owner — the population the training is ABOUT, not the population it is FOR — and "team
 * lead" appears nowhere at all. The Host's own evidence sentence is agentless: "The huddle note
 * records one owner and one deadline for every agreed action." Nobody is named as the recorder.
 *
 * WHY IT PASSED. `audienceType` reached the PROMPT ("Who needs to change: leaders") and stopped
 * there. It is not in `groundingCorpus`, and `validateBehaviorContract` checks the actor only
 * for shape — length, and that it is not an artifact or construct head. So the two fields that
 * decide who a program is about were the only participant-facing values with no source
 * authority behind them, and one invented word propagated into all four derived instructional
 * sections, because every one of them renders from this contract.
 *
 * WHAT THIS IS NOT. It is not a lexicon of this pilot. `leaders`, `team member`, `team lead`
 * and `huddle` appear nowhere below. It is a policy table over the audience ENUM — the same
 * shape `SCENARIO_PRESSURE_POLICY` uses — so the prompt and the validator read one authority
 * and cannot drift apart, and so a future training with any audience is covered.
 *
 * WHY THE ACTOR IS NOT SERVER-DERIVED. Measured before designing: deriving it from the enum
 * would render "leaders must name one owner and one deadline", losing every legitimate
 * specialization the Host's own words support — "the huddle leader", "the outgoing team
 * member", "the charge nurse". Four audience types, two of which carry only free-text detail
 * ("Admin", "Assistant", "Marketing team", "Doctor group A" are the real values on staging),
 * cannot produce a grammatical participant-facing actor on their own. So the model keeps the
 * field and the field acquires an authority it must satisfy.
 */

/** What the model is told about the audience. One entry per `AudienceType`; no pilot terms. */
export type AudiencePolicy = {
  readonly id: AudienceType;
  readonly promptLine: string;
};

export const AUDIENCE_POLICY: readonly AudiencePolicy[] = [
  { id: "everyone", promptLine: "everyone in the organisation" },
  { id: "leaders", promptLine: "the people who lead" },
  { id: "job_group", promptLine: "one specific job group" },
  { id: "specific_role", promptLine: "one specific role" },
];

export type AudienceAuthority = {
  readonly type: AudienceType;
  /** The Host's free-text group/role, for the two types that carry one. */
  readonly detail: string | null;
  readonly policy: AudiencePolicy;
};

export function audienceAuthorityFor(answers: BuilderAnswers | undefined): AudienceAuthority | null {
  const type = answers?.audienceType;
  if (!type) return null;
  const policy = AUDIENCE_POLICY.find((p) => p.id === type);
  if (!policy) return null;
  const needsDetail = (AUDIENCE_TYPES_NEEDING_DETAIL as readonly string[]).includes(type);
  const detail = needsDetail ? (answers?.audienceDetail ?? "").trim() : "";
  return { type, detail: detail.length > 0 ? detail : null, policy };
}

/** Words worth matching on: short function words carry no identity. */
const STOP = new Set([
  "the", "a", "an", "of", "and", "or", "in", "on", "at", "to", "for", "by", "with", "each",
  "every", "any", "all", "who", "that", "this", "their", "our", "your", "its", "his", "her",
  "they", "them", "one", "two", "person", "people", "staff", "member", "members", "team", "teams",
  "group", "groups", "role", "roles", "someone", "anyone", "everyone", "individual", "worker",
  "workers", "employee", "employees", "colleague", "colleagues",
]);

/**
 * Korean marks a noun's grammatical role with a trailing particle, so the same word appears as
 * `담당자`, `담당자를`, `담당자가`. Identity has to see through that the way `nounStem` sees through
 * an English plural — measured: without it, a Korean role the host explicitly named was refused
 * because the source wrote it with an object particle.
 *
 * Deliberately a closed list of particles and only on a word long enough to survive the strip.
 */
const KOREAN_PARTICLES = ["으로", "에서", "에게", "이란", "라는", "를", "을", "이", "가", "은", "는", "의", "에", "와", "과", "도", "로", "만"];

function koreanStem(token: string): string {
  if (!/[\uac00-\ud7a3]/.test(token)) return token;
  for (const particle of KOREAN_PARTICLES) {
    if (token.length > particle.length + 1 && token.endsWith(particle)) return token.slice(0, -particle.length);
  }
  return token;
}

/*
  CONFIRMER AUTHORITY RETIRED AT v11 (Slice 3.2P-R3.4-R1).

  `confirmerAuthorized` lived here from R3.2-R2 to v10, with three gates — relational
  counterpart, role-head grounding, corpus/detail — and it did its job: it refused W4's
  invented "records manager" and it was narrowed twice by real false positives before it
  earned that. It is removed rather than kept, because it validated a field that no longer
  exists. An unreachable validator is worse than no validator: it reads as protection.

  The invention it caught is now structurally impossible — the provider schema has no
  completion field, and completion comes from the host's own words. Its diagnostic reason
  `confirmer_unauthorized` stays in the ledger vocabulary for the W4 row that carries it.

  What survives here is what the PROMPT still needs: who the training is for.
*/

/** The prompt's audience section, derived from the same policy the validator consults. */
export function audiencePromptLines(authority: AudienceAuthority | null): string[] {
  const who = !authority
    ? "the people the host selected"
    : authority.detail
      ? `${authority.policy.promptLine} — the host named: ${authority.detail}`
      : authority.policy.promptLine;
  return [
    "WHO THE TRAINING IS FOR:",
    `- The host decided this, not you: ${who}.`,
    "- BTY writes the participant-facing subject itself, in the second person, so behavior_contract.actor is NOT displayed. Return a plain actor anyway; do not try to redefine who the training is for through it.",
    "- If the host's problem describes a group that is FAILING to do something, that group is what the training is ABOUT. It is not automatically who the training is FOR.",
    "- completion.confirmed_by must be someone the trained action itself involves, or someone the host's own words name. Do NOT appoint a manager, lead or reviewer the host never mentioned.",
    "- If the host's evidence sentence names no one — 'the record shows X' — leave it that way.",
  ];
}
