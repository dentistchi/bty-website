/** Self-contained en/ko copy for the Foundry Event History Archive (read-only).
 *  Calm and operational — a factual record, never a scoreboard or trophy wall. */

export type Locale = "en" | "ko";

export type HistoryCopy = {
  // surface header
  title: string;
  subtitle: string;
  back: string;
  eyebrow: string;
  // list
  emptyTitle: string;
  emptySub: string;
  completedTag: string;
  endedOn: (date: string) => string;
  participantsCount: (n: number) => string;
  completedCount: (n: number) => string;
  // detail — sections
  sessionDetails: string;
  participation: string;
  trainingMaterials: string;
  completionSummary: string;
  // detail — fields
  createdLabel: string;
  endedLabel: string;
  statusLabel: string;
  participantsLabel: string;
  completedByLabel: string;
  incompleteLabel: string;
  materialVideo: string;
  materialDocument: string;
  /** R4-R2G — the two guidance types name themselves; no enum name ever reaches the Host. */
  materialWrittenGuidance: string;
  materialLiveDiscussion: string;
  /** The stored discriminator is one this build does not know. Honest, never a guess. */
  materialUnknown: string;
  materialNone: string;
  pagesLabel: (n: number) => string;
  reflectionQuestion: string;
  rosterEmpty: string;
  // participant status labels (completion-only)
  status_joined: string;
  status_watching: string;
  status_reading: string;
  status_response_pending: string;
  status_complete: string;
  // states
  loadError: string;
  notFound: string;
  retry: string;
  // date formatting locale tag
  dateLocale: string;
};

export const HISTORY_COPY: Record<Locale, HistoryCopy> = {
  en: {
    title: "History",
    subtitle: "Training sessions you have already run.",
    back: "Back",
    eyebrow: "FOUNDRY",
    emptyTitle: "No past training yet",
    emptySub: "Completed training events will appear here.",
    completedTag: "Completed",
    endedOn: (date) => `Ended ${date}`,
    participantsCount: (n) => (n === 1 ? "1 participant" : `${n} participants`),
    completedCount: (n) => `${n} completed`,
    sessionDetails: "Session details",
    participation: "Participation",
    trainingMaterials: "Training materials",
    completionSummary: "Completion",
    createdLabel: "Created",
    endedLabel: "Ended",
    statusLabel: "Status",
    participantsLabel: "Participants",
    completedByLabel: "Completed by",
    incompleteLabel: "Not completed",
    materialVideo: "Video",
    materialDocument: "Document",
    materialWrittenGuidance: "Written guidance",
    materialLiveDiscussion: "Live discussion",
    materialUnknown: "This material can't be shown in this version.",
    materialNone: "No training material recorded.",
    pagesLabel: (n) => `${n} ${n === 1 ? "page" : "pages"}`,
    reflectionQuestion: "Completion question",
    rosterEmpty: "No one joined this session.",
    status_joined: "Joined",
    status_watching: "Watching",
    status_reading: "Reading",
    status_response_pending: "Response pending",
    status_complete: "Completed",
    loadError: "Could not load history. Please retry.",
    notFound: "This session could not be found.",
    retry: "Retry",
    dateLocale: "en-US",
  },
  ko: {
    title: "지난 훈련",
    subtitle: "이미 진행한 훈련 세션들입니다.",
    back: "뒤로",
    eyebrow: "FOUNDRY",
    emptyTitle: "아직 지난 훈련이 없습니다",
    emptySub: "완료된 훈련 이벤트가 여기에 표시됩니다.",
    completedTag: "완료됨",
    endedOn: (date) => `${date} 종료`,
    participantsCount: (n) => `참가자 ${n}명`,
    completedCount: (n) => `${n}명 완료`,
    sessionDetails: "세션 정보",
    participation: "참여",
    trainingMaterials: "훈련 자료",
    completionSummary: "완료 현황",
    createdLabel: "생성",
    endedLabel: "종료",
    statusLabel: "상태",
    participantsLabel: "참가자",
    completedByLabel: "완료",
    incompleteLabel: "미완료",
    materialVideo: "영상",
    materialDocument: "문서",
    materialWrittenGuidance: "문서 가이드",
    materialLiveDiscussion: "라이브 논의",
    materialUnknown: "이 버전에서는 이 자료를 표시할 수 없습니다.",
    materialNone: "기록된 훈련 자료가 없습니다.",
    pagesLabel: (n) => `${n}페이지`,
    reflectionQuestion: "완료 질문",
    rosterEmpty: "이 세션에 참여한 사람이 없습니다.",
    status_joined: "입장",
    status_watching: "시청 중",
    status_reading: "읽는 중",
    status_response_pending: "응답 대기",
    status_complete: "완료",
    loadError: "기록을 불러오지 못했습니다. 다시 시도해 주세요.",
    notFound: "이 세션을 찾을 수 없습니다.",
    retry: "다시 시도",
    dateLocale: "ko-KR",
  },
};
