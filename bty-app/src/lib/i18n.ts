export type Locale = "ko" | "en";

export type Messages = {
  /** §2: 전환 중 로딩 문구 (locale별) */
  loading: { message: string; hint: string };
  nav: { center: string; bty: string; arena: string; en: string; ko: string };
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
    /** §7 2차: 단계 2 안내 문구 */
    guideMessage: string;
    startPractice: string;
    intro: string;
    placeholder: string;
    send: string;
    thinking: string;
    emptyHint: string;
    backToFoundry: string;
    reply: string;
    /** §7 2차: 단계 5 완료 */
    doneTitle: string;
    doneSub: string;
    doneCtaComplete: string;
    doneCtaMentor: string;
    doneCtaFoundry: string;
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
    /** CHATBOT_TRAINING_CHECKLIST §2.3: 빈 채팅 시 소개 문구 (Foundry) */
    introFoundry: string;
    /** CHATBOT_TRAINING_CHECKLIST §2.3: 빈 채팅 시 소개 문구 (Center) */
    introCenter: string;
    /** 공간 전환 시 한 줄 안내 (Foundry) */
    spaceHintFoundry: string;
    /** 공간 전환 시 한 줄 안내 (Center) */
    spaceHintCenter: string;
  };
  resilience: {
    title: string;
    subtitle: string;
    /** §4·§8: 일별 궤적 있을 때 그래프 부제 (locale별) */
    dailyTrajectorySubtitle: string;
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
  /** PROJECT_BACKLOG §8: 대시보드 감정 스탯 카드 빈 상태 */
  emotionalStats: {
    emptyMessage: string;
  };
};

const ko: Messages = {
  loading: { message: "잠시만 기다려 주세요.", hint: "첫 로딩은 1–2분 걸릴 수 있어요." },
  nav: { center: "Center", bty: "Foundry", arena: "Arena", en: "English", ko: "한국어" },
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
    guideMessage: "상대 입장을 잠시 돌려보는 연습이에요. 겪었던 갈등을 한 줄로 적으면, Dr. Chi가 역지사지 질문으로 비춰드려요.",
    startPractice: "연습 시작",
    intro: "겪었던 갈등을 한 줄로 적어보세요. Dr. Chi가 역지사지 질문으로 도와드릴게요.",
    placeholder: "예: 직원에게 말했는데 상대가 불쾌해했어요",
    send: "전송",
    thinking: "Dr. Chi가 생각 중…",
    emptyHint: "갈등 상황을 입력하고 전송해보세요.",
    backToFoundry: "Foundry로 돌아가기",
    reply: "만약 입장이 반대라면 어떨까요?",
    doneTitle: "오늘의 연습 완료",
    doneSub: "한 걸음씩 상대의 입장을 돌려보는 연습이 쌓이고 있어요.",
    doneCtaComplete: "연습 완료하기",
    doneCtaMentor: "멘토와 대화하기",
    doneCtaFoundry: "Foundry로",
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
    introFoundry: "이제 다른 사람의 입장을 생각해볼까요? 오늘의 연습을 함께해요.",
    introCenter: "지금 상태도 괜찮아요. 여기는 안전한 곳이에요.",
    spaceHintFoundry: "지금은 Foundry예요. 위로보다는 선택·구조에 초점을 둡니다.",
    spaceHintCenter: "지금은 Center예요. 편하게 마음을 나눠 보세요.",
  },
  resilience: {
    title: "회복 탄력성",
    subtitle: "떨어졌다가 다시 올라가는, 파도 같은 흐름이에요.",
    dailyTrajectorySubtitle: "매일의 5문항/활동에 따른 궤적이에요. 날짜별로 쌓인 회복의 흐름이에요.",
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
  emotionalStats: {
    emptyMessage: "아직 기록이 없어요. Arena나 챗에서 대화를 진행해 보세요.",
  },
};

const en: Messages = {
  loading: { message: "Please wait…", hint: "First load may take 1–2 minutes." },
  nav: { center: "Center", bty: "Foundry", arena: "Arena", en: "English", ko: "한국어" },
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
    guideMessage: "A short practice to see the other side. Describe a conflict in one line and Dr. Chi will reflect with an integrity question.",
    startPractice: "Start practice",
    intro: "Describe a conflict in one line. Dr. Chi will reflect with an integrity question.",
    placeholder: "e.g. I said something and the other person got upset",
    send: "Send",
    thinking: "Dr. Chi is thinking…",
    emptyHint: "Enter a conflict and send.",
    backToFoundry: "Back to Foundry",
    reply: "What if the roles were reversed?",
    doneTitle: "Today’s practice complete",
    doneSub: "You’re building the habit of seeing the other side, one step at a time.",
    doneCtaComplete: "Complete practice",
    doneCtaMentor: "Talk to mentor",
    doneCtaFoundry: "Back to Foundry",
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
    introFoundry: "How about thinking from the other person's side? Let's practice together.",
    introCenter: "You're okay as you are. This is a safe place.",
    spaceHintFoundry: "You're in Foundry—focus on choices and structure rather than comfort.",
    spaceHintCenter: "You're in Center—feel free to share what's on your mind.",
  },
  resilience: {
    title: "Recovery resilience",
    subtitle: "A wave that dips then rises again.",
    dailyTrajectorySubtitle: "Daily trajectory from your 5-item check-ins. Your recovery over time.",
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
  emotionalStats: {
    emptyMessage: "No records yet. Try Arena or chat to start.",
  },
};

export function getMessages(locale: Locale): Messages {
  return locale === "en" ? en : ko;
}
