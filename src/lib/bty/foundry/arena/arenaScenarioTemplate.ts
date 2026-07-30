import type { ArenaScenarioDraft, GuidedAnswers, HardestWhenOption, ScenarioBranch } from "@/domain/foundry/arena-draft/types";
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
 * Slice 3.2I — per-primary causal branches for the deterministic template. The three
 * template primaries are fixed strategies (act-now / verify-first / involve-the-person);
 * each branch is the reality THAT strategy creates, with its own escalation, tradeoff,
 * and action decision. Branch-local choice ids (unique within a branch). Every branch
 * satisfies the difficult-choice gate in branch mode. Keyed by the template's primary ids.
 */
function buildTemplateBranches(locale: Locale, pressure: string): Record<string, ScenarioBranch> {
  if (locale === "ko") {
    return {
      primary_1: {
        resultingWorldState: "지금 바로 움직여 기준은 지켰지만, 정보가 불완전한 채였습니다.",
        escalationText: `빠르게 움직여 선을 지켰지만, 알지 못했던 빈틈이 드러났고 ${pressure}. 너무 서둘렀던 것 아니냐는 말이 나옵니다.`,
        tradeoffChoices: [
          { id: "p1_tradeoff_1", label: "빠른 판단을 지지하며 빈틈을 공개적으로 바로잡고, 그 노출을 감수한다" },
          { id: "p1_tradeoff_2", label: "일부를 되돌려 빈틈부터 메우되, 방금 보인 결단력을 스스로 깎는 부담을 진다" },
        ],
        actionDecision: {
          prompt: "이제 실제로 무엇을 하시겠습니까?",
          choices: [
            { id: "p1_action_1", label: "지금 공개적으로 빈틈을 바로잡고 판단의 책임을 계속 진다", isActionCommitment: true },
            { id: "p1_action_2", label: "진행을 멈추고 사실을 다시 확인하되, 잃은 추진력을 감수한다", isActionCommitment: false },
          ],
        },
      },
      primary_2: {
        resultingWorldState: "먼저 확인했지만, 그 사이 위험은 계속 돌아갔습니다.",
        escalationText: "확인으로 사실은 분명해졌지만, 기다리는 동안 방치된 위험이 눈에 보이는 피해를 냈고, 왜 더 빨리 움직이지 않았느냐는 물음이 돌아옵니다.",
        tradeoffChoices: [
          { id: "p2_tradeoff_1", label: "지연을 인정하고 확신이 선 지금 단호하게 실행하며, 늦었다는 비판을 감수한다" },
          { id: "p2_tradeoff_2", label: "남은 불확실성까지 더 확인한 뒤 움직이되, 피해가 더 커질 위험을 감수한다" },
        ],
        actionDecision: {
          prompt: "이제 실제로 무엇을 하시겠습니까?",
          choices: [
            { id: "p2_action_1", label: "확인된 것에 근거해 지금 실행하고 지연의 책임을 짊어진다", isActionCommitment: true },
            { id: "p2_action_2", label: "나머지 확인을 마저 끝내되, 그동안 피해가 더 날 수 있음을 감수한다", isActionCommitment: false },
          ],
        },
      },
      primary_3: {
        resultingWorldState: "관련된 사람을 먼저 끌어들였고, 공동의 방식은 그만큼 느려졌습니다.",
        escalationText: `함께 하려던 상대가 반발하면서 원하던 공동의 방식이 막혔고, 그러는 사이 ${pressure}.`,
        tradeoffChoices: [
          { id: "p3_tradeoff_1", label: "동의 없이 결과를 위해 밀고 나가되, 관계에 생길 균열을 감수한다" },
          { id: "p3_tradeoff_2", label: "계속 설득해 함께 가려 하되, 지연이 결과를 해칠 위험을 감수한다" },
        ],
        actionDecision: {
          prompt: "이제 실제로 무엇을 하시겠습니까?",
          choices: [
            { id: "p3_action_1", label: "반대를 무릅쓰고 지금 실행한 뒤 관계는 나중에 회복한다", isActionCommitment: true },
            { id: "p3_action_2", label: "혼자 움직이기 전에 합류할 기한을 분명히 주되, 그 지연을 감수한다", isActionCommitment: false },
          ],
        },
      },
    };
  }
  return {
    primary_1: {
      resultingWorldState: "You moved now and held the standard, but on incomplete information.",
      escalationText: `You acted fast and held the line — but a gap in what you knew now surfaces, and ${pressure}. People ask whether you moved too soon.`,
      tradeoffChoices: [
        { id: "p1_tradeoff_1", label: "Stand behind your fast call and fix the gap in the open, accepting the exposure" },
        { id: "p1_tradeoff_2", label: "Walk part of it back to close the gap first, accepting that it undercuts the decisiveness you showed" },
      ],
      actionDecision: {
        prompt: "Decide what you will actually do now.",
        choices: [
          { id: "p1_action_1", label: "Correct the gap publicly now and keep ownership of the call", isActionCommitment: true },
          { id: "p1_action_2", label: "Pause the rollout to re-check the facts, accepting the loss of momentum", isActionCommitment: false },
        ],
      },
    },
    primary_2: {
      resultingWorldState: "You verified first; the risk kept running while you did.",
      escalationText:
        "Your check confirmed the facts — but while you waited, the risk you left running did visible damage, and people ask why you did not move sooner.",
      tradeoffChoices: [
        { id: "p2_tradeoff_1", label: "Own the delay and act decisively now that you are certain, accepting the criticism for waiting" },
        { id: "p2_tradeoff_2", label: "Keep verifying the remaining unknowns before you act, accepting that the damage may widen" },
      ],
      actionDecision: {
        prompt: "Decide what you will actually do now.",
        choices: [
          { id: "p2_action_1", label: "Act now on what you have confirmed and absorb the blame for the delay", isActionCommitment: true },
          { id: "p2_action_2", label: "Finish confirming the rest first, accepting that more harm may land meanwhile", isActionCommitment: false },
        ],
      },
    },
    primary_3: {
      resultingWorldState: "You brought in the person first; the shared approach is now slower.",
      escalationText: `The person you brought in pushes back, and the shared approach you wanted is stuck while ${pressure}.`,
      tradeoffChoices: [
        { id: "p3_tradeoff_1", label: "Move ahead without their agreement to protect the outcome, accepting the strain on the relationship" },
        { id: "p3_tradeoff_2", label: "Keep working to bring them along, accepting that the delay may cost the outcome" },
      ],
      actionDecision: {
        prompt: "Decide what you will actually do now.",
        choices: [
          { id: "p3_action_1", label: "Act now over their objection and repair the relationship afterward", isActionCommitment: true },
          { id: "p3_action_2", label: "Give them a firm window to get on board before you act alone, accepting the delay", isActionCommitment: false },
        ],
      },
    },
  };
}

