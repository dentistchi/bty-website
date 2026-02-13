export type Locale = "ko" | "en";

export type Messages = {
  nav: { todayMe: string; bty: string; en: string; ko: string };
  todayMe: {
    title: string;
    tagline: string;
    linkToBty: string;
  };
  bty: {
    title: string;
    tagline: string;
    linkToTodayMe: string;
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
    typing: string;
    typingSlow: string;
    errorMsg: string;
    retry: string;
  };
  resilience: {
    title: string;
    subtitle: string;
    past: string;
    now: string;
  };
};

const ko: Messages = {
  nav: { todayMe: "Dear Me", bty: "훈련장", en: "English", ko: "한국어" },
  todayMe: {
    title: "Dear Me",
    tagline: "나는 안전하다. 잠시 쉬어가도 돼요.",
    linkToBty: "어제보다 나은 연습하러 가기 (bty)",
  },
  bty: {
    title: "bty",
    tagline: "어제보다 나은 연습. Integrity & Practice.",
    linkToTodayMe: "Dear Me로 가기",
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
    typing: "BTY가 생각 중",
    typingSlow: "잠깐만요, 더 정확히 정리해서 답할게요",
    errorMsg: "연결이 잠깐 끊겼어요. 다시 한 번 보내볼까요?",
    retry: "다시 보내기",
  },
  resilience: {
    title: "회복 탄력성",
    subtitle: "떨어졌다가 다시 올라가는, 파도 같은 흐름이에요.",
    past: "과거",
    now: "지금",
  },
};

const en: Messages = {
  nav: { todayMe: "Dear Me", bty: "Dojo", en: "English", ko: "한국어" },
  todayMe: {
    title: "Dear Me",
    tagline: "You are safe. It’s okay to rest here.",
    linkToBty: "Go to bty (Practice)",
  },
  bty: {
    title: "bty",
    tagline: "Practice. Integrity & Better Than Yesterday.",
    linkToTodayMe: "Go to Dear Me",
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
    typing: "BTY is thinking",
    typingSlow: "Hold on, organizing a better response",
    errorMsg: "Connection dropped briefly. Try sending again?",
    retry: "Send again",
  },
  resilience: {
    title: "Recovery resilience",
    subtitle: "A wave that dips then rises again.",
    past: "Past",
    now: "Now",
  },
};

export function getMessages(locale: Locale): Messages {
  return locale === "en" ? en : ko;
}
