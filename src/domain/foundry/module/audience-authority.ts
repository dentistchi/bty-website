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

/** How an audience authorizes an actor. One entry per `AudienceType`; no pilot-specific terms. */
export type AudiencePolicy = {
  readonly id: AudienceType;
  /** What the model is told about who the training is for. Consumed by the prompt builder. */
  readonly promptLine: string;
  /** A legal actor for this audience — used by the parity test, never by the validator. */
  readonly example: string;
  /**
   * Words this audience's own MEANING authorizes, beyond the Host's free text. Empty when the
   * audience carries no inherent vocabulary — then only the Host's own words can authorize.
   */
  readonly vocabulary: readonly string[];
  /** True when this audience accepts any human role, because the Host named no narrower one. */
  readonly openToAnyRole: boolean;
};

export const AUDIENCE_POLICY: readonly AudiencePolicy[] = [
  {
    id: "everyone",
    promptLine: "everyone in the organisation — any role may be the actor, because the host named no narrower group",
    example: "each person on the team",
    vocabulary: [],
    openToAnyRole: true,
  },
  {
    id: "leaders",
    promptLine:
      "the people who LEAD — the actor must be a leading or supervising role, not the people they lead",
    example: "the shift supervisor",
    /*
      The enum's own meaning, in the words English actually uses for it. Deliberately about
      leading rather than about any particular workplace: a clinic, a warehouse and a software
      team all name this role differently, and all of them are here.
    */
    vocabulary: [
      "leader", "leaders", "lead", "leads", "leading",
      "manager", "managers", "management", "supervisor", "supervisors", "supervising",
      "head", "heads", "chief", "director", "directors", "principal",
      "owner", "owners", "captain", "coordinator", "coordinators",
      "foreman", "charge", "senior", "in charge", "team lead", "teamlead",
      "boss", "chair", "chairs", "facilitator", "facilitators", "host", "hosts",
      "리더", "관리자", "책임자", "팀장", "매니저",
    ],
    openToAnyRole: false,
  },
  {
    id: "job_group",
    promptLine: "the specific job group the host named — the actor must be that group, not another one",
    example: "the named job group",
    vocabulary: [],
    openToAnyRole: false,
  },
  {
    id: "specific_role",
    promptLine: "the specific role the host named — the actor must be that role, not another one",
    example: "the named role",
    vocabulary: [],
    openToAnyRole: false,
  },
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

/*
  Stemmed with the EXISTING `nounStem`, because a Host who wrote "our dispatchers" has plainly
  authorized "the dispatcher" — measured: without it, that legitimate actor was refused.
*/
function identityTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 2 && !STOP.has(t))
    .map((t) => nounStem(t))
    .filter((t) => !STOP.has(t));
}

/**
 * IDENTITY, NOT SUBSTRING. "team", "member", "staff" and "people" are stripped as stop words
 * precisely because they are the vocabulary of ANY workplace sentence — matching on them is
 * how "a team member" would have slipped through a naive corpus check, since the Host's problem
 * statement contains those exact words while describing a different population entirely.
 */
function sharesIdentity(actor: string, source: string): boolean {
  const wanted = new Set(identityTokens(source));
  if (wanted.size === 0) return false;
  return identityTokens(actor).some((t) => wanted.has(t));
}

export type RoleAuthorityResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "audience_mismatch" | "ungrounded_role" };

/**
 * May this actor speak for this Host's audience?
 *
 * Three ways to be authorized, in order of authority:
 *   1. the audience accepts any role (`everyone`) — the Host said so;
 *   2. the audience's own meaning covers it (`leaders` + a leading word);
 *   3. the Host's own words cover it — the audience detail, or anything they wrote.
 *
 * `corpus` is the existing grounding corpus, so a Host who names a role anywhere in their own
 * answers has already authorized it. Nothing new is invented to hold this rule.
 */
export function actorAuthorized(
  actor: string,
  authority: AudienceAuthority | null,
  corpus: string,
): RoleAuthorityResult {
  const value = actor.trim();
  if (value.length === 0) return { ok: false, reason: "ungrounded_role" };
  // No audience recorded at all — the Builder gates on it, so this is defence in depth only.
  if (!authority) return { ok: true };

  if (authority.policy.openToAnyRole) return { ok: true };

  const inVocabulary = authority.policy.vocabulary.some((w) =>
    w.includes(" ") ? value.toLowerCase().includes(w) : identityTokens(value).includes(w) || value.toLowerCase().includes(w),
  );
  if (inVocabulary) return { ok: true };

  if (authority.detail && sharesIdentity(value, authority.detail)) return { ok: true };
  if (sharesIdentity(value, corpus)) return { ok: true };

  /*
    A detail-bearing audience names its population explicitly, so failing to match it is a
    different fault from failing to look like a leader — the diagnosis says which.
  */
  return { ok: false, reason: authority.detail ? "audience_mismatch" : "audience_mismatch" };
}

/**
 * May this person or role be named as the one who CONFIRMS?
 *
 * Deliberately NOT "must equal the actor": a read-back by the person receiving the handover is
 * the most honest confirmation there is, and that person is not the learner. What it may not be
 * is a NEW responsibility-bearing role the source never named — the W3 defect, where an
 * agentless evidence sentence ("the huddle note records…") acquired an invented recorder.
 *
 * Authorized when the Host's own words name them, or when the audience's meaning covers them.
 * An artifact can never reach here: `validateBehaviorContract` already refuses an artifact or
 * construct head as the confirmer, and that rule is left exactly as it was.
 */
export function confirmerAuthorized(
  confirmedBy: string,
  authority: AudienceAuthority | null,
  corpus: string,
): RoleAuthorityResult {
  const value = confirmedBy.trim();
  if (value.length === 0) return { ok: false, reason: "ungrounded_role" };

  /*
    DELIBERATELY NARROWER THAN THE ACTOR RULE, and the narrowing is measured rather than
    cautious. The first version required every confirmer to be grounded in the host's own words,
    and it refused "the person taking over" — the confirmer in this repository's canonical
    fixture, and a perfectly honest one: the other party to a handover is not a role anybody
    invented. Forty-four existing assertions said so.

    So the rule applies only where the host named EXACTLY who the training is for — `job_group`
    and `specific_role` carry a free-text population, and a confirmer from outside it is a
    substitution rather than a counterpart. For `everyone` and `leaders` the host named a broad
    population, and a generic counterpart ("the person taking over", "the recipient") stays
    legal; those audiences are governed by the ACTOR rule, which is where W3's defect lived.
  */
  if (!authority?.detail) return { ok: true };
  if (sharesIdentity(value, authority.detail)) return { ok: true };
  if (sharesIdentity(value, corpus)) return { ok: true };
  return { ok: false, reason: "ungrounded_role" };
}

/** The prompt's audience section, derived from the same policy the validator uses. */
export function audiencePromptLines(authority: AudienceAuthority | null): string[] {
  if (!authority) return [];
  const who = authority.detail
    ? `${authority.policy.promptLine} — the host named: ${authority.detail}`
    : authority.policy.promptLine;
  return [
    "WHO THE TRAINING IS FOR — behavior_contract.actor:",
    `- The host decided this, not you: ${who}.`,
    "- Do NOT substitute a different population. If the host's problem describes a group that is FAILING to do something, that group is what the training is ABOUT — it is not automatically who the training is FOR.",
    "- completion.confirmed_by must be a person or role the host's own words name, or one this audience covers. Do NOT invent a new responsible person.",
    "- If the host's evidence sentence names no one — 'the record shows X' — leave it that way. Do not appoint someone to keep it.",
  ];
}
