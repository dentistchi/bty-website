/** Self-contained en/ko copy for the Guided Module Builder (Slice 2.1). Plain,
 *  operational, HOST-oriented language — never "capability", "module schema",
 *  "evidence ladder", "learning objective", etc. */

import type { Locale } from "./copy";

export type ModuleBuilderCopy = {
  // entry
  entryEyebrow: string;
  startNew: string;
  entrySupport: string;
  starting: string;
  continueLead: string;
  // draft card
  untitled: string;
  stepProgress: (n: number) => string;
  editedRel: (rel: string) => string;
  relJustNow: string;
  relMin: (n: number) => string;
  relHour: (n: number) => string;
  relDay: (n: number) => string;
  otherDrafts: string;
  // delete
  deleteDraft: string;
  deleteAction: string;
  moreActions: string;
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
  s4BehaviorLead: string;
  s4VerifyQ: string;
  verifyObserved: string;
  verifyHeard: string;
  verifyRecorded: string;
  verifyConfirmed: string;
  s4VerifyGuidance: string;
  s4Honesty: string;
  s4Blocker: string;
  // step 5 learning needs (multi-select)
  s5Q: string;
  s5Help: string;
  needInfoTitle: string;
  needInfoDesc: string;
  needDecideTitle: string;
  needDecideDesc: string;
  needPracticeTitle: string;
  needPracticeDesc: string;
  needSharedTitle: string;
  needSharedDesc: string;
  s5ArenaHint: string;
  s5Blocker: string;
  // step 6 material intent (YouTube / PDF only)
  s6Q: string;
  matYoutube: string;
  matPdf: string;
  matYoutubePlaceholder: string;
  ytMissingTitle: string;
  requiredBeforeApproval: string;
  pdfMissingLead: string;
  s6Blocker: string;
  // pdf attachment
  pdfAttachLead: string;
  attachPdf: string;
  replacePdf: string;
  removePdf: string;
  uploadingPdf: string;
  removingPdf: string;
  uploadFailed: string;
  removeFailed: string;
  pdfReadyBadge: string;
  pagesLabel: (n: number) => string;
  // files & documents (multi-format assets)
  matFiles: string;
  filesHeader: string;
  filesLead: string;
  attachFiles: string;
  addPhoto: string;
  assetAttached: string;
  assetUploading: string;
  assetRemove: string;
  errUnsupported: string;
  errTooLarge: string;
  errGeneric: string;
  deliveryReady: string;
  deliveryDeferred: string;
  reviewMaterials: string;
  noFilesYet: string;
  // quick-event discoverability
  quickLead: string;
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
  reviewSaved: string;
  reviewLead: string;
  needsAttention: (n: number) => string;
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
  // review needs-attention inline guidance
  gBehaviorNeeds: string;
  gBehaviorHint: string;
  gPdfMissing: string;
  gYtMissing: string;
  // step 6 completion question (participant-facing; host-authored, prefilled with a suggestion)
  s6CompletionQ: string;
  s6CompletionHelp: string;
  s6CompletionPlaceholder: string;
  // step 8 review — completion-question row + publish action
  reviewCompletion: string;
  publishCta: string;
  publishTrust: string;
  publishing: string;
  publishError: string;
  publishNotReady: string;
};

const arenaFollowLabel = (
  days: number | undefined,
  none: string,
  seven: string,
  thirty: string,
): string => (days === 7 ? seven : days === 30 ? thirty : none);

