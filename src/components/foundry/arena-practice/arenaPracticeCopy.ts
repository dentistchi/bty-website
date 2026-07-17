import type { AvoidancePressureSeed, HardestWhenOption } from "@/domain/foundry/arena-draft/types";
import type { AudienceType } from "@/domain/foundry/module/module-builder";

/**
 * Foundry Guided Arena Builder — localized copy (UI-only display strings).
 *
 * Plain product language: no "axis", "pattern", "entry/exit", "validator", or
 * other scenario-design jargon. iPhone-first, one dominant question per screen.
 */

export type Locale = "en" | "ko";

export type ArenaPracticeCopy = {
  eyebrow: string;
  back: string;

  // Source summary
  summaryTitle: string;
  summaryLead: string;
  labelCapability: string;
  labelForWhom: string;
  labelExpected: string;
  labelSourceTraining: string;
  startCta: string;
  resumeLead: string;
  resumeCta: string;
  startOver: string;

  // Q1
  q1Title: string;
  q1Help: string;
  hardestWhen: Record<HardestWhenOption, string>;
  otherPlaceholder: string;

  // Q2
  q2Title: string;
  q2Help: string;
  seed: Record<AvoidancePressureSeed, string>;
  q2Placeholder: string;
  continueCta: string;
  generateCta: string;

  // Generating
  generatingTitle: string;
  generatingLead: string;

  // Editor
  editTitle: string;
  fieldTitle: string;
  fieldOpening: string;
  sectionPrimary: string;
  sectionTradeoff: string;
  fieldEscalation: string;
  sectionAction: string;
  fieldActionPrompt: string;
  choiceLabel: (n: number) => string;
  commitmentOn: string;
  commitmentOff: string;
  commitmentHint: string;
  aiDraftNote: string;
  templateDraftNote: string;

  // Save / preview / regenerate
  save: string;
  saving: string;
  saved: string;
  saveError: string;
  previewCta: string;
  editCta: string;
  regenerate: string;
  regenerateConfirm: string;
  regenerating: string;

  // Preview
  previewTitle: string;
  previewOpening: string;
  previewPrimary: string;
  previewEscalation: string;
  previewTradeoff: string;
  previewAction: string;
  previewNotPlayable: string;
  previewCommitmentTag: string;

  // States / errors
  loadError: string;
  sourceGoneTitle: string;
  sourceGoneLead: string;
  noModuleTitle: string;
  noModuleLead: string;
  genericError: string;
  sensitiveWarning: string;
};

export const AUDIENCE_LABELS: Record<Locale, Record<AudienceType, string>> = {
  en: { everyone: "Everyone", leaders: "Leaders", job_group: "A job group", specific_role: "A specific role" },
  ko: { everyone: "모두", leaders: "리더", job_group: "특정 직군", specific_role: "특정 역할" },
};

