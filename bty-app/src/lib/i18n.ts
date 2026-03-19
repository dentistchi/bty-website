import type { ResilienceLevelDisplayLabelKey } from "@/domain/center/resilience";
import { DASHBOARD_RECOMMENDATION_EMPTY_PLACEHOLDER_KEY } from "@/domain/dashboard";
import {
  HEALING_PROGRESS_BLOCKED_COOLDOWN_DISPLAY_KEY,
  HEALING_PROGRESS_BLOCKED_PHASE_DISPLAY_KEY,
} from "@/domain/healing";
import {
  ARENA_RUN_DETAIL_EMPTY_DISPLAY_KEY,
  ARENA_RUN_DETAIL_LOADING_DISPLAY_KEY,
} from "@/domain/rules/arenaRunDetailDisplay";
import type { WeeklyCompetitionStageTierBandDisplayLabelKey } from "@/domain/rules/weeklyCompetitionDisplay";

export type Locale = "ko" | "en";

export type Messages = {
  /** §2: 전환 중 로딩 문구 (locale별) */
  loading: { message: string; hint: string };
  nav: { center: string; bty: string; arena: string; en: string; ko: string; skipToMainContent: string };
  login: {
    title: string;
    afterLoginGoTo: string;
    email: string;
    password: string;
    submit: string;
    submitting: string;
    cookieNotice: string;
    errorDefault: string;
    forgotPassword: string;
    forgotPasswordSent: string;
    forgotPasswordError: string;
  };
  auth: { backToLogin: string; loading: string; callbackError: string };
  logout: string;
  /**
   * 도메인 stable 키(weeklyTierDisplayLabelKey·arenaRunStateDisplayLabelKey)와 1:1.
   * @see domain/rules/leaderboard.ts · arenaRunState.ts
   */
  arena: {
    weeklyTierBronze: string;
    weeklyTierSilver: string;
    weeklyTierGold: string;
    weeklyTierPlatinum: string;
    runStateInProgress: string;
    runStateCompleted: string;
    runStateAborted: string;
    /** leaderboardTieRankSuffixDisplayKey(true) — 위 행과 동일 주간 XP 동순위 접미 */
    tieRankSuffix: string;
  };
  /** 도메인 reflectTextLengthHintKey → 문구 (Arena 성찰 입력). */
  reflectHints: {
    reflect_hint_empty: string;
    reflect_hint_short: string;
    reflect_hint_developing: string;
    reflect_hint_substantial: string;
    reflect_hint_near_limit: string;
    reflect_hint_at_limit: string;
  };
  integrity: {
    title: string;
    subtitle: string;
    /** 연습 플로우 2종 화면 보강: 단계 2 안내 라벨 */
    stepLabelGuide?: string;
    /** §7 2차: 단계 2 안내 문구 */
    guideMessage: string;
    startPractice: string;
    intro: string;
    placeholder: string;
    send: string;
    thinking: string;
    /** 빈 대화 영역 안내 (메시지 없을 때 EmptyState 메인 문구, render-only) */
    emptyHint: string;
    /** Optional hint under empty state message */
    emptyStateHint?: string;
    backToFoundry: string;
    reply: string;
    /** §7 2차: 단계 5 완료 */
    doneTitle: string;
    doneSub: string;
    doneCtaComplete: string;
    doneCtaMentor: string;
    doneCtaFoundry: string;
    /** Dojo 연습 플로우 2종 연동: 역지사지 완료 후 50문항 진단으로 */
    doneCtaAssessment: string;
    /** API 실패(네트워크 등) 시 표시 (render-only) */
    apiError: string;
    /** Error section title (e.g. for role=alert) */
    errorTitle?: string;
    /** API가 빈 응답일 때 표시 (render-only) */
    replyFallback: string;
    /** aria-label: 연습 시작 버튼 */
    ariaStartPractice?: string;
    /** aria-label: 연습 완료 버튼 */
    ariaCompletePractice?: string;
    /** aria-label: 갈등 입력 필드 */
    ariaInputLabel?: string;
    /** aria-label: Dr. Chi 응답 대기 (로딩 스켈레톤) */
    ariaWaitingChi?: string;
    /** 멘토 이름 라벨 (응답 버블 상단) */
    mentorName?: string;
    conversationSimulatorAria: string;
    messageComposerAria: string;
    /** 역지사지 페이지 메인 랜드마크 */
    integrityMainRegionAria: string;
  };
  center: {
    /** §2: 전환 중 로딩/대기 문구 (locale에 맞게) */
    loading: string;
    /** Dear Me 페이지 메인 랜드마크 접근성 라벨 */
    mainAriaLabel: string;
    /** Dear Me 페이지 상단 헤더(제목·안내) 영역 라벨 */
    headerLabel: string;
    /** Dear Me 페이지 본문 영역 라벨 */
    contentLabel: string;
    title: string;
    /** §1·§8: 아늑한 방 헤더 (locale별) */
    heroTitleMain?: string;
    heroTitleAccent?: string;
    tagline: string;
    /** §5: 단일 CTA 라벨 (문 열고 나가기 / 연습하러 가기 통합) */
    ctaToFoundry: string;
    linkToBty: string;
    assessmentCta: string;
    assessmentCtaSub: string;
    /** §3: 5문항 아래 안내 — "더 자세한 테스트를 원하시면 클릭하세요" + 50문항 링크 */
    assessmentDetailHint: string;
    entryIntro: string;
    startCta: string;
    /** 2단계: 오늘의 나 */
    todayStepTitle: string;
    todayMoodLabel: string;
    todayEnergyLabel: string;
    todayOneWordLabel: string;
    /** §8: locale별 placeholder (기분/한 단어 입력) */
    todayMoodPlaceholder: string;
    todayOneWordPlaceholder: string;
    todayNext: string;
    todaySkip: string;
    /** §1·§5: EmotionalBridge 문구 (문 열고 나가기) */
    bridgeHeading: string;
    bridgeSub: string;
    /** 3단계: 편지 쓰기 */
    letterStepTitle: string;
    /** 편지 입력·제출 그룹 접근성 라벨 */
    letterFormLabel: string;
    letterPrompt: string;
    letterPlaceholder: string;
    submitLetter: string;
    sendingLetter: string;
    /** 4단계: 답장 */
    replyStepTitle: string;
    /** 답장 영역(완료 안내+답장 내용) 그룹 접근성 라벨 */
    replySummaryLabel: string;
    /** 5단계: 완료 */
    completedTitle: string;
    completedSub: string;
    continueToChat: string;
    /** 편지 이력 */
    letterHistoryTitle: string;
    /** 이력 목록(ul) 전용 접근성 라벨 */
    letterHistoryListAria: string;
    letterHistoryEmpty: string;
    letterHistoryError: string;
    letterHistoryLoading: string;
    letterHistoryReplied: string;
    letterHistoryNoReply: string;
    /** 답장 화면 하단 액션 그룹 접근성 라벨 (다시 쓰기·Center로) */
    replyActionsLabel: string;
    /** Dear Me 페이지 푸터(Center 링크) 영역 라벨 */
    footerLabel: string;
  };
  bty: {
    title: string;
    tagline: string;
    linkToCenter: string;
    entryIntro: string;
    startCta: string;
    arenaCta: string;
    dashboardLabel: string;
    leaderboardLabel: string;
    /** 대시보드 LE Stage·AIR 위젯 카드 라벨 */
    leStageLabel: string;
    airLabel: string;
    /** 대시보드 추천 위젯 카드 라벨 */
    recommendationLabel: string;
    /** DASHBOARD_RECOMMENDATION_EMPTY_PLACEHOLDER_KEY */
    recommendationEmptyPlaceholder: string;
    /** AIR 위젯: 로드 실패 시 문구 */
    airUnavailable: string;
    /** 대시보드 주간 성찰 위젯 영역 aria-label */
    weeklyReflectionRegion: string;
    /** 대시보드 Personal Record 위젯 영역 aria-label */
    personalRecordRegion: string;
    /** 대시보드 Streak 카드 라벨 */
    streakLabel: string;
    /** 대시보드 Points Today 카드 라벨 */
    pointsTodayLabel: string;
    /** 대시보드 Lifetime Progress 카드 라벨 */
    lifetimeProgressLabel: string;
    /** 대시보드 Dojo 연습 카드 라벨 */
    dojoPracticeLabel: string;
    /** Dojo 연습 링크 영역 aria-label */
    dojoPracticeLinksRegion: string;
    /** 리더보드 주간 리셋 일시 영역 aria-label */
    leaderboardWeekResetRegion: string;
    /** 대시보드 Arena 티어 카드 (GET /api/arena/core-xp 의 tier 표시만) */
    dashboardTierCardLabel: string;
    dashboardTierCardSubline: string;
    dashboardTierCardRegionAria: string;
    /** LE Stage·AIR 카드 묶음 랜드마크 (접근성) */
    leAirSummarySectionAria: string;
    /** 대시보드 상단 바로가기: Arena */
    /** 대시보드 바로가기 → /bty-arena/play (허브와 구분) */
    dashboardShortcutGoArena: string;
    /** 대시보드 상단 바로가기: 주간 랭킹 */
    dashboardShortcutWeeklyRanking: string;
    /** 리더보드 카드·목록 묶음 랜드마크 */
    leaderboardMainRegionAria: string;
    /** 대시보드 히어로 부제 (한눈에 보기) */
    dashboardHeroSubtitle: string;
    /** 주간 XP·랭킹 위젯 (API 표시만, 순위는 리더보드 링크) */
    dashboardWeeklyRankWidgetTitle: string;
    dashboardWeeklyWidgetLoading: string;
    dashboardWeeklyWidgetAria: string;
    dashboardWeeklyXpCaption: string;
    /** 주간 티어 라벨(도메인 calculateTier→weeklyTierDisplayLabelKey→arena) 상단 캡션 */
    dashboardWeeklyTierCaption: string;
    /** weeklyCompetitionStageTierBandDisplayLabelKey 캡션 */
    dashboardWeeklyCompetitionStageCaption: string;
    weeklyCompetitionStageBandBronze: string;
    weeklyCompetitionStageBandSilver: string;
    weeklyCompetitionStageBandGold: string;
    weeklyCompetitionStageBandPlatinum: string;
    /** LE Stage 위젯 진행 바 접근성 */
    leStageLeProgressBarAria: string;
    dashboardWeeklyRankSeeLeaderboard: string;
    dashboardWeeklyRankHint: string;
    /** 대시보드: 라이브 리더보드 미리보기 모달 */
    dashboardOpenLiveLeaderboardCta: string;
    dashboardLiveLeaderboardModalTitle: string;
    dashboardLiveLeaderboardModalAria: string;
    dashboardLiveLeaderboardLoading: string;
    dashboardLiveLeaderboardEmpty: string;
    dashboardLiveLeaderboardClose: string;
    dashboardLiveLeaderboardFullPage: string;
    dashboardLiveLeaderboardFailed: string;
    /** 모달 보조 설명(aria-describedby) */
    dashboardLiveLeaderboardModalDesc: string;
    /** 순위 목록 ul 접근성 라벨 */
    dashboardLiveLeaderboardListAria: string;
    /** 내 순위 없을 때 상위 목록 안내 */
    dashboardLiveLeaderboardNotRankedBanner: string;
    /** nearMe 비어 전체 상위 표시 시 */
    dashboardLiveLeaderboardNearMeFallbackBanner: string;
    /** 닫기 버튼 스크린리더 */
    dashboardLiveLeaderboardCloseAria: string;
    /** LE stage-summary 위젯 스크린리더 부연 */
    leStageSummaryWidgetDesc: string;
    /** 프로필(Code·Sub Name) 카드 */
    profileCodeNameCardLabel: string;
    profileIdentitySubline: string;
    profileRenamePlaceholder: string;
    profileSaveSubName: string;
    profileSaving: string;
    eliteMeContentUnlockedLabel: string;
    eliteMeContentUnlockedYes: string;
    eliteMeContentUnlockedNo: string;
    /** LE 카드 내 TII·인증 요약 밴드 */
    leEngineTiiCertifiedBandAria: string;
    /** 시즌 카드: 주간 XP·이벤트·주간 구간 묶음 */
    weeklySeasonActivityAria: string;
    /** 대시보드 페이지 h1 */
    dashboardPageTitle: string;
    /** Foundry 허브 메인 랜드마크 */
    foundryHubMainLandmarkAria: string;
    /** Foundry 기능 카드 그리드 */
    foundryFeatureCardsRegionAria: string;
    foundryBackToBtyHome: string;
    /** bty 인덱스: Arena·Center·Foundry 한 줄 설명 */
    indexThreeHubsExplainer: string;
    /** bty 인덱스: 세 허브 진입 카드 묶음 (landmark) */
    indexHubEntriesRegionAria: string;
    /** 오늘 획득 XP 카드 부가 설명 */
    pointsTodaySubline: string;
    /** 대시보드 AIR 위젯: integritySlip 플래그 시 (API 값만 표시) */
    airIntegritySlip: string;
    /** LE Stage 요약 API 실패·빈 응답 시 */
    leStageSummaryUnavailable: string;
    /** AIR 7·14·90일 그룹 라벨 (접근성) */
    leAirAria7d: string;
    leAirAria14d: string;
    leAirAria90d: string;
    leAirAriaGrid: string;
    /** LE·AIR 위젯: AIR API 대기 중 */
    leAirLoading: string;
    leStageSummarySectionAria: string;
    leStageStagePrefix: string;
    leStageResetDueLabel: string;
    leStageArenaSummaryHeading: string;
    leStageBehaviorHeading: string;
    leStageLoading: string;
  };
  /** 자존감 50문항 결과 화면 (Center assessment). */
  assessmentResult: {
    /** 본문(점수·레이더·권장 트랙) 영역 aria-label */
    mainContentRegionAria: string;
    /** 하단 다음 단계 CTA 그룹 aria-label */
    nextStepsCtaGroupAria: string;
    start28ProgramCta: string;
    retakeCta: string;
    /** CTA 그룹용 스크린리더 전용 제목 */
    ctaSrOnlyHeading: string;
  };
  landing: {
    heroTitle: string;
    heroSubtitle: string;
    recommended: string;
    arenaTitle: string;
    arenaDesc: string;
    arenaCta: string;
    foundryTitle: string;
    foundryDesc: string;
    foundryCta: string;
    centerTitle: string;
    centerDesc: string;
    centerCta: string;
    /** 대시보드 상단 카드 내 "Today's growth" 섹션으로 가는 링크 문구 */
    todayGrowthLink: string;
    footerHint: string;
  };
  safeMirror: {
    title: string;
    subtitle: string;
    placeholder: string;
    submit: string;
    submitting: string;
    /** §8: API 실패 시 표시할 답장 대체 문구 (locale별) */
    fallbackReply: string;
  };
  smallWins: {
    title: string;
    subtitle: string;
    add: string;
    customPlaceholder: string;
    count: string;
    suggested: string[];
  };
  selfEsteem: {
    title: string;
    subtitle: string;
    again: string;
    choices: { value: number; label: string }[];
    questions: string[];
    storyLabels: string[];
    results: {
      high: string;
      mid: string;
      low: string;
      strengthHigh: string;
      strengthMid: string;
      strengthLow: string;
      scoreSuffix: string;
    };
  };
  chat: {
    title: string;
    placeholder: string;
    send: string;
    thinking: string;
    /** 연결 끊김/에러 시 표시 문구 */
    connectionError: string;
    /** 재시도 버튼 라벨 */
    retry: string;
    /** CHATBOT_TRAINING_CHECKLIST §2.3: 빈 채팅 시 소개 문구 (Foundry) */
    introFoundry: string;
    /** CHATBOT_TRAINING_CHECKLIST §2.3: 빈 채팅 시 소개 문구 (Center) */
    introCenter: string;
    /** 공간 전환 시 한 줄 안내 (Foundry) */
    spaceHintFoundry: string;
    /** 공간 전환 시 한 줄 안내 (Center) */
    spaceHintCenter: string;
    /** CHATBOT_TRAINING: 빈 채팅 시 소개 문구 (Arena) */
    introArena: string;
    /** 공간 전환 시 한 줄 안내 (Arena) */
    spaceHintArena: string;
    /** 예시 문구 섹션 라벨 (빈 채팅 시) */
    exampleLabel: string;
    /** Foundry에서 클릭 가능한 예시 문구 (2~3개) */
    examplePhrasesFoundry: string[];
    /** Center에서 클릭 가능한 예시 문구 (2~3개) */
    examplePhrasesCenter: string[];
    /** Arena에서 클릭 가능한 예시 문구 (1~2개) */
    examplePhrasesArena: string[];
    rememberConversation: string;
    deleteHistory: string;
  };
  resilience: {
    title: string;
    subtitle: string;
    /** §4·§8: 일별 궤적 있을 때 그래프 부제 (locale별) */
    dailyTrajectorySubtitle: string;
    /** §4 CENTER_PAGE: 그래프 데이터 없을 때 안내 문구 */
    emptyMessage: string;
    past: string;
    now: string;
    /** resilienceLevelDisplayLabelKey(low|mid|high) */
    levelLow: string;
    levelMid: string;
    levelHigh: string;
    levelLegendAria: string;
  };
  arenaLevels: {
    membershipPending: string;
    /** PROJECT_BACKLOG §8: 빈 상태 — 해금된 레벨이 아직 없을 때 */
    noLevelsYet: string;
    /** BRIEF §2: 빈 상태 CTA 버튼 문구 */
    emptyCta: string;
    loginRequired: string;
    track: string;
    unlockedUpTo: string;
    /** ARENA_UI_REDESIGN_BRIEF 프롬프트 D: 레벨 카드 포근한 문구 */
    levelCardHint: string;
    l4AdminGranted: string;
    staff: string;
    leader: string;
    l4Partner: string;
  };
  avatarOutfit: {
    label: string;
    professional: string;
    fantasy: string;
    hint: string;
    /** §2: 아바타 설정 페이지 전용 */
    pageTitle: string;
    backToFoundry: string;
    backToFoundryAria: string;
    goToDashboard: string;
    goToDashboardAria: string;
    preview: string;
    previewAria: string;
    character: string;
    characterLocked: string;
    characterChangeHint: string;
    outfit: string;
    noOutfits: string;
    save: string;
    saving: string;
    saveAria: string;
    errorLoad: string;
    /** outfitKey → 표시 라벨 (en/ko) */
    outfitLabels: Record<string, string>;
  };
  arenaMembership: {
    label: string;
    approved: string;
    pending: string;
    hint: string;
    jobFunction: string;
    joinedAt: string;
    leaderStartedAt: string;
    submit: string;
    submitting: string;
    submitError: string;
    submitSuccess: string;
    seniorDoctorHint: string;
    validationRequired: string;
  };
  /** 멘토 대화 신청·승인 UI (PHASE_4_ELITE_5_PERCENT_SPEC §10 3차). API 응답만 표시(render-only). */
  mentorRequest: {
    cardTitle: string;
    cardDesc: string;
    requestCta: string;
    submitting: string;
    statusPending: string;
    statusApproved: string;
    statusRejected: string;
    messageLabel: string;
    messagePlaceholder: string;
    errorEliteOnly: string;
    errorPendingExists: string;
    errorSubmit: string;
    approvedCta: string;
    /** 목록 화면: 제목·빈 상태·컬럼 라벨 */
    listTitle: string;
    listEmpty: string;
    colDate: string;
    colStatus: string;
    /** 도메인 키 elite_mentor_sla_response_imminent 표시 */
    slaImminentBadge: string;
    /** eliteMentorRequestTerminalLabelKey(approved) */
    eliteDomainTerminalApproved: string;
    /** eliteMentorRequestTerminalLabelKey(rejected) */
    eliteDomainTerminalRejected: string;
    /** eliteMentorPendingStaleLabelKey */
    eliteDomainPendingStale: string;
    /** eliteMentorRequestStatusDisplayLabelKey */
    eliteStatusBadgePending: string;
    eliteStatusBadgeApproved: string;
    eliteStatusBadgeRejected: string;
  };
  /** Elite 전용 페이지 (§7 서클 모임 카드 등). isElite 분기·render-only. §4차 해금 확장: 해금 조건·노출 문구. */
  elitePage: {
    circleCardTitle: string;
    circleCardDesc: string;
    circleCardPlaceholder: string;
    /** 배지 kind → 표시 문구 (API badges[].labelKey와 매핑). */
    badgeLabels?: Record<string, string>;
    /** 엘리트 4차 해금 확장: 해금 조건·노출 (render-only). */
    unlockConditionTitle: string;
    unlockConditionMet: string;
    unlockConditionLocked: string;
    unlockExposureTitle: string;
    unlockExposureMet: string;
    unlockExposureLocked: string;
    /** Elite 멘토·심화 대화 링크 목록 접근성 */
    mentorDeepLinksListAria: string;
    loadingElitePageAria: string;
    pageTitle: string;
    pageIntroElite: string;
    badgesSectionTitle: string;
    tableColActions: string;
  };
  /** Admin: 멘토 신청 큐·승인 UI. API 응답만 표시(render-only). */
    mentorRequestAdmin: {
    title: string;
    description: string;
    empty: string;
    loading: string;
    actions: string;
    userId: string;
    createdAt: string;
    message: string;
    colStatus: string;
    tableCaption: string;
    queueTableAria: string;
    approveRejectGroupAria: string;
    statusPendingLabel: string;
    approve: string;
    reject: string;
    approving: string;
    rejecting: string;
    error: string;
    errorLoadQueue: string;
    errorPatch: string;
    debugLink: string;
    usersLink: string;
    arenaMembershipLink: string;
  };
  /** Foundry 멘토 허브(1:1 대화). */
  mentorPage: {
    deleteAllHistoryConfirm: string;
    /** 멘토 허브 메인 랜드마크 */
    pageMainLandmarkAria: string;
    topicChoiceGroupAria: string;
  };
  /** Dental RPG 장비 카드 UI. 레어리티 1–5 표시. */
  dentalRpg: {
    empty: string;
    listAria: string;
    rarity1: string;
    rarity2: string;
    rarity3: string;
    rarity4: string;
    rarity5: string;
  };
  /** Healing 인덱스·Awakening 진입. Q4. */
  healing: {
    title: string;
    intro: string;
    awakeningCta: string;
    dashboardCta: string;
    navLabel: string;
    ariaAwakening: string;
    ariaDashboard: string;
    loading: string;
    /** Phase 없을 때 빈 상태 문구. */
    emptyPhase: string;
    /** API 실패 시 에러 문구. */
    loadError: string;
    /** 2차 각성 페이지 로딩 시 메인 랜드마크 라벨. */
    awakeningLoadingLabel: string;
    /** Healing 인덱스: 단계·로딩·에러 영역 접근성 */
    phaseProgressRegionAria: string;
    /** 2차 각성: 1~3막 의식 콘텐츠 묶음 */
    awakeningRitualActsRegionAria: string;
    /** Awakening·대시보드 링크 nav 바깥 랜드마크 */
    healingBottomNavSectionAria: string;
    mainLandmarkAria: string;
    stubApiSectionTitle: string;
    phaseFieldLabel: string;
    ringTypeFieldLabel: string;
    stubRenderOnlyNote: string;
    /** Q4 GET /api/bty/awakening 액트 목록·진행 스텁 */
    awakeningActsTrackTitle: string;
    awakeningActsTrackRegionAria: string;
    awakeningActsTriggerLine: string;
    awakeningActDone: string;
    awakeningActOpen: string;
    awakeningRecordNextCta: string;
    awakeningAllActsRecorded: string;
    awakeningProgressToastOk: string;
    awakeningProgressToast409: string;
    awakeningProgressToast400: string;
    awakeningProgressToastNetwork: string;
    awakeningActsLoadError: string;
    healingAwakeningProgressHeading: string;
    healingAwakeningProgressPct: string;
    healingProgressbarValuetext: string;
    healingProgressbarDetailAllDone: string;
    healingProgressbarDetailNext: string;
    healingProgressbarDetailSync: string;
    healingAwakeningAllActsDone: string;
    healingNextActFromApi: string;
    healingNextActSyncHint: string;
    healingProgressRefreshHint: string;
    healingProgressRefreshCta: string;
    awakeningActsGridAria: string;
    awakeningActNumberLabel: string;
    healingActsOverallProgressAria: string;
    healingActsOverallProgressCaption: string;
    healingActsOverallProgressValuetext: string;
    /** healingAwakeningActBlockedMessageKey */
    healingAwakeningBlockedOrderRequired: string;
    healingAwakeningBlockedAlreadyComplete: string;
    /** healingAwakeningActLockReasonDisplayKey */
    healingActLockPrerequisite: string;
    healingActLockAlreadyComplete: string;
    /** healingPathProgressBlockedUserDisplayKey — 쿨다운(향후 API) */
    pathProgressBlockedCooldown: string;
    /** 선행 단계 미충족 등 */
    pathProgressBlockedPhase: string;
  };
  /** 28일 훈련(Train) 사이드바·진도. */
  train: {
    title: string;
    /** 완료 버튼·코치/요약 전환 그룹 접근성 라벨 */
    completeGroupLabel: string;
    /** 오른쪽 패널 완료 요약 영역 접근성 라벨 */
    completionSummaryLabel: string;
    /** 오른쪽 패널 코치 대화 영역 접근성 라벨 */
    coachChatLabel: string;
    /** 완료 요약 내 보강 질문 블록 접근성 라벨 */
    reinforcementLabel: string;
    /** 왼쪽 사이드바 일자 목록 네비게이션 라벨 */
    dayListLabel: string;
    /** 가운데 레슨 본문 영역 라벨 */
    lessonLabel: string;
    /** 잠긴 레슨 안내(status) 라벨 */
    lockedLabel: string;
    /** 오른쪽 패널(완료 요약·코치 대화) 영역 라벨 */
    sidebarPanelLabel: string;
    /** 28일 훈련(journey) 시작 페이지 제목·안내 */
    journeyStartTitle: string;
    journeyStartIntro: string;
    journeyStartDay1Link: string;
    journeyStartDay1Aria: string;
  };
  /** Dojo 50문항 결과 화면. 영역별 점수·Dr. Chi 코멘트 표시(render-only). */
  dojoResult: {
    title: string;
    areaScoresTitle: string;
    drChiCommentTitle: string;
    /** summaryKey별 Dr. Chi 코멘트 (API mentorComment 템플릿용). */
    resultCommentHigh: string;
    resultCommentMid: string;
    resultCommentLow: string;
    loading: string;
    noAnswers: string;
    backToAssessment: string;
    apiError: string;
    dimensionLabels: Record<string, string>;
    /** 결과 페이지 다음 액션 그룹 라벨 (접근성). */
    nextActionsLabel: string;
    /** Dojo 결과 페이지 하단 액션 그룹 라벨 (다시 진단·과거 보기). */
    resultActionsLabel: string;
    /** 50문항 현재 문항·선택지 카드 영역 */
    questionStepSectionAria: string;
    /** 결과: 점수 막대·코멘트 묶음 */
    resultScoresInsightRegionAria: string;
    /** Dojo 50문항 페이지 메인 랜드마크 */
    dojoPageMainAria: string;
    /** Dojo 과거 진단 이력 페이지 메인 영역 */
    dojoHistoryMainRegionAria: string;
  };
  /** Arena 런 페이지·컴포넌트 문구. locale=ko 시 한국어만 표시(render-only). */
  arenaRun: {
    reflectionPrompt: string;
    errorStartRun: string;
    errorSignIn: string;
    errorAlreadySubmitted: string;
    errorSubmitFailed: string;
    heroTitle: string;
    otherLabel: string;
    otherRecorded: string;
    nextScenario: string;
    otherPlaceholder: string;
    cancel: string;
    submit: string;
    liveRanking: string;
    completeErrorPrefix: string;
    completeErrorSuffix: string;
    headerTitle: string;
    headerSubtitle: string;
    pauseLabel: string;
    resetLabel: string;
    mainLabel: string;
    startSimulation: string;
    confirm: string;
    reflectionTitle: string;
    reflectionNext: string;
    reflectionOptional: string;
    reflectionPlaceholder: string;
    systemOutput: string;
    skipFollowUp: string;
    followUpSelected: string;
    step6Title: string;
    /** Arena 런 메인 랜드마크 */
    mainPlayLandmarkAria: string;
    preparingNewScenarioAria: string;
    scenarioProgressPanelAria: string;
    reflectionBusyAria: string;
    reflectionSentenceBlockAria: string;
    reflectionChoiceOptionsAria: string;
    /** 성찰 본문 글자 수·힌트 영역 */
    reflectionLengthHintAria: string;
    reflectionCharCount: string;
    youChose: string;
    keyInsight: string;
    principle: string;
    completeBtn: string;
    reflectionBonusLabel: string;
    deepeningTitle: string;
    nextActionLabel: string;
    step7Title: string;
    step7Body: string;
    choiceLabel: string;
    /** 시나리오 완료(결과 전환) 시 토스트 문구 */
    scenarioCompletedToast: string;
    /** 시나리오를 찾을 수 없을 때(빈 상태) 메시지·힌트 */
    scenarioNotFound: string;
    scenarioNotFoundHint: string;
    /** §4 Past scenarios: 제목·접기/펼치기·빈 상태·에러·재시도 */
    pastScenariosHeading: string;
    pastScenariosCollapse: string;
    pastScenariosExpand: string;
    loadingHistory: string;
    couldNotLoadHistory: string;
    /** 세션 쿠키가 API에 안 잡힐 때(Edge 등) 과거 시나리오 대신 안내 */
    pastScenariosSessionHint: string;
    retryLoadHistory: string;
    retry: string;
    noCompletedScenarios: string;
    startFirstScenario: string;
    completed: string;
    inProgress: string;
    /** POST reflect 실패 시(성찰 저장은 됨) */
    reflectDeepeningUnavailable: string;
  };
  /** PROJECT_BACKLOG §8: 대시보드 감정 스탯 카드 빈 상태·에러 */
  emotionalStats: {
    emptyMessage: string;
    /** §2 v3: 섹션 제목 (오늘의 성장 / Today's growth) */
    sectionTitle: string;
    errorLoad: string;
  };
  /** 프로필 페이지: 표시용 필드(display_name) 표시·편집. API 응답/제출만 사용. */
  profile: {
    title: string;
    displayNameLabel: string;
    displayNamePlaceholder: string;
    save: string;
    saving: string;
    backToDashboard: string;
    errorLoad: string;
    errorSave: string;
    errorTooLong: string;
    avatarSettingsLink: string;
    /** 저장 버튼 접근성(스크린 리더용) */
    saveButtonAriaLabel: string;
  };
  /** Phase 1 스텁: Arena wireframe / Growth / My Page 공통 문구·네비 */
  uxPhase1Stub: {
    bottomNavArena: string;
    bottomNavGrowth: string;
    bottomNavMyPage: string;
    growthTitle: string;
    growthSubtitle: string;
    growthLead: string;
    growthReturnArena: string;
    growthWeeklyRankingLink: string;
    growthFoundryLink: string;
    growthOptionsRegionAria: string;
    wireframeLandmarkAria: string;
    weeklySnapshotRegionAria: string;
    wireframeScreenTitle: string;
    wireframeScreenSubtitle: string;
    wireframeSystemReady: string;
    wireframePlayGame: string;
    wireframeStartScenario: string;
    wireframeContinue: string;
    wireframeResumeLast: string;
    wireframeOr: string;
    wireframeWeeklyRankLine: string;
    wireframeSeasonLine: string;
    wireframeWireRuleNote: string;
    wireframeResultStubPrefix: string;
    resultTitle: string;
    resultSubtitle: string;
    resultCoreXpSample: string;
    resultWeeklyXpSample: string;
    resultSampleNote: string;
    resultSystemTitle: string;
    resultSystemBody: string;
    resultContinueCta: string;
    resultReturnArenaCta: string;
    resultWireHubLink: string;
    growthArenaPlayLink: string;
    growthArenaWireHubLink: string;
    growthShortcutsNavAria: string;
    growthElitePageLink: string;
    wireframeFoundryEliteAria: string;
    growthHealingLink: string;
    growthAwakeningLink: string;
    resultRunCompleteHint: string;
    resultShareRegionAria: string;
    resultShareCta: string;
    resultShareCopied: string;
    resultShareFailed: string;
    resultShareClipboardLine: string;
    resultNextActionsRegionAria: string;
    resultNextScenarioSectionLabel: string;
    resultNextScenarioCta: string;
    resultNextScenarioSub: string;
    wireframeArenaPracticeNavAria: string;
    wireframeDojoLink: string;
    wireframeIntegrityLink: string;
    wireframeRunsDashboardHint: string;
    growthMyRankCardTitle: string;
    growthMyRankRegionAria: string;
    growthMyRankLoading: string;
    growthMyRankYourRank: string;
    growthMyRankWeeklyXpLine: string;
    growthMyRankNoRank: string;
    /** 이번 주 주간 XP 0·비참가 안내 */
    growthMyRankWeekNotParticipated: string;
    growthMyRankAnonymous: string;
    growthMyRankSeeLeaderboard: string;
    /** Comeback modal (3+ day return) — calm recovery tone */
    comebackTitle: string;
    comebackBody: string;
    comebackResumeJourneyCta: string;
    comebackNotNowCta: string;
    growthNavDojoTitle: string;
    growthNavDojoLine: string;
    growthNavIntegrityTitle: string;
    growthNavIntegrityLine: string;
    growthNavGuidanceTitle: string;
    growthNavGuidanceLine: string;
    growthNavJourneyTitle: string;
    growthNavJourneyLine: string;
    growthNavReflectionTitle: string;
    growthNavReflectionLine: string;
    growthBackToGrowth: string;
    growthJourneyLandmarkAria: string;
    arenaHubTitle: string;
    /** 허브 ScreenShell 메인 타이틀 (짧게; 카드에서 이어하기/준비 문구 구분) */
    arenaHubShellTitle: string;
    arenaHubSubtitle: string;
    arenaHubReadyTitle: string;
    arenaHubReadyBody: string;
    arenaHubCardTitleContinue: string;
    arenaHubCardBodyResume: string;
    arenaHubCardBodyNew: string;
    arenaHubCtaWeeklyRank: string;
    arenaHubEntryLoading: string;
    arenaHubContinueCta: string;
    arenaHubPlayCta: string;
    arenaHubWeeklyRankLabel: string;
    arenaHubSeasonEndsLabel: string;
    arenaHubSummaryRegionAria: string;
    arenaHubSummaryLoadError: string;
    arenaResultEyebrow: string;
    arenaResultRecordedTitle: string;
    arenaResultRecordedSubtitle: string;
    arenaResultSystemNoteTitle: string;
    arenaResultSystemNoteBody: string;
    arenaResultContinuePlayCta: string;
    arenaResultReturnHubCta: string;
    /** Growth 허브 — 4카드 (Dojo · Integrity Mirror · Guidance · Journey) */
    growthHubSectionLabel: string;
    growthHubHeadline: string;
    growthHubLead: string;
    growthHubCardsNavAria: string;
    /** Growth 허브 본문 랜드마크 (스크린리더) */
    growthHubMainRegionAria: string;
    growthCardDojoTitle: string;
    growthCardDojoDesc: string;
    growthCardIntegrityTitle: string;
    growthCardIntegrityDesc: string;
    growthCardGuidanceTitle: string;
    growthCardGuidanceDesc: string;
    growthCardJourneyTitle: string;
    growthCardJourneyDesc: string;
  };
  /** my-page progress / team / leader 스텁 카피 */
  myPageStub: {
    subMyPage: string;
    progressTitle: string;
    coreXp: string;
    weeklyXp: string;
    streak: string;
    systemMsg: string;
    progressStage: string;
    progressRank: string;
    progressStreakVal: string;
    progressSystemLine: string;
    progressFootnote: string;
    teamTitle: string;
    teamTiiCard: string;
    teamStatusCard: string;
    teamInnerStatus: string;
    teamStable: string;
    teamInnerTrend: string;
    teamTrendVal: string;
    teamRankCard: string;
    teamRankCaption: string;
    teamRankLine: string;
    teamFooter: string;
    leaderTitle: string;
    leaderCardStatus: string;
    leaderBuilding: string;
    leaderCardReadiness: string;
    leaderReadinessVal: string;
    leaderCardCert: string;
    leaderCertVal: string;
    leaderSystem: string;
    leaderSystemLine: string;
    leaderFootnote: string;
    overviewHealingCardTitle: string;
    overviewHealingCardLead: string;
    overviewHealingNavAria: string;
    recentRunsCardTitle: string;
    recentRunsRegionAria: string;
    recentRunsLoading: string;
    recentRunsEmpty: string;
    recentRunsAnonymous: string;
    recentRunsFootnote: string;
    recentRunsLoadMore: string;
    recentRunsLoadingMore: string;
    recentRunsScenarioPrefix: string;
    recentRunsStartedPrefix: string;
    recentRunsStatusPrefix: string;
    recentRunsOpenDetail: string;
    runDetailPageTitle: string;
    runDetailPageSubtitle: string;
    runDetailRegionAria: string;
    runDetailBackMyPage: string;
    runDetailLoading: string;
    /** arena.run_detail.loading — 도메인 키와 동일 문구 */
    runDetailSkeletonLoading: string;
    /** arena.run_detail.empty */
    runDetailSkeletonEmpty: string;
    runDetailError: string;
    runDetailNotFound: string;
    runDetailSignIn: string;
    runDetailScenarioId: string;
    runDetailStatus: string;
    runDetailStartedAt: string;
    runDetailCompletedAt: string;
    runDetailLocaleLabel: string;
    runDetailDifficulty: string;
    /** 런 상태 API 값 → 표시 라벨 (render-only 매핑) */
    runStatusLabelDone: string;
    runStatusLabelInProgress: string;
    runStatusLabelStarted: string;
    /** My Page ScreenShell — overview / subpages */
    myPageShellOverviewTitle: string;
    myPageShellOverviewSubtitle: string;
    /** My Page 개요 카드 묶음 랜드마크 */
    myPageOverviewRegionAria: string;
    myPageShellProgressTitle: string;
    myPageShellProgressSubtitle: string;
    myPageShellTeamTitle: string;
    myPageShellTeamSubtitle: string;
    myPageShellLeaderTitle: string;
    myPageShellLeaderSubtitle: string;
    myPageCardIdentity: string;
    myPageCardProgress: string;
    myPageCardTeam: string;
    myPageLinkView: string;
    myPageLinkLeader: string;
    myPageLabelCodeName: string;
    myPageLabelStage: string;
    myPageLabelCoreProgress: string;
    myPageLabelWeeklyProgress: string;
    myPageOverviewTeamStatus: string;
    myPageProgressMovement: string;
    myPageTeamNoteHeading: string;
    myPageAccountLink: string;
    myPageTabsAria: string;
    myPageTabOverview: string;
    myPageTabProgress: string;
    myPageTabTeam: string;
    myPageTabLeader: string;
    myPageTabAccount: string;
  };
};

