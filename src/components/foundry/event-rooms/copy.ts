/** Self-contained en/ko copy for the Foundry Event Rooms manager UI (mirrors the
 *  shell's local-dictionary pattern). Quiet, operational, BTY-native. */

export type Locale = "en" | "ko";

export type EventRoomsCopy = {
  eyebrow: string;
  // non-host (no active Foundry Host grant) quiet state
  nonHostLead: string;
  nonHostSub: string;
  // empty state
  emptyLead: string;
  createCta: string;
  // create
  createEyebrow: string;
  nameLabel: string;
  namePlaceholder: string;
  youtubeLabel: string;
  youtubePlaceholder: string;
  promptLabel: string;
  promptPlaceholder: string;
  create: string;
  creating: string;
  cancel: string;
  titleError: string;
  youtubeError: string;
  promptError: string;
  // roster status labels
  status_joined: string;
  status_watching: string;
  status_response_pending: string;
  status_complete: string;
  completedCount: (done: number, total: number) => string;
  // home
  openHeader: string;
  pastHeader: string;
  joinedCount: (n: number) => string;
  closedTag: string;
  // control room
  back: string;
  statusOpen: string;
  statusClosed: string;
  scanToJoin: string;
  shareLink: string;
  linkCopied: string;
  rotateQr: string;
  rotateConfirm: string;
  joinedHeader: (n: number) => string;
  closeEvent: string;
  closeConfirm: string;
  remove: string;
  removeConfirm: string;
  rosterEmpty: string;
  closedNotice: string;
  qrError: string;
  loadError: string;
};

export const EVENT_ROOMS_COPY: Record<Locale, EventRoomsCopy> = {
  en: {
    eyebrow: "FOUNDRY",
    nonHostLead: "Training rooms are opened by authorized hosts.",
    nonHostSub: "Scan an invitation QR to join a training event.",
    emptyLead: "Bring your team into one room.",
    createCta: "Create an event",
    createEyebrow: "CREATE TRAINING EVENT",
    nameLabel: "Event name",
    namePlaceholder: "e.g. Handling Difficult Conversations",
    youtubeLabel: "YouTube link",
    youtubePlaceholder: "https://www.youtube.com/watch?v=…",
    promptLabel: "Completion question",
    promptPlaceholder: "e.g. What is one conversation you will handle differently this week?",
    create: "Create training event",
    creating: "Creating…",
    cancel: "Cancel",
    titleError: "Please enter an event name.",
    youtubeError: "Please paste a valid YouTube link.",
    promptError: "Please enter a completion question.",
    status_joined: "Joined",
    status_watching: "Watching",
    status_response_pending: "Response pending",
    status_complete: "Complete",
    completedCount: (done, total) => `${done} of ${total} completed`,
    openHeader: "OPEN EVENTS",
    pastHeader: "PAST EVENTS",
    joinedCount: (n) => (n === 1 ? "1 joined" : `${n} joined`),
    closedTag: "Closed",
    back: "Back",
    statusOpen: "OPEN",
    statusClosed: "CLOSED",
    scanToJoin: "Scan to join",
    shareLink: "Share link",
    linkCopied: "Link copied",
    rotateQr: "Rotate QR",
    rotateConfirm: "Replace the current QR? The old QR will stop working.",
    joinedHeader: (n) => (n === 1 ? "1 person joined" : `${n} people joined`),
    closeEvent: "Close event",
    closeConfirm: "Close this event? No one new will be able to join.",
    remove: "Remove",
    removeConfirm: "Remove this participant?",
    rosterEmpty: "No one has joined yet.",
    closedNotice: "This event is closed. New participants can no longer join.",
    qrError: "The QR could not be shown. Try Share link.",
    loadError: "Could not load. Pull to retry.",
  },
  ko: {
    eyebrow: "FOUNDRY",
    nonHostLead: "훈련 방은 승인된 호스트가 엽니다.",
    nonHostSub: "초대 QR을 스캔하여 훈련 이벤트에 참여하세요.",
    emptyLead: "팀을 하나의 방으로 모으세요.",
    createCta: "이벤트 만들기",
    createEyebrow: "훈련 이벤트 만들기",
    nameLabel: "이벤트 이름",
    namePlaceholder: "예: 어려운 대화 다루기",
    youtubeLabel: "YouTube 링크",
    youtubePlaceholder: "https://www.youtube.com/watch?v=…",
    promptLabel: "완료 질문",
    promptPlaceholder: "예: 이번 주에 다르게 다뤄볼 대화 하나는 무엇인가요?",
    create: "훈련 이벤트 만들기",
    creating: "만드는 중…",
    cancel: "취소",
    titleError: "이벤트 이름을 입력해 주세요.",
    youtubeError: "올바른 YouTube 링크를 붙여넣어 주세요.",
    promptError: "완료 질문을 입력해 주세요.",
    status_joined: "입장",
    status_watching: "시청 중",
    status_response_pending: "응답 대기",
    status_complete: "완료",
    completedCount: (done, total) => `${total}명 중 ${done}명 완료`,
    openHeader: "진행 중인 이벤트",
    pastHeader: "지난 이벤트",
    joinedCount: (n) => `${n}명 입장`,
    closedTag: "종료됨",
    back: "뒤로",
    statusOpen: "진행 중",
    statusClosed: "종료됨",
    scanToJoin: "스캔하여 입장",
    shareLink: "링크 공유",
    linkCopied: "링크가 복사되었습니다",
    rotateQr: "QR 재발급",
    rotateConfirm: "현재 QR을 교체할까요? 기존 QR은 더 이상 작동하지 않습니다.",
    joinedHeader: (n) => `${n}명 입장`,
    closeEvent: "이벤트 종료",
    closeConfirm: "이 이벤트를 종료할까요? 더 이상 새로 입장할 수 없습니다.",
    remove: "내보내기",
    removeConfirm: "이 참가자를 내보낼까요?",
    rosterEmpty: "아직 아무도 입장하지 않았습니다.",
    closedNotice: "종료된 이벤트입니다. 더 이상 새로 입장할 수 없습니다.",
    qrError: "QR을 표시하지 못했습니다. 링크 공유를 사용하세요.",
    loadError: "불러오지 못했습니다. 다시 시도해 주세요.",
  },
};