/**
 * Build a complete, valid draft deterministically (Slice 3.2H — difficult-choice
 * scaffold). Every option is a defensible strategy that protects a legitimate value
 * and accepts a real cost — none is written as an obvious throwaway, so the learner
 * cannot reject it from wording alone. `isActionCommitment` marks the immediate-action
 * option INTERNALLY only (for pattern interpretation); both Action Decision choices are
 * concrete, cost-bearing next actions, not "act vs avoid". Passes both the structural
 * validator and the difficult-choice quality gate. Honest scaffolding — the host edits
 * every line. Pure w.r.t. its inputs.
 */
export function buildTemplateScenarioDraft(input: ScenarioGenInput): ArenaScenarioDraft {
  const { locale, facts, guided } = input;
  const hard = hardestWhenPhrase(guided, locale);
  const pressure = guided.avoidancePressure.text;
  const behavior = behaviorPhrase(facts, locale);

  if (locale === "ko") {
    return {
      title: clip(`${behavior} — ${hard}`, 118),
      opening: `현실적인 상황입니다. ${behavior} 이(가) 필요한 순간이지만, 하필 ${hard}이고, ${pressure}. 둘 다 지킬 수는 없습니다. 무엇을 먼저 지키시겠습니까?`,
      primary: {
        choices: [
          { id: "primary_1", label: "지금 바로 움직여 기준을 지킨다 — 다만 정보가 불완전한 채로 판단하는 위험을 감수한다" },
          { id: "primary_2", label: "사실부터 확인한 뒤 대응한다 — 정확성은 지키지만 그 사이 위험이 계속된다" },
          { id: "primary_3", label: "관련된 사람과 먼저 상의한다 — 신뢰는 지키지만 대응이 늦어진다" },
        ],
      },
      tradeoff: {
        escalationText: `압박이 더 커집니다. ${pressure} 상황에서 관련된 사람들이 이제 지켜보고 있습니다. 처음에 택한 길의 대가가 분명해지고, 어느 쪽도 대가 없이 물러설 수 없습니다.`,
        choices: [
          { id: "tradeoff_1", label: "처음 방식을 밀고 나가며 커지는 부담을 스스로 짊어진다" },
          { id: "tradeoff_2", label: "지금 방향을 바꿔 피해를 줄이되, 앞선 판단을 뒤집는 부담을 안는다" },
        ],
      },
      actionDecision: {
        prompt: "이제 실제로 무엇을 하시겠습니까?",
        choices: [
          { id: "action_1", label: "지금 실행하고 뒤따르는 책임과 여파를 감당한다", isActionCommitment: true },
          { id: "action_2", label: "확인 가능한 부분만 좁혀 지금 처리하고, 나머지는 미해결로 남긴다", isActionCommitment: false },
        ],
      },
      branches: buildTemplateBranches(locale, pressure),
    };
  }

  return {
    title: clip(`${behavior} — ${hard}`, 118),
    opening: `A realistic moment. ${capitalize(behavior)} is called for, but it lands exactly ${hard}, and ${pressure}. You cannot fully protect both at once. What do you protect first?`,
    primary: {
      choices: [
        { id: "primary_1", label: "Act on it now to hold the standard, accepting that you may be acting on incomplete information" },
        { id: "primary_2", label: "Confirm the facts first, protecting accuracy while the risk keeps running in the meantime" },
        { id: "primary_3", label: "Raise it with the person involved first, protecting the relationship but slowing the response" },
      ],
    },
    tradeoff: {
      escalationText: `The pressure tightens. ${capitalize(pressure)}, and the people affected are now watching. The cost of your first move is visible, and no path lets you step back without giving something up.`,
      choices: [
        { id: "tradeoff_1", label: "Hold to your first approach and absorb the growing cost yourself" },
        { id: "tradeoff_2", label: "Change course now to limit the damage, accepting that it undercuts your earlier call" },
      ],
    },
    actionDecision: {
      prompt: "Decide what you will actually do now.",
      choices: [
        { id: "action_1", label: "Commit to the action now and own the fallout that follows", isActionCommitment: true },
        { id: "action_2", label: "Narrow the scope to what you can verify and act on that part now, leaving the rest unresolved", isActionCommitment: false },
      ],
    },
    branches: buildTemplateBranches(locale, pressure),
  };
}

function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}