const ko: Messages = {
  loading: { message: "잠시만 기다려 주세요.", hint: "첫 로딩은 1–2분 걸릴 수 있어요." },
  nav: { center: "Center", bty: "Foundry", arena: "Arena", en: "English", ko: "한국어", skipToMainContent: "본문으로 건너뛰기" },
  login: {
    title: "bty 로그인",
    afterLoginGoTo: "로그인 후",
    email: "이메일",
    password: "비밀번호",
    submit: "로그인",
    submitting: "로그인 중...",
    cookieNotice: "쿠키 기반 세션으로 동작합니다. 로그인 성공 직후 새로고침/이동이 발생할 수 있습니다.",
    errorDefault: "로그인에 실패했습니다.",
    forgotPassword: "비밀번호 찾기",
    forgotPasswordSent: "재설정 링크를 이메일로 보냈습니다. 받은편지함(또는 스팸)을 확인해주세요.",
    forgotPasswordError: "요청에 실패했습니다. 이메일을 확인하거나 잠시 후 다시 시도해주세요.",
  },
  auth: { backToLogin: "로그인으로 돌아가기", loading: "인증 처리 중...", callbackError: "인증 처리에 실패했습니다. 다시 시도해주세요." },
  logout: "로그아웃",
  arena: {
    weeklyTierBronze: "브론즈 (주간)",
    weeklyTierSilver: "실버 (주간)",
    weeklyTierGold: "골드 (주간)",
    weeklyTierPlatinum: "플래티넘 (주간)",
    runStateInProgress: "진행 중",
    runStateCompleted: "완료",
    runStateAborted: "중단",
    tieRankSuffix: "동순위",
  },
  reflectHints: {
    reflect_hint_empty: "한 문장이라도 적어 보면 다음 단계로 이어져요.",
    reflect_hint_short: "조금만 더 구체적으로 적어 볼까요?",
    reflect_hint_developing: "좋아요. 느낌이 드러나고 있어요.",
    reflect_hint_substantial: "충분히 담겼어요. 마음을 더 덧붙여도 좋아요.",
    reflect_hint_near_limit: "거의 한도에 가까워요. 마무리만 정리해 주세요.",
    reflect_hint_at_limit: "이 길이로 제출할 수 있어요.",
  },
  integrity: {
    title: "역지사지 시뮬레이터",
    subtitle: "Dr. Chi와 함께 갈등 상황을 돌려보세요.",
    stepLabelGuide: "2. 안내",
    guideMessage: "상대 입장을 잠시 돌려보는 연습이에요. 겪었던 갈등을 한 줄로 적으면, Dr. Chi가 역지사지 질문으로 비춰드려요.",
    startPractice: "연습 시작",
    intro: "겪었던 갈등을 한 줄로 적어보세요. Dr. Chi가 역지사지 질문으로 도와드릴게요.",
    placeholder: "예: 직원에게 말했는데 상대가 불쾌해했어요",
    send: "전송",
    thinking: "Dr. Chi가 생각 중…",
    emptyHint: "갈등 상황을 입력하고 전송해보세요.",
    emptyStateHint: "첫 메시지를 보내보세요.",
    backToFoundry: "Foundry로 돌아가기",
    reply: "만약 입장이 반대라면 어떨까요?",
    doneTitle: "오늘의 연습 완료",
    doneSub: "한 걸음씩 상대의 입장을 돌려보는 연습이 쌓이고 있어요.",
    doneCtaComplete: "연습 완료하기",
    doneCtaMentor: "멘토와 대화하기",
    doneCtaFoundry: "Foundry로",
    doneCtaAssessment: "50문항 진단",
    apiError: "연결이 불안정해요. 다시 시도해주세요.",
    errorTitle: "오류",
    replyFallback: "조금 더 말해주실래요?",
    ariaStartPractice: "연습 시작하기",
    ariaCompletePractice: "연습 마치기",
    ariaInputLabel: "갈등 상황을 입력하세요",
    ariaWaitingChi: "Dr. Chi 응답 대기 중…",
    mentorName: "Dr. Chi",
    conversationSimulatorAria: "역지사지 대화 내용",
    messageComposerAria: "메시지 입력·전송",
    integrityMainRegionAria: "역지사지 시뮬레이터 — 안내·대화·완료",
  },
  center: {
    loading: "잠시만 기다려 주세요.",
    mainAriaLabel: "나에게 쓰는 편지",
    headerLabel: "Dear Me 제목 및 안내",
    contentLabel: "Dear Me 본문",
    title: "Center",
    heroTitleMain: "센터,",
    heroTitleAccent: "듣고 있어요.",
    tagline: "아늑한 방에서 쉬어가요. 나는 안전해요.",
    ctaToFoundry: "문 열고 연습하러 가기",
    linkToBty: "어제보다 나은 연습하러 가기 (bty)",
    assessmentCta: "자존감 진단 (50문항)",
    assessmentCtaSub: "자기 존중감을 짧게 점검해 보세요.",
    assessmentDetailHint: "더 자세한 테스트를 원하시면 클릭하세요.",
    entryIntro: "말 못 할 마음을 비추는 안전한 공간이에요. 조언이 아니라 그대로 비춰드려요. 치유받는 방이에요.",
    startCta: "시작하기",
    todayStepTitle: "오늘의 나",
    todayMoodLabel: "지금 기분은 어때요?",
    todayEnergyLabel: "에너지 수준 (1=많이 지침, 5=괜찮음)",
    todayOneWordLabel: "한 단어로 오늘을 표현하면?",
    todayMoodPlaceholder: "예: 평온해요, 조금 불안해요",
    todayOneWordPlaceholder: "예: 고맙다, 지쳤다",
    todayNext: "다음",
    todaySkip: "건너뛰기",
    bridgeHeading: "이제 문을 열고 밖으로 나가볼까요?",
    bridgeSub: "(연습하러 가기)",
    letterStepTitle: "나에게 쓰는 편지",
    letterFormLabel: "편지 입력 및 보내기",
    letterPrompt: "지금 마음에 있는 말을 편하게 적어보세요. 여기선 조언이 아니라 그대로 비춰드릴게요.",
    letterPlaceholder: "오늘 누구에게도 말 못했던 마음이 있나요?",
    submitLetter: "보내기",
    sendingLetter: "글을 읽고 있어요…",
    replyStepTitle: "답장",
    replySummaryLabel: "답장 요약",
    completedTitle: "오늘의 편지 완료",
    completedSub: "마음을 나눠줘서 고마워요. 더 말하고 싶으면 챗에서 이어서 나눠 보세요.",
    continueToChat: "챗으로 이어하기",
    letterHistoryTitle: "보낸 편지 이력",
    letterHistoryListAria: "보낸 편지 날짜별 목록",
    letterHistoryEmpty: "아직 보낸 편지가 없어요.",
    letterHistoryError: "편지 이력을 불러올 수 없어요.",
    letterHistoryLoading: "편지 이력을 불러오는 중…",
    letterHistoryReplied: "답장 있음",
    letterHistoryNoReply: "답장 없음",
    replyActionsLabel: "답장 후 액션",
    footerLabel: "Center로 돌아가기",
  },
  bty: {
    title: "bty",
    tagline: "어제보다 나은 연습. Integrity & Practice.",
    linkToCenter: "Center로 가기",
    entryIntro: "대시보드, 멘토, 역지사지 연습. 오늘 할 훈련을 고르세요.",
    startCta: "시작하기",
    arenaCta: "Arena 플레이",
    dashboardLabel: "Dashboard",
    leaderboardLabel: "Leaderboard",
    leStageLabel: "LE Stage",
    airLabel: "AIR",
    recommendationLabel: "추천",
    recommendationEmptyPlaceholder:
      "지금은 맞춤 추천이 없어요. Arena·Foundry·Center에서 활동하면 여기에 다음 행동이 안내돼요.",
    airUnavailable: "AIR 지표를 불러올 수 없습니다.",
    weeklyReflectionRegion: "주간 성찰 진행",
    personalRecordRegion: "이번 주 개인 기록",
    streakLabel: "연속 일수",
    pointsTodayLabel: "오늘 획득 XP",
    lifetimeProgressLabel: "평생 진행 (Core XP)",
    dojoPracticeLabel: "Dojo 연습",
    dojoPracticeLinksRegion: "Dojo 연습 링크",
    leaderboardWeekResetRegion: "이번 주 리셋 일시",
    dashboardTierCardLabel: "Arena 티어",
    dashboardTierCardSubline:
      "서버에서 계산한 티어입니다. Core XP로부터 UI에서 재계산하지 않습니다.",
    dashboardTierCardRegionAria: "Arena 티어 (API)",
    leAirSummarySectionAria: "리더십 엔진·AIR 요약 위젯",
    dashboardShortcutGoArena: "Arena 플레이",
    dashboardShortcutWeeklyRanking: "주간 랭킹 보기",
    leaderboardMainRegionAria: "리더보드 카드·순위 목록",
    dashboardHeroSubtitle: "Arena 진행을 한눈에 볼 수 있어요.",
    dashboardWeeklyRankWidgetTitle: "이번 주 랭킹",
    dashboardWeeklyWidgetLoading: "주간 순위 불러오는 중…",
    dashboardWeeklyWidgetAria: "이번 주 Arena 주간 XP·순위",
    dashboardWeeklyXpCaption: "이번 주 획득 XP",
    dashboardWeeklyTierCaption: "이번 주 경쟁 티어 (주간 XP 기준)",
    dashboardWeeklyCompetitionStageCaption: "주간 경쟁 스테이지 (밴드)",
    weeklyCompetitionStageBandBronze: "브론즈 밴드 — 주간 XP로 올라가는 첫 구간이에요.",
    weeklyCompetitionStageBandSilver: "실버 밴드 — 꾸준히 쌓이고 있어요.",
    weeklyCompetitionStageBandGold: "골드 밴드 — 상위권 경쟁 구간이에요.",
    weeklyCompetitionStageBandPlatinum: "플래티넘 밴드 — 이번 주 최상위 밴드예요.",
    leStageLeProgressBarAria: "리더십 엔진 현재 단계 진행률",
    dashboardWeeklyRankSeeLeaderboard: "전체 리더보드 보기",
    dashboardWeeklyRankHint: "실시간 순위는 리더보드에서 확인하세요.",
    dashboardOpenLiveLeaderboardCta: "라이브 순위 미리보기",
    dashboardLiveLeaderboardModalTitle: "이번 주 라이브 순위",
    dashboardLiveLeaderboardModalAria: "주간 XP 리더보드 미리보기",
    dashboardLiveLeaderboardLoading: "순위 불러오는 중…",
    dashboardLiveLeaderboardEmpty: "표시할 순위가 없어요.",
    dashboardLiveLeaderboardClose: "닫기",
    dashboardLiveLeaderboardFullPage: "전체 리더보드로",
    dashboardLiveLeaderboardFailed: "불러오지 못했어요.",
    dashboardLiveLeaderboardModalDesc:
      "이번 주 주간 XP 기준 순위입니다. 내 순위 주변 또는 상위 플레이어가 표시될 수 있어요.",
    dashboardLiveLeaderboardListAria: "주간 XP 순위 목록",
    dashboardLiveLeaderboardNotRankedBanner:
      "이번 주 아직 순위에 없어요. 아래는 참가 중인 플레이어 미리보기예요.",
    dashboardLiveLeaderboardNearMeFallbackBanner:
      "주변 순위 구간이 비어 있어 상위 순위를 표시합니다.",
    dashboardLiveLeaderboardCloseAria: "라이브 순위 미리보기 닫기",
    leStageSummaryWidgetDesc:
      "스테이지·리셋 기한·Arena 요약·행동 패턴은 서버 응답을 그대로 표시합니다.",
    profileCodeNameCardLabel: "코드명 · 서브 이름",
    profileIdentitySubline:
      "대시보드에 표시되는 이름이에요. 리더보드에 올라가려면 Arena에서 시나리오를 한 번 완료해 주세요.",
    profileRenamePlaceholder: "서브 이름 변경 (7자, 코드당 1회)",
    profileSaveSubName: "저장",
    profileSaving: "저장 중…",
    eliteMeContentUnlockedLabel: "Elite 전용 콘텐츠 해금 (me/elite)",
    eliteMeContentUnlockedYes: "예",
    eliteMeContentUnlockedNo: "아니오",
    leEngineTiiCertifiedBandAria: "팀 TII·AIR 요약·인증 상태",
    weeklySeasonActivityAria: "시즌·주간 XP 및 이벤트 수",
    dashboardPageTitle: "대시보드",
    foundryHubMainLandmarkAria: "Foundry 연습 허브",
    foundryFeatureCardsRegionAria: "Dojo·역지사지·멘토·대시보드·Elite 연결",
    foundryBackToBtyHome: "← bty 메인",
    indexThreeHubsExplainer: "Arena는 시나리오·랭킹, Center는 쉼·편지, Foundry는 대시보드·멘토·연습입니다.",
    indexHubEntriesRegionAria: "Arena·Center·Foundry 허브 선택",
    pointsTodaySubline: "오늘(UTC 기준) 획득한 XP입니다.",
    airIntegritySlip: "무결성 이탈 감지",
    leStageSummaryUnavailable: "스테이지 요약을 불러올 수 없습니다.",
    leAirAria7d: "AIR 7일",
    leAirAria14d: "AIR 14일",
    leAirAria90d: "AIR 90일",
    leAirAriaGrid: "AIR 지표: 7일·14일·90일",
    leAirLoading: "AIR 지표 불러오는 중…",
    leStageSummarySectionAria: "리더십 엔진 스테이지 요약",
    leStageStagePrefix: "단계",
    leStageResetDueLabel: "Reset 완료 기한",
    leStageArenaSummaryHeading: "Arena 결과 요약",
    leStageBehaviorHeading: "행동 패턴",
    leStageLoading: "스테이지 요약 불러오는 중…",
  },
  assessmentResult: {
    mainContentRegionAria: "진단 결과 요약: 영역별 점수·권장 트랙",
    nextStepsCtaGroupAria: "진단 후 다음 단계",
    start28ProgramCta: "28일 프로그램 시작",
    retakeCta: "다시 검사하기",
    ctaSrOnlyHeading: "진단 후 다음 단계",
  },
  landing: {
    heroTitle: "Better Than Yesterday",
    heroSubtitle: "오늘 어디로 가볼까요?",
    recommended: "추천",
    arenaTitle: "Arena",
    arenaDesc: "시나리오를 플레이하면서 선택과 성장을 쌓아요. XP, 주간 퀘스트, 리더보드.",
    arenaCta: "플레이하기",
    foundryTitle: "Foundry",
    foundryDesc: "대시보드, 멘토, 역지사지 연습. 오늘 할 연습을 고르세요.",
    foundryCta: "Foundry 가기",
    centerTitle: "Center",
    centerDesc: "말 못 할 마음을 비추는 안전한 공간. 조언이 아니라 그대로 비춰드려요.",
    centerCta: "쉬러 가기",
    todayGrowthLink: "오늘의 성장",
    footerHint: "위에서 가고 싶은 곳을 골라주세요.",
  },
  safeMirror: {
    title: "안전한 거울",
    subtitle: "지금 느끼는 말을 편하게 적어보세요. 여기선 조언이 아니라, 그 마음을 그대로 비춰드릴게요.",
    placeholder: "오늘 누구에게도 말 못했던 마음이 있나요?",
    submit: "적기",
    submitting: "글을 읽고 있어요…",
    fallbackReply: "지금은 답장을 적기 어려워요. 그 마음이 들었다는 것만으로도 충분해요.",
  },
  smallWins: {
    title: "작은 승리",
    subtitle: "거창한 게 아니라, 오늘 한 아주 작은 일을 눌러 기록해보세요.",
    add: "추가",
    customPlaceholder: "직접 입력 (예: 물 한 잔 마시기)",
    count: "오늘의 작은 승리",
    suggested: ["오늘 이불 개기", "물 한 잔 마시기", "창문 열어 환기하기", "손 씻기", "스트레칭 1분", "한 입 먹기", "일어나서 세수하기", "양치하기"],
  },
  selfEsteem: {
    title: "자존감 알아보기",
    subtitle: "나와 조금씩 대화해 보세요. 맞는 말에 가깝다고 느끼는 칸을 골라주시면 돼요. 정답은 없어요.",
    again: "다시 알아보기",
    choices: [
      { value: 1, label: "거의 그렇지 않다" },
      { value: 2, label: "그렇지 않은 편이다" },
      { value: 3, label: "보통이다" },
      { value: 4, label: "그런 편이다" },
      { value: 5, label: "매우 그렇다" },
    ],
    questions: [
      "나는 내가 해낸 일에 대해 만족하는 편이다.",
      "나는 대체로 나 자신에 대해 괜찮다고 느낀다.",
      "나는 내 단점도 받아들이려 노력한다.",
      "실패해도 나는 나 자신을 존중할 수 있다.",
      "나는 나에게 친절하게 말하려 노력한다.",
    ],
    storyLabels: ["첫 번째 이야기", "두 번째 이야기", "세 번째 이야기", "네 번째 이야기", "다섯 번째 이야기"],
    results: {
      high: "지금 이 순간에도 스스로를 괜찮다고 느끼려 한 걸음씩 내딛고 있어요. 그 마음이 여기까지 와 있다는 것만으로도 충분히 의미 있어요.",
      mid: "가끔은 나 자신이 불안하거나 부족하게 느껴질 수 있어요. 그런 날에도 여기선 그냥 그대로 있어도 괜찮아요.",
      low: "자신에 대해 엄하게 느껴지는 날이 있을 수 있어요. 그런 마음이 드는 건 당신이 부족해서가 아니라, 스스로를 소중히 여기고 싶어하기 때문이에요. 여기는 그 마음을 그대로 두어도 되는 곳이에요.",
      strengthHigh: "자기를 돌보고 스스로를 인정하는",
      strengthMid: "조금씩 나를 알아가고 있는",
      strengthLow: "지금도 스스로를 소중히 여기려 하는",
      scoreSuffix: "점",
    },
  },
  chat: {
    title: "말걸기",
    placeholder: "하고 싶은 말을 적어보세요",
    send: "보내기",
    thinking: "생각 중…",
    connectionError: "연결이 끊겼어요. 다시 시도해 주세요.",
    retry: "다시 시도",
    introFoundry: "Dr. Chi예요. 다른 사람 입장에서 생각해보는 연습을 도와드릴게요. 편하게 한마디부터 적어 주세요.",
    introCenter: "Dr. Chi예요. 지금 느낌 그대로 괜찮아요. 여기는 안전한 곳이에요. 하고 싶은 말이 있으면 적어 주세요.",
    spaceHintFoundry: "지금은 Foundry(연습 공간)예요. 시나리오·선택·역할 연습에 맞춰 대화해요.",
    spaceHintCenter: "지금은 Center(마음 쉼 공간)예요. 위로와 공감에 맞춰 편하게 나눠요.",
    introArena: "Dr. Chi예요. 시나리오 선택·트레이드오프·우선순위를 같이 정리해 볼게요. 하고 싶은 말 있으면 적어 주세요.",
    spaceHintArena: "지금은 Arena예요. 시뮬레이션·선택·성찰에 맞춰 대화해요.",
    exampleLabel: "예시로 시작하기",
    examplePhrasesFoundry: [
      "상대방 입장에서는 어떤 생각이 들까요?",
      "이 상황에서 제가 바꿀 수 있는 건 뭘까요?",
      "다음에 비슷할 때 시도해볼 말 한 가지가 있을까요?",
      "가치가 충돌할 때 우선순위를 어떻게 둘까요?",
    ],
    examplePhrasesCenter: [
      "요즘 가장 힘든 점이 뭔지 말해보고 싶어요.",
      "지금 기분을 한 단어로 하면요.",
      "오늘 하루 중 조금이라도 좋았던 순간이 있어요.",
      "그냥 들어주기만 해도 돼요.",
    ],
    examplePhrasesArena: [
      "이 판에서 하나만 가져가면 뭘 고를까요?",
      "선택한 걸 다음 시나리오에서도 써보고 싶어요.",
    ],
    rememberConversation: "대화 기억하기",
    deleteHistory: "기록 삭제",
  },
  resilience: {
    title: "회복 탄력성",
    subtitle: "떨어졌다가 다시 올라가는, 파도 같은 흐름이에요.",
    dailyTrajectorySubtitle: "매일의 5문항/활동에 따른 궤적이에요. 날짜별로 쌓인 회복의 흐름이에요.",
    emptyMessage: "아직 궤적이 없어요. Center에서 오늘의 나·편지 단계를 진행하면 쌓여요.",
    past: "과거",
    now: "지금",
    levelLow: "낮음 (에너지 1–2)",
    levelMid: "중간 (에너지 3)",
    levelHigh: "높음 (에너지 4–5)",
    levelLegendAria: "일별 회복 수준 범례",
  },
  arenaLevels: {
    membershipPending: "멤버십 승인 대기 중입니다. 승인 후 레벨이 표시됩니다.",
    noLevelsYet: "아직 기록이 없어요. 첫 시나리오를 시작해 보세요.",
    emptyCta: "Arena에서 시나리오 시작하기",
    loginRequired: "로그인이 필요합니다.",
    track: "트랙",
    unlockedUpTo: "최대 오픈 레벨",
    levelCardHint: "지금 여기까지 열렸어요.",
    l4AdminGranted: "관리자 부여",
    staff: "스태프",
    leader: "리더",
    l4Partner: "L4 (파트너)",
  },
  avatarOutfit: {
    label: "옷 테마",
    professional: "직업군",
    fantasy: "롤플레잉",
    hint: "레벨이 올라가면 선택한 테마의 옷이 바뀝니다.",
    pageTitle: "아바타",
    backToFoundry: "훈련장으로 돌아가기",
    backToFoundryAria: "훈련장으로 돌아가기",
    goToDashboard: "대시보드로 가기",
    goToDashboardAria: "대시보드로 가기",
    preview: "미리보기",
    previewAria: "아바타 미리보기",
    character: "캐릭터",
    characterLocked: "캐릭터 변경(잠김) — 다음 Code 진화 전까지 고정됩니다.",
    characterChangeHint: "캐릭터 변경은 대시보드에서 할 수 있어요.",
    outfit: "옷",
    noOutfits: "이 테마에서 선택 가능한 옷이 없습니다.",
    save: "저장",
    saving: "저장 중",
    saveAria: "저장",
    errorLoad: "아바타 설정을 불러오지 못했습니다.",
    outfitLabels: {
      professional_outfit_scrub_general: "일반 스크럽",
      professional_outfit_figs_scrub: "Figs 스크럽",
      professional_outfit_doctor_gown: "의사 가운",
      professional_outfit_surgery_coat_suit: "수술 코트 + 정장",
      professional_outfit_brand_suit: "브랜드 정장",
      professional_outfit_figs_scrub_short: "반팔 Figs 스크럽",
      professional_outfit_shorts_tee: "반바지, 반팔티",
      fantasy_outfit_apprentice: "견습",
      fantasy_outfit_adventurer: "모험가",
      fantasy_outfit_journeyer: "여행자",
      fantasy_outfit_warrior_mage_mid: "전사/마법/상인 중급",
      fantasy_outfit_senior: "시니어",
      fantasy_outfit_senior_plus: "시니어+",
      fantasy_outfit_master: "마스터",
    },
  },
  arenaMembership: {
    label: "Arena 가입",
    approved: "승인됨",
    pending: "승인 대기 중입니다. Admin 승인 후 레벨이 표시됩니다.",
    hint: "직군·입사일·리더시작일을 입력하면 Admin 승인 후 Arena 레벨이 열립니다.",
    jobFunction: "직군",
    joinedAt: "입사일",
    leaderStartedAt: "리더시작일 (선택, 리더 직군인 경우)",
    submit: "제출",
    submitting: "제출 중…",
    submitError: "제출에 실패했습니다.",
    submitSuccess: "승인 대기 중입니다. Admin 승인 후 레벨이 열립니다.",
    seniorDoctorHint: "Senior Doctor는 보통 3년 이상 경력 시 선택합니다.",
    validationRequired: "직군과 입사일을 입력해 주세요.",
  },
  mentorRequest: {
    cardTitle: "Dr. Chi 1:1 대화 신청",
    cardDesc: "Elite(상위 5%)만 신청할 수 있어요. 승인 후 멘토 페이지에서 심화 대화를 이어갈 수 있습니다.",
    requestCta: "대화 신청하기",
    submitting: "신청 중…",
    statusPending: "승인 대기 중입니다.",
    statusApproved: "승인되었습니다. 멘토 페이지에서 대화를 이어가세요.",
    statusRejected: "이번에는 승인되지 않았어요. 다음 기회에 다시 신청해 주세요.",
    messageLabel: "하고 싶은 말 (선택)",
    messagePlaceholder: "예: 리더십 피드백을 받고 싶어요",
    errorEliteOnly: "상위 5%에 있을 때만 신청할 수 있어요.",
    errorPendingExists: "이미 대기 중인 신청이 있어요.",
    errorSubmit: "신청에 실패했어요. 다시 시도해 주세요.",
    approvedCta: "멘토 페이지로 이동",
    listTitle: "내 신청 목록",
    listEmpty: "아직 신청 내역이 없습니다.",
    colDate: "신청 일시",
    colStatus: "상태",
    slaImminentBadge: "멘토 응답 기한 임박 — 곧 안내가 올 수 있어요.",
    eliteDomainTerminalApproved: "멘토 신청 · 승인됨",
    eliteDomainTerminalRejected: "멘토 신청 · 거절됨",
    eliteDomainPendingStale: "신청 후 2주 이상 경과했어요. 응답을 기다리는 중입니다.",
    eliteStatusBadgePending: "멘토 신청 · 대기 중",
    eliteStatusBadgeApproved: "멘토 신청 · 승인",
    eliteStatusBadgeRejected: "멘토 신청 · 거절",
  },
  elitePage: {
    circleCardTitle: "서클(Circle) 모임",
    circleCardDesc: "Elite 전용 소규모 모임(주 1회 또는 월 1회). 일정·참여는 아래 안내를 확인해 주세요.",
    circleCardPlaceholder: "준비 중",
    badgeLabels: { weekly_elite: "이번 주 상위 5%" },
    unlockConditionTitle: "해금 조건",
    unlockConditionMet: "주간 리더보드 상위 5% 달성(충족).",
    unlockConditionLocked: "주간 리더보드 상위 5% 달성 시 이용 가능.",
    unlockExposureTitle: "노출",
    unlockExposureMet: "Elite 전용 콘텐츠(멘토 대화 신청, 서클 모임, 배지 등)를 이용할 수 있습니다.",
    unlockExposureLocked: "상위 5% 달성 시 Elite 전용 페이지·콘텐츠 이용 가능.",
    mentorDeepLinksListAria: "Elite 멘토·심화 대화 링크",
    loadingElitePageAria: "Elite 페이지 불러오는 중",
    pageTitle: "Elite 전용",
    pageIntroElite:
      "주간 리더보드 상위 5%에 진입하셨습니다. 여기서는 Elite 전용 콘텐츠를 이용할 수 있습니다.",
    badgesSectionTitle: "증정 배지",
    tableColActions: "동작",
  },
  mentorRequestAdmin: {
    title: "멘토 대화 신청 승인",
    description: "Elite 멘토(1:1) 신청 큐. 승인/거절 처리합니다.",
    empty: "대기 중인 신청이 없습니다.",
    loading: "목록 불러오는 중…",
    actions: "동작",
    userId: "유저 ID",
    createdAt: "신청 일시",
    message: "메시지",
    colStatus: "상태",
    tableCaption: "Elite 멘토 신청 대기 목록",
    queueTableAria: "멘토 신청 대기 큐 테이블",
    approveRejectGroupAria: "이 신청 승인 또는 거절",
    statusPendingLabel: "대기",
    approve: "승인",
    reject: "거절",
    approving: "승인 중…",
    rejecting: "거절 중…",
    error: "처리 실패",
    errorLoadQueue: "목록을 불러오지 못했습니다.",
    errorPatch: "승인·거절 처리에 실패했습니다.",
    debugLink: "디버깅",
    usersLink: "사용자 관리",
    arenaMembershipLink: "Arena 멤버십 승인",
  },
  mentorPage: {
    deleteAllHistoryConfirm: "저장된 멘토 대화 기록을 모두 삭제할까요?",
    pageMainLandmarkAria: "Dr. Chi 멘토 대화",
    topicChoiceGroupAria: "대화 주제 선택",
  },
  dentalRpg: {
    empty: "장비가 없습니다.",
    listAria: "장비 목록",
    rarity1: "일반",
    rarity2: "고급",
    rarity3: "희귀",
    rarity4: "에픽",
    rarity5: "전설",
  },
  healing: {
    title: "Healing",
    intro: "Healing과 Awakening 경로의 진입점입니다. Awakening에서 2차 각성 리듀얼을 진행할 수 있어요.",
    awakeningCta: "Awakening →",
    dashboardCta: "← 대시보드",
    navLabel: "Healing 메뉴",
    ariaAwakening: "Awakening으로",
    ariaDashboard: "대시보드로",
    loading: "불러오는 중…",
    emptyPhase: "진도 단계 정보를 불러올 수 없습니다. Awakening으로 이동해 보세요.",
    loadError: "진도 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
    awakeningLoadingLabel: "2차 각성 불러오는 중",
    phaseProgressRegionAria: "Healing 단계·진행 상태",
    awakeningRitualActsRegionAria: "2차 각성 의식 1~3막",
    healingBottomNavSectionAria: "각성·대시보드 이동",
    mainLandmarkAria: "Healing 허브",
    stubApiSectionTitle: "서버 진행 상태 (표시 전용)",
    phaseFieldLabel: "단계",
    ringTypeFieldLabel: "링 유형",
    stubRenderOnlyNote: "표시값은 API 응답이며, UI에서 단계를 계산하지 않습니다.",
    awakeningActsTrackTitle: "Awakening 액트 (서버 기록)",
    awakeningActsTrackRegionAria: "Awakening 액트 목록 및 완료 기록",
    awakeningActsTriggerLine: "{day}일·세션 {sessions}회 이후 의식 해금(서버 트리거 정보).",
    awakeningActDone: "기록됨",
    awakeningActOpen: "미기록",
    awakeningRecordNextCta: "다음 액트 완료 기록",
    awakeningAllActsRecorded: "세 액트 기록이 모두 완료되었어요.",
    awakeningProgressToastOk: "기록이 저장되었습니다.",
    awakeningProgressToast409: "이미 기록된 액트예요.",
    awakeningProgressToast400: "순서에 맞지 않거나 잘못된 요청이에요.",
    awakeningProgressToastNetwork: "저장에 실패했어요. 다시 시도해 주세요.",
    awakeningActsLoadError: "액트 정보를 불러오지 못했어요.",
    healingAwakeningProgressHeading: "Awakening 진행 (서버)",
    healingAwakeningProgressPct: "진행률 {n}%",
    healingProgressbarValuetext: "진행률 {pct}퍼센트. {detail}",
    healingProgressbarDetailAllDone: "모든 Act를 완료했습니다.",
    healingProgressbarDetailNext: "다음 막: {name}.",
    healingProgressbarDetailSync: "다음 막은 서버와 동기화되면 표시됩니다.",
    healingAwakeningAllActsDone: "세 액트를 모두 기록했습니다.",
    healingNextActFromApi: "다음 액트(서버): {name}",
    healingNextActSyncHint:
      "기록 순서가 어긋난 경우 아래에서 순서대로 다시 기록해 주세요.",
    healingProgressRefreshHint:
      "기록 후 목록이 바로 안 바뀌면 아래를 눌러 서버 상태를 다시 불러오세요.",
    healingProgressRefreshCta: "진행 상태 새로고침",
    awakeningActsGridAria: "Awakening 액트 1~3 그리드",
    awakeningActNumberLabel: "액트 {n}",
    healingAwakeningBlockedOrderRequired: "먼저 이전 액트를 순서대로 완료해 주세요.",
    healingAwakeningBlockedAlreadyComplete: "이미 기록된 액트입니다.",
    healingActLockPrerequisite: "먼저 이전 액트를 순서대로 완료해 주세요.",
    healingActLockAlreadyComplete: "이미 기록된 액트입니다.",
    pathProgressBlockedCooldown: "잠시 후 다시 시도해 주세요. (쿨다운)",
    pathProgressBlockedPhase: "이전 단계를 먼저 완료한 뒤 진행할 수 있어요.",
    healingActsOverallProgressAria: "Awakening 액트 기록 진행률",
    healingActsOverallProgressCaption: "기록된 액트",
    healingActsOverallProgressValuetext: "{done}개 중 {total}개 기록됨, 진행률 {pct}퍼센트",
  },
  train: {
    title: "28일 훈련",
    completeGroupLabel: "완료 처리 및 코치·요약 전환",
    completionSummaryLabel: "완료 요약",
    coachChatLabel: "코치 대화",
    reinforcementLabel: "보강 질문",
    dayListLabel: "일자 목록",
    lessonLabel: "오늘의 레슨",
    lockedLabel: "잠긴 레슨 안내",
    sidebarPanelLabel: "완료 요약 및 코치 대화",
    journeyStartTitle: "28일 훈련 시작",
    journeyStartIntro: "왼쪽에서 Day를 선택하면 레슨이 보이고, 오른쪽에서 코치와 대화할 수 있어요.",
    journeyStartDay1Link: "Day 1부터 시작하기",
    journeyStartDay1Aria: "Day 1부터 시작하기",
  },
  dojoResult: {
    title: "Today-Me 50문항 결과",
    areaScoresTitle: "영역별 점수",
    drChiCommentTitle: "Dr. Chi 코멘트",
    resultCommentHigh: "역지사지·소통·리더십 영역에서 잘 발휘하고 있어요. 강점을 유지하면서 조금씩 확장해 보세요.",
    resultCommentMid: "몇몇 영역은 이미 잘하고 있고, 몇몇은 더 연습할 여지가 있어요. 한 번에 하나씩 골라서 연습해 보세요.",
    resultCommentLow: "지금이 출발선이에요. Foundry 역지사지 연습과 50문항 진단을 반복하면 단계적으로 성장할 수 있어요.",
    loading: "결과를 불러오는 중…",
    noAnswers: "결과를 보려면 50문항을 먼저 완료해 주세요.",
    backToAssessment: "진단하러 가기",
    apiError: "결과를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
    dimensionLabels: {
      core: "자기 가치",
      compassion: "자기 연민",
      stability: "안정성",
      growth: "성장",
      social: "관계",
      perspective_taking: "역지사지",
      communication: "소통·경청",
      leadership: "리더십·책임",
      conflict: "갈등·협상",
      teamwork: "팀·협업",
    },
    nextActionsLabel: "다음 액션",
    resultActionsLabel: "결과 후 액션",
    questionStepSectionAria: "현재 문항 및 응답 선택",
    resultScoresInsightRegionAria: "영역별 점수 및 코멘트",
    dojoPageMainAria: "Dojo 역량 진단 50문항",
    dojoHistoryMainRegionAria: "Dojo 과거 진단 이력 — 제출일·요약 목록",
  },
  arenaRun: {
    reflectionPrompt: "한 문장으로: 이 판에서 가져갈 것은?",
    errorStartRun: "런을 시작할 수 없습니다.",
    errorSignIn: "로그인이 필요합니다.",
    errorAlreadySubmitted: "이미 제출되었거나 세션이 만료되었습니다.",
    errorSubmitFailed: "제출에 실패했습니다. 다시 시도해 주세요.",
    heroTitle: "오늘도 한 걸음, Arena에서.",
    otherLabel: "기타 (직접 입력)",
    otherRecorded: "기타 기록됨.",
    nextScenario: "다음 시나리오",
    otherPlaceholder: "직접 입력해 주세요...",
    cancel: "취소",
    submit: "제출",
    liveRanking: "실시간 순위",
    completeErrorPrefix: "저장 실패: ",
    completeErrorSuffix: ". 리더보드에 반영되지 않았을 수 있어요.",
    headerTitle: "시뮬레이션",
    headerSubtitle: "한 판으로 끝. 멈춰도 이어짐. (MVP: 1 + 보완 1)",
    pauseLabel: "일시정지",
    resetLabel: "초기화",
    mainLabel: "메인",
    startSimulation: "시뮬레이션 시작",
    confirm: "확인",
    reflectionTitle: "성찰",
    reflectionNext: "다음",
    reflectionOptional: "옵션",
    reflectionPlaceholder: "예: 다음엔 반응하기 전에 한 번 멈춰 보겠다.",
    systemOutput: "시스템 출력",
    skipFollowUp: "따라하기 건너뛰기 · 다음 시나리오",
    followUpSelected: "선택한 따라하기",
    step6Title: "Step 6 · 정리",
    mainPlayLandmarkAria: "Arena 시나리오 플레이",
    preparingNewScenarioAria: "새 시나리오 준비 중",
    scenarioProgressPanelAria: "시나리오 진행·완료",
    reflectionBusyAria: "반영 제출 중",
    reflectionSentenceBlockAria: "한 문장 성찰 입력",
    reflectionChoiceOptionsAria: "성찰 선택지",
    reflectionLengthHintAria: "성찰 글 길이 안내",
    reflectionCharCount: "{n} / {max}자",
    youChose: "선택한 항목",
    keyInsight: "핵심 통찰:",
    principle: "원칙: \"사람을 먼저 안정시키고, 그다음 시스템을 고칩니다.\"",
    completeBtn: "완료",
    reflectionBonusLabel: "성찰 보너스",
    deepeningTitle: "성찰 심화",
    nextActionLabel: "다음 행동",
    step7Title: "Step 7 · 완료",
    step7Body: "저장되었습니다. 아래 버튼으로 다음 시나리오로 이동합니다.",
    choiceLabel: "선택",
    scenarioCompletedToast: "시나리오를 완료했어요",
    scenarioNotFound: "시나리오를 찾을 수 없습니다.",
    scenarioNotFoundHint: "다른 시나리오를 선택하거나 새로고침해 보세요.",
    pastScenariosHeading: "지난 시나리오",
    pastScenariosCollapse: "접기",
    pastScenariosExpand: "펼치기",
    loadingHistory: "이력 불러오는 중…",
    couldNotLoadHistory: "이력을 불러오지 못했어요.",
    pastScenariosSessionHint:
      "이 기기에서 세션이 잠시 끊긴 것 같아요. bty 메인에서 다시 로그인하거나 페이지를 새로고침하면 이력이 보일 수 있어요.",
    retryLoadHistory: "이력 다시 불러오기",
    retry: "다시 시도",
    noCompletedScenarios: "아직 완료한 시나리오가 없어요.",
    startFirstScenario: "첫 시나리오를 시작해 보세요!",
    completed: "완료",
    inProgress: "진행 중",
    reflectDeepeningUnavailable:
      "심화 해석은 잠시 불러오지 못했어요. 성찰은 저장되었습니다.",
  },
  emotionalStats: {
    emptyMessage: "아직 기록이 없어요. Arena나 챗에서 대화를 진행해 보세요.",
    sectionTitle: "오늘의 성장",
    errorLoad: "표시를 불러오지 못했어요.",
  },
  profile: {
    title: "프로필",
    displayNameLabel: "표시 이름",
    displayNamePlaceholder: "닉네임 또는 표시할 이름 (선택)",
    save: "저장",
    saving: "저장 중…",
    backToDashboard: "대시보드로",
    errorLoad: "프로필을 불러오지 못했어요.",
    errorSave: "저장에 실패했어요.",
    errorTooLong: "표시 이름은 64자 이하여야 해요.",
    avatarSettingsLink: "아바타 설정",
    saveButtonAriaLabel: "표시 이름 저장",
  },
  uxPhase1Stub: {
    bottomNavArena: "Arena",
    bottomNavGrowth: "성장",
    bottomNavMyPage: "마이",
    growthTitle: "성장",
    growthSubtitle: "해석 · 회복",
    growthLead: "내면 상태를 다시 세웁니다.",
    growthReturnArena: "Arena 허브로",
    growthWeeklyRankingLink: "주간 랭킹",
    growthFoundryLink: "Foundry 대시보드",
    growthOptionsRegionAria: "성장 영역 바로가기 목록",
    wireframeLandmarkAria: "Arena 와이어프레임 허브",
    weeklySnapshotRegionAria: "주간 순위 요약 예시",
    wireframeScreenTitle: "BTY Arena",
    wireframeScreenSubtitle: "와이어 · Phase 1",
    wireframeSystemReady: "시스템 준비 완료.",
    wireframePlayGame: "플레이",
    wireframeStartScenario: "새 시나리오 시작",
    wireframeContinue: "이어하기",
    wireframeResumeLast: "마지막 시뮬 이어하기",
    wireframeOr: "또는",
    wireframeWeeklyRankLine: "주간 순위: #128",
    wireframeSeasonLine: "시즌 종료까지 12일",
    wireframeWireRuleNote:
      "예시 수치 · AIR·TII·LRI 등은 본 화면에 노출하지 않음 (와이어 규칙).",
    wireframeResultStubPrefix: "시뮬 결과 화면 스텁:",
    resultTitle: "시뮬레이션 완료",
    resultSubtitle: "Arena · 결과",
    resultCoreXpSample: "+25 코어 XP",
    resultWeeklyXpSample: "+15 주간 XP",
    resultSampleNote: "예시 보상 · 실데이터는 API 연동 후",
    resultSystemTitle: "시스템 메시지",
    resultSystemBody: "의사결정 일관성이 개선된 것으로 감지되었습니다.",
    resultContinueCta: "계속",
    resultReturnArenaCta: "Arena로 돌아가기",
    resultWireHubLink: "Arena 와이어 허브",
    growthArenaPlayLink: "Arena 플레이",
    growthArenaWireHubLink: "Arena 허브(와이어)",
    growthShortcutsNavAria: "랭킹·대시보드·Arena·Healing 바로가기",
    growthElitePageLink: "Elite (상위 5%)",
    wireframeFoundryEliteAria: "Foundry·Elite 바로가기",
    growthHealingLink: "Healing",
    growthAwakeningLink: "Awakening",
    resultRunCompleteHint:
      "런 완료 후 「다음 시나리오」를 눌러야 주간 XP·리더보드에 반영됩니다.",
    resultShareRegionAria: "완료 요약 공유",
    resultShareCta: "완료 한 줄 복사",
    resultShareCopied: "복사했어요.",
    resultShareFailed: "복사하지 못했어요.",
    resultShareClipboardLine: "BTY Arena에서 시나리오 런을 완료했습니다.",
    resultNextActionsRegionAria: "런 완료 후 다음 행동",
    resultNextScenarioSectionLabel: "권장 다음 행동",
    resultNextScenarioCta: "다음 시나리오",
    resultNextScenarioSub: "플레이를 이어가면 주간 XP·리더보드에 반영됩니다.",
    wireframeArenaPracticeNavAria: "Dojo·역지사지 연습 진입",
    wireframeDojoLink: "Dojo 50",
    wireframeIntegrityLink: "역지사지",
    wireframeRunsDashboardHint: "최근 런 목록은 Foundry 대시보드에서 확인할 수 있어요.",
    growthMyRankCardTitle: "이번 주 내 순위",
    growthMyRankRegionAria: "주간 리더보드 내 순위·주간 XP",
    growthMyRankLoading: "순위 불러오는 중…",
    growthMyRankYourRank: "내 순위: #{rank}",
    growthMyRankWeeklyXpLine: "주간 XP: {xp}",
    growthMyRankNoRank: "이번 주 리더보드에 아직 없어요.",
    growthMyRankWeekNotParticipated:
      "이번 주 주간 XP가 없어 순위에 올라가지 않았어요. Arena에서 플레이하면 반영돼요.",
    growthMyRankAnonymous: "로그인 후 내 순위가 표시됩니다.",
    growthMyRankSeeLeaderboard: "전체 리더보드",
    comebackTitle: "다시 만나서 반가워요",
    comebackBody:
      "잠시 쉬어간 것으로 보여요. 부담 없이, 지금 이어가던 회복 루프를 계속할 수 있어요.",
    comebackResumeJourneyCta: "여정 이어가기",
    comebackNotNowCta: "나중에",
    growthNavDojoTitle: "Dojo",
    growthNavDojoLine: "지금 상태를 가늠하는 50문항",
    growthNavIntegrityTitle: "Integrity",
    growthNavIntegrityLine: "상대 시선에서 상황 보기",
    growthNavGuidanceTitle: "Guidance",
    growthNavGuidanceLine: "결정 패턴 되돌아보기",
    growthNavJourneyTitle: "Journey",
    growthNavJourneyLine: "28일 회복 루프 — 오늘 경로부터 이어가기",
    growthNavReflectionTitle: "Reflection",
    growthNavReflectionLine: "내면 목소리 안정화 (Dear Me)",
    growthBackToGrowth: "성장으로 돌아가기",
    growthJourneyLandmarkAria: "28일 Journey 보드",
    arenaHubTitle: "아레나를 이어갑니다.",
    arenaHubShellTitle: "아레나",
    arenaHubSubtitle: "판단·반복·압박 훈련은 이 공간에 있습니다.",
    arenaHubReadyTitle: "시스템 준비",
    arenaHubReadyBody: "마지막 시뮬을 이어가거나 새 시나리오를 시작할 수 있어요.",
    arenaHubCardTitleContinue: "아레나를 이어갑니다.",
    arenaHubCardBodyResume: "진행 중이던 시뮬을 이어갈 수 있어요.",
    arenaHubCardBodyNew: "새 시나리오를 시작할 수 있어요.",
    arenaHubCtaWeeklyRank: "주간 순위",
    arenaHubEntryLoading: "불러오는 중…",
    arenaHubContinueCta: "이어하기",
    arenaHubPlayCta: "플레이",
    arenaHubWeeklyRankLabel: "주간 순위",
    arenaHubSeasonEndsLabel: "시즌 종료까지",
    arenaHubSummaryRegionAria: "아레나 허브 — 주간 순위·시즌",
    arenaHubSummaryLoadError: "통계를 불러오지 못했습니다.",
    arenaResultEyebrow: "Arena 결과",
    arenaResultRecordedTitle: "결정이 기록되었습니다.",
    arenaResultRecordedSubtitle: "결과가 반영되었습니다.",
    arenaResultSystemNoteTitle: "시스템 메시지",
    arenaResultSystemNoteBody: "의사결정 일관성이 개선된 것으로 감지되었습니다.",
    arenaResultContinuePlayCta: "계속",
    arenaResultReturnHubCta: "Arena로 돌아가기",
    growthHubSectionLabel: "성장",
    growthHubHeadline: "내면 상태를 다시 세웁니다.",
    growthHubLead: "해석·회복·정렬은 이 공간에서 이어집니다.",
    growthHubCardsNavAria: "Dojo·Integrity·Guidance·Journey",
    growthHubMainRegionAria: "성장 허브 — 내면 정렬·Dojo·Integrity·Guidance·Journey",
    growthCardDojoTitle: "Dojo",
    growthCardDojoDesc: "지금 상태를 가늠합니다",
    growthCardIntegrityTitle: "Integrity Mirror",
    growthCardIntegrityDesc: "상대 시선에서 상황을 봅니다",
    growthCardGuidanceTitle: "Guidance",
    growthCardGuidanceDesc: "결정 패턴을 되돌아봅니다",
    growthCardJourneyTitle: "Journey",
    growthCardJourneyDesc: "28일 회복 경로를 이어갑니다",
  },
  myPageStub: {
    subMyPage: "마이 페이지",
    progressTitle: "진행",
    coreXp: "코어 XP",
    weeklyXp: "주간 XP",
    streak: "연속",
    systemMsg: "시스템 메시지",
    progressStage: "3단계 → 4단계",
    progressRank: "현재 순위: #128",
    progressStreakVal: "일관성: 5일",
    progressSystemLine: "안정적인 실행 패턴이 감지되었습니다.",
    progressFootnote: "예시 수치 · 심층 분석·raw 지표는 노출하지 않음",
    teamTitle: "팀",
    teamTiiCard: "팀 무결성 지수 (TII)",
    teamStatusCard: "팀 상태",
    teamInnerStatus: "상태",
    teamStable: "안정",
    teamInnerTrend: "추세",
    teamTrendVal: "개선 중",
    teamRankCard: "팀 순위",
    teamRankCaption: "순위",
    teamRankLine: "#8",
    teamFooter: "팀 점수는 집단 실행 품질을 반영합니다.",
    leaderTitle: "리더 트랙",
    leaderCardStatus: "상태",
    leaderBuilding: "구축 중",
    leaderCardReadiness: "리더 준비도",
    leaderReadinessVal: "임계치 근접",
    leaderCardCert: "인증",
    leaderCertVal: "아직 자격 미달",
    leaderSystem: "시스템 메시지",
    leaderSystemLine: "책임 패턴이 개선되고 있습니다.",
    leaderFootnote: "상태·톤 위주 · raw 수치·과도한 설명 없음",
    overviewHealingCardTitle: "Healing",
    overviewHealingCardLead: "회복·2차 각성 경로로 이동합니다.",
    overviewHealingNavAria: "Healing·Awakening 바로가기",
    recentRunsCardTitle: "최근 런",
    recentRunsRegionAria: "최근 Arena 런 목록",
    recentRunsLoading: "런 목록 불러오는 중…",
    recentRunsEmpty: "최근 런이 없어요.",
    recentRunsAnonymous: "로그인하면 최근 런 목록이 보여요.",
    recentRunsFootnote: "순서·필드는 API 응답 그대로입니다. 다음 페이지는 cursor로 불러옵니다.",
    recentRunsLoadMore: "다음 런 더 보기",
    recentRunsLoadingMore: "불러오는 중…",
    recentRunsScenarioPrefix: "시나리오",
    recentRunsStartedPrefix: "시작",
    recentRunsStatusPrefix: "상태",
    recentRunsOpenDetail: "상세",
    runDetailPageTitle: "런 상세",
    runDetailPageSubtitle: "Arena · 단일 런",
    runDetailRegionAria: "Arena 런 상세",
    runDetailBackMyPage: "마이 페이지",
    runDetailLoading: "런 정보 불러오는 중…",
    runDetailSkeletonLoading: "런 정보 불러오는 중…",
    runDetailSkeletonEmpty: "런을 찾을 수 없거나 권한이 없어요.",
    runDetailError: "런을 불러오지 못했어요.",
    runDetailNotFound: "런을 찾을 수 없거나 권한이 없어요.",
    runDetailSignIn: "로그인 후 내 런을 볼 수 있어요.",
    runDetailScenarioId: "시나리오",
    runDetailStatus: "상태",
    runDetailStartedAt: "시작",
    runDetailCompletedAt: "완료",
    runDetailLocaleLabel: "언어",
    runDetailDifficulty: "난이도",
    runStatusLabelDone: "완료",
    runStatusLabelInProgress: "진행 중",
    runStatusLabelStarted: "시작됨",
    myPageShellOverviewTitle: "지금 상태입니다.",
    myPageShellOverviewSubtitle: "아이덴티티·진행·팀 요약이 여기에 있습니다.",
    myPageOverviewRegionAria: "마이 페이지 개요 — 아이덴티티·진행·팀·계정 링크",
    myPageShellProgressTitle: "현재 움직임입니다.",
    myPageShellProgressSubtitle: "성장은 누적됩니다. 경쟁 창은 주기적으로 초기화됩니다.",
    myPageShellTeamTitle: "집단 무결성 상태입니다.",
    myPageShellTeamSubtitle: "팀 점수는 집단 실행 품질을 반영합니다.",
    myPageShellLeaderTitle: "준비도와 자격입니다.",
    myPageShellLeaderSubtitle: "리더십은 상태로 표시됩니다. 과도한 수치는 보이지 않습니다.",
    myPageCardIdentity: "아이덴티티",
    myPageCardProgress: "진행",
    myPageCardTeam: "팀",
    myPageLinkView: "보기 →",
    myPageLinkLeader: "리더 →",
    myPageLabelCodeName: "코드네임",
    myPageLabelStage: "단계",
    myPageLabelCoreProgress: "코어 진행",
    myPageLabelWeeklyProgress: "주간 진행",
    myPageOverviewTeamStatus: "상태",
    myPageProgressMovement: "단계 이동",
    myPageTeamNoteHeading: "안내",
    myPageAccountLink: "계정",
    myPageTabsAria: "마이 페이지 섹션",
    myPageTabOverview: "개요",
    myPageTabProgress: "진행",
    myPageTabTeam: "팀",
    myPageTabLeader: "리더",
    myPageTabAccount: "계정",
  },
};

