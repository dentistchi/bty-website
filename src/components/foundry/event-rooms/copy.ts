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
  /*
    QUICK TRAINING MATERIAL — the third option (Slice Quick Training Authoring V1). Text is not a
    new kind of learning: it is the existing written-guidance runtime, reached from this form.
  */
  activityText: string;
  textLabel: string;
  textPlaceholder: string;
  textError: string;
  textTooLongError: string;
  textPromptLabel: string;
  textPromptPlaceholder: string;
  /*
    QUIZ OPTIONALITY. The two states are named, both are visible, and each says what it does to
    the completion check — because choosing a quiz REMOVES the completion question rather than
    adding something beside it.
  */
  quizSectionLabel: string;
  quizNone: string;
  quizAdd: string;
  quizNoneNote: string;
  quizAddNote: string;
  // The three authoring methods. All three land in the one editor below them.
  quizMethodLabel: string;
  quizMethodManual: string;
  quizMethodCsv: string;
  quizMethodGenerate: string;
  quizCsvLabel: string;
  quizCsvHint: string;
  quizCsvError: string;
  quizCsvLoaded: (n: number) => string;
  /** The AI box is SOURCE MATERIAL — what the employee should study — never a quiz question. */
  quizSourceLabel: string;
  quizSourceNote: string;
  quizSourcePlaceholder: string;
  quizCount: (n: number) => string;
  quizGenerate: string;
  quizGenerating: string;
  quizGenShortError: (required: number) => string;
  quizGenUngroundedError: string;
  quizGenProviderError: string;
  quizGenTimeoutError: string;
  quizGenOutputError: string;
  // The one shared editor.
  quizEditorHeading: string;
  quizEditorLead: string;
  quizEditorCount: (n: number, max: number) => string;
  quizQuestionLabel: (n: number) => string;
  quizQuestionPlaceholder: string;
  quizChoicePlaceholder: (n: number) => string;
  quizCorrectLabel: string;
  quizAddChoice: string;
  quizRemoveChoice: string;
  quizAddQuestion: string;
  quizRemoveQuestion: string;
  quizExplanationLabel: string;
  quizExplanationPlaceholder: string;
  quizQuestionTextError: string;
  quizChoiceLabelError: string;
  quizDuplicateChoiceError: string;
  quizCorrectChoiceError: string;
  quizIncompleteError: string;
  // roster status labels
  status_joined: string;
  status_watching: string;
  status_reading: string;
  status_response_pending: string;
  status_complete: string;
  completedCount: (done: number, total: number) => string;
  // home
  /*
    ★ "TRAINING SESSIONS" / "PAST TRAINING", not "events" (IA simplification V1).

    `foundry_events` and `bty_events` are two unrelated products — a training room with
    participants, progress and completion, and a QR live experience with XP and attendance. They
    have different tables, different lifecycles and different APIs, and calling both of them
    "events" on the same screen is most of why that screen was confusing.

    The object stays `foundry_events` internally: this is what people READ, not a rename.
  */
  openHeader: string;
  pastHeader: string;
  joinedCount: (n: number) => string;
  closedTag: string;
  // control room
  back: string;
  /** 3.2G-R4: control-bound resolving + unavailable surfaces (deep-link handoff before data loads). */
  controlResolving: string;
  controlUnavailable: string;
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
  /*
    TEAMS-NATIVE DELIVERY V1 — inside the BTY personal tab the Host never leaves Teams: they pick
    colleagues in Teams' own picker and Teams opens a chat with the invitation already drafted.
    "Send" rather than "Share", because the Host is addressing people, not publishing a link.
  */
  sendInTeams: string;
  sendInTeamsChoosing: string;
  sendInTeamsComposed: string;
  sendInTeamsUnsupported: string;
  sendInTeamsFailed: string;
  teamsLinkCopied: string;
  /*
    TEAMS CHAT-NATIVE DELIVERY V1 — the Host chooses colleagues and BTY's bot delivers the training
    into each of their own Teams chats. Nothing is sent until the Host confirms.
  */
  sendInTeamsConfirm: (n: number) => string;
  sendInTeamsConfirmCta: string;
  sendInTeamsCancel: string;
  sendInTeamsSending: string;
  sendInTeamsSent: (n: number) => string;
  sendInTeamsMixed: (sent: number, failed: number) => string;
  sendInTeamsAlready: (n: number) => string;
  sendInTeamsNoneCta: string;
  sendInTeamsUnavailable: string;
  /*
    WHY ONE PERSON DID NOT RECEIVE IT (Teams Delivery Diagnostics V1). The API already returned a
    product reason per recipient and the client discarded it, so every failure read as the same
    shrug. These are the five distinct things a Host can actually tell apart and act on — and none
    of them is a Microsoft error string.
  */
  sendReasonNotInstalled: string;
  sendReasonNotEligible: string;
  sendReasonNoRoute: string;
  sendReasonUnknown: string;
  sendReasonFailed: string;
  /*
    A SCORE IS NOT THE DESTINATION. These name the surface behind one learner's score — what they
    missed, and the one tap that turns a number into a conversation with the person.
  */
  quizHeader: string;
  quizProgress: (done: number, total: number) => string;
  quizAverage: (percent: number) => string;
  resultDetailBack: string;
  resultDetailAllCorrect: string;
  resultDetailMissedHeader: string;
  resultDetailTheyChose: string;
  resultDetailCorrectAnswer: string;
  resultDetailNoAnswer: string;
  resultDetailLoading: string;
  resultDetailUnavailable: string;
  messageInTeams: string;
  messageInTeamsOpening: string;
  messageInTeamsNoIdentity: string;
  messageInTeamsUnavailable: string;
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
  /** Remove a PARTICIPANT from a session. Not the same act as tidying your own history. */
  remove: string;
  removeConfirm: string;
  /*
    ★ SEPARATE KEYS FROM `remove`, DELIBERATELY. That one takes a person out of a training session
    — a shared, consequential act with a confirmation. This one hides a finished session from the
    reader's OWN history and changes nothing anybody else can see. Same English word, two different
    meanings; sharing a key would eventually let one surface borrow the other's copy.
  */
  historyRemove: string;
  historyRemoveFailed: string;
  rosterEmpty: string;
  /*
    TRAINING OUTCOME (Slice R4-R3A). Ordinary manager language: a Host should be able to read this
    without knowing what an Evidence Ladder is. The three groups stay separately labelled because
    completion, a learner's own report, and someone else's confirmation are three different facts —
    collapsing them into one number would state something nobody measured.
  */
  outcomeHeading: string;
  outcomeQuestion: string;
  outcomeCompleted: string;
  outcomeCompletedOf: (done: number, total: number) => string;
  outcomeAfterHeading: string;
  outcomeApplied: string;
  outcomePartly: string;
  outcomeNotYet: string;
  outcomeBlocked: string;
  outcomeWaiting: string;
  outcomeOverdue: string;
  outcomeObservedHeading: string;
  outcomeConfirmed: string;
  outcomeNotEstablished: string;
  outcomeCouldntTell: string;
  /** The one-line reading. Each says what we KNOW, never how anyone performed. */
  outcomeReadingNothingYet: string;
  outcomeReadingUnknown: (waiting: number, overdue: number) => string;
  outcomeReadingReportedOnly: string;
  outcomeReadingConfirmed: string;
  /**
   * R4-R3A-R1 — reachable ONLY when no checkpoint was configured. It used to be printed whenever
   * the Journey was missing, which told 17 production Hosts they had forgotten something they had
   * in fact set.
   */
  outcomeEndsAtCompletion: string;
  /**
   * The checkpoint EXISTS and has produced no obligation yet (Slice R4-R3B2).
   *
   * It used to say the learners "finished without signing in, so we can't follow up with them" —
   * a cause the product cannot prove and, for three measured production completions, one that was
   * simply false: a follow-up existed for them. Names the configuration first so the Host is not
   * read as having forgotten it, then states the shortfall as a fact and stops.
   */
  outcomeAwaitingConnection: (days: number, notConnected: number) => string;
  /** How many completions the configured follow-up has not reached. No cause is asserted. */
  outcomeNotConnectedNote: (n: number) => string;
  outcomeDecisionsToggle: (n: number) => string;
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
    pastViewAll: "View all past training",
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
    activityText: "Read a short text",
    textLabel: "What should participants read?",
    textPlaceholder: "Paste or write the guidance participants should read.",
    textError: "Please enter the text participants will read.",
    textTooLongError: "This text is too long. Please shorten it to 2,000 characters or fewer.",
    textPromptLabel: "What should participants reflect on after reading?",
    textPromptPlaceholder: "e.g. What is one thing from this you will apply this week?",
    quizSectionLabel: "Quiz",
    quizNone: "No quiz",
    quizAdd: "Add quiz",
    quizNoneNote: "Participants answer your completion question to finish.",
    quizAddNote: "Submitting the quiz completes the training, so no completion question is asked.",
    quizMethodLabel: "How do you want to create the questions?",
    quizMethodManual: "Write them myself",
    quizMethodCsv: "Upload a CSV",
    quizMethodGenerate: "Generate from study content",
    quizCsvLabel: "Choose a CSV file",
    quizCsvHint: "Columns: question, option_a, option_b, option_c, option_d, correct_option, explanation",
    quizCsvError: "Couldn’t read this CSV. Check the columns, then choose the file once more.",
    quizCsvLoaded: (n) => `Loaded ${n} question${n === 1 ? "" : "s"} for review.`,
    quizSourceLabel: "Paste what your team should study",
    quizSourceNote: "The questions are written only from this content.",
    quizSourcePlaceholder: "Paste the policy, guide or notes participants should learn from.",
    quizCount: (n) => `${n} questions`,
    quizGenerate: "Create questions",
    quizGenerating: "Writing questions…",
    quizGenShortError: (required) =>
      `There isn’t enough content to write these questions from. Please paste at least ${required} characters.`,
    quizGenUngroundedError: "The questions weren’t traceable to your content. Add more detail, then create them once more.",
    quizGenProviderError: "Questions couldn’t be created right now. You can upload a CSV or write them yourself.",
    quizGenTimeoutError: "That took too long. Use a shorter piece of content and create the questions once more.",
    quizGenOutputError: "The questions came back unusable. Please create them once more.",
    quizEditorHeading: "Review the quiz",
    quizEditorLead: "Edit anything here before you create the training. Nothing is saved until then.",
    quizEditorCount: (n, max) => `${n} of ${max} questions`,
    quizQuestionLabel: (n) => `Question ${n}`,
    quizQuestionPlaceholder: "What do you want to check?",
    quizChoicePlaceholder: (n) => `Answer ${n}`,
    quizCorrectLabel: "Correct answer",
    quizAddChoice: "Add answer",
    quizRemoveChoice: "Remove",
    quizAddQuestion: "Add question",
    quizRemoveQuestion: "Remove question",
    quizExplanationLabel: "Explanation (optional)",
    quizExplanationPlaceholder: "Shown after the participant submits.",
    quizQuestionTextError: "Please write the question.",
    quizChoiceLabelError: "Please fill in every answer.",
    quizDuplicateChoiceError: "Two answers are the same.",
    quizCorrectChoiceError: "Please mark the correct answer.",
    quizIncompleteError: "Please finish the quiz before creating the training.",
    status_joined: "Joined",
    status_watching: "Watching",
    status_reading: "Reading",
    status_response_pending: "Response pending",
    status_complete: "Complete",
    completedCount: (done, total) => `${done} of ${total} completed`,
    openHeader: "TRAINING SESSIONS",
    pastHeader: "PAST TRAINING",
    joinedCount: (n) => (n === 1 ? "1 joined" : `${n} joined`),
    closedTag: "Closed",
    back: "Back",
    controlResolving: "Opening follow-up…",
    controlUnavailable: "This follow-up couldn't be opened.",
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
    sendInTeams: "Send in Teams",
    sendInTeamsChoosing: "Choosing people…",
    sendInTeamsComposed: "Teams opened a draft. Press Send there to invite them.",
    sendInTeamsUnsupported: "This Teams version can't pick people here. The BTY link is copied — paste it into a chat.",
    sendInTeamsFailed: "Teams couldn't open a chat. The BTY link is copied — paste it into a chat.",
    teamsLinkCopied: "BTY training link copied.",
    sendInTeamsConfirm: (n) => `Send this training to ${n} ${n === 1 ? "person" : "people"}?`,
    sendInTeamsConfirmCta: "Send",
    sendInTeamsCancel: "Cancel",
    sendInTeamsSending: "Sending…",
    sendInTeamsSent: (n) => `Sent in Teams to ${n} ${n === 1 ? "person" : "people"}.`,
    sendInTeamsMixed: (sent, failed) => `${sent} sent · ${failed} couldn't receive it.`,
    sendInTeamsAlready: (n) => `${n} already had it.`,
    sendInTeamsNoneCta: "Couldn't send this training.",
    sendInTeamsUnavailable: "Teams can't send this training right now.",
    sendReasonNotInstalled: "BTY isn't installed for this employee in Teams.",
    sendReasonNotEligible: "This account can't receive this training.",
    sendReasonNoRoute: "BTY can't reach Teams for this organization yet.",
    sendReasonUnknown: "Teams couldn't confirm delivery.",
    sendReasonFailed: "BTY couldn't send the training.",
    quizHeader: "Quiz",
    quizProgress: (done, total) => `${done} of ${total} completed the quiz`,
    quizAverage: (percent) => ` · average ${percent}%`,
    resultDetailBack: "Back to results",
    resultDetailAllCorrect: "Answered every question correctly.",
    resultDetailMissedHeader: "Worth going over",
    resultDetailTheyChose: "They chose",
    resultDetailCorrectAnswer: "Correct answer",
    resultDetailNoAnswer: "No answer",
    resultDetailLoading: "Opening result…",
    resultDetailUnavailable: "This result can't be opened right now.",
    messageInTeams: "Message in Teams",
    messageInTeamsOpening: "Opening Teams…",
    messageInTeamsNoIdentity: "This learner didn't join through Teams, so there's no chat to open.",
    messageInTeamsUnavailable: "Teams chat can't be opened right now.",
    closeFallback: "Close",
    rotateQr: "Rotate QR",
    rotateConfirm: "Replace the current QR? The old QR will stop working.",
    createArenaPractice: "Create practice",
    continueArenaPractice: "Continue practice",
    manageArenaPractice: "Manage practice",
    createNewVersion: "Create new version",
    createNewVersionBusy: "Opening…",
    createNewVersionNote: "Your current published training will remain unchanged.",
    joinedHeader: (n) => (n === 1 ? "1 person joined" : `${n} people joined`),
    closeEvent: "Close event",
    closeConfirm: "Close this event? No one new will be able to join.",
    remove: "Remove",
    removeConfirm: "Remove this participant?",
    historyRemove: "Remove",
    historyRemoveFailed: "Couldn't remove that.",
    rosterEmpty: "No one has joined yet.",
    outcomeHeading: "Training outcome",
    outcomeQuestion: "Did anything change?",
    outcomeCompleted: "Completed",
    outcomeCompletedOf: (done, total) => `${done} of ${total}`,
    outcomeAfterHeading: "After the training",
    outcomeApplied: "Applied",
    outcomePartly: "Partly applied",
    outcomeNotYet: "Not yet",
    outcomeBlocked: "Blocked",
    outcomeWaiting: "Waiting",
    outcomeOverdue: "Overdue",
    outcomeObservedHeading: "Observed by someone else",
    outcomeConfirmed: "Confirmed",
    outcomeNotEstablished: "Not established",
    outcomeCouldntTell: "Couldn’t tell",
    outcomeReadingNothingYet: "Nothing to report yet.",
    /*
      Pluralised the way this file already does it (see `joinedCount`): a ternary on n === 1.
      "1 haven’t answered" is not English, and this is a first-viewport outcome number.
    */
    outcomeReadingUnknown: (waiting, overdue) => {
      const n = waiting + overdue;
      const who = n === 1 ? "1 person hasn’t answered" : `${n} people haven’t answered`;
      if (overdue === 0) return `We don’t know yet — ${who}.`;
      const late = overdue === 1 ? "1 is overdue" : `${overdue} are overdue`;
      return `We don’t know yet — ${who}, and ${late}.`;
    },
    outcomeReadingReportedOnly: "People told us what happened. No one else has confirmed it yet.",
    outcomeReadingConfirmed: "Someone else confirmed this happened at work.",
    outcomeEndsAtCompletion: "This training ends at completion. No follow-up was set up for it.",
    outcomeAwaitingConnection: (days, notConnected) =>
      notConnected === 1
        ? `Follow-up was set for ${days} days. 1 completion isn’t connected to a follow-up yet.`
        : `Follow-up was set for ${days} days. ${notConnected} completions aren’t connected to a follow-up yet.`,
    outcomeNotConnectedNote: (n) =>
      n === 1
        ? "1 completion isn’t connected to a follow-up yet."
        : `${n} completions aren’t connected to a follow-up yet.`,
    outcomeDecisionsToggle: (n) => `What people decided to do (${n})`,
    closedNotice: "This event is closed. New participants can no longer join.",
    qrError: "The QR could not be shown. Try Share link.",
    loadError: "Could not load. Pull to retry.",
  },
  ko: {
    eyebrow: "FOUNDRY",
    nonHostLead: "훈련 방은 승인된 호스트가 엽니다.",
    nonHostSub: "초대 QR을 스캔하여 훈련 이벤트에 참여하세요.",
    emptyLead: "팀을 하나의 방으로 모으세요.",
    // The door BELOW the Builder door: one video or one document, no design step.
    createCta: "자료로 바로 시작하기",
    createQuickNote: "영상이나 자료 하나로 훈련을 바로 시작하세요.",
    pastViewAll: "지난 교육 모두 보기",
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
    activityText: "짧은 글 읽기",
    textLabel: "참가자가 읽을 내용은 무엇인가요?",
    textPlaceholder: "참가자가 읽을 내용을 붙여 넣거나 작성하세요.",
    textError: "참가자가 읽을 내용을 입력해 주세요.",
    textTooLongError: "내용이 너무 깁니다. 2,000자 이내로 줄여 주세요.",
    textPromptLabel: "읽은 후 참가자가 성찰할 질문은 무엇인가요?",
    textPromptPlaceholder: "예: 이 중에서 이번 주에 적용해볼 한 가지는 무엇인가요?",
    quizSectionLabel: "퀴즈",
    quizNone: "퀴즈 없음",
    quizAdd: "퀴즈 추가",
    quizNoneNote: "참가자는 완료 질문에 답하면 훈련이 끝납니다.",
    quizAddNote: "퀴즈를 제출하면 훈련이 완료되므로 완료 질문은 묻지 않습니다.",
    quizMethodLabel: "문제를 어떻게 만들까요?",
    quizMethodManual: "직접 작성",
    quizMethodCsv: "CSV 파일 올리기",
    quizMethodGenerate: "학습 내용으로 만들기",
    quizCsvLabel: "CSV 파일 선택",
    quizCsvHint: "열: question, option_a, option_b, option_c, option_d, correct_option, explanation",
    quizCsvError: "이 CSV를 읽을 수 없습니다. 열 구성을 확인해 주세요.",
    quizCsvLoaded: (n) => `${n}문제를 불러왔습니다. 검토해 주세요.`,
    quizSourceLabel: "직원이 공부할 내용을 붙여 넣으세요",
    quizSourceNote: "이 내용만 사용해서 퀴즈를 만듭니다.",
    quizSourcePlaceholder: "참가자가 배워야 할 규정, 안내문, 메모를 붙여 넣으세요.",
    quizCount: (n) => `${n}문제`,
    quizGenerate: "문제 만들기",
    quizGenerating: "문제를 만드는 중…",
    quizGenShortError: (required) => `이 문제 수를 만들기에는 내용이 부족합니다. ${required}자 이상 붙여 넣어 주세요.`,
    quizGenUngroundedError: "붙여 넣은 내용에서 근거를 찾을 수 없었습니다. 내용을 보강한 뒤 다시 시도해 주세요.",
    quizGenProviderError: "지금은 문제를 만들 수 없습니다. CSV를 올리거나 직접 작성할 수 있습니다.",
    quizGenTimeoutError: "시간이 너무 오래 걸렸습니다. 내용을 줄여 다시 시도해 주세요.",
    quizGenOutputError: "만들어진 문제를 사용할 수 없습니다. 다시 시도해 주세요.",
    quizEditorHeading: "퀴즈 검토",
    quizEditorLead: "훈련을 만들기 전에 여기서 모두 수정할 수 있습니다. 그전까지는 저장되지 않습니다.",
    quizEditorCount: (n, max) => `${max}문제 중 ${n}문제`,
    quizQuestionLabel: (n) => `${n}번 문제`,
    quizQuestionPlaceholder: "무엇을 확인하고 싶나요?",
    quizChoicePlaceholder: (n) => `보기 ${n}`,
    quizCorrectLabel: "정답",
    quizAddChoice: "보기 추가",
    quizRemoveChoice: "삭제",
    quizAddQuestion: "문제 추가",
    quizRemoveQuestion: "문제 삭제",
    quizExplanationLabel: "해설 (선택)",
    quizExplanationPlaceholder: "참가자가 제출한 뒤에 보여집니다.",
    quizQuestionTextError: "문제를 입력해 주세요.",
    quizChoiceLabelError: "모든 보기를 채워 주세요.",
    quizDuplicateChoiceError: "같은 보기가 두 개 있습니다.",
    quizCorrectChoiceError: "정답을 표시해 주세요.",
    quizIncompleteError: "훈련을 만들기 전에 퀴즈를 완성해 주세요.",
    status_joined: "입장",
    status_watching: "시청 중",
    status_reading: "읽는 중",
    status_response_pending: "응답 대기",
    status_complete: "완료",
    completedCount: (done, total) => `${total}명 중 ${done}명 완료`,
    openHeader: "교육 세션",
    pastHeader: "지난 교육",
    joinedCount: (n) => `${n}명 입장`,
    closedTag: "종료됨",
    back: "뒤로",
    controlResolving: "후속 조치를 여는 중…",
    controlUnavailable: "이 후속 조치를 열 수 없습니다.",
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
    sendInTeams: "Teams에서 보내기",
    sendInTeamsChoosing: "받을 사람 선택 중…",
    sendInTeamsComposed: "Teams에 초대 메시지가 작성되었습니다. 거기서 보내기를 누르세요.",
    sendInTeamsUnsupported: "이 Teams 버전에서는 여기서 사람을 선택할 수 없습니다. BTY 링크를 복사했으니 채팅에 붙여넣으세요.",
    sendInTeamsFailed: "Teams에서 채팅을 열지 못했습니다. BTY 링크를 복사했으니 채팅에 붙여넣으세요.",
    teamsLinkCopied: "BTY 훈련 링크가 복사되었습니다.",
    sendInTeamsConfirm: (n) => `이 훈련을 ${n}명에게 보낼까요?`,
    sendInTeamsConfirmCta: "보내기",
    sendInTeamsCancel: "취소",
    sendInTeamsSending: "보내는 중…",
    sendInTeamsSent: (n) => `Teams로 ${n}명에게 보냈습니다.`,
    sendInTeamsMixed: (sent, failed) => `${sent}명 발송 · ${failed}명은 받지 못했습니다.`,
    sendInTeamsAlready: (n) => `${n}명은 이미 받았습니다.`,
    sendInTeamsNoneCta: "이 훈련을 보내지 못했습니다.",
    sendInTeamsUnavailable: "지금은 Teams로 이 훈련을 보낼 수 없습니다.",
    sendReasonNotInstalled: "이 직원의 Teams에 BTY가 설치되어 있지 않습니다.",
    sendReasonNotEligible: "이 계정은 이 훈련을 받을 수 없습니다.",
    sendReasonNoRoute: "아직 이 조직의 Teams에 연결할 수 없습니다.",
    sendReasonUnknown: "Teams가 전달을 확인하지 못했습니다.",
    sendReasonFailed: "훈련을 보내지 못했습니다.",
    quizHeader: "퀴즈",
    quizProgress: (done, total) => `퀴즈 완료 ${done} / ${total}`,
    quizAverage: (percent) => ` · 평균 점수 ${percent}%`,
    resultDetailBack: "결과로 돌아가기",
    resultDetailAllCorrect: "모든 문항을 맞혔습니다.",
    resultDetailMissedHeader: "같이 확인하면 좋은 문항",
    resultDetailTheyChose: "선택한 답",
    resultDetailCorrectAnswer: "정답",
    resultDetailNoAnswer: "답변 없음",
    resultDetailLoading: "결과를 여는 중…",
    resultDetailUnavailable: "지금은 이 결과를 열 수 없습니다.",
    messageInTeams: "Teams에서 메시지 보내기",
    messageInTeamsOpening: "Teams를 여는 중…",
    messageInTeamsNoIdentity: "이 학습자는 Teams로 참여하지 않아 열 수 있는 대화가 없습니다.",
    messageInTeamsUnavailable: "지금은 Teams 대화를 열 수 없습니다.",
    closeFallback: "닫기",
    rotateQr: "QR 재발급",
    createArenaPractice: "연습 만들기",
    continueArenaPractice: "연습 이어하기",
    manageArenaPractice: "연습 관리",
    createNewVersion: "새 버전 만들기",
    createNewVersionBusy: "여는 중…",
    createNewVersionNote: "현재 게시된 트레이닝은 그대로 유지됩니다.",
    rotateConfirm: "현재 QR을 교체할까요? 기존 QR은 더 이상 작동하지 않습니다.",
    joinedHeader: (n) => `${n}명 입장`,
    closeEvent: "이벤트 종료",
    closeConfirm: "이 이벤트를 종료할까요? 더 이상 새로 입장할 수 없습니다.",
    remove: "내보내기",
    removeConfirm: "이 참가자를 내보낼까요?",
    historyRemove: "치우기",
    historyRemoveFailed: "치우지 못했습니다.",
    rosterEmpty: "아직 아무도 입장하지 않았습니다.",
    outcomeHeading: "훈련 결과",
    outcomeQuestion: "무엇이 달라졌나요?",
    outcomeCompleted: "완료",
    outcomeCompletedOf: (done, total) => `${total}명 중 ${done}명`,
    outcomeAfterHeading: "훈련 이후",
    outcomeApplied: "적용함",
    outcomePartly: "일부 적용함",
    outcomeNotYet: "아직 안 함",
    outcomeBlocked: "막힘",
    outcomeWaiting: "대기 중",
    outcomeOverdue: "기한 지남",
    outcomeObservedHeading: "다른 사람이 본 것",
    outcomeConfirmed: "확인됨",
    outcomeNotEstablished: "확인되지 않음",
    outcomeCouldntTell: "판단할 수 없었음",
    outcomeReadingNothingYet: "아직 보고된 것이 없습니다.",
    /* Korean needs no singular/plural inflection here — the counter 명 is correct for every n. */
    outcomeReadingUnknown: (waiting, overdue) => {
      const n = waiting + overdue;
      if (overdue === 0) return `아직 알 수 없습니다 — ${n}명이 답하지 않았습니다.`;
      return `아직 알 수 없습니다 — ${n}명이 답하지 않았고, ${overdue}명은 기한이 지났습니다.`;
    },
    outcomeReadingReportedOnly: "본인이 무엇을 했는지 알려 주었습니다. 아직 다른 사람이 확인하지는 않았습니다.",
    outcomeReadingConfirmed: "다른 사람이 실제 업무에서 확인했습니다.",
    outcomeEndsAtCompletion: "이 훈련은 완료에서 끝납니다. 후속 확인이 설정되지 않았습니다.",
    /* 한국어는 수 구분이 필요 없어 단수/복수 분기가 없습니다. 설정을 먼저 말해, 호스트가 빠뜨린 것으로 읽히지 않게 합니다. */
    outcomeAwaitingConnection: (days, notConnected) =>
      `후속 확인은 ${days}일로 설정되어 있습니다. 아직 ${notConnected}건의 완료가 후속 확인과 연결되지 않았습니다.`,
    outcomeNotConnectedNote: (n) => `아직 ${n}건의 완료가 후속 확인과 연결되지 않았습니다.`,
    outcomeDecisionsToggle: (n) => `사람들이 하기로 한 것 (${n})`,
    closedNotice: "종료된 이벤트입니다. 더 이상 새로 입장할 수 없습니다.",
    qrError: "QR을 표시하지 못했습니다. 링크 공유를 사용하세요.",
    loadError: "불러오지 못했습니다. 다시 시도해 주세요.",
  },
};
