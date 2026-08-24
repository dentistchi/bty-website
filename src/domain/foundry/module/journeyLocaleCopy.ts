import type { Confirmer, PressureFrame, ResponseMode, ReviewFocus, VerificationTarget } from "./program-coherence";

/**
 * THE SENTENCE FRAMES BTY WRITES ITSELF, IN BOTH LANGUAGES (Slice R4-R5C13).
 *
 * WHAT THIS REPLACES, and why the old note was honest but no longer sufficient.
 * `composeObservableAction` recorded the limitation in plain words: "a Korean program renders
 * Korean content inside English sentence frames", and refused to hide it behind a locale-aware
 * join that would have implied Korean support the surrounding sentences did not have. That was
 * the right call at the time.
 *
 * R4-R5C11 changed the arithmetic. Before it, YOUR DECISION, APPLY IT, BEFORE YOU FINISH and
 * WHAT HAPPENS NEXT all interpolated the Host's own action phrase, so a Korean program read as
 * Korean content in an English frame — bad, but recognisably the Host's training. C11 removed
 * the behaviour clause from all four, which was right for repetition and turned those four
 * sections into ONE HUNDRED PERCENT BTY-authored English. A Korean Host generating a Korean
 * program now gets four sections with no Korean in them at all, and adopting freezes exactly
 * those characters into `realityGroundedJourneyV1`, the published snapshot and the learner's
 * screen — `JourneyReading` localizes section LABELS and never content.
 *
 * So the limitation stopped being a rough edge and became a learner-facing defect, and this is
 * the repair: one typed table, both languages, consumed by the same semantic renderers. There
 * is no second locale system — the domain layer had none at all, and `moduleBuilderCopy` lives
 * in the components layer where domain code may not reach.
 *
 * WHAT IS AND IS NOT TRANSLATED. Only BTY's own scaffolding. Every Host and model string —
 * trigger, actor, observable action, completion criterion, problem statement, construct label,
 * the Host's own completion question — is interpolated verbatim in whatever language it was
 * written. Nothing here reads Host prose, and nothing here can rewrite it.
 *
 * KOREAN THAT AVOIDS GUESSING. Korean subject and object particles agree with the final
 * consonant of the noun they attach to, and the nouns here are arbitrary Host phrases. Rather
 * than compute morphology or emit "을(를)", the Korean frames are built so no particle ever
 * lands on a Host string: apposition after the actor, `입니다` after a construct label, and a
 * pressure clause that already ends in `때`. That is a deliberate constraint on the wording,
 * not an accident of it.
 */
export type JourneyLocale = "en" | "ko";

export type JourneyCopy = {
  /** THE STANDARD — the one full behaviour instruction. */
  standard: (trigger: string, actor: string, action: string) => string;
  /** The Host's completion criterion, labelled. Rendered by THE STANDARD only (C11). */
  completionEvidence: (criterion: string) => string;
  /** IN CONTEXT — the moment and the pressure, pointing at the standard rather than repeating it. */
  scenario: (trigger: string, pressureClause: string) => string;
  pressure: Record<PressureFrame, string>;
  /** YOUR DECISION — asks; never pre-writes a commitment (C11). */
  decision: string;
  /** APPLY IT — the next real occasion, plus an optional construct clause. */
  application: (constructClause: string) => string;
  constructClause: (label: string) => string;
  /** WHY THIS MATTERS — the Host's problem and what the program introduces. Consequence only. */
  rationale: (problem: string, introduces: string) => string;
  introducesConstruct: (noun: string) => string;
  introducesDefault: string;
  /** BEFORE YOU FINISH — used only when the Host wrote no question of their own. */
  /** The whole "name the moment" question — the join differs, so it is not composed by the caller. */
  completionNameTheMoment: (ask: string) => string;
  completionAsk: Record<VerificationTarget, string>;
  completionTarget: Record<VerificationTarget, string>;
  completionMode: Record<Exclude<ResponseMode, "name_the_moment">, (target: string) => string>;
  /** WHAT HAPPENS NEXT — when BTY will ask and what kind of answer it is. No behaviour clause. */
  followUp: (days: number, focus: string, by: string) => string;
  followUpFocus: Record<ReviewFocus, string>;
  followUpBy: Record<Confirmer, string>;
};

const upperFirst = (s: string) => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1));
const lowerFirst = (s: string) => (s.length === 0 ? s : s[0].toLowerCase() + s.slice(1));