const en: Messages = {
  loading: { message: "Please wait…", hint: "First load may take 1–2 minutes." },
  nav: { center: "Center", bty: "Foundry", arena: "Arena", en: "English", ko: "한국어", skipToMainContent: "Skip to main content" },
  login: {
    title: "bty Sign in",
    afterLoginGoTo: "After sign in you will go to",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    submitting: "Signing in…",
    cookieNotice: "Session uses cookies. The page may refresh or redirect after sign in.",
    errorDefault: "Sign in failed.",
    forgotPassword: "Forgot password?",
    forgotPasswordSent: "We sent a reset link to your email. Check your inbox (and spam folder).",
    forgotPasswordError: "Request failed. Check the email address or try again later.",
  },
  auth: { backToLogin: "Back to sign in", loading: "Verifying…", callbackError: "Verification failed. Please try again." },
  logout: "Log out",
  arena: {
    weeklyTierBronze: "Bronze (weekly)",
    weeklyTierSilver: "Silver (weekly)",
    weeklyTierGold: "Gold (weekly)",
    weeklyTierPlatinum: "Platinum (weekly)",
    runStateInProgress: "In progress",
    runStateCompleted: "Completed",
    runStateAborted: "Aborted",
    tieRankSuffix: "Tied",
  },
  reflectHints: {
    reflect_hint_empty: "Even one sentence helps you move forward.",
    reflect_hint_short: "A bit more detail would strengthen your reflection.",
    reflect_hint_developing: "Nice — your perspective is coming through.",
    reflect_hint_substantial: "You’ve captured plenty. You can still add if you like.",
    reflect_hint_near_limit: "You’re close to the length limit — wrap up when ready.",
    reflect_hint_at_limit: "You can submit at this length.",
  },
  integrity: {
    title: "Integrity Mirror",
    subtitle: "Reframe the situation with Dr. Chi.",
    stepLabelGuide: "Step 2 — Guide",
    guideMessage: "A short practice to see the other side. Describe a conflict in one line and Dr. Chi will reflect with an integrity question.",
    startPractice: "Start practice",
    intro: "Describe a conflict in one line. Dr. Chi will reflect with an integrity question.",
    placeholder: "e.g. I said something and the other person got upset",
    send: "Send",
    thinking: "Dr. Chi is thinking…",
    emptyHint: "Enter a conflict and send.",
    emptyStateHint: "Send your first message.",
    backToFoundry: "Back to Foundry",
    reply: "What if the roles were reversed?",
    doneTitle: "Today’s practice complete",
    doneSub: "You’re building the habit of seeing the other side, one step at a time.",
    doneCtaComplete: "Complete practice",
    doneCtaMentor: "Talk to mentor",
    doneCtaFoundry: "Back to Foundry",
    doneCtaAssessment: "50-item assessment",
    apiError: "Connection issue. Please try again.",
    errorTitle: "Error",
    replyFallback: "Could you say a bit more?",
    ariaStartPractice: "Start practice",
    ariaCompletePractice: "Complete practice",
    ariaInputLabel: "Describe a conflict situation",
    ariaWaitingChi: "Waiting for Dr. Chi…",
    mentorName: "Dr. Chi",
    conversationSimulatorAria: "Integrity conversation",
    messageComposerAria: "Message input and send",
    integrityMainRegionAria: "Integrity simulator — guide, conversation, completion",
  },
  center: {
    loading: "Please wait…",
    mainAriaLabel: "Letter to yourself",
    headerLabel: "Dear Me title and intro",
    contentLabel: "Dear Me content",
    title: "Center",
    heroTitleMain: "Center,",
    heroTitleAccent: "I'm listening.",
    tagline: "A cozy room to rest and heal. You're safe here.",
    ctaToFoundry: "Go to Foundry (practice)",
    linkToBty: "Go to bty (practice)",
    assessmentCta: "Self-Esteem Assessment (50 items)",
    assessmentCtaSub: "A short check on how you feel about yourself.",
    assessmentDetailHint: "Click here for a more detailed test.",
    entryIntro: "A safe space that reflects your feelings. No advice—just reflection. A place to rest and heal.",
    startCta: "Start",
    todayStepTitle: "Today's you",
    todayMoodLabel: "How do you feel right now?",
    todayEnergyLabel: "Energy level (1=very low, 5=okay)",
    todayOneWordLabel: "One word for today?",
    todayMoodPlaceholder: "e.g. calm, a bit anxious",
    todayOneWordPlaceholder: "e.g. grateful, tired",
    todayNext: "Next",
    todaySkip: "Skip",
    bridgeHeading: "Ready to step out?",
    bridgeSub: "(Go to practice)",
    letterStepTitle: "A letter to yourself",
    letterFormLabel: "Letter input and send",
    letterPrompt: "Write what's on your mind. Here we reflect, not advise.",
    letterPlaceholder: "Was there something you couldn't tell anyone today?",
    submitLetter: "Send",
    sendingLetter: "Reading your words…",
    replyStepTitle: "Reply",
    replySummaryLabel: "Reply summary",
    completedTitle: "Today's letter complete",
    completedSub: "Thanks for sharing. You can continue in Chat if you'd like.",
    continueToChat: "Continue in Chat",
    letterHistoryTitle: "Letter history",
    letterHistoryListAria: "List of sent letters by date",
    letterHistoryEmpty: "No letters yet.",
    letterHistoryError: "Failed to load letter history.",
    letterHistoryLoading: "Loading letter history…",
    letterHistoryReplied: "Replied",
    letterHistoryNoReply: "No reply",
    replyActionsLabel: "Actions after reply",
    footerLabel: "Back to Center",
  },
  bty: {
    title: "bty",
    tagline: "Practice. Integrity & Better Than Yesterday.",
    linkToCenter: "Go to Center",
    entryIntro: "Dashboard, mentor, integrity practice. Choose what to work on.",
    startCta: "Start",
    arenaCta: "Play Arena",
    dashboardLabel: "Dashboard",
    leaderboardLabel: "Leaderboard",
    leStageLabel: "LE Stage",
    airLabel: "AIR",
    recommendationLabel: "Recommendation",
    recommendationEmptyPlaceholder:
      "No personalized recommendation right now. Activity in Arena, Foundry, or Center will surface next steps here.",
    airUnavailable: "Unable to load AIR.",
    weeklyReflectionRegion: "Weekly reflection progress",
    personalRecordRegion: "Personal record this week",
    streakLabel: "Streak",
    pointsTodayLabel: "Points Today",
    lifetimeProgressLabel: "Lifetime Progress (Core XP)",
    dojoPracticeLabel: "Dojo practice",
    dojoPracticeLinksRegion: "Dojo practice links",
    leaderboardWeekResetRegion: "Weekly reset time",
    dashboardTierCardLabel: "Arena tier",
    dashboardTierCardSubline:
      "Tier from the server. Do not derive tier from Core XP in the UI.",
    dashboardTierCardRegionAria: "Arena tier (API)",
    leAirSummarySectionAria: "Leadership Engine and AIR summary widgets",
    dashboardShortcutGoArena: "Play Arena",
    dashboardShortcutWeeklyRanking: "View weekly ranking",
    leaderboardMainRegionAria: "Leaderboard cards and ranking list",
    dashboardHeroSubtitle: "Your arena progress at a glance.",
    dashboardWeeklyRankWidgetTitle: "Weekly XP & ranking",
    dashboardWeeklyWidgetLoading: "Loading weekly info",
    dashboardWeeklyWidgetAria: "This week’s weekly XP and ranking info",
    dashboardWeeklyXpCaption: "Weekly XP earned this week (UTC window)",
    dashboardWeeklyTierCaption: "This week's competition tier (from weekly XP)",
    dashboardWeeklyCompetitionStageCaption: "Weekly competition stage (band)",
    weeklyCompetitionStageBandBronze: "Bronze band — first weekly XP climb.",
    weeklyCompetitionStageBandSilver: "Silver band — steady progress.",
    weeklyCompetitionStageBandGold: "Gold band — upper competition tier.",
    weeklyCompetitionStageBandPlatinum: "Platinum band — top weekly tier.",
    leStageLeProgressBarAria: "Leadership Engine stage progress",
    dashboardWeeklyRankSeeLeaderboard: "View rank on leaderboard",
    dashboardWeeklyRankHint: "Weekly rank is shown only on the leaderboard.",
    dashboardOpenLiveLeaderboardCta: "Preview live rankings",
    dashboardLiveLeaderboardModalTitle: "This week’s live rankings",
    dashboardLiveLeaderboardModalAria: "Weekly XP leaderboard preview",
    dashboardLiveLeaderboardLoading: "Loading rankings…",
    dashboardLiveLeaderboardEmpty: "No rows to show yet.",
    dashboardLiveLeaderboardClose: "Close",
    dashboardLiveLeaderboardFullPage: "Open full leaderboard",
    dashboardLiveLeaderboardFailed: "Could not load.",
    dashboardLiveLeaderboardModalDesc:
      "Weekly XP rankings for this week. You may see players near your rank or the top of the board.",
    dashboardLiveLeaderboardListAria: "Weekly XP ranking list",
    dashboardLiveLeaderboardNotRankedBanner:
      "You’re not on the board for this week yet. Below is a preview of active players.",
    dashboardLiveLeaderboardNearMeFallbackBanner:
      "No players in your nearby rank slice; showing top rankings instead.",
    dashboardLiveLeaderboardCloseAria: "Close live rankings preview",
    leStageSummaryWidgetDesc:
      "Stage, reset due date, Arena summary, and behavior pattern are shown as returned by the server.",
    profileCodeNameCardLabel: "Code · Sub name",
    profileIdentitySubline:
      "Your identity on the dashboard. Complete an Arena scenario to appear on the leaderboard.",
    profileRenamePlaceholder: "Rename Sub Name (7 chars, once per code)",
    profileSaveSubName: "Save",
    profileSaving: "Saving…",
    eliteMeContentUnlockedLabel: "Elite-only content (me/elite)",
    eliteMeContentUnlockedYes: "Yes",
    eliteMeContentUnlockedNo: "No",
    leEngineTiiCertifiedBandAria: "Team TII, AIR summary, and certification",
    weeklySeasonActivityAria: "Season and weekly XP, event count",
    dashboardPageTitle: "Dashboard",
    foundryHubMainLandmarkAria: "Foundry practice hub",
    foundryFeatureCardsRegionAria: "Links to Dojo, Integrity, mentor, dashboard, Elite",
    foundryBackToBtyHome: "← bty home",
    indexThreeHubsExplainer: "Arena: scenarios & ranking. Center: rest & letters. Foundry: dashboard, mentor & practice.",
    indexHubEntriesRegionAria: "Arena, Center, and Foundry hub links",
    pointsTodaySubline: "XP earned today (UTC date).",
    airIntegritySlip: "Integrity slip",
    leStageSummaryUnavailable: "Unable to load stage summary.",
    leAirAria7d: "AIR 7d",
    leAirAria14d: "AIR 14d",
    leAirAria90d: "AIR 90d",
    leAirAriaGrid: "AIR: 7d, 14d, 90d",
    leAirLoading: "Loading AIR metrics…",
    leStageSummarySectionAria: "Leadership Engine stage summary",
    leStageStagePrefix: "Stage",
    leStageResetDueLabel: "Reset due",
    leStageArenaSummaryHeading: "Arena summary",
    leStageBehaviorHeading: "Behavior pattern",
    leStageLoading: "Loading stage summary…",
  },
  assessmentResult: {
    mainContentRegionAria: "Assessment result: scores and recommended track",
    nextStepsCtaGroupAria: "Next steps after assessment",
    start28ProgramCta: "Start 28-day program",
    retakeCta: "Retake assessment",
    ctaSrOnlyHeading: "Next steps after assessment",
  },
  landing: {
    heroTitle: "Better Than Yesterday",
    heroSubtitle: "Where would you like to go today?",
    recommended: "Recommended",
    arenaTitle: "Arena",
    arenaDesc: "Play scenarios, make choices, grow. XP, weekly quests, leaderboard.",
    arenaCta: "Play",
    foundryTitle: "Foundry",
    foundryDesc: "Dashboard, mentor, integrity practice. Choose what to work on.",
    foundryCta: "Go to Foundry",
    centerTitle: "Center",
    centerDesc: "A safe space that reflects your feelings. No advice—just reflection.",
    centerCta: "Rest here",
    todayGrowthLink: "Today's growth",
    footerHint: "Choose a path above.",
  },
  safeMirror: {
    title: "Safe Mirror",
    subtitle: "Write how you feel. Here we don’t give advice—we reflect your feelings back.",
    placeholder: "Was there something you couldn't tell anyone today?",
    submit: "Write",
    submitting: "Reading your words…",
    fallbackReply: "I can't write back right now. It's enough that you wrote it down.",
  },
  smallWins: {
    title: "Small Wins",
    subtitle: "Record one small thing you did today. No need for big goals.",
    add: "Add",
    customPlaceholder: "Custom (e.g. drank a glass of water)",
    count: "Today’s small wins",
    suggested: ["Made the bed", "Drank water", "Opened a window", "Washed hands", "1 min stretch", "Ate a bite", "Washed face", "Brushed teeth"],
  },
  selfEsteem: {
    title: "Self-esteem check",
    subtitle: "A short conversation with yourself. Pick what feels closest. There are no wrong answers.",
    again: "Try again",
    choices: [
      { value: 1, label: "Almost never" },
      { value: 2, label: "Rarely" },
      { value: 3, label: "Sometimes" },
      { value: 4, label: "Often" },
      { value: 5, label: "Almost always" },
    ],
    questions: [
      "I am satisfied with what I’ve done.",
      "I generally feel okay about myself.",
      "I try to accept my flaws.",
      "I can respect myself even when I fail.",
      "I try to speak kindly to myself.",
    ],
    storyLabels: ["First story", "Second story", "Third story", "Fourth story", "Fifth story"],
    results: {
      high: "You’re already taking steps to be okay with yourself. That intention matters.",
      mid: "Some days we feel anxious or not enough. Here, it’s okay to just be as you are.",
      low: "It’s okay to be hard on yourself sometimes. That often means you care. You’re allowed to be here as you are.",
      strengthHigh: "self-caring and self-acknowledging",
      strengthMid: "gradually getting to know yourself",
      strengthLow: "still trying to hold yourself dear",
      scoreSuffix: " pts",
    },
  },
  chat: {
    title: "Chat",
    placeholder: "Type something…",
    send: "Send",
    thinking: "Thinking…",
    connectionError: "Connection failed or timed out. Please try again.",
    retry: "Retry",
    introFoundry: "I'm Dr. Chi. I'm here to help you practice seeing things from the other person's side. Start with a line or two whenever you're ready.",
    introCenter: "I'm Dr. Chi. However you feel right now is okay. This is a safe space. Share whatever you'd like.",
    spaceHintFoundry: "You're in Foundry (practice space). We'll focus on scenarios, choices, and role-play.",
    spaceHintCenter: "You're in Center (rest space). We'll focus on support and empathy. Share at your own pace.",
    introArena: "I'm Dr. Chi. We can work through scenario choices, trade-offs, and priorities. Share whenever you're ready.",
    spaceHintArena: "You're in Arena. We'll focus on simulation, choices, and reflection.",
    exampleLabel: "Try an example",
    examplePhrasesFoundry: [
      "What might the other person be thinking in this situation?",
      "What's one thing I could change in how I respond?",
      "One thing I could try saying next time?",
      "When values clash, what do I prioritize?",
    ],
    examplePhrasesCenter: [
      "I want to talk about what's been hardest lately.",
      "In one word, how I feel right now.",
      "One small moment that felt okay today.",
      "Just listening is enough.",
    ],
    examplePhrasesArena: [
      "If I could take one thing from this run, what would it be?",
      "I want to try using this choice in the next scenario.",
    ],
    rememberConversation: "Remember conversation",
    deleteHistory: "Delete history",
  },
  resilience: {
    title: "Recovery resilience",
    subtitle: "A wave that dips then rises again.",
    dailyTrajectorySubtitle: "Daily trajectory from your 5-item check-ins. Your recovery over time.",
    emptyMessage: "No trajectory yet. Complete today's steps or letter in Center to build it.",
    past: "Past",
    now: "Now",
    levelLow: "Low (energy 1–2)",
    levelMid: "Mid (energy 3)",
    levelHigh: "High (energy 4–5)",
    levelLegendAria: "Daily recovery level legend",
  },
  arenaLevels: {
    membershipPending: "Membership approval pending. Levels will show after approval.",
    noLevelsYet: "No records yet. Start your first scenario.",
    emptyCta: "Start a scenario in Arena",
    loginRequired: "Sign in required.",
    track: "Track",
    unlockedUpTo: "Unlocked up to",
    levelCardHint: "Unlocked up to here.",
    l4AdminGranted: "admin-granted",
    staff: "Staff",
    leader: "Leader",
    l4Partner: "L4 (Partner)",
  },
  avatarOutfit: {
    label: "Outfit theme",
    professional: "Professional",
    fantasy: "Fantasy",
    hint: "Outfit changes by level within your chosen theme.",
    pageTitle: "Avatar",
    backToFoundry: "Back to Foundry",
    backToFoundryAria: "Back to Foundry",
    goToDashboard: "Go to Dashboard",
    goToDashboardAria: "Go to Dashboard",
    preview: "Preview",
    previewAria: "Avatar preview",
    character: "Character",
    characterLocked: "Character is locked until the next Code evolution.",
    characterChangeHint: "You can change your character on the dashboard.",
    outfit: "Outfit",
    noOutfits: "No outfits available for this theme.",
    save: "Save",
    saving: "Saving",
    saveAria: "Save",
    errorLoad: "Failed to load avatar settings.",
    outfitLabels: {
      professional_outfit_scrub_general: "General scrub",
      professional_outfit_figs_scrub: "Figs scrub",
      professional_outfit_doctor_gown: "Doctor gown",
      professional_outfit_surgery_coat_suit: "Surgery coat + suit",
      professional_outfit_brand_suit: "Brand suit",
      professional_outfit_figs_scrub_short: "Short-sleeve Figs scrub",
      professional_outfit_shorts_tee: "Shorts & tee",
      fantasy_outfit_apprentice: "Apprentice",
      fantasy_outfit_adventurer: "Adventurer",
      fantasy_outfit_journeyer: "Journeyer",
      fantasy_outfit_warrior_mage_mid: "Warrior/Mage/Merchant mid",
      fantasy_outfit_senior: "Senior",
      fantasy_outfit_senior_plus: "Senior+",
      fantasy_outfit_master: "Master",
    },
  },
  arenaMembership: {
    label: "Arena membership",
    approved: "Approved",
    pending: "Pending approval. Levels will show after admin approval.",
    hint: "Enter job function and join date. Admin approval unlocks Arena levels.",
    jobFunction: "Job function",
    joinedAt: "Join date",
    leaderStartedAt: "Leader start date (optional, for leader roles)",
    submit: "Submit",
    submitting: "Submitting…",
    submitError: "Submission failed.",
    submitSuccess: "Pending approval. Levels will show after admin approval.",
    seniorDoctorHint: "Senior Doctor is typically 3+ years of experience.",
    validationRequired: "Please enter job function and join date.",
  },
  mentorRequest: {
    cardTitle: "Request 1:1 session with Dr. Chi",
    cardDesc: "Available for Elite (top 5%) only. After approval, continue the conversation on the Mentor page.",
    requestCta: "Request session",
    submitting: "Submitting…",
    statusPending: "Pending approval.",
    statusApproved: "Approved. Continue the conversation on the Mentor page.",
    statusRejected: "Not approved this time. You can request again later.",
    messageLabel: "Message (optional)",
    messagePlaceholder: "e.g. I'd like feedback on leadership",
    errorEliteOnly: "Only available when you're in the top 5%.",
    errorPendingExists: "You already have a pending request.",
    errorSubmit: "Request failed. Please try again.",
    approvedCta: "Go to Mentor page",
    listTitle: "My requests",
    listEmpty: "No requests yet.",
    colDate: "Requested at",
    colStatus: "Status",
    slaImminentBadge: "Mentor response window closing soon — you may hear back shortly.",
    eliteDomainTerminalApproved: "Mentor request · Approved",
    eliteDomainTerminalRejected: "Mentor request · Declined",
    eliteDomainPendingStale: "It’s been over two weeks since you applied. We’re still waiting on a response.",
    eliteStatusBadgePending: "Mentor request · Pending",
    eliteStatusBadgeApproved: "Mentor request · Approved",
    eliteStatusBadgeRejected: "Mentor request · Declined",
  },
  elitePage: {
    circleCardTitle: "Circle meetup",
    circleCardDesc: "Elite-only small-group meetups (e.g. weekly or monthly). Check below for schedule and how to join.",
    circleCardPlaceholder: "Coming soon",
    badgeLabels: { weekly_elite: "Weekly Top 5%" },
    unlockConditionTitle: "Unlock condition",
    unlockConditionMet: "Top 5% on the weekly leaderboard (met).",
    unlockConditionLocked: "Available when you reach the top 5% on the weekly leaderboard.",
    unlockExposureTitle: "What's available",
    unlockExposureMet: "You can access Elite-only content (mentor session request, circle meetup, badges, etc.).",
    unlockExposureLocked: "Elite page and content available when you reach top 5%.",
    mentorDeepLinksListAria: "Elite mentor and deep conversation links",
    loadingElitePageAria: "Loading Elite page",
    pageTitle: "Elite only",
    pageIntroElite:
      "You're in the top 5% on the weekly leaderboard. Here you can access Elite-only content.",
    badgesSectionTitle: "Badges",
    tableColActions: "Actions",
  },
  mentorRequestAdmin: {
    title: "Mentor session request approval",
    description: "Elite mentor (1:1) request queue. Approve or reject.",
    empty: "No pending requests.",
    loading: "Loading…",
    actions: "Actions",
    userId: "User ID",
    createdAt: "Requested at",
    message: "Message",
    colStatus: "Status",
    tableCaption: "Pending Elite mentor session requests",
    queueTableAria: "Mentor request queue table",
    approveRejectGroupAria: "Approve or reject this request",
    statusPendingLabel: "Pending",
    approve: "Approve",
    reject: "Reject",
    approving: "Approving…",
    rejecting: "Rejecting…",
    error: "Action failed",
    errorLoadQueue: "Could not load the queue.",
    errorPatch: "Approve or reject failed.",
    debugLink: "Debug",
    usersLink: "Users",
    arenaMembershipLink: "Arena membership",
  },
  mentorPage: {
    deleteAllHistoryConfirm: "Delete all saved mentor conversation?",
    pageMainLandmarkAria: "Dr. Chi mentor conversation",
    topicChoiceGroupAria: "Choose a conversation topic",
  },
  dentalRpg: {
    empty: "No equipment.",
    listAria: "Equipment list",
    rarity1: "Common",
    rarity2: "Uncommon",
    rarity3: "Rare",
    rarity4: "Epic",
    rarity5: "Legendary",
  },
  healing: {
    title: "Healing",
    intro: "Entry point for Healing and Awakening. Continue to Awakening for the Second Awakening ritual.",
    awakeningCta: "Awakening →",
    dashboardCta: "← Dashboard",
    navLabel: "Healing menu",
    ariaAwakening: "Go to Awakening",
    ariaDashboard: "Back to dashboard",
    loading: "Loading…",
    emptyPhase: "Phase information is unavailable. Try going to Awakening.",
    loadError: "Could not load progress. Please try again later.",
    awakeningLoadingLabel: "Loading Second Awakening",
    phaseProgressRegionAria: "Healing phase and progress",
    awakeningRitualActsRegionAria: "Second Awakening ritual acts 1–3",
    healingBottomNavSectionAria: "Awakening and dashboard links",
    mainLandmarkAria: "Healing hub",
    stubApiSectionTitle: "Server progress (display only)",
    phaseFieldLabel: "Phase",
    ringTypeFieldLabel: "Ring type",
    stubRenderOnlyNote: "Values come from the API; the UI does not compute phase.",
    awakeningActsTrackTitle: "Awakening acts (server record)",
    awakeningActsTrackRegionAria: "Awakening act list and completion record",
    awakeningActsTriggerLine:
      "Ritual unlocks after {day} days and {sessions} sessions (server trigger info).",
    awakeningActDone: "Recorded",
    awakeningActOpen: "Not yet recorded",
    awakeningRecordNextCta: "Record next act complete",
    awakeningAllActsRecorded: "All three acts are recorded.",
    awakeningProgressToastOk: "Progress saved.",
    awakeningProgressToast409: "This act was already recorded.",
    awakeningProgressToast400: "Wrong order or invalid request.",
    awakeningProgressToastNetwork: "Could not save. Try again.",
    awakeningActsLoadError: "Could not load act info.",
    healingAwakeningProgressHeading: "Awakening progress (server)",
    healingAwakeningProgressPct: "Progress {n}%",
    healingProgressbarValuetext: "{pct} percent. {detail}",
    healingProgressbarDetailAllDone: "All acts are complete.",
    healingProgressbarDetailNext: "Next act: {name}.",
    healingProgressbarDetailSync: "Next act appears when synced with the server.",
    healingAwakeningAllActsDone: "All three acts are recorded.",
    healingNextActFromApi: "Next act (server): {name}",
    healingNextActSyncHint:
      "If records are out of order, complete acts in sequence below.",
    healingProgressRefreshHint:
      "If the list doesn’t update after recording, refresh server state below.",
    healingProgressRefreshCta: "Refresh progress",
    awakeningActsGridAria: "Awakening acts 1–3 grid",
    awakeningActNumberLabel: "Act {n}",
    healingAwakeningBlockedOrderRequired: "Complete the previous act in order first.",
    healingAwakeningBlockedAlreadyComplete: "This act is already recorded.",
    healingActLockPrerequisite: "Complete the previous act in order first.",
    healingActLockAlreadyComplete: "This act is already recorded.",
    pathProgressBlockedCooldown: "Please try again in a moment. (Cooldown)",
    pathProgressBlockedPhase: "Complete the previous step first to continue.",
    healingActsOverallProgressAria: "Awakening acts completion progress",
    healingActsOverallProgressCaption: "Acts recorded",
    healingActsOverallProgressValuetext: "{done} of {total} acts recorded, {pct} percent",
  },
  train: {
    title: "28-Day Training",
    completeGroupLabel: "Complete and coach or summary toggle",
    completionSummaryLabel: "Completion summary",
    coachChatLabel: "Coach chat",
    reinforcementLabel: "Reinforcement questions",
    dayListLabel: "Day list",
    lessonLabel: "Today's lesson",
    lockedLabel: "Locked lesson notice",
    sidebarPanelLabel: "Completion summary and coach chat",
    journeyStartTitle: "Start 28-day training",
    journeyStartIntro: "Pick a day on the left for the lesson; chat with the coach on the right.",
    journeyStartDay1Link: "Start from Day 1",
    journeyStartDay1Aria: "Start from Day 1",
  },
  dojoResult: {
    title: "Today-Me 50-Item Result",
    areaScoresTitle: "Scores by area",
    drChiCommentTitle: "Dr. Chi comment",
    resultCommentHigh: "You're doing well in perspective-taking, communication, and leadership. Keep building on these strengths.",
    resultCommentMid: "Some areas are already strong; others have room to grow. Pick one area at a time to practice.",
    resultCommentLow: "This is your starting point. Repeating the Foundry integrity practice and this assessment will help you grow step by step.",
    loading: "Loading result…",
    noAnswers: "Complete the 50 questions to see your result.",
    backToAssessment: "Go to assessment",
    apiError: "Could not load result. Please try again later.",
    dimensionLabels: {
      core: "Self-worth",
      compassion: "Self-compassion",
      stability: "Stability",
      growth: "Growth",
      social: "Relations",
      perspective_taking: "Perspective-taking",
      communication: "Communication & listening",
      leadership: "Leadership & responsibility",
      conflict: "Conflict & negotiation",
      teamwork: "Team & collaboration",
    },
    nextActionsLabel: "Next actions",
    resultActionsLabel: "Result actions",
    questionStepSectionAria: "Current question and response options",
    resultScoresInsightRegionAria: "Scores by area and comment",
    dojoPageMainAria: "Dojo 50-item assessment",
    dojoHistoryMainRegionAria: "Dojo past assessment history — submission date and summary list",
  },
  arenaRun: {
    reflectionPrompt: "In one sentence: what will you take from this scenario?",
    errorStartRun: "Could not start run.",
    errorSignIn: "Please sign in.",
    errorAlreadySubmitted: "Already submitted or session expired.",
    errorSubmitFailed: "Submission failed. Please try again.",
    heroTitle: "One step today, in the Arena.",
    otherLabel: "Other (Write your own)",
    otherRecorded: "Other recorded.",
    nextScenario: "Next scenario",
    otherPlaceholder: "Write your own...",
    cancel: "Cancel",
    submit: "Submit",
    liveRanking: "Live ranking",
    completeErrorPrefix: "Save failed: ",
    completeErrorSuffix: ". You may not appear on the leaderboard.",
    headerTitle: "Simulation",
    headerSubtitle: "One round. Resumes when you return. (MVP 1)",
    pauseLabel: "Pause",
    resetLabel: "Reset",
    mainLabel: "Main",
    startSimulation: "Start Simulation",
    confirm: "Confirm",
    reflectionTitle: "Reflection",
    reflectionNext: "Next",
    reflectionOptional: "Optional",
    reflectionPlaceholder: "e.g. I'll pause before reacting next time.",
    systemOutput: "SYSTEM OUTPUT",
    skipFollowUp: "Skip follow-up · Next scenario",
    followUpSelected: "FOLLOW-UP SELECTED",
    step6Title: "Step 6 · Consolidation",
    mainPlayLandmarkAria: "Arena scenario play",
    preparingNewScenarioAria: "Preparing new scenario",
    scenarioProgressPanelAria: "Scenario progress and result",
    reflectionBusyAria: "Submitting reflection",
    reflectionSentenceBlockAria: "One-sentence reflection",
    reflectionChoiceOptionsAria: "Reflection choices",
    reflectionLengthHintAria: "Reflection length hint",
    reflectionCharCount: "{n} / {max} characters",
    youChose: "You chose",
    keyInsight: "Key insight:",
    principle: "Principle: \"Stabilize people first, then fix the system.\"",
    completeBtn: "Complete",
    reflectionBonusLabel: "Reflection bonus",
    deepeningTitle: "Reflection deepening",
    nextActionLabel: "Next step",
    step7Title: "Step 7 · Complete",
    step7Body: "Saved. Use the button below to go to the next scenario.",
    choiceLabel: "Choice",
    scenarioCompletedToast: "Scenario completed",
    scenarioNotFound: "Scenario not found.",
    scenarioNotFoundHint: "Try another scenario or refresh.",
    pastScenariosHeading: "Past scenarios",
    pastScenariosCollapse: "Collapse",
    pastScenariosExpand: "Expand",
    loadingHistory: "Loading history…",
    couldNotLoadHistory: "Could not load history.",
    pastScenariosSessionHint:
      "Your session may not have reached this request. Try signing in again from bty home or refresh the page to see past runs.",
    retryLoadHistory: "Retry load history",
    retry: "Retry",
    noCompletedScenarios: "No completed scenarios yet.",
    startFirstScenario: "Start your first scenario!",
    completed: "Completed",
    inProgress: "In progress",
    reflectDeepeningUnavailable:
      "We couldn’t load the deeper reflection right now. Your reflection was saved.",
  },
  emotionalStats: {
    emptyMessage: "No records yet. Try Arena or chat to start.",
    sectionTitle: "Today's growth",
    errorLoad: "Could not load display.",
  },
  profile: {
    title: "Profile",
    displayNameLabel: "Display name",
    displayNamePlaceholder: "Nickname or name to show (optional)",
    save: "Save",
    saving: "Saving…",
    backToDashboard: "Back to dashboard",
    errorLoad: "Failed to load profile.",
    errorSave: "Failed to save.",
    errorTooLong: "Display name must be 64 characters or less.",
    avatarSettingsLink: "Avatar settings",
    saveButtonAriaLabel: "Save display name",
  },
  uxPhase1Stub: {
    bottomNavArena: "Arena",
    bottomNavGrowth: "Growth",
    bottomNavMyPage: "My Page",
    growthTitle: "Growth",
    growthSubtitle: "Interpretation · recovery",
    growthLead: "Rebuild your internal state.",
    growthReturnArena: "Arena hub",
    growthWeeklyRankingLink: "Weekly ranking",
    growthFoundryLink: "Foundry dashboard",
    growthOptionsRegionAria: "Growth area shortcuts",
    wireframeLandmarkAria: "Arena wireframe hub",
    weeklySnapshotRegionAria: "Weekly rank snapshot sample",
    wireframeScreenTitle: "BTY Arena",
    wireframeScreenSubtitle: "Wireframe · Phase 1",
    wireframeSystemReady: "System ready.",
    wireframePlayGame: "Play Game",
    wireframeStartScenario: "Start new scenario",
    wireframeContinue: "Continue",
    wireframeResumeLast: "Resume last simulation",
    wireframeOr: "or",
    wireframeWeeklyRankLine: "Weekly Rank: #128",
    wireframeSeasonLine: "Season ends in 12 days",
    wireframeWireRuleNote:
      "Sample values · AIR, TII, LRI not shown on this screen (wireframe rules).",
    wireframeResultStubPrefix: "Result screen stub:",
    resultTitle: "Simulation Complete",
    resultSubtitle: "Arena · Result",
    resultCoreXpSample: "+25 Core XP",
    resultWeeklyXpSample: "+15 Weekly XP",
    resultSampleNote: "Sample rewards · live data after API wiring",
    resultSystemTitle: "System message",
    resultSystemBody: "System detected improved decision consistency.",
    resultContinueCta: "Continue",
    resultReturnArenaCta: "Return to Arena",
    resultWireHubLink: "Arena wireframe hub",
    growthArenaPlayLink: "Play Arena",
    growthArenaWireHubLink: "Arena hub (wireframe)",
    growthShortcutsNavAria: "Ranking, dashboard, Arena, and Healing shortcuts",
    growthElitePageLink: "Elite (top 5%)",
    wireframeFoundryEliteAria: "Foundry and Elite shortcuts",
    growthHealingLink: "Healing",
    growthAwakeningLink: "Awakening",
    resultRunCompleteHint:
      "After a run, tap “Next scenario” for weekly XP and leaderboard credit.",
    resultShareRegionAria: "Share completion summary",
    resultShareCta: "Copy one-line summary",
    resultShareCopied: "Copied.",
    resultShareFailed: "Could not copy.",
    resultShareClipboardLine: "Completed an Arena scenario run on BTY.",
    resultNextActionsRegionAria: "Next steps after your run",
    resultNextScenarioSectionLabel: "Recommended next step",
    resultNextScenarioCta: "Next scenario",
    resultNextScenarioSub: "Keep playing to earn weekly XP and leaderboard credit.",
    wireframeArenaPracticeNavAria: "Dojo and Integrity practice entry",
    wireframeDojoLink: "Dojo 50",
    wireframeIntegrityLink: "Integrity Mirror",
    wireframeRunsDashboardHint: "Recent runs are listed on the Foundry dashboard.",
    growthMyRankCardTitle: "Your rank this week",
    growthMyRankRegionAria: "Weekly leaderboard rank and weekly XP",
    growthMyRankLoading: "Loading rank…",
    growthMyRankYourRank: "Your rank: #{rank}",
    growthMyRankWeeklyXpLine: "Weekly XP: {xp}",
    growthMyRankNoRank: "Not on the weekly leaderboard yet.",
    growthMyRankWeekNotParticipated:
      "No weekly XP yet this week, so you’re not ranked. Play in Arena to appear.",
    growthMyRankAnonymous: "Sign in to see your rank.",
    growthMyRankSeeLeaderboard: "Full leaderboard",
    comebackTitle: "Welcome back",
    comebackBody:
      "It looks like you stepped away for a few days. Whenever you’re ready, you can continue your recovery path—no pressure.",
    comebackResumeJourneyCta: "Resume Journey",
    comebackNotNowCta: "Not now",
    growthNavDojoTitle: "Dojo",
    growthNavDojoLine: "50-question snapshot of where you are",
    growthNavIntegrityTitle: "Integrity",
    growthNavIntegrityLine: "See the situation from the other side",
    growthNavGuidanceTitle: "Guidance",
    growthNavGuidanceLine: "Review your decision patterns",
    growthNavJourneyTitle: "Journey",
    growthNavJourneyLine: "28-day recovery loop—continue from your current day",
    growthNavReflectionTitle: "Reflection",
    growthNavReflectionLine: "Stabilize your inner voice (Dear Me)",
    growthBackToGrowth: "Back to Growth",
    growthJourneyLandmarkAria: "28-day Journey board",
    arenaHubTitle: "Continue your Arena.",
    arenaHubShellTitle: "Arena",
    arenaHubSubtitle: "Decision, repetition, and pressure training live here.",
    arenaHubReadyTitle: "System ready",
    arenaHubReadyBody: "Resume your last simulation or begin a new scenario.",
    arenaHubCardTitleContinue: "Continue your Arena.",
    arenaHubCardBodyResume: "Resume your last simulation.",
    arenaHubCardBodyNew: "Start a new scenario.",
    arenaHubCtaWeeklyRank: "Weekly rank",
    arenaHubEntryLoading: "Loading…",
    arenaHubContinueCta: "Continue",
    arenaHubPlayCta: "Play Game",
    arenaHubWeeklyRankLabel: "Weekly rank",
    arenaHubSeasonEndsLabel: "Season ends in",
    arenaHubSummaryRegionAria: "Arena hub — weekly rank and season",
    arenaHubSummaryLoadError: "Could not load stats.",
    arenaResultEyebrow: "Arena Result",
    arenaResultRecordedTitle: "Decision recorded.",
    arenaResultRecordedSubtitle: "Outcome has been updated.",
    arenaResultSystemNoteTitle: "System note",
    arenaResultSystemNoteBody: "Improved decision consistency detected.",
    arenaResultContinuePlayCta: "Continue",
    arenaResultReturnHubCta: "Return to Arena",
    growthHubSectionLabel: "Growth",
    growthHubHeadline: "Rebuild your internal state.",
    growthHubLead: "Reflection, recovery, and alignment live here.",
    growthHubCardsNavAria: "Dojo, Integrity Mirror, Guidance, and Journey",
    growthHubMainRegionAria: "Growth hub — inner alignment, Dojo, Integrity, Guidance, Journey",
    growthCardDojoTitle: "Dojo",
    growthCardDojoDesc: "Measure your current state",
    growthCardIntegrityTitle: "Integrity Mirror",
    growthCardIntegrityDesc: "See the situation from the other side",
    growthCardGuidanceTitle: "Guidance",
    growthCardGuidanceDesc: "Review your decision patterns",
    growthCardJourneyTitle: "Journey",
    growthCardJourneyDesc: "Continue your 28-day recovery path",
  },
  myPageStub: {
    subMyPage: "My Page",
    progressTitle: "Progress",
    coreXp: "Core XP",
    weeklyXp: "Weekly XP",
    streak: "Streak",
    systemMsg: "System message",
    progressStage: "Stage 3 → Stage 4",
    progressRank: "Current rank: #128",
    progressStreakVal: "Consistency: 5 days",
    progressSystemLine: "Stable execution pattern detected.",
    progressFootnote: "Sample values · no deep analytics or raw metrics",
    teamTitle: "Team",
    teamTiiCard: "Team Integrity Score (TII)",
    teamStatusCard: "Team status",
    teamInnerStatus: "Status",
    teamStable: "Stable",
    teamInnerTrend: "Trend",
    teamTrendVal: "Improving",
    teamRankCard: "Team rank",
    teamRankCaption: "Rank",
    teamRankLine: "#8",
    teamFooter: "Team score reflects collective execution quality.",
    leaderTitle: "Leader Track",
    leaderCardStatus: "Status",
    leaderBuilding: "Building",
    leaderCardReadiness: "Leader readiness",
    leaderReadinessVal: "Near threshold",
    leaderCardCert: "Certification",
    leaderCertVal: "Not yet qualified",
    leaderSystem: "System message",
    leaderSystemLine: "Improving responsibility pattern detected.",
    leaderFootnote: "Tone-first · minimal numbers",
    overviewHealingCardTitle: "Healing",
    overviewHealingCardLead: "Recovery and Second Awakening paths.",
    overviewHealingNavAria: "Healing and Awakening shortcuts",
    recentRunsCardTitle: "Recent runs",
    recentRunsRegionAria: "Recent Arena runs",
    recentRunsLoading: "Loading runs…",
    recentRunsEmpty: "No recent runs.",
    recentRunsAnonymous: "Sign in to see your recent runs.",
    recentRunsFootnote: "Order and fields match the API. Next page uses cursor.",
    recentRunsLoadMore: "Load more runs",
    recentRunsLoadingMore: "Loading…",
    recentRunsScenarioPrefix: "Scenario",
    recentRunsStartedPrefix: "Started",
    recentRunsStatusPrefix: "Status",
    recentRunsOpenDetail: "Details",
    runDetailPageTitle: "Run details",
    runDetailPageSubtitle: "Arena · single run",
    runDetailRegionAria: "Arena run details",
    runDetailBackMyPage: "My page",
    runDetailLoading: "Loading run…",
    runDetailSkeletonLoading: "Loading run…",
    runDetailSkeletonEmpty: "Run not found or not allowed.",
    runDetailError: "Could not load this run.",
    runDetailNotFound: "Run not found or not allowed.",
    runDetailSignIn: "Sign in to view your runs.",
    runDetailScenarioId: "Scenario",
    runDetailStatus: "Status",
    runDetailStartedAt: "Started",
    runDetailCompletedAt: "Completed",
    runDetailLocaleLabel: "Locale",
    runDetailDifficulty: "Difficulty",
    runStatusLabelDone: "Completed",
    runStatusLabelInProgress: "In progress",
    runStatusLabelStarted: "Started",
    myPageShellOverviewTitle: "Your current status.",
    myPageShellOverviewSubtitle: "Identity, progress, and team summary live here.",
    myPageOverviewRegionAria: "My Page overview — identity, progress, team, account link",
    myPageShellProgressTitle: "Your current movement.",
    myPageShellProgressSubtitle: "Growth remains cumulative. Competition resets by window.",
    myPageShellTeamTitle: "Collective integrity status.",
    myPageShellTeamSubtitle: "Team score reflects collective execution quality.",
    myPageShellLeaderTitle: "Readiness and qualification.",
    myPageShellLeaderSubtitle: "Leadership status is shown as state, not raw analytics.",
    myPageCardIdentity: "Identity",
    myPageCardProgress: "Progress",
    myPageCardTeam: "Team",
    myPageLinkView: "View →",
    myPageLinkLeader: "Leader →",
    myPageLabelCodeName: "Code Name",
    myPageLabelStage: "Stage",
    myPageLabelCoreProgress: "Core Progress",
    myPageLabelWeeklyProgress: "Weekly Progress",
    myPageOverviewTeamStatus: "Status",
    myPageProgressMovement: "Stage movement",
    myPageTeamNoteHeading: "Note",
    myPageAccountLink: "Account",
    myPageTabsAria: "My Page sections",
    myPageTabOverview: "Overview",
    myPageTabProgress: "Progress",
    myPageTabTeam: "Team",
    myPageTabLeader: "Leader",
    myPageTabAccount: "Account",
  },
};

