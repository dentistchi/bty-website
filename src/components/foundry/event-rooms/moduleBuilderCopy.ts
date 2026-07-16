/** Self-contained en/ko copy for the Guided Module Builder (Slice 2). Plain,
 *  operational language only — never "capability", "module schema", "evidence
 *  ladder", "learning objective", etc. */

import type { Locale } from "./copy";

export type ModuleBuilderCopy = {
  // entry
  entryEyebrow: string;
  startNew: string;
  starting: string;
  continueLead: string;
  continueDraft: string;
  draftUpdated: (rel: string) => string;
  otherDrafts: string;
  deleteDraft: string;
  deleteConfirm: string;
  deleted: string;
  // shell chrome
  stepOf: (n: number, total: number) => string;
  back: string;
  next: string;
  saveAndLeave: string;
  editSection: string;
  // save states
  saving: string;
  saved: string;
  saveError: string;
  retry: string;
  // restore states
  restoreLoading: string;
  restoreUnavailable: string;
  restoreGone: string;
  // step 1 problem
  s1Q: string;
  s1Help: string;
  s1Placeholder: string;
  s1Blocker: string;
  // step 2 audience
  s2Q: string;
  audEveryone: string;
  audLeaders: string;
  audJobGroup: string;
  audRole: string;
  audJobGroupDetail: string;
  audRoleDetail: string;
  s2Blocker: string;
  s2DetailBlocker: string;
  // step 3 behavior
  s3Q: string;
  s3Help: string;
  s3Placeholder: string;
  s3Blocker: string;
  s3VagueGuidance: string;
  // step 4 evidence
  s4Q: string;
  s4Help: string;
  s4Placeholder: string;
  evSeen: string;
  evHeard: string;
  evRecorded: string;
  evConfirmed: string;
  s4Honesty: string;
  s4Blocker: string;
  // step 5 learning need
  s5Q: string;
  needKnow: string;
  needDecide: string;
  needPractice: string;
  needShared: string;
  s5ArenaHint: string;
  s5Blocker: string;
  // step 6 material intent
  s6Q: string;
  matYoutube: string;
  matPdf: string;
  matWritten: string;
  matLive: string;
  matYoutubePlaceholder: string;
  matWrittenPlaceholder: string;
  matLivePlaceholder: string;
  matPdfDeferred: string;
  s6Blocker: string;
  // step 7 practice + follow-up
  s7ArenaQ: string;
  s7ArenaRecommended: string;
  s7ArenaAccept: string;
  s7ArenaDecline: string;
  s7FollowQ: string;
  followNone: string;
  follow7: string;
  follow30: string;
  s7Blocker: string;
  // step 8 review
  reviewEyebrow: string;
  reviewChange: string;
  reviewWho: string;
  reviewBehavior: string;
  reviewEvidence: string;
  reviewLearning: string;
  reviewMaterial: string;
  reviewArena: string;
  reviewFollow: string;
  reviewEmpty: string;
  arenaYes: string;
  arenaNo: string;
};

const arenaFollowLabel = (
  days: number | undefined,
  none: string,
  seven: string,
  thirty: string,
): string => (days === 7 ? seven : days === 30 ? thirty : none);

