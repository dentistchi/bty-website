import type { ArenaScenarioDraft, GuidedAnswers, HardestWhenOption, ScenarioBranch } from "@/domain/foundry/arena-draft/types";
import type { ModuleSourceFacts } from "./arenaScenarioSource";

/**
 * Foundry Guided Arena Builder — deterministic scenario template.
 *
 * ⚠️ TEST / FIXTURE FACTORY ONLY (Slice 3.2I-R2). This composes a complete, gate-passing
 * branch-aware draft deterministically, for unit/parser/player tests, golden fixtures, and
 * offline development. It is DELIBERATELY NOT called by the Manager-facing generation
 * runtime: a deterministic scaffold reused across unrelated trainings is a quietly-
 * delivered product failure, so the live path (`generateArenaScenarioDraft`) is LIVE-model
 * only and fails safe rather than shipping this. Keep it for tests; do not wire it back into
 * the runtime. It composes a CONCRETE SCENE (actor, incident, stakeholder, decision-now)
 * and satisfies `validateArenaScenarioDraft` / `validateBranchedScenario` /
 * `validateConcreteScene` (but NOT `validateIncidentSpecific` — its branches are a shared
 * scaffold, which is exactly why it is fixture-only). en/ko.
 */

export type Locale = "en" | "ko";