/** English — the exact strings R4-R5C11 shipped. Semantically frozen; see the EN regression tests. */
const EN: JourneyCopy = {
  standard: (trigger, actor, action) => `${upperFirst(trigger)}, ${lowerFirst(actor)} must ${action}.`,
  completionEvidence: (criterion) => `Completion evidence: ${upperFirst(criterion)}.`,
  scenario: (trigger, pressure) => `${upperFirst(trigger)}, when ${pressure}, this is easiest to skip.`,
  pressure: {
    time_is_short: "time is running short",
    others_are_waiting: "someone else is already waiting",
    interruptions: "the conversation keeps being interrupted",
    attention_is_elsewhere: "attention is somewhere else",
    too_much_at_once: "several things need attention at once",
    pushback: "someone pushes back",
    fatigue: "everyone is tired",
    someone_is_missing: "the person you would usually rely on is not there",
    unclear_information: "something important is still unclear",
    unclear_ownership: "it is not obvious who should take it",
    being_watched: "other people are watching",
    nobody_steps_up: "nobody offers to take it",
  },
  decision: "The next time this happens, what will you do differently?",
  application: (constructClause) => `The next time this happens is the first real chance to try it for yourself.${constructClause}`,
  constructClause: (label) => ` This is ${label} in practice.`,
  rationale: (problem, introduces) => `${upperFirst(problem)}. This program introduces ${introduces} for exactly that.`,
  introducesConstruct: (noun) => `one shared ${noun}`,
  introducesDefault: "one visible way of working",
  completionNameTheMoment: (ask) => `The next time this happens, ${ask}?`,
  completionAsk: {
    the_behaviour: "what exactly will you do",
    the_application_plan: "how will you fit this into what you are already doing",
    the_confirmation_step: "how will you make sure it gets confirmed",
  },
  completionTarget: {
    the_behaviour: "you are in that situation",
    the_application_plan: "you apply this",
    the_confirmation_step: "you make sure this is completed",
  },
  completionMode: {
    state_what_you_will_say: (t) => `What exactly will you say when ${t}?`,
    name_what_could_stop_you: (t) => `What could stop you when ${t}?`,
  },
  followUp: (days, focus, by) => `In ${days} days you will be asked ${focus}. ${by}`,
  followUpFocus: {
    what_you_said: "what you actually said at that moment",
    what_happened_next: "what happened when you tried it",
    the_confirmation: "whether it was completed",
  },
  followUpBy: {
    self_report: "That is your own account of it, not an observation.",
    the_host: "Your host will read it with you.",
  },
};

/**
 * Korean. Same cognitive job per section, written as Korean rather than translated from the
 * English word by word — and built so no particle ever attaches to a Host-written noun.
 */
const KO: JourneyCopy = {
  // Apposition after the actor: `팀 리더 — 확인한다`. A subject particle here would have to
  // agree with a Host noun this code cannot analyse, and "이(가)" reads like a form, not training.
  standard: (trigger, actor, action) => `${trigger}, ${actor} — ${action}.`,
  completionEvidence: (criterion) => `완료 증거: ${criterion}.`,
  // Every pressure clause already ends in `때`, so the frame needs no connective of its own.
  scenario: (trigger, pressure) => `${trigger}, ${pressure} 가장 놓치기 쉽습니다.`,
  pressure: {
    time_is_short: "시간이 촉박할 때",
    others_are_waiting: "다른 사람이 이미 기다리고 있을 때",
    interruptions: "대화가 자꾸 끊길 때",
    attention_is_elsewhere: "주의가 다른 곳에 가 있을 때",
    too_much_at_once: "여러 일이 한꺼번에 몰릴 때",
    pushback: "누군가 반발할 때",
    fatigue: "모두 지쳐 있을 때",
    someone_is_missing: "평소 맡던 사람이 자리에 없을 때",
    unclear_information: "중요한 정보가 아직 불분명할 때",
    unclear_ownership: "누가 맡아야 할지 분명하지 않을 때",
    being_watched: "다른 사람들이 지켜보고 있을 때",
    nobody_steps_up: "아무도 나서지 않을 때",
  },
  decision: "다음에 이런 상황이 생기면 무엇을 다르게 해보겠습니까?",
  application: (constructClause) => `다음에 이런 상황이 생기는 것이 실제로 해볼 첫 기회입니다.${constructClause}`,
  // `입니다` attaches to any noun without agreement, so the Host's construct label is safe here.
  constructClause: (label) => ` 이것이 실제 업무에서의 ${label}입니다.`,
  // "What this program offers for that problem is X" — states the consequence, never the behaviour.
  rationale: (problem, introduces) => `${problem}. 이 프로그램이 그 문제에 대해 내놓는 것은 ${introduces}입니다.`,
  introducesConstruct: (noun) => `하나의 공통된 ${noun}`,
  introducesDefault: "눈에 보이는 하나의 일하는 방식",
  // Korean takes no comma after the conditional "…면", so the join lives with the language.
  completionNameTheMoment: (ask) => `다음에 이런 상황이 생기면 ${ask}?`,
  completionAsk: {
    the_behaviour: "정확히 무엇을 하시겠습니까",
    the_application_plan: "지금 하고 있는 일에 이것을 어떻게 넣으시겠습니까",
    the_confirmation_step: "확인까지 마치도록 어떻게 하시겠습니까",
  },
  completionTarget: {
    the_behaviour: "그런 상황이 되었을 때",
    the_application_plan: "이것을 실제로 적용할 때",
    the_confirmation_step: "완료를 확인할 때",
  },
  completionMode: {
    state_what_you_will_say: (t) => `${t} 정확히 어떤 말을 하시겠습니까?`,
    name_what_could_stop_you: (t) => `${t} 무엇이 방해가 될 수 있습니까?`,
  },
  followUp: (days, focus, by) => `${days}일 후, ${focus}. ${by}`,
  followUpFocus: {
    what_you_said: "그 순간에 실제로 어떤 말을 했는지 다시 묻겠습니다",
    what_happened_next: "실제로 해봤을 때 어떻게 되었는지 다시 묻겠습니다",
    the_confirmation: "완료되었는지 다시 묻겠습니다",
  },
  followUpBy: {
    self_report: "이것은 본인의 경험에 대한 답이며, 다른 사람의 관찰은 아닙니다.",
    the_host: "담당자가 함께 읽습니다.",
  },
};

/** The one lookup. A locale this table does not know renders English rather than guessing. */
export function journeyCopy(locale: JourneyLocale | undefined): JourneyCopy {
  return locale === "ko" ? KO : EN;
}

/** For the parity tests: both tables, keyed, so a key added to one and not the other fails. */
export const JOURNEY_COPY_TABLES: Record<JourneyLocale, JourneyCopy> = { en: EN, ko: KO };
