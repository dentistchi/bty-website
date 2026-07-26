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
  createQuickNote: string;
  // past-events list hygiene (UI only)
  pastViewAll: string;
  pastShowLess: string;
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
  youtubeNotEmbeddable: string;
  youtubeNotFound: string;
  youtubeCheckFailed: string;
  promptError: string;
  // content-type choice + document (PDF) create
  chooseActivity: string;
  activityVideo: string;
  activityDocument: string;
  pdfLabel: string;
  pdfChoose: string;
  pdfReplace: string;
  introLabel: string;
  introPlaceholder: string;
  docPromptLabel: string;
  docPromptPlaceholder: string;
  pdfError: string;
  pdfTooLargeError: string;
  pdfReadError: string;
  uploadFailedError: string;
  reading: string; // "Reading the PDF…" progress hint while uploading
  // roster status labels
  status_joined: string;
  status_watching: string;
  status_reading: string;
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
  // share this room (QR / copy invitation / share to Teams)
  shareRoomHeader: string;
  copyInvitation: string;
  invitationCopied: string;
  copyFailedManual: string;
  shareToTeams: string;
  // Native primary action — opens the iOS system share sheet (app-neutral label).
  shareInvitation: string;
  openingTeams: string;
  chooseTeams: string;
  chooseAppToShare: string;
  teamsCouldNotOpen: string;
  readyToPaste: string;
  readyToPasteNative: string;
  openTeams: string;
  closeFallback: string;
  rotateQr: string;
  rotateConfirm: string;
  createArenaPractice: string;
  continueArenaPractice: string;
  manageArenaPractice: string;
  createNewVersion: string;
  createNewVersionBusy: string;
  createNewVersionNote: string;
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
    createCta: "Create quick event",
    createQuickNote: "Skip guided setup.",
    pastViewAll: "View all past events",
    pastShowLess: "Show less",
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
    youtubeNotEmbeddable: "This video can’t be played inside Foundry. Choose another YouTube video.",
    youtubeNotFound: "This YouTube video couldn’t be found. Check the link.",
    youtubeCheckFailed: "Couldn’t verify this video right now. Please try again.",
    promptError: "Please enter a completion question.",
    chooseActivity: "What will participants do?",
    activityVideo: "Watch a video",
    activityDocument: "Read a document",
    pdfLabel: "Upload PDF",
    pdfChoose: "Choose a PDF",
    pdfReplace: "Choose a different PDF",
    introLabel: "Introduction (optional)",
    introPlaceholder: "A short note for participants before they read.",
    docPromptLabel: "What should participants reflect on after reading?",
    docPromptPlaceholder: "e.g. What is one thing from this you will apply this week?",
    pdfError: "Please choose a PDF file.",
    pdfTooLargeError: "This PDF is too large. Choose a file under 25 MB.",
    pdfReadError: "Couldn’t read this PDF. Try another file.",
    uploadFailedError: "Couldn’t upload the PDF. Please upload it once more.",
    reading: "Preparing the document…",
    status_joined: "Joined",
    status_watching: "Watching",
    status_reading: "Reading",
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
    shareRoomHeader: "Share this room",
    copyInvitation: "Copy link",
    invitationCopied: "Invitation copied",
    copyFailedManual: "Couldn’t copy automatically. Select and copy the text below.",
    shareToTeams: "Share to Teams",
    shareInvitation: "Share invitation",
    openingTeams: "Opening Teams…",
    chooseTeams: "Choose Teams to share",
    chooseAppToShare: "Choose an app to share",
    teamsCouldNotOpen: "Teams could not be opened. The invitation is ready to paste.",
    readyToPaste: "Invitation copied. Paste it into Teams.",
    readyToPasteNative: "Invitation ready to paste.",
    openTeams: "Open Teams",
    closeFallback: "Close",
    rotateQr: "Rotate QR",
    rotateConfirm: "Replace the current QR? The old QR will stop working.",
    createArenaPractice: "Create Arena practice",
    continueArenaPractice: "Continue Arena practice",
    manageArenaPractice: "Manage Arena practice",
    createNewVersion: "Create new version",
    createNewVersionBusy: "Opening…",
    createNewVersionNote: "Your current published training will remain unchanged.",
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
    createCta: "빠른 이벤트 만들기",
    createQuickNote: "가이드 설정 건너뛰기.",
    pastViewAll: "지난 이벤트 모두 보기",
    pastShowLess: "간략히 보기",
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
    youtubeNotEmbeddable: "이 영상은 Foundry 안에서 재생할 수 없습니다. 다른 YouTube 영상을 선택하세요.",
    youtubeNotFound: "이 YouTube 영상을 찾을 수 없습니다. 링크를 확인해 주세요.",
    youtubeCheckFailed: "지금 영상을 확인할 수 없습니다. 다시 시도해 주세요.",
    promptError: "완료 질문을 입력해 주세요.",
    chooseActivity: "참가자는 무엇을 하나요?",
    activityVideo: "영상 보기",
    activityDocument: "문서 읽기",
    pdfLabel: "PDF 업로드",
    pdfChoose: "PDF 선택",
    pdfReplace: "다른 PDF 선택",
    introLabel: "소개 (선택)",
    introPlaceholder: "읽기 전에 참가자에게 전할 짧은 안내.",
    docPromptLabel: "읽은 후 참가자가 성찰할 질문은 무엇인가요?",
    docPromptPlaceholder: "예: 이 중에서 이번 주에 적용해볼 한 가지는 무엇인가요?",
    pdfError: "PDF 파일을 선택해 주세요.",
    pdfTooLargeError: "PDF가 너무 큽니다. 25MB 미만 파일을 선택하세요.",
    pdfReadError: "이 PDF를 읽을 수 없습니다. 다른 파일을 시도해 주세요.",
    uploadFailedError: "PDF를 업로드하지 못했습니다. 다시 시도해 주세요.",
    reading: "문서를 준비하는 중…",
    status_joined: "입장",
    status_watching: "시청 중",
    status_reading: "읽는 중",
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
    shareRoomHeader: "이 방 공유하기",
    copyInvitation: "링크 복사",
    invitationCopied: "초대장이 복사되었습니다",
    copyFailedManual: "자동으로 복사하지 못했습니다. 아래 텍스트를 선택해 복사하세요.",
    shareToTeams: "Teams로 공유",
    shareInvitation: "초대장 공유",
    openingTeams: "Teams 여는 중…",
    chooseTeams: "공유에서 Teams를 선택하세요",
    chooseAppToShare: "공유할 앱을 선택하세요",
    teamsCouldNotOpen: "Teams를 열 수 없습니다. 초대장을 붙여넣을 준비가 되었습니다.",
    readyToPaste: "초대장이 복사되었습니다. Teams에 붙여넣으세요.",
    readyToPasteNative: "초대장을 붙여넣을 준비가 되었습니다.",
    openTeams: "Teams 열기",
    closeFallback: "닫기",
    rotateQr: "QR 재발급",
    createArenaPractice: "아레나 연습 만들기",
    continueArenaPractice: "아레나 연습 이어하기",
    manageArenaPractice: "아레나 연습 관리",
    createNewVersion: "새 버전 만들기",
    createNewVersionBusy: "여는 중…",
    createNewVersionNote: "현재 게시된 트레이닝은 그대로 유지됩니다.",
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