export type ScenarioGenInput = {
  locale: Locale;
  facts: ModuleSourceFacts;
  guided: GuidedAnswers;
  /**
   * Slice 3.2I-R4 — the Manager-CONFIRMED practice boundary (server-supplied). When
   * present + confirmed it is the generation authority (overrides free-text inference).
   * The deterministic template ignores it. Typed loosely here to avoid a domain import in
   * this fixture module; the service reads it via the domain `PracticeBoundary` type.
   */
  boundary?: import("@/domain/foundry/arena-draft/boundary").PracticeBoundary;
  /**
   * Slice 3.2I-R2.23C — the Host's ACTIVE-boundary selection for THIS situation. Absent is
   * legitimate: scoping is only required once four or more confirmed rules are available.
   */
  boundaryScope?: import("@/domain/foundry/arena-draft/boundaryScope").PracticeBoundaryScope | null;
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
// Concrete-scene composition (Slice 3.2I-R1)
// ---------------------------------------------------------------------------

/** A "why now" clause per Q1 option — a concrete time/sequencing pressure, not boilerplate. */
function whenClause(guided: GuidedAnswers, locale: Locale): string {
  const { choice, customText } = guided.hardestWhen;
  if (choice === "other" && customText) return customText;
  const en: Record<HardestWhenOption, string> = {
    time_limited: "the day's work is about to move ahead",
    other_resists: "the person who raised it is already pushing back",
    performance_pressure: "results are due and the numbers are under scrutiny",
    authority_unclear: "it isn't clear whose call this is",
    other: "the moment to decide is now",
  };
  const ko: Record<HardestWhenOption, string> = {
    time_limited: "하루 일과가 곧 시작됩니다",
    other_resists: "문제를 꺼낸 사람이 이미 반발하고 있습니다",
    performance_pressure: "성과가 걸려 있고 다들 수치를 지켜봅니다",
    authority_unclear: "누구의 결정인지 분명하지 않습니다",
    other: "지금이 결정할 순간입니다",
  };
  return (locale === "ko" ? ko : en)[choice];
}

/** The concrete incident the scene turns on — the host's problem statement, else null. */
function incidentPhrase(facts: ModuleSourceFacts, locale: Locale): string | null {
  const p = facts.problem?.trim() || facts.observableBehavior?.trim();
  if (!p) return null;
  if (locale === "ko") return p;
  return p.charAt(0).toLowerCase() + p.slice(1);
}

/** Per-primary causal branches — concrete reactions to each strategy (act-openly / verify-first / one-on-one). */
function buildTemplateBranches(locale: Locale): Record<string, ScenarioBranch> {
  if (locale === "ko") {
    return {
      primary_1: {
        resultingWorldState: "팀 전체에 공개하고 함께 결정하려 했습니다.",
        escalationText: "팀의 의견이 갈리고, 한 선배 동료는 조용히 넘어갈 일을 공개적인 다툼으로 키웠다고 말합니다.",
        tradeoffChoices: [
          { id: "p1_tradeoff_1", label: "논의를 열어 둔 채 지금 이견을 끝까지 다루되, 전체가 느려지는 것을 감수한다" },
          { id: "p1_tradeoff_2", label: "직접 나서서 결정을 내려 일을 진행시키되, 일부가 무시당했다고 느끼는 것을 감수한다" },
        ],
        actionDecision: {
          prompt: "이제 실제로 무엇을 하시겠습니까?",
          choices: [
            { id: "p1_action_1", label: "지금 그 자리에서 결정하고 이유를 모두에게 말한 뒤 반발을 감당한다", isActionCommitment: true },
            { id: "p1_action_2", label: "가장 가까운 두 사람의 말을 먼저 듣기 위해 잠시 멈추되, 그 지연을 감수한다", isActionCommitment: false },
          ],
        },
      },
      primary_2: {
        resultingWorldState: "먼저 사실부터 확인했습니다.",
        escalationText: "확인을 마칠 무렵 두 사람은 이미 예전 방식대로 처리했고, 왜 붙들고 있었느냐는 물음이 돌아옵니다.",
        tradeoffChoices: [
          { id: "p2_tradeoff_1", label: "기록을 공개적으로 바로잡고 늦은 이유를 설명하되, 비판을 감수한다" },
          { id: "p2_tradeoff_2", label: "예전 일은 다시 들추지 않고 지금부터 올바른 방식으로 옮기되, 그 부분이 묻히는 것을 감수한다" },
        ],
        actionDecision: {
          prompt: "이제 실제로 무엇을 하시겠습니까?",
          choices: [
            { id: "p2_action_1", label: "지금 모두에게 명확한 정정을 보내고 지연의 책임을 감당한다", isActionCommitment: true },
            { id: "p2_action_2", label: "아직 위험한 사람들에게만 먼저 알리고 나머지는 나중에 처리하되, 그 공백을 감수한다", isActionCommitment: false },
          ],
        },
      },
      primary_3: {
        resultingWorldState: "동료와 먼저 일대일로 이야기했습니다.",
        escalationText: "동료는 둘만 알고 있자고 하지만, 다른 동료가 이미 눈치채고 어떻게 할 거냐고 묻습니다.",
        tradeoffChoices: [
          { id: "p3_tradeoff_1", label: "동료의 동의를 얻어 지금 공개로 가되, 그 불편함을 감수한다" },
          { id: "p3_tradeoff_2", label: "조금 더 비공개로 풀어 가되, 다른 동료가 당신을 건너뛸 수 있음을 감수한다" },
        ],
        actionDecision: {
          prompt: "이제 실제로 무엇을 하시겠습니까?",
          choices: [
            { id: "p3_action_1", label: "오늘 그룹에 문제를 꺼내 분명히 짚되, 그 여파를 감당한다", isActionCommitment: true },
            { id: "p3_action_2", label: "동료에게 스스로 꺼낼 하루의 시간을 먼저 주되, 그 위험을 감수한다", isActionCommitment: false },
          ],
        },
      },
    };
  }
  return {
    primary_1: {
      resultingWorldState: "You raised it openly with the whole team.",
      escalationText:
        "The team splits on what to do, and a senior colleague says you turned a quiet fix into a public fight.",
      tradeoffChoices: [
        { id: "p1_tradeoff_1", label: "Keep the discussion open and work through the disagreement now, even though it slows everything down" },
        { id: "p1_tradeoff_2", label: "Step in and make the call yourself to keep things moving, accepting that some feel overruled" },
      ],
      actionDecision: {
        prompt: "Decide what you will actually do now.",
        choices: [
          { id: "p1_action_1", label: "Decide in the room now and tell everyone your reason, owning the pushback", isActionCommitment: true },
          { id: "p1_action_2", label: "Pause to hear the two people closest to it first, accepting the delay", isActionCommitment: false },
        ],
      },
    },
    primary_2: {
      resultingWorldState: "You checked the facts before saying anything.",
      escalationText:
        "By the time you finish checking, two people have already done it the old way, and someone asks why you sat on it.",
      tradeoffChoices: [
        { id: "p2_tradeoff_1", label: "Correct the record openly and explain why you waited, accepting the criticism" },
        { id: "p2_tradeoff_2", label: "Move everyone to the right way from here without reopening the slip, accepting that it goes unaddressed" },
      ],
      actionDecision: {
        prompt: "Decide what you will actually do now.",
        choices: [
          { id: "p2_action_1", label: "Send a clear correction to everyone now and take the blame for the delay", isActionCommitment: true },
          { id: "p2_action_2", label: "Brief only the people still at risk and handle the rest later, accepting the gap", isActionCommitment: false },
        ],
      },
    },
    primary_3: {
      resultingWorldState: "You spoke with the teammate one-on-one first.",
      escalationText:
        "The teammate asks you to keep it between you, but another colleague has noticed and wants to know what you are doing about it.",
      tradeoffChoices: [
        { id: "p3_tradeoff_1", label: "Bring it into the open now with the teammate's knowledge, accepting the discomfort" },
        { id: "p3_tradeoff_2", label: "Keep working it privately a while longer, accepting that the other colleague may go around you" },
      ],
      actionDecision: {
        prompt: "Decide what you will actually do now.",
        choices: [
          { id: "p3_action_1", label: "Raise it with the group today and name the issue plainly, accepting the fallout", isActionCommitment: true },
          { id: "p3_action_2", label: "Give the teammate one day to raise it themselves first, accepting the risk", isActionCommitment: false },
        ],
      },
    },
  };
}

/**
 * Compose a complete branch-aware draft as a CONCRETE SCENE (Slice 3.2I-R1). The opening
 * names a concrete actor (a teammate), the host's incident, an affected stakeholder, and a
 * time pressure; the choices are concrete actions; each branch is a specific reaction. When
 * the module lacks an incident to build on, the opening falls back to a weaker line that the
 * concrete-scene gate rejects — so the caller fails safe rather than shipping a hollow scene.
 * Pure w.r.t. its inputs.
 */
export function buildTemplateScenarioDraft(input: ScenarioGenInput): ArenaScenarioDraft {
  const { locale, facts, guided } = input;
  const when = whenClause(guided, locale);
  const avoid = guided.avoidancePressure.text.trim();
  const inc = incidentPhrase(facts, locale);

  if (locale === "ko") {
    return {
      title: clip(facts.problem?.trim() || "지금 내려야 할 결정", 80),
      opening: inc
        ? `동료가 조용히 당신을 부릅니다. 함께 판단해야 할 문제입니다: ${inc}. 여기에 기대던 사람들이 이미 영향을 받고 있고, ${when}. 지금 정면으로 다룰 수도 있지만, ${avoid}. 미루면 바로잡기가 더 어려워집니다. 무엇부터 하시겠습니까?`
        : `상황이 벌어졌습니다. ${when}.`,
      primary: {
        choices: [
          { id: "primary_1", label: "팀 전체에 지금 공개하고 함께 결정한다" },
          { id: "primary_2", label: "사실을 먼저 스스로 확인한 뒤 어떻게 처리할지 정한다" },
          { id: "primary_3", label: "더 진행하기 전에 동료와 일대일로 이야기한다" },
        ],
      },
      tradeoff: {
        escalationText: "관련된 사람들이 이제 당신의 판단을 지켜보고, 처음 선택의 대가가 분명해집니다.",
        choices: [
          { id: "tradeoff_1", label: "직접 맡아 지금 매듭짓고, 떠안는 책임에 따르는 노출을 감수한다" },
          { id: "tradeoff_2", label: "상사를 끌어들여 판단을 뒷받침받되, 혼자 매듭짓지 못한 인상을 감수한다" },
        ],
      },
      actionDecision: {
        prompt: "이제 실제로 무엇을 하시겠습니까?",
        choices: [
          { id: "action_1", label: "지금 결정하고 이유를 모두에게 알린 뒤 반발을 감당한다", isActionCommitment: true },
          { id: "action_2", label: "핵심 사실부터 확인한 뒤 움직이되, 그 지연을 감수한다", isActionCommitment: false },
        ],
      },
      branches: buildTemplateBranches(locale),
    };
  }

  return {
    title: clip(facts.problem?.trim() || "A call you have to make now", 80),
    opening: inc
      ? `A teammate pulls you aside about a problem you have to weigh in on: ${inc}. The people who rely on this are already affected, and ${when}. You can take it on directly right now, but ${avoid}; if you wait, it only gets harder to put right. Where do you start?`
      : `Something has come up, and ${when}.`,
    primary: {
      choices: [
        { id: "primary_1", label: "Raise it openly with the whole team now and decide together" },
        { id: "primary_2", label: "Check the facts yourself first, then decide how to handle it" },
        { id: "primary_3", label: "Meet the teammate one-on-one before taking it further" },
      ],
    },
    tradeoff: {
      escalationText: "The people affected are now watching how you handle it, and the cost of your first move is becoming clear.",
      choices: [
        { id: "tradeoff_1", label: "Address it yourself and settle it now, accepting the exposure of owning it" },
        { id: "tradeoff_2", label: "Bring in your manager to back the call, accepting that it looks like you could not settle it alone" },
      ],
    },
    actionDecision: {
      prompt: "Decide what you will actually do now.",
      choices: [
        { id: "action_1", label: "Decide it now and tell everyone your reasoning, owning the pushback", isActionCommitment: true },
        { id: "action_2", label: "Pause to confirm the key facts first, accepting the delay before you act", isActionCommitment: false },
      ],
    },
    branches: buildTemplateBranches(locale),
  };
}

function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}
