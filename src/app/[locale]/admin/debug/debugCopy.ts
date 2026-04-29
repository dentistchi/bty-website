/** Admin debug page — ko/en copy + region aria labels (render-only). */

export type DebugLocale = "ko" | "en";

export type DebugCopy = {
  mainRegionAria: string;
  title: string;
  subtitle: string;
  qualityNav: string;
  regionMvp: string;
  regionList: string;
  regionPatch: string;
  regionLogin: string;
  regionSession: string;
  regionTips: string;
  mvpTitle: string;
  titleLabel: string;
  titlePh: string;
  descLabel: string;
  descPh: string;
  routeLabel: string;
  routeChat: string;
  routeMentor: string;
  routeArena: string;
  routeOther: string;
  contextLabel: string;
  contextPh: string;
  submitReport: string;
  submittingReport: string;
  submitReportAriaBusy: string;
  submitReportAriaIdle: string;
  submitBusyRegionAria: string;
  listTitle: string;
  filterAll: string;
  filterOpen: string;
  filterResolved: string;
  filterAllAria: string;
  filterOpenAria: string;
  filterResolvedAria: string;
  loadingList: string;
  noReports: string;
  resolvedBadge: string;
  resolutionNotePh: string;
  resolveDone: string;
  resolving: string;
  resolveAriaBusy: string;
  resolveAriaIdle: string;
  resolvingRegionAria: string;
  patchTitle: string;
  patchDesc: string;
  patchRun: string;
  patchRunning: string;
  patchAriaBusy: string;
  patchAriaIdle: string;
  patchBusyRegionAria: string;
  patchOk: string;
  patchWarn: string;
  loginTitle: string;
  emailLabel: string;
  passwordLabel: string;
  passwordPh: string;
  loginTest: string;
  loginTesting: string;
  loginTestAriaIdle: string;
  loginTestAriaBusy: string;
  loginBusyRegionAria: string;
  sessionTitle: string;
  sessionCheck: string;
  sessionCheckAria: string;
  tipsTitle: string;
  tips1: string;
  tips2: string;
  needCredentials: string;
  loginOkPrefix: string;
  loginFailPrefix: string;
  networkErrorPrefix: string;
  noToken: string;
  sessionOkPrefix: string;
  sessionFailPrefix: string;
  needTitle: string;
  reportSubmitted: string;
  resolutionNotePrefix: string;
};

