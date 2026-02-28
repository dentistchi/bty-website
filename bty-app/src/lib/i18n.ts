export type Locale = "ko" | "en";

export type Messages = {
  nav: { todayMe: string; bty: string; arena: string; en: string; ko: string };
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
    intro: string;
    placeholder: string;
    send: string;
    thinking: string;
    emptyHint: string;
    backToDojo: string;
    reply: string;
  };
  todayMe: {
    title: string;
    tagline: string;
    linkToBty: string;
    assessmentCta: string;
    assessmentCtaSub: string;
  };
  bty: {
    title: string;
    tagline: string;
    linkToTodayMe: string;
  };
  landing: {
    heroTitle: string;
    heroSubtitle: string;
    recommended: string;
    arenaTitle: string;
    arenaDesc: string;
    arenaCta: string;
    dojoTitle: string;
    dojoDesc: string;
    dojoCta: string;
    dearMeTitle: string;
    dearMeDesc: string;
    dearMeCta: string;
    footerHint: string;
  };
  safeMirror: {
    title: string;
    subtitle: string;
    placeholder: string;
    submit: string;
    submitting: string;
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
  };
  resilience: {
    title: string;
    subtitle: string;
    past: string;
    now: string;
  };
  arenaLevels: {
    membershipPending: string;
    loginRequired: string;
    track: string;
    unlockedUpTo: string;
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
};

const ko: Messages = {
  nav: { todayMe: "Dear Me", bty: "훈련장", arena: "Arena", en: "English", ko: "한국어" },
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
    intro: "겪었던 갈등을 한 줄로 적어보세요. Dr. Chi가 역지사지 질문으로 도와드릴게요.",
    placeholder: "예: 직원에게 말했는데 상대가 불쾌해했어요",
    send: "전송",
    thinking: "Dr. Chi가 생각 중…",
    emptyHint: "갈등 상황을 입력하고 전송해보세요.",
    backToDojo: "훈련장으로 돌아가기",
    reply: "만약 입장이 반대라면 어떨까요?",
  },
  todayMe: {
    title: "Dear Me",
    tagline: "나는 안전하다. 잠시 쉬어가도 돼요.",
    linkToBty: "어제보다 나은 연습하러 가기 (bty)",
    assessmentCta: "자존감 진단 (50문항)",
    assessmentCtaSub: "자기 존중감을 짧게 점검해 보세요.",
  },
  bty: {
    title: "bty",
    tagline: "어제보다 나은 연습. Integrity & Practice.",
    linkToTodayMe: "Dear Me로 가기",
  },
  landing: {
    heroTitle: "Better Than Yesterday",
    heroSubtitle: "오늘 어디로 가볼까요?",
    recommended: "추천",
    arenaTitle: "Arena",
    arenaDesc: "시나리오를 플레이하면서 선택과 성장을 쌓아요. XP, 주간 퀘스트, 리더보드.",
    arenaCta: "플레이하기",
    dojoTitle: "훈련장",
    dojoDesc: "대시보드, 멘토, 역지사지 연습. 오늘 할 연습을 고르세요.",
    dojoCta: "훈련장 가기",
    dearMeTitle: "Dear Me",
    dearMeDesc: "말 못 할 마음을 비추는 안전한 공간. 조언이 아니라 그대로 비춰드려요.",
    dearMeCta: "쉬러 가기",
    footerHint: "위에서 가고 싶은 곳을 골라주세요.",
  },
  safeMirror: {
    title: "안전한 거울",
    subtitle: "지금 느끼는 말을 편하게 적어보세요. 여기선 조언이 아니라, 그 마음을 그대로 비춰드릴게요.",
    placeholder: "오늘 누구에게도 말 못했던 마음이 있나요?",
    submit: "적기",
    submitting: "글을 읽고 있어요…",
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
  },
  resilience: {
    title: "회복 탄력성",
    subtitle: "떨어졌다가 다시 올라가는, 파도 같은 흐름이에요.",
    past: "과거",
    now: "지금",
  },
  arenaLevels: {
    membershipPending: "멤버십 승인 대기 중입니다. 승인 후 레벨이 표시됩니다.",
    loginRequired: "로그인이 필요합니다.",
    track: "트랙",
    unlockedUpTo: "최대 오픈 레벨",
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
};

const en: Messages = {
  nav: { todayMe: "Dear Me", bty: "Dojo", arena: "Arena", en: "English", ko: "한국어" },
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
    intro: "Describe a conflict in one line. Dr. Chi will reflect with an integrity question.",
    placeholder: "e.g. I said something and the other person got upset",
    send: "Send",
    thinking: "Dr. Chi is thinking…",
    emptyHint: "Enter a conflict and send.",
    backToDojo: "Back to Dojo",
    reply: "What if the roles were reversed?",
  },
  todayMe: {
    title: "Dear Me",
    tagline: "You are safe. It’s okay to rest here.",
    linkToBty: "Go to bty (practice)",
    assessmentCta: "Self-Esteem Assessment (50 items)",
    assessmentCtaSub: "A short check on how you feel about yourself.",
  },
  bty: {
    title: "bty",
    tagline: "Practice. Integrity & Better Than Yesterday.",
    linkToTodayMe: "Go to Dear Me",
  },
  landing: {
    heroTitle: "Better Than Yesterday",
    heroSubtitle: "Where would you like to go today?",
    recommended: "Recommended",
    arenaTitle: "Arena",
    arenaDesc: "Play scenarios, make choices, grow. XP, weekly quests, leaderboard.",
    arenaCta: "Play",
    dojoTitle: "Dojo",
    dojoDesc: "Dashboard, mentor, integrity practice. Choose what to work on.",
    dojoCta: "Go to Dojo",
    dearMeTitle: "Dear Me",
    dearMeDesc: "A safe space that reflects your feelings. No advice—just reflection.",
    dearMeCta: "Rest here",
    footerHint: "Choose a path above.",
  },
  safeMirror: {
    title: "Safe Mirror",
    subtitle: "Write how you feel. Here we don’t give advice—we reflect your feelings back.",
    placeholder: "Was there something you couldn't tell anyone today?",
    submit: "Write",
    submitting: "Reading your words…",
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
  },
  resilience: {
    title: "Recovery resilience",
    subtitle: "A wave that dips then rises again.",
    past: "Past",
    now: "Now",
  },
  arenaLevels: {
    membershipPending: "Membership approval pending. Levels will show after approval.",
    loginRequired: "Sign in required.",
    track: "Track",
    unlockedUpTo: "Unlocked up to",
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
};

export function getMessages(locale: Locale): Messages {
  return locale === "en" ? en : ko;
}
