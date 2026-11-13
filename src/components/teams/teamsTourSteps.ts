import type { AppTabKey } from "@/components/app-shell/AppTabBar";

type Locale = "en" | "ko";
type Message = readonly [title: string, body: string, action: string];

export type TeamsTourStep = {
  id: string;
  chapter: AppTabKey;
  scope: string;
  anchors: readonly string[];
  en: Message;
  ko: Message;
  click?: string;
  tab?: AppTabKey;
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

export const teamsTourSteps: readonly TeamsTourStep[] = [
  {
    id: "today", chapter: "today", scope: today, anchors: [id("today-item"), id("today-list"), id("today-header")],
    en: ["Start with Today", "When there’s something to do, your next action appears here. Use Show more to see other items when available.", "Continue"],
    ko: ["오늘 할 일 확인", "확인할 일이 있으면 여기에 다음 행동이 표시돼요. 더 보기가 있으면 다른 할 일도 펼칠 수 있어요.", "계속"],
  },
  {
    id: "today-more", chapter: "today", scope: today, whenVisible: true,
    anchors: [id("today-show-more")], click: id("today-show-more"), optionalClick: true,
    en: ["See the rest of your list", "Show more expands other items that need attention. You can open any of them later from Today.", "Show more"],
    ko: ["나머지 할 일 보기", "더 보기를 누르면 추가로 확인할 일이 펼쳐져요. 나중에도 오늘에서 각 항목을 열 수 있어요.", "더 보기"],
  },
  {
    id: "today-incoming", chapter: "today", scope: today, anchors: [`${id("needs-your-response")} h2`, id("today-header")],
    en: ["Respond to a Track", "When someone sends you a Track, find it on Today. Open the original Teams message, mark it as understood, ask a question, or request help when those options are available.", "Continue"],
    ko: ["받은 Track에 답하기", "누군가 Track을 보내면 오늘에 표시돼요. Teams 원본을 열어 보고, 제공되는 버튼으로 확인했다고 답하거나 질문하거나 도움을 요청할 수 있어요.", "계속"],
  },
  {
    id: "today-question", chapter: "today", scope: today, whenVisible: true,
    anchors: [id("announcement-question")], click: id("announcement-question"), skipDestination: true,
    en: ["Open the question box", "Tap I have a question to see where to write. Sending a message is up to you.", "Open question box"],
    ko: ["질문 입력란 열기", "질문이 있습니다를 눌러 질문을 어디에 쓰는지 확인하세요. 보낼지는 직접 결정할 수 있어요.", "질문 입력란 열기"],
  },
  {
    id: "today-question-box", chapter: "today", scope: today, whenVisible: true, revealedBy: "today-question",
    anchors: [`${id("announcement-question-form")} textarea`, `${id("needs-your-response")} h2`],
    en: ["Write a question here", "When you need clarification, write your question here and use Send. You can continue the tour with the box empty.", "Continue"],
    ko: ["여기에 질문을 작성하세요", "확인이 필요한 내용을 적고 보내기를 누르면 질문이 전달돼요. 둘러보기는 입력란이 비어 있어도 계속할 수 있어요.", "계속"],
  },
  {
    id: "today-outgoing", chapter: "today", scope: today, anchors: [`${id("tracking-sent")} h2`, id("today-header")],
    en: ["Follow up on a Track you sent", "Start a Track from a message’s … menu in Teams. Back here, open a sent Track to see who has responded and who still needs a follow-up.", "Continue"],
    ko: ["보낸 Track 확인", "Teams 메시지의 … 메뉴에서 Track을 시작하세요. 이곳에서 보낸 Track을 펼쳐 누가 답했고 누구에게 후속 확인이 필요한지 볼 수 있어요.", "계속"],
  },
  {
    id: "today-track-details", chapter: "today", scope: today, whenVisible: true,
    anchors: [`${id("tracking-toggle")}[aria-expanded="false"]`],
    click: `${id("tracking-toggle")}[aria-expanded="false"]`, optionalClick: true,
    en: ["Open a sent Track", "Expand a Track to see the status of its recipients.", "Show Track details"],
    ko: ["보낸 Track 펼치기", "Track을 펼쳐 받은 사람들의 응답 상태를 확인해 보세요.", "Track 상세 보기"],
  },
  {
    id: "saved", chapter: "today", scope: today, anchors: [id("today-saved-entry")], click: id("today-saved-entry"),
    en: ["Open Saved for later", "In Teams, use the message’s … menu and choose Save under BTY. Tap Saved for later here to find it again.", "Open saved list"],
    ko: ["나중에 보기 열기", "Teams 메시지의 … 메뉴에서 BTY의 저장을 선택하세요. 여기서 나중에 보기를 누르면 다시 찾을 수 있어요.", "저장 목록 열기"],
  },
  {
    id: "saved-list", chapter: "today", scope: saved, anchors: [id("saved-open"), `${saved} h2`],
    en: ["Use your saved list", "Expand a conversation if it is grouped. Open in Teams takes you back to the message. Soon and Later organize the list, and Remove clears a saved item from this list.", "Continue"],
    ko: ["저장 목록 사용", "메시지가 대화별로 묶여 있으면 펼쳐보세요. Teams에서 열기로 원본을 확인하고, 곧과 나중에로 분류하거나 치우기로 목록에서 뺄 수 있어요.", "계속"],
  },
  {
    id: "saved-conversation", chapter: "today", scope: saved, whenVisible: true,
    anchors: [`${id("saved-conversation-header")}[aria-expanded="false"]`],
    click: `${id("saved-conversation-header")}[aria-expanded="false"]`, optionalClick: true,
    en: ["Expand a saved conversation", "See the individual messages saved from that conversation.", "Show saved messages"],
    ko: ["저장한 대화 펼치기", "그 대화에서 저장한 메시지를 하나씩 확인할 수 있어요.", "저장 메시지 보기"],
  },
  {
    id: "saved-back", chapter: "today", scope: saved, anchors: [id("saved-back")], click: id("saved-back"),
    en: ["Return to Today", "Use the back button to return to your Today screen.", "Back to Today"],
    ko: ["오늘로 돌아가기", "뒤로 버튼을 눌러 오늘 화면으로 돌아가세요.", "오늘로 돌아가기"],
  },
  {
    id: "open-learn", chapter: "today", scope: today, anchors: ['[data-bty-tab="learn"]'], tab: "learn",
    en: ["Open Learn", "Tap Learn to find assigned training and your learning history.", "Go to Learn"],
    ko: ["배우기 탭 열기", "배우기를 눌러 배정된 교육과 학습 기록을 확인하세요.", "배우기로 이동"],
  },
  {
    id: "required-learning", chapter: "learn", scope: learn, anchors: [`${id("foundry-required-learning")} h2`, learn],
    en: ["Find your assigned training", "Assignments appear under Required learning. Start opens a new assignment, and Continue picks up one you have already started.", "Continue"],
    ko: ["배정된 교육 찾기", "배정된 교육은 필수 학습에 나와요. 학습 시작으로 처음 열고, 학습 계속하기로 하던 교육을 이어갈 수 있어요.", "계속"],
  },
  {
    id: "learning-history", chapter: "learn", scope: learn, anchors: [id("door-my-learning"), learn],
    click: id("door-my-learning"), skipDestination: true,
    en: ["Open your learning history", "Learning history is where you can reopen training you finished and review your reflections and follow-ups.", "Open history"],
    ko: ["학습 기록 열기", "학습 기록에서 마친 교육을 다시 보고, 내 회고와 후속 확인을 찾을 수 있어요.", "기록 열기"],
  },
  {
    id: "learning-records", chapter: "learn", scope: history, anchors: [id("my-learning-archived-open"), `${history} h1`, id("my-learning-back")],
    click: id("my-learning-back"),
    en: ["Review completed training", "Open a record to see what you learned and follow-up actions. Archived entries are available from this screen when you have any.", "Back to Learn"],
    ko: ["마친 교육 다시 보기", "기록을 열어 배운 내용과 후속 행동을 확인할 수 있어요. 보관한 기록이 있으면 이 화면에서 열 수 있어요.", "배우기로 돌아가기"],
  },
  {
    id: "learn-host", chapter: "learn", scope: learn, whenVisible: true, anchors: [id("door-create-training"), id("door-open-event")],
    en: ["Create training for your team", "With author access, use Create training to build a training from a recurring problem or Create event to set up a team event.", "Continue"],
    ko: ["팀 교육 만들기", "작성 권한이 있으면 훈련 만들기로 반복되는 문제를 교육으로 만들거나, 이벤트 만들기로 팀 이벤트를 준비할 수 있어요.", "계속"],
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
    id: "practice-arena-screen", chapter: "practice", scope: id("practice-arena"), anchors: [`${id("practice-arena")} [data-bty-main-heading]`, id("practice-arena-back")],
    click: id("practice-arena-back"),
    en: ["Choose a practice when ready", "This is where you can open an available practice. Starting it begins a practice attempt.", "Back to Practice"],
    ko: ["준비되면 연습 선택", "이 화면에서 이용 가능한 연습을 열 수 있어요. 시작을 누르면 실제 연습이 시작돼요.", "연습으로 돌아가기"],
  },
  {
    id: "practice-clinical", chapter: "practice", scope: practice, anchors: [id("practice-clinical-entry")],
    click: id("practice-clinical-entry"),
    en: ["Open Clinical Cases", "Explore cases for practicing clinical decisions and treatment planning.", "Open Clinical Cases"],
    ko: ["임상 케이스 열기", "진단과 치료 계획을 연습할 수 있는 임상 케이스를 살펴보세요.", "임상 케이스 열기"],
  },
  {
    id: "practice-clinical-screen", chapter: "practice", scope: id("practice-clinical"), anchors: [`${id("practice-clinical")} h1`, `${id("practice-clinical")} h2`, id("practice-clinical-back")],
    click: id("practice-clinical-back"),
    en: ["Explore the case library", "Choose a case to review its setup. Begin encounter starts the clinical exercise when you’re ready.", "Back to Practice"],
    ko: ["케이스 목록 살펴보기", "케이스를 고르면 상황을 볼 수 있어요. 준비가 되면 진료 시작 버튼으로 연습을 시작하세요.", "연습으로 돌아가기"],
  },
  {
    id: "practice-ai", chapter: "practice", scope: practice, anchors: [id("practice-ai-patient-entry"), id("practice-ai-patient-unavailable"), `${practice} h1`],
    click: id("practice-ai-patient-entry"), skipDestination: true,
    en: ["Find AI Patient", "When available for your account, AI Patient lets you practice a conversation with a simulated patient.", "Open AI Patient"],
    ko: ["AI 환자 찾기", "계정에서 이용 가능하면 AI 환자와 대화하며 상담을 연습할 수 있어요.", "AI 환자 열기"],
  },
  {
    id: "practice-ai-screen", chapter: "practice", scope: id("ai-patient-intro"), anchors: [id("ai-patient-back")],
    click: id("ai-patient-back"),
    en: ["Review the AI Patient setup", "Read the scenario instructions first. Selecting a scenario when ready starts the simulated conversation.", "Back to Practice"],
    ko: ["AI 환자 연습 준비", "먼저 화면의 안내를 읽으세요. 준비가 되면 시나리오를 선택해 모의 대화를 시작할 수 있어요.", "연습으로 돌아가기"],
  },
  {
    id: "practice-field", chapter: "practice", scope: practice, anchors: [id("practice-field-actions")],
    click: id("practice-field-actions"),
    en: ["Open Action plans", "Action plans are where you put something you learned into practice at work.", "Open Action plans"],
    ko: ["행동 계획 열기", "교육에서 배운 내용을 업무에서 실천할 계획을 확인하는 곳이에요.", "행동 계획 열기"],
  },
  {
    id: "practice-field-screen", chapter: "practice", scope: id("field-actions-focus"), anchors: [`${id("field-actions-focus")} h1`, id("field-actions-back")],
    click: id("field-actions-back"),
    en: ["Follow your action plan", "See plans waiting for review, needing changes, or ready to complete. Open a plan to see the next step for its current status.", "Back to Practice"],
    ko: ["실천 계획 진행 상태 확인", "검토 중인 계획, 수정이 필요한 계획, 완료할 수 있는 계획을 볼 수 있어요. 계획을 열면 상태에 맞는 다음 행동이 나와요.", "연습으로 돌아가기"],
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
    en: ["See your learning rewards", "When rewards are enabled, this area shows your XP, level, weekly goal and badges. Open a badge to see how it is earned.", "Continue"],
    ko: ["학습 보상 확인", "보상이 켜져 있으면 XP, 레벨, 주간 목표와 배지를 확인할 수 있어요. 배지를 열면 받는 방법을 볼 수 있어요.", "계속"],
  },
  {
    id: "me-week", chapter: "me", scope: me, anchors: [`${id("me-this-week")} h2`, id("me-week-summary")],
    en: ["Review your week", "This Week summarizes your recent BTY activity. Tap the orb next to see attendance by day.", "Continue"],
    ko: ["이번 주 돌아보기", "이번 주에는 최근 BTY 활동이 나와요. 다음으로 구슬을 눌러 날짜별 출석을 확인해 보세요.", "계속"],
  },
  {
    id: "me-attendance", chapter: "me", scope: me, anchors: [id("me-weekly-orb")], click: id("me-weekly-orb"),
    en: ["Open weekly attendance", "Tap the orb to see the days you used BTY this week.", "Open attendance"],
    ko: ["주간 출석 열기", "구슬을 눌러 이번 주에 BTY를 사용한 날을 확인하세요.", "출석 열기"],
  },
  {
    id: "me-attendance-screen", chapter: "me", scope: id("me-attendance-popup"), anchors: [id("me-attendance-close")],
    click: id("me-attendance-close"),
    en: ["Read your attendance", "Each light represents a day of activity. Close the attendance popup to continue.", "Close attendance"],
    ko: ["출석 확인", "불빛은 BTY를 사용한 날짜를 뜻해요. 출석 팝업을 닫고 계속하세요.", "출석 닫기"],
  },
  {
    id: "me-past", chapter: "me", scope: me, anchors: [id("me-row-past-tracks")], click: id("me-row-past-tracks"),
    en: ["Open Past Tracks", "Use Past Tracks to find earlier conversations you have cleared from Today.", "Open Past Tracks"],
    ko: ["지난 Track 열기", "오늘 화면에서 정리한 이전 Track 대화를 다시 찾을 수 있어요.", "지난 Track 열기"],
  },
  {
    id: "me-past-screen", chapter: "me", scope: id("past-tracks"), anchors: [`${id("past-tracks")} h2`, id("past-tracks-back")],
    click: id("past-tracks-back"),
    en: ["Review past conversations", "Past Tracks can include requests you received and Tracks you sent. Open a conversation if you need to see it again.", "Back to Me"],
    ko: ["지난 대화 다시 보기", "받은 요청과 내가 보낸 Track을 볼 수 있어요. 필요한 대화가 있으면 펼쳐 확인하세요.", "나로 돌아가기"],
  },
  {
    id: "me-center", chapter: "me", scope: me, anchors: [id("me-row-center")], click: id("me-row-center"),
    en: ["Open Center", "Center is where you can revisit your personal reflections.", "Open Center"],
    ko: ["센터 열기", "센터에서 내 회고를 다시 볼 수 있어요.", "센터 열기"],
  },
  {
    id: "me-center-screen", chapter: "me", scope: id("me-center"), anchors: [`${id("center-reality-feed")} h1`, `${id("center-reality-feed")} h2`, id("me-center-back")],
    click: id("me-center-back"),
    en: ["Revisit your reflections", "Your reflection feed brings together things you wrote down and want to revisit. Sharing preferences are available here when shown.", "Back to Me"],
    ko: ["내 회고 다시 보기", "내가 작성한 회고를 한곳에서 돌아볼 수 있어요. 공유 설정이 표시되면 여기서 확인할 수 있어요.", "나로 돌아가기"],
  },
  {
    id: "me-account", chapter: "me", scope: me, anchors: [id("me-account-row")], click: id("me-account-row"),
    en: ["Open Account", "Check which account is connected to BTY.", "Open Account"],
    ko: ["계정 열기", "BTY에 연결된 계정을 확인할 수 있어요.", "계정 열기"],
  },
  {
    id: "me-account-screen", chapter: "me", scope: id("me-account"), anchors: [id("account-identity"), id("account-block"), id("me-account-back")],
    click: id("me-account-back"),
    en: ["Review account controls", "Account shows your connection. Switch account and sign out are available here when shown. Use Back to finish the tour.", "Back to Me"],
    ko: ["계정 설정 확인", "연결 상태를 확인할 수 있어요. 계정 전환과 로그아웃이 표시되면 이곳에서 사용할 수 있어요. 뒤로 눌러 둘러보기를 마무리하세요.", "나로 돌아가기"],
  },
  {
    id: "finish", chapter: "me", scope: me, anchors: [id("me-tour-replay")],
    en: ["You’re ready to use BTY", "You can reopen the guide here. While it is open, tap any tab to go straight to that part of the guide.", "Finish tour"],
    ko: ["둘러보기 완료", "언제든 여기서 다시 열 수 있어요. 둘러보는 중에는 원하는 탭을 눌러 그 부분부터 볼 수 있어요.", "완료"],
  },
];

export function tourTabIndex(tab: AppTabKey) {
  return teamsTourSteps.findIndex((step) => step.chapter === tab);
}

export function tourCopy(step: TeamsTourStep, locale: Locale) {
  const [title, body, action] = step[locale];
  return { title, body, action };
}
