/** Self-contained en/ko copy for the Foundry Event Rooms manager UI (mirrors the
 *  shell's local-dictionary pattern). Quiet, operational, BTY-native. */

export type Locale = "en" | "ko";

export type EventRoomsCopy = {
  eyebrow: string;
  // empty state
  emptyLead: string;
  createCta: string;
  // create
  createEyebrow: string;
  nameLabel: string;
  namePlaceholder: string;
  create: string;
  creating: string;
  cancel: string;
  titleError: string;
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
    emptyLead: "Bring your team into one room.",
    createCta: "Create an event",
    createEyebrow: "CREATE EVENT",
    nameLabel: "Event name",
    namePlaceholder: "e.g. July Manager Meeting",
    create: "Create event",
    creating: "Creating…",
    cancel: "Cancel",
    titleError: "Please enter an event name.",
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
    emptyLead: "팀을 하나의 방으로 모으세요.",
    createCta: "이벤트 만들기",
    createEyebrow: "이벤트 만들기",
    nameLabel: "이벤트 이름",
    namePlaceholder: "예: 7월 매니저 미팅",
    create: "이벤트 만들기",
    creating: "만드는 중…",
    cancel: "취소",
    titleError: "이벤트 이름을 입력해 주세요.",
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