export const ARENA_PRACTICE_COPY: Record<Locale, ArenaPracticeCopy> = {
  en: {
    eyebrow: "ARENA PRACTICE",
    back: "Back",

    summaryTitle: "Create Arena practice",
    summaryLead: "Turn this training into a realistic practice scenario. You'll answer two quick questions.",
    labelCapability: "What this builds",
    labelForWhom: "For whom",
    labelExpected: "Expected behavior",
    labelSourceTraining: "From training",
    startCta: "Start",
    resumeLead: "You have a saved practice draft for this training.",
    resumeCta: "Open saved draft",
    startOver: "Start a new one",

    q1Title: "When is this hardest to do?",
    q1Help: "Pick the moment where the behavior tends to break down.",
    hardestWhen: {
      time_limited: "When time is limited",
      other_resists: "When the other person resists",
      performance_pressure: "When performance or cost pressure is high",
      authority_unclear: "When authority is unclear",
      other: "Describe another moment",
    },
    otherPlaceholder: "When is it hardest?",

    q2Title: "What pressure makes people avoid the expected behavior?",
    q2Help: "Pick a starting point and edit it, or write your own.",
    seed: {
      time: "There isn't enough time, so it gets pushed to later",
      relationship: "It might strain the relationship, so it gets avoided",
      authority: "It's unclear whether I have the standing to act",
      credibility: "Fear of looking incompetent makes people hesitate",
      cost: "Cost or performance pressure makes people step back",
      safety: "Concern about safety or risk makes people hold off",
    },
    q2Placeholder: "What makes people avoid it?",
    continueCta: "Continue",
    generateCta: "Build the scenario",

    generatingTitle: "Building your scenario",
    generatingLead: "Shaping a realistic practice moment from what you described…",

    editTitle: "Edit practice scenario",
    fieldTitle: "Scenario title",
    fieldOpening: "Opening situation",
    sectionPrimary: "First choices",
    sectionTradeoff: "It gets harder",
    fieldEscalation: "Escalation",
    sectionAction: "Action decision",
    fieldActionPrompt: "Decision prompt",
    choiceLabel: (n) => `Choice ${n}`,
    commitmentOn: "Real action",
    commitmentOff: "Wait / prepare",
    commitmentHint: "Mark which choices are a real, observable action commitment.",
    aiDraftNote: "Drafted with AI — edit anything before saving.",
    templateDraftNote: "Draft scaffold — edit anything before saving.",

    save: "Save draft",
    saving: "Saving…",
    saved: "Saved",
    saveError: "Couldn't save — tap to retry.",
    previewCta: "Preview",
    editCta: "Edit",
    regenerate: "Try a different draft",
    regenerateConfirm: "Replace the current scenario with a new draft? Your edits will be lost.",
    regenerating: "Rebuilding…",

    previewTitle: "Preview",
    previewOpening: "Opening",
    previewPrimary: "First choices",
    previewEscalation: "It gets harder",
    previewTradeoff: "Tradeoff choices",
    previewAction: "Action decision",
    previewNotPlayable: "Preview only — this is a draft, not a live playable run.",
    previewCommitmentTag: "action",

    loadError: "Couldn't load this training. Go back and retry.",
    sourceGoneTitle: "This training is no longer available",
    sourceGoneLead: "The source training was removed or you no longer have access.",
    noModuleTitle: "No published module yet",
    noModuleLead: "Create Arena practice from a published training module.",
    genericError: "Something went wrong. Please retry.",
    sensitiveWarning: "Possible personal or sensitive details — please review before saving.",
  },
  ko: {
    eyebrow: "아레나 연습",
    back: "뒤로",

    summaryTitle: "아레나 연습 만들기",
    summaryLead: "이 교육을 현실적인 연습 시나리오로 바꿉니다. 두 가지 질문에만 답하면 됩니다.",
    labelCapability: "무엇을 기르나",
    labelForWhom: "대상",
    labelExpected: "기대 행동",
    labelSourceTraining: "원본 교육",
    startCta: "시작",
    resumeLead: "이 교육에 저장된 연습 초안이 있습니다.",
    resumeCta: "저장된 초안 열기",
    startOver: "새로 시작하기",

    q1Title: "이 행동이 언제 가장 하기 어렵나요?",
    q1Help: "행동이 무너지기 쉬운 순간을 골라 주세요.",
    hardestWhen: {
      time_limited: "시간이 부족할 때",
      other_resists: "상대가 반발할 때",
      performance_pressure: "성과·비용 압박이 클 때",
      authority_unclear: "권한이 불분명할 때",
      other: "다른 순간을 직접 설명하기",
    },
    otherPlaceholder: "언제 가장 어렵나요?",

    q2Title: "어떤 압박이 기대 행동을 피하게 만드나요?",
    q2Help: "예시를 고른 뒤 수정하거나, 직접 작성하세요.",
    seed: {
      time: "시간이 부족해서 나중으로 미루게 된다",
      relationship: "관계가 불편해질까 봐 피하게 된다",
      authority: "내가 나설 권한이 있는지 확신이 없다",
      credibility: "무능해 보일까 봐 주저하게 된다",
      cost: "비용·성과 부담 때문에 물러서게 된다",
      safety: "안전이나 위험이 걱정되어 망설이게 된다",
    },
    q2Placeholder: "무엇이 이 행동을 피하게 만드나요?",
    continueCta: "다음",
    generateCta: "시나리오 만들기",

    generatingTitle: "시나리오를 만드는 중",
    generatingLead: "말씀하신 내용으로 현실적인 연습 상황을 구성하고 있습니다…",

    editTitle: "연습 시나리오 편집",
    fieldTitle: "시나리오 제목",
    fieldOpening: "시작 상황",
    sectionPrimary: "첫 선택",
    sectionTradeoff: "상황이 더 어려워진다",
    fieldEscalation: "상황 악화",
    sectionAction: "행동 결정",
    fieldActionPrompt: "결정 질문",
    choiceLabel: (n) => `선택 ${n}`,
    commitmentOn: "실제 행동",
    commitmentOff: "대기·준비",
    commitmentHint: "실제로 관찰 가능한 행동 약속인 선택을 표시하세요.",
    aiDraftNote: "AI로 초안을 만들었습니다 — 저장 전에 자유롭게 수정하세요.",
    templateDraftNote: "기본 초안입니다 — 저장 전에 자유롭게 수정하세요.",

    save: "초안 저장",
    saving: "저장 중…",
    saved: "저장됨",
    saveError: "저장하지 못했습니다 — 다시 시도하세요.",
    previewCta: "미리보기",
    editCta: "편집",
    regenerate: "다른 초안 만들기",
    regenerateConfirm: "현재 시나리오를 새 초안으로 교체할까요? 수정한 내용은 사라집니다.",
    regenerating: "다시 만드는 중…",

    previewTitle: "미리보기",
    previewOpening: "시작",
    previewPrimary: "첫 선택",
    previewEscalation: "상황이 더 어려워진다",
    previewTradeoff: "절충 선택",
    previewAction: "행동 결정",
    previewNotPlayable: "미리보기 전용 — 실제 플레이가 아닌 초안입니다.",
    previewCommitmentTag: "행동",

    loadError: "이 교육을 불러오지 못했습니다. 뒤로 가서 다시 시도하세요.",
    sourceGoneTitle: "이 교육을 더 이상 사용할 수 없습니다",
    sourceGoneLead: "원본 교육이 삭제되었거나 접근 권한이 없습니다.",
    noModuleTitle: "아직 게시된 모듈이 없습니다",
    noModuleLead: "게시된 교육 모듈에서 아레나 연습을 만들 수 있습니다.",
    genericError: "문제가 발생했습니다. 다시 시도해 주세요.",
    sensitiveWarning: "개인·민감 정보가 포함되었을 수 있습니다 — 저장 전에 확인하세요.",
  },
};
