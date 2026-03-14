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
  };
  center: {
    /** §2: 전환 중 로딩/대기 문구 (locale에 맞게) */
    loading: string;
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
    letterPrompt: string;
    letterPlaceholder: string;
    submitLetter: string;
    sendingLetter: string;
    /** 4단계: 답장 */
    replyStepTitle: string;
    /** 5단계: 완료 */
    completedTitle: string;
    completedSub: string;
    continueToChat: string;
    /** 편지 이력 */
    letterHistoryTitle: string;
    letterHistoryEmpty: string;
    letterHistoryError: string;
    letterHistoryLoading: string;
    letterHistoryReplied: string;
    letterHistoryNoReply: string;
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
  };
  /** Admin: 멘토 신청 큐·승인 UI. API 응답만 표시(render-only). */
  mentorRequestAdmin: {
    title: string;
    description: string;
    empty: string;
    userId: string;
    createdAt: string;
    message: string;
    approve: string;
    reject: string;
    approving: string;
    rejecting: string;
    error: string;
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
  };
  /** PROJECT_BACKLOG §8: 대시보드 감정 스탯 카드 빈 상태 */
  emotionalStats: {
    emptyMessage: string;
    /** §2 v3: 섹션 제목 (오늘의 성장 / Today's growth) */
    sectionTitle: string;
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
  },
  center: {
    loading: "잠시만 기다려 주세요.",
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
    letterPrompt: "지금 마음에 있는 말을 편하게 적어보세요. 여기선 조언이 아니라 그대로 비춰드릴게요.",
    letterPlaceholder: "오늘 누구에게도 말 못했던 마음이 있나요?",
    submitLetter: "보내기",
    sendingLetter: "글을 읽고 있어요…",
    replyStepTitle: "답장",
    completedTitle: "오늘의 편지 완료",
    completedSub: "마음을 나눠줘서 고마워요. 더 말하고 싶으면 챗에서 이어서 나눠 보세요.",
    continueToChat: "챗으로 이어하기",
    letterHistoryTitle: "보낸 편지 이력",
    letterHistoryEmpty: "아직 보낸 편지가 없어요.",
    letterHistoryError: "편지 이력을 불러올 수 없어요.",
    letterHistoryLoading: "편지 이력을 불러오는 중…",
    letterHistoryReplied: "답장 있음",
    letterHistoryNoReply: "답장 없음",
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
  },
  mentorRequestAdmin: {
    title: "멘토 대화 신청 승인",
    description: "Elite 멘토(1:1) 신청 큐. 승인/거절 처리합니다.",
    empty: "대기 중인 신청이 없습니다.",
    userId: "유저 ID",
    createdAt: "신청 일시",
    message: "메시지",
    approve: "승인",
    reject: "거절",
    approving: "승인 중…",
    rejecting: "거절 중…",
    error: "처리 실패",
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
  },
  emotionalStats: {
    emptyMessage: "아직 기록이 없어요. Arena나 챗에서 대화를 진행해 보세요.",
    sectionTitle: "오늘의 성장",
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
  },
  center: {
    loading: "Please wait…",
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
    letterPrompt: "Write what's on your mind. Here we reflect, not advise.",
    letterPlaceholder: "Was there something you couldn't tell anyone today?",
    submitLetter: "Send",
    sendingLetter: "Reading your words…",
    replyStepTitle: "Reply",
    completedTitle: "Today's letter complete",
    completedSub: "Thanks for sharing. You can continue in Chat if you'd like.",
    continueToChat: "Continue in Chat",
    letterHistoryTitle: "Letter history",
    letterHistoryEmpty: "No letters yet.",
    letterHistoryError: "Failed to load letter history.",
    letterHistoryLoading: "Loading letter history…",
    letterHistoryReplied: "Replied",
    letterHistoryNoReply: "No reply",
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
  },
  mentorRequestAdmin: {
    title: "Mentor session request approval",
    description: "Elite mentor (1:1) request queue. Approve or reject.",
    empty: "No pending requests.",
    userId: "User ID",
    createdAt: "Requested at",
    message: "Message",
    approve: "Approve",
    reject: "Reject",
    approving: "Approving…",
    rejecting: "Rejecting…",
    error: "Action failed",
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
  },
  emotionalStats: {
    emptyMessage: "No records yet. Try Arena or chat to start.",
    sectionTitle: "Today's growth",
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
};

export function getMessages(locale: Locale): Messages {
  return locale === "en" ? en : ko;
}
