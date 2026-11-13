import type { AppTabKey } from "@/components/app-shell/AppTabBar";

type Locale = "en" | "ko";
type Message = readonly [title: string, body: string, action: string];

type ScreenCopy = {
  en: Message;
  ko: Message;
};

type TourContext = ScreenCopy & { target: string };

export type TeamsTourStep = {
  id: string;
  chapter: AppTabKey;
  scope: string;
  anchors: readonly string[];
  en: Message;
  ko: Message;
  click?: string;
  tab?: AppTabKey;
  inspect?: string;
  contexts?: readonly TourContext[];
  skipDestination?: true;
  whenVisible?: boolean;
  optionalClick?: boolean;
  revealedBy?: string;
};

const id = (testId: string) => `[data-testid="${testId}"]`;
const today = id("today-home");
const saved = id("saved-view");
const learn = id("learn-header");
const history = id("foundry-my-learning");
const practice = id("practice-landing");
const me = id("me-home");

const context = (target: string, en: Message, ko: Message): TourContext => ({ target, en, ko });

export const teamsTourSteps: readonly TeamsTourStep[] = [
  {
    id: "today", chapter: "today", scope: today, anchors: [],
    en: ["Start with Today", "Today brings together your next action and saved messages.", "Continue"],
    ko: ["오늘 할 일 확인", "오늘에서 다음 할 일과 저장한 메시지를 찾을 수 있어요.", "계속"],
    contexts: [
      context(id("today-item"), ["Your next action", "Start here when an assignment or follow-up needs attention.", "Continue"], ["다음 할 일", "배정된 학습이나 후속 확인이 필요할 때 이 카드에서 시작해요.", "계속"]),
      context(id("today-empty"), ["You’re caught up", "There’s no next action in this list right now. New assignments and follow-ups appear here.", "Continue"], ["지금 할 일이 없어요", "이 목록에 지금 할 일은 없어요. 새 학습이나 후속 확인이 생기면 여기에 표시돼요.", "계속"]),
    ],
  },
  {
    id: "today-more", chapter: "today", scope: today, whenVisible: true,
    anchors: [id("today-show-more")], click: id("today-show-more"), optionalClick: true,
    en: ["See the rest of your list", "Show more expands other items that need attention. You can open any of them later from Today.", "Show more"],
    ko: ["나머지 할 일 보기", "더 보기를 누르면 추가로 확인할 일이 펼쳐져요. 나중에도 오늘에서 각 항목을 열 수 있어요.", "더 보기"],
  },
  {
    id: "today-incoming", chapter: "today", scope: today, whenVisible: true, anchors: [id("announcement-item")],
    en: ["Respond to a Track", "This card shows what a teammate asked you to review. Any available response options are on the card.", "Continue"],
    ko: ["받은 Track에 답하기", "팀원이 확인을 요청한 내용이에요. 답변할 수 있으면 이 카드에 선택지가 표시돼요.", "계속"],
  },
  {
    id: "today-question", chapter: "today", scope: today, whenVisible: true,
    anchors: [id("announcement-question")], click: id("announcement-question"), skipDestination: true,
    en: ["Open the question box", "Tap I have a question to see where to write. Sending a message is up to you.", "Open question box"],
    ko: ["질문 입력란 열기", "질문이 있습니다를 눌러 질문을 어디에 쓰는지 확인하세요. 보낼지는 직접 결정할 수 있어요.", "질문 입력란 열기"],
  },
  {
    id: "today-question-box", chapter: "today", scope: today, whenVisible: true, revealedBy: "today-question",
    anchors: [`${id("announcement-question-form")} textarea`],
    en: ["Write a question here", "This box is for asking the sender for clarification. You can leave it empty during the tour.", "Continue"],
    ko: ["질문을 적는 곳", "보낸 사람에게 확인이 필요한 내용을 묻는 입력란이에요. 둘러보기 중에는 비워 둬도 돼요.", "계속"],
  },
  {
    id: "today-outgoing", chapter: "today", scope: today, whenVisible: true, anchors: [id("tracking-item")],
    inspect: id("tracking-toggle"),
    en: ["Follow up on a Track you sent", "See who responded and who may need a follow-up. If a response list is available, you can expand it here.", "Continue"],
    ko: ["보낸 Track 확인", "누가 답했고 누구에게 후속 확인이 필요한지 볼 수 있어요. 응답 목록이 있으면 여기서 펼쳐보세요.", "계속"],
  },
  {
    id: "saved", chapter: "today", scope: today, anchors: [id("today-saved-entry")], click: id("today-saved-entry"),
    en: ["Find saved Teams messages", "Messages you save to BTY in Teams appear in this list.", "Open saved list"],
    ko: ["저장한 Teams 메시지 찾기", "Teams에서 BTY에 저장한 메시지는 이 목록에 모여요.", "저장 목록 열기"],
  },
  {
    id: "saved-list", chapter: "today", scope: saved, anchors: [], tab: "learn",
    inspect: id("saved-conversation-header"),
    en: ["Saved for later", "In a Teams message’s … menu, choose Save under BTY to add it here.", "Next: Learn"],
    ko: ["나중에 보기", "Teams 메시지의 … 메뉴에서 BTY의 저장을 선택하면 여기에 추가돼요.", "다음: 배우기"],
    contexts: [
      context(id("saved-open"), ["Reopen a saved message", "Open in Teams takes you to the original conversation.", "Next: Learn"], ["저장한 메시지 다시 열기", "Teams에서 열기로 원래 대화를 찾을 수 있어요.", "다음: 배우기"]),
      context(id("saved-item"), ["Your saved messages", "Use the controls on a saved item to organize it or remove it from this list.", "Next: Learn"], ["저장한 메시지", "각 항목의 메뉴로 메시지를 분류하거나 이 목록에서 뺄 수 있어요.", "다음: 배우기"]),
      context(id("saved-conversation-header"), ["Messages grouped by conversation", "Expand a conversation to see each message you saved from it.", "Next: Learn"], ["대화별로 묶인 메시지", "대화를 펼치면 그 대화에서 저장한 메시지를 하나씩 볼 수 있어요.", "다음: 배우기"]),
      context(id("saved-empty"), ["Save your first message", "In a Teams message’s … menu, choose Save under BTY. The message will appear here.", "Next: Learn"], ["첫 메시지 저장", "Teams 메시지의 … 메뉴에서 BTY의 저장을 선택하면 여기에 나타나요.", "다음: 배우기"]),
    ],
  },
  {
    id: "required-learning", chapter: "learn", scope: learn, anchors: [],
    en: ["Assigned training", "Your organization’s assignments appear under Required learning once the list loads.", "Continue"],
    ko: ["배정된 학습", "목록이 로드되면 조직에서 배정한 학습을 필수 학습에서 확인할 수 있어요.", "계속"],
    contexts: [
      context(`${id("required-card")} a[data-status="in_progress"]`, ["Resume assigned training", "Continue learning reopens the training you already started.", "Continue tour"], ["배정된 학습 이어가기", "학습 계속하기로 시작했던 학습을 다시 열 수 있어요.", "둘러보기 계속"]),
      context(`${id("required-card")} a[data-status="assigned"]`, ["Start assigned training", "Start learning opens this assignment.", "Continue tour"], ["배정된 학습 시작", "학습 시작으로 이 배정 학습을 열 수 있어요.", "둘러보기 계속"]),
      context(id("required-empty"), ["No assignments right now", "New training assigned by your organization will appear here.", "Continue"], ["현재 배정된 학습이 없어요", "조직에서 새로 배정한 학습은 이곳에 표시돼요.", "계속"]),
    ],
  },
  {
    id: "learn-host", chapter: "learn", scope: learn, whenVisible: true, anchors: [id("door-create-training")],
    en: ["Create training for your team", "Create training turns a recurring work problem into a lesson your team can use.", "Continue"],
    ko: ["팀 교육 만들기", "훈련 만들기로 업무에서 반복되는 문제를 팀이 연습할 학습으로 만들 수 있어요.", "계속"],
  },
  {
    id: "learn-event", chapter: "learn", scope: learn, whenVisible: true, anchors: [id("door-open-event")],
    en: ["Open a team event", "Open an event sets up a session for your team to join.", "Continue"],
    ko: ["팀 이벤트 만들기", "이벤트 만들기에서 팀원이 참여할 세션을 열 수 있어요.", "계속"],
  },
  {
    id: "learning-history", chapter: "learn", scope: learn, anchors: [id("door-my-learning")],
    click: id("door-my-learning"), skipDestination: true,
    en: ["Open your learning history", "Learning history is where you can reopen training you finished and review your reflections and follow-ups.", "Open history"],
    ko: ["학습 기록 열기", "학습 기록에서 마친 교육을 다시 보고, 내 회고와 후속 확인을 찾을 수 있어요.", "기록 열기"],
  },
  {
    id: "learning-records", chapter: "learn", scope: history, anchors: [],
    click: id("my-learning-back"),
    en: ["Your learning history", "Training you complete appears here.", "Continue tour"],
    ko: ["내 학습 기록", "마친 학습은 이곳에 표시돼요.", "둘러보기 계속"],
    contexts: [
      context(id("my-learning-open-detail"), ["Revisit a completed training", "The record contains what you learned and any follow-up actions.", "Continue tour"], ["마친 학습 다시 보기", "기록에서 배운 내용과 후속 행동을 확인할 수 있어요.", "둘러보기 계속"]),
      context(id("my-learning-empty"), ["Build your learning history", "Your first completed training will appear here.", "Continue tour"], ["학습 기록 쌓기", "첫 학습을 마치면 이곳에 기록이 생겨요.", "둘러보기 계속"]),
    ],
  },
  {
    id: "open-practice", chapter: "learn", scope: learn, anchors: ['[data-bty-tab="practice"]'], tab: "practice",
    en: ["Open Practice", "Tap Practice to see the available exercises and your action plans.", "Go to Practice"],
    ko: ["연습 탭 열기", "연습을 눌러 이용할 수 있는 연습과 행동 계획을 확인하세요.", "연습으로 이동"],
  },
  {
    id: "practice-arena", chapter: "practice", scope: practice, anchors: [id("practice-arena-entry")],
    click: id("practice-arena-entry"),
    en: ["Open Arena practice", "Tap Practice situations to rehearse how to respond to situations you may face at work.", "Open Arena"],
    ko: ["아레나 연습 열기", "연습 상황을 눌러 업무 중 마주칠 상황에 어떻게 대응할지 연습해 보세요.", "아레나 열기"],
  },
  {
    id: "practice-arena-screen", chapter: "practice", scope: id("practice-arena"), anchors: [],
    click: id("practice-arena-back"),
    en: ["Practice situations", "This is where published exercises from your completed training appear.", "Continue tour"],
    ko: ["연습 상황", "완료한 학습에 연결된 연습이 공개되면 이곳에 표시돼요.", "둘러보기 계속"],
    contexts: [
      context(id("arena-practice-card"), ["Try a practice situation", "This card shows the exercise and the training it came from.", "Continue tour"], ["연습 상황 선택", "이 카드에서 연습 내용과 어떤 학습에 연결되어 있는지 확인할 수 있어요.", "둘러보기 계속"]),
      context(id("arena-practices-empty"), ["No practice situations yet", "A situation from your completed training appears here when it has been published.", "Continue tour"], ["아직 공개된 연습 상황이 없어요", "완료한 학습에 연결된 연습이 공개되면 이곳에 표시돼요.", "둘러보기 계속"]),
      context(id("arena-practices-error"), ["Practice list unavailable", "The list couldn’t load. You can continue the tour.", "Continue tour"], ["연습 목록을 불러오지 못했어요", "둘러보기는 계속할 수 있어요.", "둘러보기 계속"]),
    ],
  },
  {
    id: "practice-clinical", chapter: "practice", scope: practice, anchors: [id("practice-clinical-entry")],
    click: id("practice-clinical-entry"),
    en: ["Open Clinical Cases", "Explore cases for practicing clinical decisions and treatment planning.", "Open Clinical Cases"],
    ko: ["임상 케이스 열기", "진단과 치료 계획을 연습할 수 있는 임상 케이스를 살펴보세요.", "임상 케이스 열기"],
  },
  {
    id: "practice-clinical-screen", chapter: "practice", scope: id("practice-clinical"), anchors: [`${id("practice-clinical")} h1`],
    click: id("practice-clinical-back"),
    en: ["Explore the case library", "Each fictional case lets you practice deciding what to ask, examine, and recommend.", "Continue tour"],
    ko: ["케이스 목록 살펴보기", "가상 환자 케이스에서 어떤 질문과 검사를 할지, 어떤 치료를 권할지 연습할 수 있어요.", "둘러보기 계속"],
  },
  {
    id: "practice-ai", chapter: "practice", scope: practice, anchors: [],
    click: id("practice-ai-patient-entry"), skipDestination: true,
    en: ["Practice options", "Continue to see how to apply what you learned at work.", "Continue"],
    ko: ["연습 옵션", "다음으로 학습 내용을 업무에 적용하는 방법을 확인하세요.", "계속"],
    contexts: [
      context(id("practice-ai-patient-entry"), ["Practice with an AI Patient", "Rehearse a conversation with a fictional patient and get coaching afterward.", "Open AI Patient"], ["AI 환자와 연습하기", "가상 환자와 대화하며 연습하고 이후에 코칭을 받을 수 있어요.", "AI 환자 열기"]),
      context(id("practice-ai-patient-unavailable"), ["AI Patient is unavailable", "This exercise is currently unavailable for your account.", "Continue"], ["AI 환자 연습을 이용할 수 없어요", "현재 이 계정에서는 이 연습을 이용할 수 없어요.", "계속"]),
    ],
  },
  {
    id: "practice-ai-screen", chapter: "practice", scope: id("ai-patient-intro"), anchors: [`${id("ai-patient-intro")} h1`],
    click: id("ai-patient-back"),
    en: ["Review the AI Patient setup", "The scenario describes the conversation you’ll practice with a fictional patient.", "Continue tour"],
    ko: ["AI 환자 연습 준비", "시나리오에서 가상 환자와 어떤 대화를 연습할지 확인할 수 있어요.", "둘러보기 계속"],
  },
  {
    id: "practice-field", chapter: "practice", scope: practice, anchors: [id("practice-field-actions")],
    click: id("practice-field-actions"),
    en: ["Open Action plans", "Action plans are where you put something you learned into practice at work.", "Open Action plans"],
    ko: ["행동 계획 열기", "교육에서 배운 내용을 업무에서 실천할 계획을 확인하는 곳이에요.", "행동 계획 열기"],
  },
  {
    id: "practice-field-screen", chapter: "practice", scope: id("field-actions-focus"), anchors: [],
    click: id("field-actions-back"),
    en: ["Your action plans", "Plans for using what you learned at work appear here.", "Continue tour"],
    ko: ["내 행동 계획", "학습에서 배운 내용을 업무에 적용하는 계획이 이곳에 표시돼요.", "둘러보기 계속"],
    contexts: [
      context(id("fa-item"), ["Check an action plan", "The plan’s status shows whether it is waiting for review, needs changes, or is ready to complete.", "Continue tour"], ["행동 계획 상태 확인", "계획의 상태에서 검토 중인지, 수정이 필요한지, 완료할 수 있는지 확인할 수 있어요.", "둘러보기 계속"]),
      context(id("fa-empty"), ["No action plans yet", "Your plans appear here once you create one.", "Continue tour"], ["아직 행동 계획이 없어요", "행동 계획을 만들면 여기서 확인할 수 있어요.", "둘러보기 계속"]),
      context(id("fa-error"), ["Action plans unavailable", "The list couldn’t load. You can continue the tour.", "Continue tour"], ["행동 계획을 불러오지 못했어요", "둘러보기는 계속할 수 있어요.", "둘러보기 계속"]),
    ],
  },
  {
    id: "open-me", chapter: "practice", scope: practice, anchors: ['[data-bty-tab="me"]'], tab: "me",
    en: ["Open Me", "Tap Me to find your activity, records, and account settings.", "Go to Me"],
    ko: ["나 탭 열기", "나를 눌러 내 활동, 기록, 계정 설정을 확인하세요.", "나로 이동"],
  },
  {
    id: "me-language", chapter: "me", scope: me, anchors: [id("me-language")],
    en: ["Choose your language", "Use EN or KO here to switch the language of the BTY app.", "Continue"],
    ko: ["언어 선택", "여기서 EN 또는 KO를 눌러 BTY 앱의 언어를 바꿀 수 있어요.", "계속"],
  },
  {
    id: "me-rewards", chapter: "me", scope: me, whenVisible: true, anchors: [id("learning-total-xp"), `${id("learning-rewards")} h2`],
    en: ["See your learning rewards", "This area shows your XP, level, weekly goal, and badges.", "Continue"],
    ko: ["학습 보상 확인", "여기서 XP, 레벨, 주간 목표와 배지를 확인할 수 있어요.", "계속"],
  },
  {
    id: "me-week", chapter: "me", scope: me, anchors: [`${id("me-this-week")} h2`, id("me-week-summary")],
    en: ["Review your week", "This Week summarizes your recent BTY activity.", "Continue"],
    ko: ["이번 주 돌아보기", "이번 주에는 최근 BTY 활동이 나와요.", "계속"],
  },
  {
    id: "me-attendance", chapter: "me", scope: me, anchors: [id("me-weekly-orb")], click: id("me-weekly-orb"),
    en: ["Open weekly attendance", "Tap the orb to see the days you used BTY this week.", "Open attendance"],
    ko: ["주간 출석 열기", "구슬을 눌러 이번 주에 BTY를 사용한 날을 확인하세요.", "출석 열기"],
  },
  {
    id: "me-attendance-screen", chapter: "me", scope: id("me-attendance-popup"), anchors: [],
    click: id("me-attendance-close"),
    en: ["Your weekly attendance", "This view shows which days you used BTY.", "Continue tour"],
    ko: ["주간 출석", "이번 주에 BTY를 사용한 날짜를 볼 수 있어요.", "둘러보기 계속"],
    contexts: [
      context(id("me-attendance-days"), ["Read your attendance", "A lit day marks a day you used BTY.", "Continue tour"], ["출석 읽기", "불이 들어온 날짜는 BTY를 사용한 날이에요.", "둘러보기 계속"]),
    ],
  },
  {
    id: "me-past", chapter: "me", scope: me, anchors: [id("me-row-past-tracks")], click: id("me-row-past-tracks"),
    en: ["Open Past Tracks", "Use Past Tracks to find earlier conversations you have cleared from Today.", "Open Past Tracks"],
    ko: ["지난 Track 열기", "오늘 화면에서 정리한 이전 Track 대화를 다시 찾을 수 있어요.", "지난 Track 열기"],
  },
  {
    id: "me-past-screen", chapter: "me", scope: id("past-tracks"), anchors: [],
    click: id("past-tracks-back"),
    en: ["Past Tracks", "Tracks you clear from Today can be found here.", "Continue tour"],
    ko: ["지난 Track", "오늘에서 정리한 Track은 여기서 찾을 수 있어요.", "둘러보기 계속"],
    contexts: [
      context(id("past-track-recipient"), ["Revisit a Track you received", "Find the request and any conversation that followed.", "Continue tour"], ["받은 Track 다시 보기", "받았던 요청과 이어진 대화를 확인할 수 있어요.", "둘러보기 계속"]),
      context(id("past-track-host"), ["Revisit a Track you sent", "Find the Track and its response history.", "Continue tour"], ["보낸 Track 다시 보기", "보냈던 Track과 응답 기록을 확인할 수 있어요.", "둘러보기 계속"]),
      context(id("past-tracks-empty"), ["No past Tracks yet", "Tracks you clear from Today will be available here.", "Continue tour"], ["아직 지난 Track이 없어요", "오늘에서 Track을 정리하면 이곳에서 다시 볼 수 있어요.", "둘러보기 계속"]),
    ],
  },
  {
    id: "me-center", chapter: "me", scope: me, anchors: [id("me-row-center")], click: id("me-row-center"),
    en: ["Open Center", "Center is where you can revisit your personal reflections.", "Open Center"],
    ko: ["센터 열기", "센터에서 내 회고를 다시 볼 수 있어요.", "센터 열기"],
  },
  {
    id: "me-center-screen", chapter: "me", scope: id("me-center"), anchors: [`${id("center-reality-feed")} h1`],
    click: id("me-center-back"),
    en: ["Your reflections", "Reflections you write appear in this feed.", "Continue tour"],
    ko: ["내 회고", "작성한 회고를 이곳에서 돌아볼 수 있어요.", "둘러보기 계속"],
    contexts: [
      context(id("center-reflection-item"), ["Revisit a reflection", "Your entries are grouped here so you can return to what you wrote.", "Continue tour"], ["작성한 회고 다시 보기", "작성한 회고를 모아 다시 읽을 수 있어요.", "둘러보기 계속"]),
      context(id("center-feed-empty"), ["No reflections yet", "A reflection appears here after you write one.", "Continue tour"], ["아직 회고가 없어요", "회고를 작성하면 이곳에서 볼 수 있어요.", "둘러보기 계속"]),
    ],
  },
  {
    id: "me-account", chapter: "me", scope: me, anchors: [id("me-account-row")], click: id("me-account-row"),
    en: ["Open Account", "Check which account is connected to BTY.", "Open Account"],
    ko: ["계정 열기", "BTY에 연결된 계정을 확인할 수 있어요.", "계정 열기"],
  },
  {
    id: "me-account-screen", chapter: "me", scope: id("me-account"), anchors: [id("account-identity"), id("account-email"), id("account-block")],
    click: id("me-account-back"),
    en: ["Check your connected account", "Account shows which identity BTY is using.", "Continue tour"],
    ko: ["연결된 계정 확인", "BTY에 연결된 계정을 확인할 수 있어요.", "둘러보기 계속"],
  },
  {
    id: "finish", chapter: "me", scope: me, anchors: [id("me-tour-replay")],
    en: ["You’re ready to use BTY", "You can reopen the guide here. To revisit one part, choose it from the guide’s chapter menu.", "Finish tour"],
    ko: ["둘러보기 완료", "언제든 여기서 다시 열 수 있어요. 특정 부분을 다시 보려면 둘러보기 목차에서 선택하세요.", "완료"],
  },
];

export function tourTabIndex(tab: AppTabKey) {
  return teamsTourSteps.findIndex((step) => step.chapter === tab);
}

export function tourCopy(step: ScreenCopy, locale: Locale) {
  const [title, body, action] = step[locale];
  return { title, body, action };
}