export const MODULE_BUILDER_COPY: Record<Locale, ModuleBuilderCopy> = {
  en: {
    entryEyebrow: "GUIDED SETUP",
    startNew: "Start new training",
    starting: "Starting…",
    continueLead: "Pick up where you left off.",
    continueDraft: "Continue draft",
    draftUpdated: (rel) => `Last edited ${rel}`,
    otherDrafts: "Other drafts",
    deleteDraft: "Delete draft",
    deleteConfirm: "Delete this draft? This can’t be undone.",
    deleted: "Draft deleted",
    stepOf: (n, total) => `Step ${n} of ${total}`,
    back: "Back",
    next: "Next",
    saveAndLeave: "Save and leave",
    editSection: "Edit",
    saving: "Saving…",
    saved: "Saved",
    saveError: "Couldn’t save",
    retry: "Retry",
    restoreLoading: "Opening your draft…",
    restoreUnavailable: "Couldn’t open this draft. Please try again.",
    restoreGone: "This draft is no longer available.",
    s1Q: "What keeps going wrong?",
    s1Help: "Describe a specific situation that repeats — not a general topic.",
    s1Placeholder: "e.g. Handoffs at shift change keep missing the double-check step.",
    s1Blocker: "Add a sentence about what keeps happening.",
    s2Q: "Who needs to do something differently?",
    audEveryone: "Everyone",
    audLeaders: "Leaders",
    audJobGroup: "A job group",
    audRole: "A specific role",
    audJobGroupDetail: "Which group?",
    audRoleDetail: "Which role?",
    s2Blocker: "Choose who this is for.",
    s2DetailBlocker: "Add the group or role.",
    s3Q: "After this training, what should they do differently?",
    s3Help: "Describe something another person could see or hear.",
    s3Placeholder: "e.g. The charge nurse reads the dosage back at every handoff before signing off.",
    s3Blocker: "Describe the new action.",
    s3VagueGuidance: "This sounds general. Try naming something someone could actually see or hear.",
    s4Q: "How would you know it happened?",
    s4Help: "What would someone see, hear, record, or confirm?",
    s4Placeholder: "e.g. The receiving nurse confirms a verbal read-back on the handoff sheet.",
    evSeen: "Seen",
    evHeard: "Heard",
    evRecorded: "Recorded",
    evConfirmed: "Confirmed",
    s4Honesty: "Completing the training isn’t proof the behavior changed — this describes what you’d look for in real work.",
    s4Blocker: "Describe what you’d notice.",
    s5Q: "What will help people change this?",
    needKnow: "Know — they mainly need the information",
    needDecide: "Decide — they need to make a judgment or commitment",
    needPractice: "Practice — they need repeated practice",
    needShared: "Shared standard — the team needs one common way of working",
    s5ArenaHint: "This kind of change usually needs practice under pressure — Arena can help later.",
    s5Blocker: "Choose what will help most.",
    s6Q: "What will people learn from?",
    matYoutube: "YouTube video",
    matPdf: "PDF document",
    matWritten: "Written guidance",
    matLive: "Live discussion",
    matYoutubePlaceholder: "Paste a YouTube link (optional for now).",
    matWrittenPlaceholder: "Write the guidance participants will read.",
    matLivePlaceholder: "Notes for whoever facilitates the discussion.",
    matPdfDeferred: "You’ll add the document before creating the session.",
    s6Blocker: "Choose what people will learn from.",
    s7ArenaQ: "Should people practice this in Arena?",
    s7ArenaRecommended: "Recommended for this kind of change.",
    s7ArenaAccept: "Yes, recommend practice",
    s7ArenaDecline: "Not needed",
    s7FollowQ: "When should you check what happened?",
    followNone: "No follow-up",
    follow7: "In 7 days",
    follow30: "In 30 days",
    s7Blocker: "Choose a follow-up timing.",
    reviewEyebrow: "DRAFT SAVED",
    reviewChange: "What needs to change",
    reviewWho: "Who it’s for",
    reviewBehavior: "What people should do differently",
    reviewEvidence: "How you’d recognize success",
    reviewLearning: "Learning approach",
    reviewMaterial: "Material",
    reviewArena: "Practice in Arena",
    reviewFollow: "Follow-up",
    reviewEmpty: "Not added yet",
    arenaYes: "Recommended",
    arenaNo: "Not recommended",
  },
  ko: {
    entryEyebrow: "가이드 설정",
    startNew: "새 훈련 시작",
    starting: "시작하는 중…",
    continueLead: "이어서 계속하세요.",
    continueDraft: "초안 계속",
    draftUpdated: (rel) => `마지막 편집 ${rel}`,
    otherDrafts: "다른 초안",
    deleteDraft: "초안 삭제",
    deleteConfirm: "이 초안을 삭제할까요? 되돌릴 수 없습니다.",
    deleted: "초안이 삭제되었습니다",
    stepOf: (n, total) => `${total}단계 중 ${n}단계`,
    back: "뒤로",
    next: "다음",
    saveAndLeave: "저장하고 나가기",
    editSection: "편집",
    saving: "저장 중…",
    saved: "저장됨",
    saveError: "저장하지 못했습니다",
    retry: "다시 시도",
    restoreLoading: "초안을 여는 중…",
    restoreUnavailable: "이 초안을 열지 못했습니다. 다시 시도해 주세요.",
    restoreGone: "이 초안은 더 이상 사용할 수 없습니다.",
    s1Q: "무엇이 계속 잘못되나요?",
    s1Help: "일반적인 주제가 아니라 반복되는 구체적인 상황을 설명하세요.",
    s1Placeholder: "예: 교대 인수인계에서 이중 확인 단계가 계속 누락됩니다.",
    s1Blocker: "무엇이 반복되는지 한 문장으로 적어 주세요.",
    s2Q: "누가 다르게 행동해야 하나요?",
    audEveryone: "모두",
    audLeaders: "리더",
    audJobGroup: "직군",
    audRole: "특정 역할",
    audJobGroupDetail: "어떤 직군인가요?",
    audRoleDetail: "어떤 역할인가요?",
    s2Blocker: "대상을 선택하세요.",
    s2DetailBlocker: "직군 또는 역할을 적어 주세요.",
    s3Q: "이 훈련 후, 무엇을 다르게 해야 하나요?",
    s3Help: "다른 사람이 보거나 들을 수 있는 것을 설명하세요.",
    s3Placeholder: "예: 담당 간호사가 인수인계마다 서명 전 투약량을 복창합니다.",
    s3Blocker: "새로운 행동을 설명해 주세요.",
    s3VagueGuidance: "다소 일반적입니다. 누군가 실제로 보거나 들을 수 있는 것을 적어 보세요.",
    s4Q: "그 일이 일어난 걸 어떻게 알 수 있나요?",
    s4Help: "누군가 무엇을 보거나, 듣거나, 기록하거나, 확인할까요?",
    s4Placeholder: "예: 인수받는 간호사가 인수인계지에 복창 확인을 표시합니다.",
    evSeen: "봄",
    evHeard: "들음",
    evRecorded: "기록됨",
    evConfirmed: "확인됨",
    s4Honesty: "훈련 완료가 행동 변화의 증거는 아닙니다 — 이것은 실제 업무에서 확인할 것을 설명합니다.",
    s4Blocker: "무엇을 확인할지 설명해 주세요.",
    s5Q: "무엇이 사람들의 변화를 도울까요?",
    needKnow: "알기 — 주로 정보가 필요합니다",
    needDecide: "결정 — 판단이나 다짐이 필요합니다",
    needPractice: "연습 — 반복 연습이 필요합니다",
    needShared: "공통 기준 — 팀에 하나의 공통된 방식이 필요합니다",
    s5ArenaHint: "이런 변화는 보통 압박 속 연습이 필요합니다 — 나중에 Arena가 도울 수 있습니다.",
    s5Blocker: "가장 도움이 될 것을 선택하세요.",
    s6Q: "사람들은 무엇으로 배우나요?",
    matYoutube: "YouTube 영상",
    matPdf: "PDF 문서",
    matWritten: "글 안내",
    matLive: "라이브 토론",
    matYoutubePlaceholder: "YouTube 링크를 붙여넣으세요 (지금은 선택).",
    matWrittenPlaceholder: "참가자가 읽을 안내를 작성하세요.",
    matLivePlaceholder: "토론 진행자를 위한 메모.",
    matPdfDeferred: "세션을 만들기 전에 문서를 추가하게 됩니다.",
    s6Blocker: "사람들이 무엇으로 배울지 선택하세요.",
    s7ArenaQ: "사람들이 Arena에서 연습해야 하나요?",
    s7ArenaRecommended: "이런 변화에 권장됩니다.",
    s7ArenaAccept: "네, 연습을 권장합니다",
    s7ArenaDecline: "필요 없음",
    s7FollowQ: "언제 결과를 확인할까요?",
    followNone: "후속 없음",
    follow7: "7일 후",
    follow30: "30일 후",
    s7Blocker: "후속 시점을 선택하세요.",
    reviewEyebrow: "초안 저장됨",
    reviewChange: "무엇을 바꿔야 하는가",
    reviewWho: "누구를 위한 것인가",
    reviewBehavior: "무엇을 다르게 해야 하는가",
    reviewEvidence: "성공을 어떻게 알아볼까",
    reviewLearning: "학습 방식",
    reviewMaterial: "자료",
    reviewArena: "Arena 연습",
    reviewFollow: "후속 확인",
    reviewEmpty: "아직 추가되지 않음",
    arenaYes: "권장됨",
    arenaNo: "권장되지 않음",
  },
};

export { arenaFollowLabel };