export function getMessages(locale: Locale): Messages {
  return locale === "en" ? en : ko;
}

/** 도메인 `weeklyTierDisplayLabelKey` / `arenaRunStateDisplayLabelKey` 반환 키 → 로케일 문구 */
export type ArenaStableDisplayKey =
  | "arena.leaderboard.weeklyTierBronze"
  | "arena.leaderboard.weeklyTierSilver"
  | "arena.leaderboard.weeklyTierGold"
  | "arena.leaderboard.weeklyTierPlatinum"
  | "arena.leaderboard.tieRankSuffix"
  | "arena.run.stateInProgress"
  | "arena.run.stateCompleted"
  | "arena.run.stateAborted";

export function arenaStableLabel(locale: Locale, key: ArenaStableDisplayKey): string {
  const a = getMessages(locale).arena;
  switch (key) {
    case "arena.leaderboard.weeklyTierBronze":
      return a.weeklyTierBronze;
    case "arena.leaderboard.weeklyTierSilver":
      return a.weeklyTierSilver;
    case "arena.leaderboard.weeklyTierGold":
      return a.weeklyTierGold;
    case "arena.leaderboard.weeklyTierPlatinum":
      return a.weeklyTierPlatinum;
    case "arena.leaderboard.tieRankSuffix":
      return a.tieRankSuffix;
    case "arena.run.stateInProgress":
      return a.runStateInProgress;
    case "arena.run.stateCompleted":
      return a.runStateCompleted;
    case "arena.run.stateAborted":
      return a.runStateAborted;
    default: {
      const _x: never = key;
      return _x;
    }
  }
}