export function getDebugCopy(locale: DebugLocale): DebugCopy {
  if (locale === "ko") {
    return {
      mainRegionAria: "관리자 디버깅",
      title: "디버깅",
      subtitle:
        "로그인 테스트, MVP 에러 제보, 교정·패치 배포를 한 곳에서 처리합니다.",
      qualityNav: "Quality Events",
      regionMvp: "MVP 에러 제보 양식",
      regionList: "에러 제보 목록",
      regionPatch: "패치 생성 및 배포",
      regionLogin: "로그인 테스트",
      regionSession: "세션 확인",
      regionTips: "디버깅 안내",
      mvpTitle: "에러 제보 (MVP)",
      titleLabel: "제목 *",
      titlePh: "예: 챗봇이 특정 질문에 부적절 응답",
      descLabel: "설명",
      descPh: "재현 방법, 기대 동작 등",
      routeLabel: "구역",
      routeChat: "챗봇",
      routeMentor: "멘토",
      routeArena: "아레나",
      routeOther: "기타",
      contextLabel: "상세(JSON, 선택)",
      contextPh: '{"user_message":"...","assistant_message":"..."}',
      submitReport: "제보 올리기",
      submittingReport: "등록 중...",
      submitReportAriaBusy: "등록 중...",
      submitReportAriaIdle: "제보 올리기",
      submitBusyRegionAria: "제보 등록 중",
      listTitle: "제보 목록",
      filterAll: "전체",
      filterOpen: "미해결",
      filterResolved: "해결됨",
      filterAllAria: "제보 목록 전체 보기",
      filterOpenAria: "미해결 제보만 보기",
      filterResolvedAria: "해결된 제보만 보기",
      loadingList: "제보 목록 불러오는 중…",
      noReports: "제보가 없습니다.",
      resolvedBadge: "해결됨",
      resolutionNotePh: "교정 메모 (선택)",
      resolveDone: "교정 완료",
      resolving: "처리 중...",
      resolveAriaBusy: "처리 중...",
      resolveAriaIdle: "교정 완료",
      resolvingRegionAria: "처리 중",
      patchTitle: "패치 배포",
      patchDesc:
        "패치 생성(bty-ai-core)과 배포 웹훅을 한 번에 실행합니다. DEPLOY_WEBHOOK_URL을 설정하면 실제 배포가 트리거됩니다.",
      patchRun: "패치 생성 및 배포",
      patchRunning: "실행 중...",
      patchAriaBusy: "실행 중...",
      patchAriaIdle: "패치 생성 및 배포",
      patchBusyRegionAria: "패치 배포 실행 중",
      patchOk: "✅ 완료",
      patchWarn: "⚠️ 일부 단계 실패",
      loginTitle: "로그인 테스트",
      emailLabel: "이메일",
      passwordLabel: "비밀번호",
      passwordPh: "비밀번호",
      loginTest: "로그인 테스트",
      loginTesting: "테스트 중...",
      loginTestAriaIdle: "로그인 테스트",
      loginTestAriaBusy: "테스트 중...",
      loginBusyRegionAria: "로그인 테스트 중",
      sessionTitle: "세션 확인",
      sessionCheck: "현재 세션 확인",
      sessionCheckAria: "현재 세션 확인",
      tipsTitle: "디버깅 팁",
      tips1:
        "에러 제보 후 제보 목록에서 「교정 완료」로 처리하고, 「패치 생성 및 배포」로 한 번에 반영할 수 있습니다.",
      tips2:
        "DEPLOY_WEBHOOK_URL: Cloudflare Pages Deploy Hook URL 또는 배포 트리거용 URL을 넣으면 클릭 시 배포가 실행됩니다.",
      needCredentials: "이메일과 비밀번호를 입력해주세요.",
      loginOkPrefix: "✅ 성공: ",
      loginFailPrefix: "❌ 실패 (",
      networkErrorPrefix: "❌ 네트워크 오류: ",
      noToken: "토큰이 없습니다.",
      sessionOkPrefix: "✅ 세션 확인: ",
      sessionFailPrefix: "❌ 세션 확인 실패 (",
      needTitle: "제목을 입력해주세요.",
      reportSubmitted: "✅ 제보가 등록되었습니다.",
      resolutionNotePrefix: "교정 메모: ",
    };
  }
  return {
    mainRegionAria: "Admin debug",
    title: "Debug",
    subtitle: "Login test, MVP error reports, resolve flow, and patch deploy in one place.",
    qualityNav: "Quality Events",
    regionMvp: "MVP error report form",
    regionList: "Error reports list",
    regionPatch: "Patch build and deploy",
    regionLogin: "Login test",
    regionSession: "Session check",
    regionTips: "Debug tips",
    mvpTitle: "Error report (MVP)",
    titleLabel: "Title *",
    titlePh: "e.g. Chatbot unsafe reply on specific prompt",
    descLabel: "Description",
    descPh: "Repro steps, expected behavior",
    routeLabel: "Area",
    routeChat: "Chat",
    routeMentor: "Mentor",
    routeArena: "Arena",
    routeOther: "Other",
    contextLabel: "Details (JSON, optional)",
    contextPh: '{"user_message":"...","assistant_message":"..."}',
    submitReport: "Submit report",
    submittingReport: "Submitting…",
    submitReportAriaBusy: "Submitting report",
    submitReportAriaIdle: "Submit report",
    submitBusyRegionAria: "Submitting report",
    listTitle: "Reports",
    filterAll: "All",
    filterOpen: "Open",
    filterResolved: "Resolved",
    filterAllAria: "Show all reports",
    filterOpenAria: "Show open reports only",
    filterResolvedAria: "Show resolved reports only",
    loadingList: "Loading reports…",
    noReports: "No reports yet.",
    resolvedBadge: "Resolved",
    resolutionNotePh: "Resolution note (optional)",
    resolveDone: "Mark resolved",
    resolving: "Working…",
    resolveAriaBusy: "Resolving",
    resolveAriaIdle: "Mark resolved",
    resolvingRegionAria: "Resolving",
    patchTitle: "Patch deploy",
    patchDesc:
      "Runs patch generation (bty-ai-core) and deploy webhook together. Set DEPLOY_WEBHOOK_URL to trigger a real deploy.",
    patchRun: "Build patch & deploy",
    patchRunning: "Running…",
    patchAriaBusy: "Running patch deploy",
    patchAriaIdle: "Build patch and deploy",
    patchBusyRegionAria: "Patch deploy in progress",
    patchOk: "✅ Done",
    patchWarn: "⚠️ Some steps failed",
    loginTitle: "Login test",
    emailLabel: "Email",
    passwordLabel: "Password",
    passwordPh: "Password",
    loginTest: "Test login",
    loginTesting: "Testing…",
    loginTestAriaIdle: "Test login",
    loginTestAriaBusy: "Testing login",
    loginBusyRegionAria: "Login test in progress",
    sessionTitle: "Session",
    sessionCheck: "Check current session",
    sessionCheckAria: "Check current session",
    tipsTitle: "Tips",
    tips1:
      "After filing a report, resolve it from the list, then use “Build patch & deploy” to roll out.",
    tips2:
      "DEPLOY_WEBHOOK_URL: use your Cloudflare Pages deploy hook or similar URL so one click triggers deploy.",
    needCredentials: "Enter email and password.",
    loginOkPrefix: "✅ Success: ",
    loginFailPrefix: "❌ Failed (",
    networkErrorPrefix: "❌ Network error: ",
    noToken: "No token stored.",
    sessionOkPrefix: "✅ Session: ",
    sessionFailPrefix: "❌ Session check failed (",
    needTitle: "Enter a title.",
    reportSubmitted: "✅ Report submitted.",
    resolutionNotePrefix: "Resolution: ",
  };
}