export const MODULE_BUILDER_COPY: Record<Locale, ModuleBuilderCopy> = {
  en: {
    entryEyebrow: "TRAINING BUILDER",
    startNew: "Create team training",
    entrySupport: "Turn a recurring problem into a training your team can use.",
    starting: "Starting…",
    continueLead: "Pick up where you left off.",
    untitled: "Untitled training",
    stepProgress: (n) => `Step ${n} of 7`,
    editedRel: (rel) => `Edited ${rel}`,
    relJustNow: "just now",
    relMin: (n) => `${n} min ago`,
    relHour: (n) => (n === 1 ? "1 hr ago" : `${n} hrs ago`),
    relDay: (n) => (n === 1 ? "1 day ago" : `${n} days ago`),
    otherDrafts: "Other drafts",
    deleteDraft: "Delete draft",
    deleteAction: "Delete",
    moreActions: "More",
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
    s4Q: "After the training, what would show that people are doing this differently?",
    s4Help: "Describe something you could see, hear, record, or have someone confirm in real work.",
    s4Placeholder: "e.g. The read-back is noted on the handoff record.",
    s4BehaviorLead: "You said people should:",
    s4VerifyQ: "How would this be verified?",
    verifyObserved: "Observed directly",
    verifyHeard: "Heard in conversation",
    verifyRecorded: "Recorded in the workflow",
    verifyConfirmed: "Confirmed by another person",
    s4VerifyGuidance: "Choose the clearest source of evidence.",
    s4Honesty: "Completing the training is not proof that the behavior changed — this is what you’d look for in real work.",
    s4Blocker: "Describe what you’d notice.",
    s5Q: "What does this training need to include?",
    s5Help: "Select all that apply.",
    needInfoTitle: "Information",
    needInfoDesc: "People need to understand something.",
    needDecideTitle: "Decision",
    needDecideDesc: "People need to make a judgment or commitment.",
    needPracticeTitle: "Practice",
    needPracticeDesc: "People need to rehearse the behavior.",
    needSharedTitle: "Shared standard",
    needSharedDesc: "The team needs one common way of working.",
    s5ArenaHint: "This kind of change usually needs practice under pressure — Arena can help later.",
    s5Blocker: "Select at least one.",
    s6Q: "What will people learn from?",
    matYoutube: "YouTube video",
    matPdf: "PDF document",
    matYoutubePlaceholder: "Paste a YouTube link.",
    ytMissingTitle: "Link not added yet",
    requiredBeforeApproval: "Required before approval",
    pdfMissingLead: "You’ll add the PDF before approval.",
    s6Blocker: "Choose what people will learn from.",
    pdfAttachLead: "Attach a PDF your team will read.",
    attachPdf: "Attach PDF",
    replacePdf: "Replace PDF",
    removePdf: "Remove",
    uploadingPdf: "Uploading PDF…",
    removingPdf: "Removing…",
    uploadFailed: "Couldn’t upload the PDF — Try again",
    removeFailed: "Couldn’t remove the PDF — Try again",
    pdfReadyBadge: "Ready",
    pagesLabel: (n) => (n === 1 ? "1 page" : `${n} pages`),
    matFiles: "Files and documents",
    filesHeader: "FILES AND DOCUMENTS",
    filesLead: "Add the material your team will use.",
    attachFiles: "Attach files",
    addPhoto: "Add photo or screenshot",
    assetAttached: "Attached",
    assetUploading: "Uploading…",
    assetRemove: "Remove",
    errUnsupported: "Unsupported file type",
    errTooLarge: "File is too large",
    errGeneric: "Couldn’t upload — Try again",
    deliveryReady: "Ready for participant delivery",
    deliveryDeferred: "Delivery setup will be completed before approval.",
    reviewMaterials: "LEARNING MATERIALS",
    noFilesYet: "No files attached yet",
    quickLead: "Need to launch something quickly?",
    s7ArenaQ: "Should people practice this in Arena?",
    s7ArenaRecommended: "Recommended for this kind of change.",
    s7ArenaAccept: "Yes, recommend practice",
    s7ArenaDecline: "Not needed",
    s7FollowQ: "When should you check what happened?",
    followNone: "No follow-up",
    follow7: "In 7 days",
    follow30: "In 30 days",
    s7Blocker: "Choose a follow-up timing.",
    reviewEyebrow: "TRAINING DRAFT",
    reviewSaved: "Saved",
    reviewLead: "Review what you’ve built.",
    needsAttention: (n) => `Needs attention — ${n}`,
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
    gBehaviorNeeds: "Needs clarification",
    gBehaviorHint: "Describe something another person could see or hear.",
    gPdfMissing: "PDF file not added yet",
    gYtMissing: "Link not added yet",
    s6CompletionQ: "Completion question",
    s6CompletionHelp: "The question each participant answers after the material. Edit it freely.",
    s6CompletionPlaceholder: "What is one thing you will apply this week?",
    reviewCompletion: "COMPLETION QUESTION",
    publishCta: "Approve & create session",
    publishTrust: "This creates a live training session with its own join QR. Participants will be able to join and complete it.",
    publishing: "Creating session…",
    publishError: "Couldn’t create the session. Please try once more.",
    publishNotReady: "Complete the highlighted sections first.",
  },
  ko: {
    entryEyebrow: "훈련 빌더",
    startNew: "팀 훈련 만들기",
    entrySupport: "반복되는 문제를 팀이 쓸 수 있는 훈련으로 바꾸세요.",
    starting: "시작하는 중…",
    continueLead: "이어서 계속하세요.",
    untitled: "제목 없는 훈련",
    stepProgress: (n) => `7단계 중 ${n}단계`,
    editedRel: (rel) => `${rel} 편집`,
    relJustNow: "방금",
    relMin: (n) => `${n}분 전`,
    relHour: (n) => `${n}시간 전`,
    relDay: (n) => `${n}일 전`,
    otherDrafts: "다른 초안",
    deleteDraft: "초안 삭제",
    deleteAction: "삭제",
    moreActions: "더보기",
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
    s4Q: "훈련 후, 사람들이 이것을 다르게 하고 있다는 것을 무엇으로 알 수 있나요?",
    s4Help: "실제 업무에서 보거나, 듣거나, 기록하거나, 누군가 확인해 줄 수 있는 것을 설명하세요.",
    s4Placeholder: "예: 복창이 인수인계 기록에 표시됩니다.",
    s4BehaviorLead: "이렇게 해야 한다고 했습니다:",
    s4VerifyQ: "이것을 어떻게 확인하나요?",
    verifyObserved: "직접 관찰",
    verifyHeard: "대화에서 들음",
    verifyRecorded: "업무 흐름에 기록됨",
    verifyConfirmed: "다른 사람이 확인",
    s4VerifyGuidance: "가장 분명한 증거 출처를 선택하세요.",
    s4Honesty: "훈련 완료가 행동 변화의 증거는 아닙니다 — 실제 업무에서 확인할 것을 말합니다.",
    s4Blocker: "무엇을 확인할지 설명해 주세요.",
    s5Q: "이 훈련에는 무엇이 포함되어야 하나요?",
    s5Help: "해당하는 것을 모두 선택하세요.",
    needInfoTitle: "정보",
    needInfoDesc: "사람들이 무언가를 이해해야 합니다.",
    needDecideTitle: "결정",
    needDecideDesc: "사람들이 판단이나 다짐을 해야 합니다.",
    needPracticeTitle: "연습",
    needPracticeDesc: "사람들이 행동을 연습해야 합니다.",
    needSharedTitle: "공통 기준",
    needSharedDesc: "팀에 하나의 공통된 방식이 필요합니다.",
    s5ArenaHint: "이런 변화는 보통 압박 속 연습이 필요합니다 — 나중에 Arena가 도울 수 있습니다.",
    s5Blocker: "최소 하나를 선택하세요.",
    s6Q: "사람들은 무엇으로 배우나요?",
    matYoutube: "YouTube 영상",
    matPdf: "PDF 문서",
    matYoutubePlaceholder: "YouTube 링크를 붙여넣으세요.",
    ytMissingTitle: "링크가 아직 없습니다",
    requiredBeforeApproval: "승인 전 필요",
    pdfMissingLead: "승인 전에 PDF를 추가하게 됩니다.",
    s6Blocker: "사람들이 무엇으로 배울지 선택하세요.",
    pdfAttachLead: "팀이 읽을 PDF를 첨부하세요.",
    attachPdf: "PDF 첨부",
    replacePdf: "PDF 교체",
    removePdf: "제거",
    uploadingPdf: "PDF 업로드 중…",
    removingPdf: "제거 중…",
    uploadFailed: "PDF를 업로드하지 못했습니다 — 다시 시도",
    removeFailed: "PDF를 제거하지 못했습니다 — 다시 시도",
    pdfReadyBadge: "준비됨",
    pagesLabel: (n) => `${n}페이지`,
    matFiles: "파일 및 문서",
    filesHeader: "파일 및 문서",
    filesLead: "팀이 사용할 자료를 추가하세요.",
    attachFiles: "파일 첨부",
    addPhoto: "사진 또는 스크린샷 추가",
    assetAttached: "첨부됨",
    assetUploading: "업로드 중…",
    assetRemove: "제거",
    errUnsupported: "지원하지 않는 파일 형식",
    errTooLarge: "파일이 너무 큽니다",
    errGeneric: "업로드하지 못했습니다 — 다시 시도",
    deliveryReady: "참가자 전달 준비됨",
    deliveryDeferred: "승인 전에 전달 설정이 완료됩니다.",
    reviewMaterials: "학습 자료",
    noFilesYet: "아직 첨부된 파일이 없습니다",
    quickLead: "빠르게 시작해야 하나요?",
    s7ArenaQ: "사람들이 Arena에서 연습해야 하나요?",
    s7ArenaRecommended: "이런 변화에 권장됩니다.",
    s7ArenaAccept: "네, 연습을 권장합니다",
    s7ArenaDecline: "필요 없음",
    s7FollowQ: "언제 결과를 확인할까요?",
    followNone: "후속 없음",
    follow7: "7일 후",
    follow30: "30일 후",
    s7Blocker: "후속 시점을 선택하세요.",
    reviewEyebrow: "훈련 초안",
    reviewSaved: "저장됨",
    reviewLead: "만든 내용을 검토하세요.",
    needsAttention: (n) => `확인 필요 — ${n}`,
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
    gBehaviorNeeds: "명확히 필요",
    gBehaviorHint: "다른 사람이 보거나 들을 수 있는 것을 설명하세요.",
    gPdfMissing: "PDF 파일이 아직 없습니다",
    gYtMissing: "링크가 아직 없습니다",
    s6CompletionQ: "완료 질문",
    s6CompletionHelp: "자료를 본 뒤 참가자가 답하는 질문입니다. 자유롭게 수정하세요.",
    s6CompletionPlaceholder: "이번 주에 적용할 한 가지는 무엇인가요?",
    reviewCompletion: "완료 질문",
    publishCta: "승인하고 세션 만들기",
    publishTrust: "참여용 QR이 있는 실제 훈련 세션을 만듭니다. 참가자가 입장하고 완료할 수 있게 됩니다.",
    publishing: "세션을 만드는 중…",
    publishError: "세션을 만들지 못했습니다. 다시 시도해 주세요.",
    publishNotReady: "먼저 표시된 항목을 완성하세요.",
  },
};

export { arenaFollowLabel };

/**
 * A deterministic, localized completion-question suggestion derived from the
 * module design (observable behavior, else the problem). Shown PREFILLED in the
 * editable field — never an AI-generated prompt applied silently at publish. The
 * host reviews and edits it; a blank field falls back to the service default.
 */
export function suggestCompletionPrompt(
  answers: { observableBehavior?: string; problem?: string } | undefined,
  loc: Locale,
): string {
  const raw = (answers?.observableBehavior ?? answers?.problem ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return loc === "ko" ? "이번 주에 적용할 한 가지는 무엇인가요?" : "What is one thing you will apply this week?";
  const anchor = raw.length > 160 ? `${raw.slice(0, 160).trimEnd()}…` : raw;
  return loc === "ko"
    ? `"${anchor}" — 이번 주에 적용할 한 가지는 무엇인가요?`
    : `Thinking about "${anchor}", what is one thing you will apply this week?`;
}