/** `arenaRunDetailSkeletonDisplayKey` → 로케일 문구 (250). */
export function arenaRunDetailDisplayLabel(
  locale: Locale,
  key:
    | typeof ARENA_RUN_DETAIL_LOADING_DISPLAY_KEY
    | typeof ARENA_RUN_DETAIL_EMPTY_DISPLAY_KEY
): string {
  const m = getMessages(locale).myPageStub;
  return key === ARENA_RUN_DETAIL_LOADING_DISPLAY_KEY
    ? m.runDetailSkeletonLoading
    : m.runDetailSkeletonEmpty;
}

/** `DASHBOARD_RECOMMENDATION_EMPTY_PLACEHOLDER_KEY` → 로케일 문구. */
export function dashboardRecommendationEmptyCopy(locale: Locale): string {
  void DASHBOARD_RECOMMENDATION_EMPTY_PLACEHOLDER_KEY;
  return getMessages(locale).bty.recommendationEmptyPlaceholder;
}

/** `resilienceLevelDisplayLabelKey` → 로케일 문구. */
export function resilienceLevelDisplayCopy(
  locale: Locale,
  key: ResilienceLevelDisplayLabelKey
): string {
  const r = getMessages(locale).resilience;
  switch (key) {
    case "center.resilience.level_low":
      return r.levelLow;
    case "center.resilience.level_mid":
      return r.levelMid;
    case "center.resilience.level_high":
      return r.levelHigh;
    default: {
      const _e: never = key;
      return _e;
    }
  }
}

