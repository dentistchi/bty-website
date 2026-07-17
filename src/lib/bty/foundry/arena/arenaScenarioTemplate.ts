import type { ArenaScenarioDraft, GuidedAnswers, HardestWhenOption } from "@/domain/foundry/arena-draft/types";
import type { ModuleSourceFacts } from "./arenaScenarioSource";

/**
 * Foundry Guided Arena Builder — deterministic scenario template (service).
 *
 * The provider-free guarantee: when the LLM is unavailable, times out, or returns
 * output the validator rejects, this renders a COMPLETE, valid three-phase draft
 * from the same grounding (module facts + the two guided answers). It always
 * satisfies `validateArenaScenarioDraft`. Display strings live here (service),
 * never in domain. Localized (en/ko).
 *
 * This is honest scaffolding, not authored content — the host edits every line in
 * the editor. It exists so a provider failure never blocks or destroys the flow.
 */

export type Locale = "en" | "ko";

export type ScenarioGenInput = {
  locale: Locale;
  facts: ModuleSourceFacts;
  guided: GuidedAnswers;
};

// ---------------------------------------------------------------------------
// Localized guided-answer phrasing (also used to ground the LLM prompt)
// ---------------------------------------------------------------------------

const HARDEST_PHRASE: Record<Locale, Record<HardestWhenOption, string>> = {
  en: {
    time_limited: "when time is limited",
    other_resists: "when the other person resists",
    performance_pressure: "when performance or cost pressure is high",
    authority_unclear: "when authority is unclear",
    other: "in that moment",
  },
  ko: {
    time_limited: "시간이 부족할 때",
    other_resists: "상대가 반발할 때",
    performance_pressure: "성과나 비용 압박이 클 때",
    authority_unclear: "권한이 불분명할 때",
    other: "그 순간",
  },
};

/** The human phrase for the chosen Q1 option (custom text wins for "other"). */
export function hardestWhenPhrase(guided: GuidedAnswers, locale: Locale): string {
  const { choice, customText } = guided.hardestWhen;
  if (choice === "other" && customText) return customText;
  return HARDEST_PHRASE[locale][choice];
}

// ---------------------------------------------------------------------------
// Deterministic template
// ---------------------------------------------------------------------------

function behaviorPhrase(facts: ModuleSourceFacts, locale: Locale): string {
  if (facts.observableBehavior) return facts.observableBehavior;
  if (facts.problem) return facts.problem;
  return locale === "ko" ? "기대되는 행동을 실제로 하는 것" : "doing the expected behavior";
}

/**
 * Build a complete, valid draft deterministically. Stable choice ids, at least one
 * action commitment, and one deferral option. Pure w.r.t. its inputs.
 */
export function buildTemplateScenarioDraft(input: ScenarioGenInput): ArenaScenarioDraft {
  const { locale, facts, guided } = input;
  const hard = hardestWhenPhrase(guided, locale);
  const pressure = guided.avoidancePressure.text;
  const behavior = behaviorPhrase(facts, locale);

  if (locale === "ko") {
    return {
      title: clip(`${behavior} — ${hard}`, 118),
      opening: `현실적인 상황입니다. ${behavior} 이(가) 필요한 순간이 왔지만, 하필 ${hard}입니다. 어떻게 시작하시겠습니까?`,
      primary: {
        choices: [
          { id: "primary_1", label: "지금 바로, 정면으로 그 행동을 한다" },
          { id: "primary_2", label: "먼저 상황을 살피고 신중하게 접근한다" },
          { id: "primary_3", label: "다른 사람이나 더 편한 때로 미룬다" },
        ],
      },
      tradeoff: {
        escalationText: `상황이 더 어려워집니다. ${pressure} 이(가) 겹치면서, 처음 선택의 대가가 분명해집니다. 물러설수록 나중이 더 무거워집니다.`,
        choices: [
          { id: "tradeoff_1", label: "부담을 감수하고 원래 하려던 행동을 지킨다" },
          { id: "tradeoff_2", label: "관계와 안전을 위해 한발 물러선다" },
        ],
      },
      actionDecision: {
        prompt: "이제 결정할 때입니다. 실제로 무엇을 하시겠습니까?",
        choices: [
          { id: "action_1", label: "지금 그 행동을 실제로 실행하겠다", isActionCommitment: true },
          { id: "action_2", label: "조금 더 준비한 뒤로 미루겠다", isActionCommitment: false },
        ],
      },
    };
  }

  return {
    title: clip(`${behavior} — ${hard}`, 118),
    opening: `A realistic moment. ${capitalize(behavior)} is called for, but it lands exactly ${hard}. How do you begin?`,
    primary: {
      choices: [
        { id: "primary_1", label: "Do it now, directly, in the moment" },
        { id: "primary_2", label: "Read the situation first, then approach carefully" },
        { id: "primary_3", label: "Defer it to someone else or an easier time" },
      ],
    },
    tradeoff: {
      escalationText: `It gets harder. ${capitalize(pressure)} now weighs in, and the cost of your first move becomes clear. The longer you hold back, the heavier it gets later.`,
      choices: [
        { id: "tradeoff_1", label: "Absorb the cost and hold to the behavior you intended" },
        { id: "tradeoff_2", label: "Step back to protect the relationship and stay safe" },
      ],
    },
    actionDecision: {
      prompt: "Now decide. What will you actually do?",
      choices: [
        { id: "action_1", label: "Commit to taking the real action now", isActionCommitment: true },
        { id: "action_2", label: "Wait and prepare a little longer first", isActionCommitment: false },
      ],
    },
  };
}

function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}
