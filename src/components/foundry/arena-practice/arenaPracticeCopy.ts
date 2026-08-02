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
  // Slice 3.2I-R2.23C — ACTIVE-boundary scoping. Ready for the boundary editor (R5B2). The copy
  // says what the Host does and what happens to the rest; it never mentions models or limits,
  // because the reason is that a situation with too many rules at once stops teaching anything.
  boundaryScopeTitle: string;
  boundaryScopeHint: string;
  boundaryScopeCount: (n: number, max: number) => string;
  boundaryScopeConfirm: string;
  boundaryScopeChange: string;
  boundaryScopeAllActive: string;
  boundaryScopeAnother: string;
  boundaryScopeMaxReached: string;
  boundaryScopeConfirmed: string;
  boundaryScopeChangedNotice: string;
  boundaryScopeUnknownNotice: string;
  boundaryScopeSaving: string;
  boundaryScopeSaveError: string;
  boundaryScopeInactive: string;
  boundaryScopeReady: string;

  // Slice 3.2I-R5B2 — the Host CONFIRMS the boundary here. Before this existed, a new draft
  // could never obtain one, so generation was refused by the server with nothing on screen able
  // to resolve it. The language stays in the Host's terms: rules every option must follow.
  boundaryTitle: string;
  boundaryLead: string;
  boundarySuggestedTitle: string;
  boundarySuggestedHint: string;
  boundarySuggestionAdd: string;
  boundarySuggestionAdded: string;
  boundaryRulesTitle: string;
  boundaryRulesEmpty: string;
  boundaryOptionalHint: string;
  boundaryNewPlaceholder: string;
  boundaryAddCta: string;
  boundaryEditCta: string;
  boundaryRemoveCta: string;
  boundaryEditSaveCta: string;
  boundaryEditCancelCta: string;
  boundaryCount: (n: number, max: number) => string;
  boundaryConfirmCta: string;
  boundaryConfirmedTitle: string;
  boundaryChangeCta: string;
  boundarySaving: string;
  boundaryErrorEmpty: string;
  boundaryErrorTooLong: (max: number) => string;
  boundaryErrorDuplicate: string;
  boundaryErrorTooMany: (max: number) => string;
  boundarySaveError: string;
  boundaryConflict: string;
  boundaryInvalidatedNotice: string;

  // Slice 3.2I-R5B2 — the forward action out of setup, and the honest readiness lines.
  setupNeedsBoundary: string;
  setupNeedsConfirmation: string;
  setupGenerateCta: string;
  setupGenerating: string;
  setupGenerateError: string;

  // Slice 3.2I-R5B1 — interim shell setup surface (boundary editor arrives in R5B2)
  setupTitle: string;
  setupLead: string;
  setupPending: string;
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
  // Slice 3.2I — branch-aware preview (per-primary continuation)
  previewBranchFor: string;
  previewWhatHappensNext: string;

  // States / errors
  // 3.0B — test + publish
  testInArena: string;
  publishToArena: string;
  publishing: string;
  published: string;
  publishStale: string;
  publishError: string;
  saveBeforePublish: string;
  // 3.0B.1 — prominent success + honest test gating
  publishedTitle: string;
  openArenaTabHint: string;
  backToEditor: string;
  liveBanner: string;
  saveBeforeTesting: string;

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
    eyebrow: "PRACTICE",
    back: "Back",

    summaryTitle: "Create practice",
    summaryLead: "Turn this training into a realistic practice scenario. You'll answer two quick questions.",
    setupTitle: "Set up practice",
    setupLead: "Before BTY creates the situations, confirm what kind of decision learners need to practice.",
    // R5B2 — boundary setup is now ON this screen, so the interim "opens next" promise became
    // untrue. The only decision that can still be outstanding here is which rules govern THIS
    // situation, so the line says that instead.
    setupPending: "Choose which rules this practice situation will rehearse, then confirm.",
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
    previewBranchFor: "If the learner chooses",
    previewWhatHappensNext: "What happens next",

    testInArena: "Try it as a learner",
    publishToArena: "Publish practice",
    publishing: "Publishing…",
    published: "Published ✓",
    publishStale: "Save your latest edits, then publish.",
    publishError: "Couldn't publish — check the scenario and retry.",
    saveBeforePublish: "Save your edits before publishing.",
    publishedTitle: "Practice published",
    openArenaTabHint: "Learners start it from the Practice tab.",
    backToEditor: "Back to editor",
    liveBanner: "This practice is published.",
    saveBeforeTesting: "Save this draft before testing",

    loadError: "Couldn't load this training. Go back and retry.",
    sourceGoneTitle: "This training is no longer available",
    sourceGoneLead: "The source training was removed or you no longer have access.",
    noModuleTitle: "No published module yet",
    noModuleLead: "Create practice from a published training module.",
    genericError: "Something went wrong. Please retry.",
    sensitiveWarning: "Possible personal or sensitive details — please review before saving.",

    boundaryScopeTitle: "Choose up to 3 boundaries",
    boundaryScopeHint: "Select the boundaries this practice situation will rehearse.",
    boundaryScopeCount: (n, max) => `${n} of ${max} selected`,
    boundaryScopeConfirm: "Confirm boundaries",
    boundaryScopeChange: "Change selection",
    boundaryScopeAllActive: "All confirmed boundaries are active for this practice.",
    boundaryScopeAnother: "Create another practice situation to rehearse different boundaries.",
    boundaryScopeMaxReached: "You can choose up to 3. Unselect one to choose another.",
    boundaryScopeConfirmed: "These boundaries are active for this practice situation.",
    boundaryScopeChangedNotice: "The confirmed boundaries changed. Choose again for this situation.",
    boundaryScopeUnknownNotice: "A boundary you chose is no longer confirmed. Choose again.",
    boundaryScopeSaving: "Saving…",
    boundaryScopeSaveError: "That selection could not be saved. Please retry.",
    boundaryScopeInactive: "Not in this practice situation",
    boundaryScopeReady: "Ready to create this practice situation.",

    boundaryTitle: "What must every option respect?",
    boundaryLead:
      "Write the rules a learner may never break here, however the situation goes. Every option BTY writes will stay inside them.",
    boundarySuggestedTitle: "Found in this training",
    boundarySuggestedHint: "Suggestions only. Add the ones that belong, and edit anything that is not quite right.",
    boundarySuggestionAdd: "Add",
    boundarySuggestionAdded: "Added",
    boundaryRulesTitle: "Rules for this practice situation",
    boundaryRulesEmpty: "No rules yet.",
    boundaryOptionalHint:
      "If nothing is off-limits here, you can confirm with no rules — the situation becomes a judgment call with no hard line.",
    boundaryNewPlaceholder: "e.g. Never share a patient identifier before consent is confirmed.",
    boundaryAddCta: "Add rule",
    boundaryEditCta: "Edit",
    boundaryRemoveCta: "Remove",
    boundaryEditSaveCta: "Save rule",
    boundaryEditCancelCta: "Cancel",
    boundaryCount: (n, max) => `${n} of ${max} rules`,
    boundaryConfirmCta: "Confirm boundary",
    boundaryConfirmedTitle: "Boundary confirmed",
    boundaryChangeCta: "Change boundary",
    boundarySaving: "Saving…",
    boundaryErrorEmpty: "A rule needs some words before it can be added.",
    boundaryErrorTooLong: (max) => `A rule can be up to ${max} characters. Please shorten it.`,
    boundaryErrorDuplicate: "That rule is already on the list.",
    boundaryErrorTooMany: (max) => `You can set up to ${max} rules. Remove one to add another.`,
    boundarySaveError: "That boundary could not be saved. Please retry.",
    boundaryConflict:
      "This practice changed somewhere else while you were editing. Your rules are still here — review them and confirm again.",
    boundaryInvalidatedNotice: "The boundary changed, so the earlier draft situation was cleared. Create it again below.",

    setupNeedsBoundary: "Set the boundary before BTY creates the situation.",
    setupNeedsConfirmation: "Confirm the boundary to continue.",
    setupGenerateCta: "Create the practice situation",
    setupGenerating: "Creating…",
    setupGenerateError: "The situation could not be created. Please retry.",
  },
  ko: {
    eyebrow: "연습",
    back: "뒤로",

    summaryTitle: "연습 만들기",
    summaryLead: "이 교육을 현실적인 연습 시나리오로 바꿉니다. 두 가지 질문에만 답하면 됩니다.",
    setupTitle: "Practice 설정",
    setupLead: "BTY가 상황을 만들기 전에 학습자가 어떤 판단을 연습해야 하는지 확인합니다.",
    setupPending: "이 연습 상황에서 다룰 규칙을 선택한 뒤 확인하세요.",
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
    previewBranchFor: "학습자가 이 선택을 하면",
    previewWhatHappensNext: "다음에 벌어지는 일",

    testInArena: "학습자로 해보기",
    publishToArena: "연습 게시",
    publishing: "게시하는 중…",
    published: "게시됨 ✓",
    publishStale: "최신 편집을 저장한 뒤 게시하세요.",
    publishError: "게시하지 못했습니다 — 시나리오를 확인하고 다시 시도하세요.",
    saveBeforePublish: "게시하기 전에 편집 내용을 저장하세요.",
    publishedTitle: "연습이 게시되었습니다",
    openArenaTabHint: "학습자는 연습 탭에서 시작합니다.",
    backToEditor: "편집기로 돌아가기",
    liveBanner: "이 연습은 게시된 상태입니다.",
    saveBeforeTesting: "테스트하기 전에 이 초안을 저장하세요",

    loadError: "이 교육을 불러오지 못했습니다. 뒤로 가서 다시 시도하세요.",
    sourceGoneTitle: "이 교육을 더 이상 사용할 수 없습니다",
    sourceGoneLead: "원본 교육이 삭제되었거나 접근 권한이 없습니다.",
    noModuleTitle: "아직 게시된 모듈이 없습니다",
    noModuleLead: "게시된 교육 모듈에서 연습을 만들 수 있습니다.",
    genericError: "문제가 발생했습니다. 다시 시도해 주세요.",
    sensitiveWarning: "개인·민감 정보가 포함되었을 수 있습니다 — 저장 전에 확인하세요.",

    boundaryScopeTitle: "경계를 최대 3개 선택하세요",
    boundaryScopeHint: "이 연습 상황에서 다룰 경계를 선택하세요.",
    boundaryScopeCount: (n, max) => `${max}개 중 ${n}개 선택`,
    boundaryScopeConfirm: "경계 확인",
    boundaryScopeChange: "선택 변경",
    boundaryScopeAllActive: "이 연습에는 확인된 모든 경계가 적용됩니다.",
    boundaryScopeAnother: "다른 경계는 별도의 연습 상황으로 만들 수 있습니다.",
    boundaryScopeMaxReached: "최대 3개까지 선택할 수 있습니다. 다른 경계를 선택하려면 하나를 해제하세요.",
    boundaryScopeConfirmed: "이 연습 상황에는 아래 경계가 적용됩니다.",
    boundaryScopeChangedNotice: "확인된 경계가 바뀌었습니다. 이 상황에서 다룰 경계를 다시 선택하세요.",
    boundaryScopeUnknownNotice: "선택한 경계 중 확인되지 않은 항목이 있습니다. 다시 선택하세요.",
    boundaryScopeSaving: "저장 중…",
    boundaryScopeSaveError: "선택을 저장하지 못했습니다. 다시 시도해 주세요.",
    boundaryScopeInactive: "이 연습 상황에는 적용되지 않음",
    boundaryScopeReady: "이 연습 상황을 만들 준비가 되었습니다.",

    boundaryTitle: "모든 선택이 지켜야 할 것은 무엇인가요?",
    boundaryLead:
      "상황이 어떻게 흘러가도 학습자가 절대 넘어서는 안 되는 규칙을 적어 주세요. BTY가 만드는 모든 선택지는 그 안에서 만들어집니다.",
    boundarySuggestedTitle: "이 트레이닝에서 찾은 문장",
    boundarySuggestedHint: "제안일 뿐입니다. 맞는 것만 추가하고, 어색한 부분은 수정하세요.",
    boundarySuggestionAdd: "추가",
    boundarySuggestionAdded: "추가됨",
    boundaryRulesTitle: "이 연습 상황의 규칙",
    boundaryRulesEmpty: "아직 규칙이 없습니다.",
    boundaryOptionalHint:
      "여기서 절대 안 되는 일이 없다면 규칙 없이 확인해도 됩니다 — 명확한 선이 없는 판단 상황이 됩니다.",
    boundaryNewPlaceholder: "예: 동의를 확인하기 전에는 환자 신원을 절대 공유하지 않는다.",
    boundaryAddCta: "규칙 추가",
    boundaryEditCta: "수정",
    boundaryRemoveCta: "삭제",
    boundaryEditSaveCta: "규칙 저장",
    boundaryEditCancelCta: "취소",
    boundaryCount: (n, max) => `규칙 ${max}개 중 ${n}개`,
    boundaryConfirmCta: "경계 확인",
    boundaryConfirmedTitle: "경계가 확인되었습니다",
    boundaryChangeCta: "경계 변경",
    boundarySaving: "저장 중…",
    boundaryErrorEmpty: "규칙을 추가하려면 내용을 입력하세요.",
    boundaryErrorTooLong: (max) => `규칙은 최대 ${max}자까지 입력할 수 있습니다. 조금 줄여 주세요.`,
    boundaryErrorDuplicate: "이미 목록에 있는 규칙입니다.",
    boundaryErrorTooMany: (max) => `규칙은 최대 ${max}개까지 설정할 수 있습니다. 하나를 삭제한 뒤 추가하세요.`,
    boundarySaveError: "경계를 저장하지 못했습니다. 다시 시도해 주세요.",
    boundaryConflict:
      "편집하는 동안 다른 곳에서 이 연습이 변경되었습니다. 작성한 규칙은 그대로 있습니다 — 확인 후 다시 저장하세요.",
    boundaryInvalidatedNotice: "경계가 바뀌어 이전 초안 상황은 삭제되었습니다. 아래에서 다시 만들어 주세요.",

    setupNeedsBoundary: "BTY가 상황을 만들기 전에 경계를 설정하세요.",
    setupNeedsConfirmation: "계속하려면 경계를 확인하세요.",
    setupGenerateCta: "연습 상황 만들기",
    setupGenerating: "만드는 중…",
    setupGenerateError: "상황을 만들지 못했습니다. 다시 시도해 주세요.",
  },
};