export type ReflectTextLengthHintKey =
  | "reflect_hint_empty"
  | "reflect_hint_short"
  | "reflect_hint_developing"
  | "reflect_hint_substantial"
  | "reflect_hint_near_limit"
  | "reflect_hint_at_limit";

export function reflectHintLabel(locale: Locale, key: ReflectTextLengthHintKey): string {
  const h = getMessages(locale).reflectHints;
  switch (key) {
    case "reflect_hint_empty":
      return h.reflect_hint_empty;
    case "reflect_hint_short":
      return h.reflect_hint_short;
    case "reflect_hint_developing":
      return h.reflect_hint_developing;
    case "reflect_hint_substantial":
      return h.reflect_hint_substantial;
    case "reflect_hint_near_limit":
      return h.reflect_hint_near_limit;
    case "reflect_hint_at_limit":
      return h.reflect_hint_at_limit;
    default: {
      const _e: never = key;
      return _e;
    }
  }
}

export function eliteMentorDomainCopy(
  locale: Locale,
  key:
    | "elite_mentor_terminal_approved"
    | "elite_mentor_terminal_rejected"
    | "elite_mentor_pending_stale"
    | "elite_mentor_status_pending"
    | "elite_mentor_status_approved"
    | "elite_mentor_status_rejected"
): string {
  const m = getMessages(locale).mentorRequest;
  switch (key) {
    case "elite_mentor_terminal_approved":
      return m.eliteDomainTerminalApproved;
    case "elite_mentor_terminal_rejected":
      return m.eliteDomainTerminalRejected;
    case "elite_mentor_pending_stale":
      return m.eliteDomainPendingStale;
    case "elite_mentor_status_pending":
      return m.eliteStatusBadgePending;
    case "elite_mentor_status_approved":
      return m.eliteStatusBadgeApproved;
    case "elite_mentor_status_rejected":
      return m.eliteStatusBadgeRejected;
    default: {
      const _e: never = key;
      return _e;
    }
  }
}

