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
  Stemmed with the EXISTING `nounStem`, so a host who wrote "our dispatchers" has authorized
  "the dispatcher" — measured: without it, that legitimate role was refused.
*/
function identityTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 2 && !STOP.has(t))
    .map((t) => nounStem(koreanStem(t)))
    .filter((t) => !STOP.has(t));
}

function sharesIdentity(candidate: string, source: string): boolean {
  const wanted = new Set(identityTokens(source));
  if (wanted.size === 0) return false;
  return identityTokens(candidate).some((t) => wanted.has(t));
}

export type RoleAuthorityResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "ungrounded_role" };

/**
 * WHO ESTABLISHES THAT IT HAPPENED — and who may not be invented to do so.
 *
 * THREE ROLES, KEPT APART. The learner is who the Host chose. A COUNTERPART is the other party
 * to the trained act itself. A CONFIRMER is whoever or whatever establishes completion. Authority
 * over one is not authority over another — and in particular the audience is authority over the
 * LEARNER only. `audienceType: leaders` says who is being trained; it does not appoint a team
 * lead to keep anyone's records.
 *
 * MEASURED ON THE CANONICAL FIXTURE. An earlier rule refused "the person taking over", which is
 * plainly legitimate — and the repository already says why, structurally: the trained action is
 * "states each open item aloud TO THE PERSON TAKING OVER". The confirmer is the direct object of
 * the behaviour. That is a relational counterpart, entailed by the act, and it needs no list of
 * job titles to recognise.
 *
 * So a confirmer is authorized when the SOURCE or the ACTION already contains them:
 *   1. the trained action names them — the counterpart case;
 *   2. the Host's own words name them — success evidence, completion prompt, problem, detail.
 * Nothing else. An audience cannot authorize a confirmer, and an agentless evidence sentence
 * ("the huddle note records…") never acquires a keeper.
 */
/**
 * A RELATION, NOT A TITLE. "the person taking over", "the next owner", "the receiving colleague"
 * describe someone by their position in the act itself; "the team lead", "the compliance officer"
 * name an office. That is the distinction this rule turns on, and it is why this is a list of
 * RELATIONS rather than of job titles — the thing §5 warns against building.
 *
 * MEASURED: the lexical-containment rule alone refused "the person taking over" against the
 * action "states each unfinished item and identifies its next owner" — the same counterpart,
 * named differently. A counterpart entailed by an act cannot be recognised by word overlap.
 */
const RELATIONAL_COUNTERPART =
  /\b(?:taking|takes|took|receiving|receives|recipient|incoming|oncoming|next|other|counterpart|opposite|following|picking up|picks up|handing|hands)\b|받는|인수/i;

/**
 * THE HEAD OF A ROLE PHRASE — what the phrase actually names.
 *
 * English and Korean are both head-final for this shape: "the records MANAGER", "the named
 * OWNER", "기록 관리자". So the identity is the last content word, stemmed with the existing
 * `nounStem`. Modifiers are deliberately ignored, because a modifier is exactly how an invented
 * office smuggles itself in on a source word that means something else.
 */
function roleHead(text: string): string | null {
  const tokens = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 0);
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const stem = nounStem(koreanStem(tokens[i]));
    if (stem.length > 2 && !STOP.has(stem)) return stem;
  }
  return null;
}

/** Is this exact identity present in the source, as its own word? */
function identityGrounded(head: string, source: string): boolean {
  return identityTokens(source).includes(head);
}

export function confirmerAuthorized(
  confirmedBy: string,
  observableAction: string,
  authority: AudienceAuthority | null,
  corpus: string,
): RoleAuthorityResult {
  const value = confirmedBy.trim();
  if (value.length === 0) return { ok: false, reason: "ungrounded_role" };

  /*
    AUTHORITY B — RELATIONAL COUNTERPART, checked first because it is not a role at all. Someone
    described by their place in the trained act ("the person taking over", "the next owner") is
    entailed by the behaviour rather than appointed beside it. Measured on this repository's
    canonical handover fixture, where the action hands the work to exactly that person.
  */
  if (RELATIONAL_COUNTERPART.test(value)) return { ok: true };

  /*
    AUTHORITIES A and C — a named person/role, or a grounded artifact. Both are decided on the
    phrase's HEAD, never on any word it happens to contain.

    THE FALSE POSITIVE THIS CLOSES. "the records manager" was accepted because `records` shares a
    stem with the host's own sentence — "The huddle note RECORDS one owner and one deadline" —
    where it is a VERB. The role being named is `manager`, and nothing in the source establishes
    one. A source verb must not be able to staff an organisation: "checks" cannot authorize "the
    checker", and "record" cannot authorize "the records supervisor".
  */
  const head = roleHead(value);
  if (head === null) return { ok: false, reason: "ungrounded_role" };
  if (identityGrounded(head, observableAction)) return { ok: true };
  if (identityGrounded(head, corpus)) return { ok: true };
  if (authority?.detail && identityGrounded(head, authority.detail)) return { ok: true };
  return { ok: false, reason: "ungrounded_role" };
}

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