export function healingAwakeningBlockedCopy(
  locale: Locale,
  key: "healing_awakening_act_already_complete" | "healing_awakening_act_order_required"
): string {
  const h = getMessages(locale).healing;
  return key === "healing_awakening_act_already_complete"
    ? h.healingAwakeningBlockedAlreadyComplete
    : h.healingAwakeningBlockedOrderRequired;
}

export function healingAwakeningLockReasonCopy(
  locale: Locale,
  key: "healing_act_lock_prerequisite" | "healing_act_lock_already_complete"
): string {
  const h = getMessages(locale).healing;
  return key === "healing_act_lock_prerequisite"
    ? h.healingActLockPrerequisite
    : h.healingActLockAlreadyComplete;
}

/** `weeklyCompetitionStageTierBandDisplayLabelKey` → 로케일 문구 (251). */
export function weeklyCompetitionStageBandCopy(
  locale: Locale,
  key: WeeklyCompetitionStageTierBandDisplayLabelKey
): string {
  const b = getMessages(locale).bty;
  switch (key) {
    case "arena.weekly_competition.stage_band_bronze":
      return b.weeklyCompetitionStageBandBronze;
    case "arena.weekly_competition.stage_band_silver":
      return b.weeklyCompetitionStageBandSilver;
    case "arena.weekly_competition.stage_band_gold":
      return b.weeklyCompetitionStageBandGold;
    case "arena.weekly_competition.stage_band_platinum":
      return b.weeklyCompetitionStageBandPlatinum;
    default: {
      const _e: never = key;
      return _e;
    }
  }
}

/** `healingPathProgressBlockedUserDisplayKey` 결과·동일 상수 → 로케일 (251). */
export function healingPathProgressBlockedCopy(
  locale: Locale,
  key:
    | typeof HEALING_PROGRESS_BLOCKED_COOLDOWN_DISPLAY_KEY
    | typeof HEALING_PROGRESS_BLOCKED_PHASE_DISPLAY_KEY
): string {
  const h = getMessages(locale).healing;
  return key === HEALING_PROGRESS_BLOCKED_COOLDOWN_DISPLAY_KEY
    ? h.pathProgressBlockedCooldown
    : h.pathProgressBlockedPhase;
}
