"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { YouTubePlayer } from "./YouTubePlayer";
import type { CompletionState } from "@/domain/foundry/watch-integrity";
import type { LivingReflection } from "@/domain/foundry/living-reflection";
import { selectReflectionPrompt, selectCheckpointPrompt } from "@/lib/bty/foundry/events/reflectionExpression";
import { keepScreenAwake, type WakeLockController } from "@/lib/native/keepAwake";
import { sanitizeRoomReturn } from "@/lib/bty/foundry/roomReturn";
import type { JourneyElementKind } from "@/domain/foundry/module/journey";

type Locale = "en" | "ko";

/**
 * HOW LONG A LEARNER WAITS BEFORE WE STOP WAITING AND GO AND ASK (Slice R4-R2I).
 *
 * The same bound R4-R2G measured and R4-R2H reused. Twenty seconds is far beyond the handful of
 * sequential round-trips any of these calls performs, so a healthy request is never cut short.
 */
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * `AbortController` + `setTimeout` rather than `AbortSignal.timeout`, because this room opens
 * inside the native shell's WKWebView on whatever iOS the learner happens to carry.
 */
function timeoutSignal(): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(), REQUEST_TIMEOUT_MS);
  return c.signal;
}

/** `settled` = we heard back. `false` means we do NOT know what the server did. */
type PostResult = { ok: boolean; status: number; data: unknown; settled: boolean };

/** Has this learner's training actually finished, according to the server? */
function isCompletedStage(s: { stage?: string } | null): boolean {
  return s?.stage === "completed_awarded" || s?.stage === "completed_claimable";
}

type Stage =
  | "pre_join"
  | "watch"
  | "response"
  | "completed_awarded"
  | "completed_claimable"
  | "closed_incomplete"
  | "closed"
  | "removed"
  | "inactive";

type XpStatus = "awarded" | "claimable" | "owner_ineligible" | "daily_limit" | "none";

import { JourneyReading, type Journey } from "./JourneyReading";
import { terminalIdentityCopy } from "./terminalIdentityCopy";

type Snapshot = {
  event: { title: string; status: "open" | "closed" } | null;
  participant: { display_name: string } | null;
  training: { youtube_video_id: string; completion_prompt: string | null; shared_question: string | null } | null;
  stage: Stage;
  xp_status: XpStatus;
  /** Slice 3.2M-2 — the practice built from THIS training, when one is published. */
  practice?: { id: string; title: string } | null;
  /** Reality-Grounded Journey V1 (Slice 3.2C-B3A). null = legacy Run → video/PDF + completion fallback. */
  journey?: Journey;
  /** This event asks a distinct REFLECT question — server-derived (Slice 3.2R-R8B). */
  reflection_required?: boolean;
  /**
   * R4-R3B1 — the frozen follow-up checkpoint (7 / 30 / null). Carried so the terminal state can
   * say what signing in is FOR. `terminalIdentityCopy` decides what it means; this is raw.
   */
  follow_up_days?: 7 | 30 | null;
};


type Copy = {
  eyebrow: string;
  enterName: string;
  namePlaceholder: string;
  join: string;
  joining: string;
  todaysTraining: string;
  finishVideo: string;
  playerErrorTitle: string;
  playerErrorBody: string;
  playerErrorHint: string;
  carryForward: string;
  responsePlaceholder: string;
  reflectPlaceholder: string;
  reflectError: string;
  sharedHeading: string;
  sharedDisclosure: string;
  sharedPlaceholder: string;
  sharedError: string;
  decisionHeading: string;
  decisionAsk: string;
  decisionDisclosure: string;
  decisionPlaceholder: string;
  decisionError: string;
  complete: string;
  completing: string;
  trainingComplete: string;
  assignmentConnected: string;
  assignmentNoMatch: string;
  savedTitle: string;
  /*
    SHOWN ONLY AFTER A SUCCESSFUL AUTHENTICATED CLAIM (xp === "awarded", open-link entry).

    It used to say "Your reflection is private and available in My Learning." Slice 3.2R-R8C
    measured that live and it was not true: My Learning returns this completed training, but no
    read path in the product returns `learner_reflection_text` at all, and `response_text` is
    fetched there and deliberately not rendered. So the screen was naming the REFLECT answer the
    learner had just written and pointing them somewhere it does not exist.

    It now promises exactly what the button delivers — the training record, in My Learning.
    Reading the reflection back is real product work with its own home (likely Center, where
    private answers already live); it is deferred, and the copy no longer front-runs it.
  */
  savedBody: string;
  continueToBty: string;
  signedInAs: string;
  practiceHeading: string;
  practiceBody: string;
  practiceCta: string;
  accountUnknownEmail: string;
  accountLoading: string;
  continueWithAccount: string;
  useAnotherAccount: string;
  signInToSave: string;
  xpAwarded: string;
  carryOne: string;
  xpClaimable: string;
  saveXp: string;
  saving: string;
  xpDailyLimit: string;
  closedTitle: string;
  closedBody: string;
  endedTitle: string;
  endedBody: string;
  removed: string;
  inactive: string;
  nameError: string;
  responseError: string;
  /*
    R4-R2I — each shown ONLY after a reconcile failed to find the server in the state the
    learner was trying to reach. None claims the server failed while we merely stopped listening.
  */
  joinDidNotGoThrough: string;
  videoNotRecorded: string;
  videoRetry: string;
  completionDidNotGoThrough: string;
  reflectionFailed: string;
  reflectionRetry: string;
  checkpointEyebrow: string;
  checkpointContinue: string;
  reflectionEyebrow: string;
  reflectionLoading: string;
  secWhatEmerged: string;
  secWhereStretched: string;
  secLivingSentence: string;
  secNextInvitation: string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    eyebrow: "FOUNDRY",
    enterName: "Enter your name to join.",
    namePlaceholder: "Your name",
    join: "Join training",
    joining: "Joining…",
    todaysTraining: "TODAY’S TRAINING",
    finishVideo: "Finish the video to continue.",
    playerErrorTitle: "THIS VIDEO CAN’T PLAY HERE",
    playerErrorBody: "This video isn’t available in this training room.",
    playerErrorHint: "Please let the host know.",
    carryForward: "ONE THING TO CARRY FORWARD",
    responsePlaceholder: "Write one thing you will carry forward…",
    reflectPlaceholder: "Write what usually happens…",
    reflectError: "Please answer the reflect question to complete.",
    sharedHeading: "Show what you understood",
    sharedDisclosure: "Your response will be shared with the training host.",
    sharedPlaceholder: "Answer the question above…",
    sharedError: "Please answer the shared question to complete.",
    decisionHeading: "Your decision",
    decisionAsk: "What will you do?",
    decisionDisclosure: "In your own words. This is shared with the training host.",
    decisionPlaceholder: "Next time I will…",
    decisionError: "Please say what you will do to complete.",
    complete: "Complete training",
    completing: "Saving…",
    trainingComplete: "TRAINING COMPLETE",
    assignmentConnected: "Your assigned learning has been connected to this session.",
    assignmentNoMatch: "Your training record was saved. No matching assignment was connected.",
    savedTitle: "Saved to your BTY",
    savedBody: "Your training is saved in My Learning.",
    continueToBty: "Continue to BTY",
    signedInAs: "Signed in as",
    practiceHeading: "Now try it",
    practiceBody: "Practice this in a situation before it happens for real.",
    practiceCta: "Start the practice",
    accountUnknownEmail: "your account",
    accountLoading: "Checking your account…",
    continueWithAccount: "Continue with this account",
    useAnotherAccount: "Use another account",
    signInToSave: "Sign in to save",
    xpAwarded: "+10 Core XP",
    carryOne: "Carry one thing forward.",
    xpClaimable: "10 Core XP is ready to save.",
    saveXp: "Save XP to BTY",
    xpDailyLimit: "Today’s Core XP is already saved. Come back tomorrow.",
    saving: "Saving…",
    closedTitle: "THIS EVENT IS CLOSED",
    closedBody: "New participants can no longer join.",
    endedTitle: "EVENT CLOSED",
    endedBody: "This session has ended.",
    removed: "Your access to this event has ended.",
    inactive: "This invitation is no longer active.",
    nameError: "Please enter your name.",
    responseError: "Please write one line to complete.",
    joinDidNotGoThrough: "We couldn’t join the training. Tap again to try.",
    videoNotRecorded: "We couldn’t record that the video finished.",
    videoRetry: "Save again",
    completionDidNotGoThrough: "That didn’t go through. Tap again to try.",
    reflectionFailed: "We couldn’t prepare your reflection.",
    reflectionRetry: "Show it again",
    checkpointEyebrow: "A MOMENT",
    checkpointContinue: "Continue",
    reflectionEyebrow: "A LIVING REFLECTION",
    reflectionLoading: "Reflecting…",
    secWhatEmerged: "What emerged",
    secWhereStretched: "Where you stretched",
    secLivingSentence: "A living sentence",
    secNextInvitation: "Your next invitation",
  },
  ko: {
    eyebrow: "FOUNDRY",
    enterName: "이름을 입력하고 입장하세요.",
    namePlaceholder: "이름",
    join: "훈련 입장",
    joining: "입장 중…",
    todaysTraining: "오늘의 훈련",
    finishVideo: "영상을 끝까지 보면 계속됩니다.",
    playerErrorTitle: "이 영상은 여기서 재생할 수 없습니다",
    playerErrorBody: "이 영상은 이 훈련 방에서 재생할 수 없습니다.",
    playerErrorHint: "호스트에게 알려주세요.",
    carryForward: "오늘 가지고 갈 한 가지",
    responsePlaceholder: "오늘 가지고 갈 한 가지를 적어주세요…",
    reflectPlaceholder: "평소 어떤 일이 일어나는지 적어 주세요…",
    reflectError: "완료하려면 성찰 질문에 답해 주세요.",
    sharedHeading: "배운 내용을 설명해 주세요",
    sharedDisclosure: "이 답변은 교육 담당자에게 공유됩니다.",
    decisionHeading: "당신의 결정",
    decisionAsk: "무엇을 하시겠습니까?",
    decisionDisclosure: "직접 작성해 주세요. 이 답변은 교육 담당자에게 공유됩니다.",
    decisionPlaceholder: "다음에는 …",
    decisionError: "완료하려면 무엇을 할지 적어 주세요.",
    sharedPlaceholder: "위 질문에 답해 주세요…",
    sharedError: "완료하려면 공유 질문에 답해 주세요.",
    complete: "훈련 완료",
    completing: "저장 중…",
    trainingComplete: "훈련 완료",
    assignmentConnected: "배정된 학습이 이 세션 기록과 연결되었습니다.",
    assignmentNoMatch: "학습 기록이 저장되었습니다. 연결된 배정은 없습니다.",
    savedTitle: "BTY에 저장되었습니다",
    savedBody: "이 교육은 내 학습에 저장되었습니다.",
    continueToBty: "BTY로 계속하기",
    signedInAs: "로그인 계정:",
    practiceHeading: "이제 연습해 보세요",
    practiceBody: "실제로 마주하기 전에, 상황 속에서 연습해 봅니다.",
    practiceCta: "연습 시작",
    accountUnknownEmail: "내 계정",
    accountLoading: "계정을 확인하는 중…",
    continueWithAccount: "이 계정으로 계속하기",
    useAnotherAccount: "다른 계정 사용",
    signInToSave: "로그인하고 저장",
    xpAwarded: "+10 Core XP",
    carryOne: "한 가지를 가지고 가세요.",
    xpClaimable: "10 Core XP를 저장할 수 있습니다.",
    saveXp: "BTY에 XP 저장",
    xpDailyLimit: "오늘의 Core XP는 이미 저장되었습니다. 내일 다시 오세요.",
    saving: "저장 중…",
    closedTitle: "종료된 이벤트입니다",
    closedBody: "더 이상 새로 입장할 수 없습니다.",
    endedTitle: "이벤트가 종료되었습니다",
    endedBody: "이 세션은 끝났습니다.",
    removed: "이 이벤트에 대한 접근이 종료되었습니다.",
    inactive: "이 초대는 더 이상 유효하지 않습니다.",
    nameError: "이름을 입력해 주세요.",
    joinDidNotGoThrough: "훈련에 참여하지 못했습니다. 다시 눌러 주세요.",
    videoNotRecorded: "영상을 끝까지 봤다는 기록을 저장하지 못했습니다.",
    videoRetry: "다시 시도",
    completionDidNotGoThrough: "전송되지 않았습니다. 다시 눌러 주세요.",
    reflectionFailed: "성찰을 준비하지 못했습니다.",
    reflectionRetry: "다시 보기",
    responseError: "완료하려면 한 줄을 적어주세요.",
    checkpointEyebrow: "잠깐",
    checkpointContinue: "계속하기",
    reflectionEyebrow: "리빙 리플렉션",
    reflectionLoading: "성찰을 준비하고 있어요…",
    secWhatEmerged: "떠오른 것",
    secWhereStretched: "당신이 뻗어간 곳",
    secLivingSentence: "살아있는 한 문장",
    secNextInvitation: "내일의 초대",
  },
};

function resolveLocale(): Locale {
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ko")) return "ko";
  return "en";
}

function Frame({ children }: { children: React.ReactNode }) {
  // Slice 3.1B-3E.1 (contract C): when the Room was opened from a Required assignment it
  // carries a sanitized same-origin `?return=/{locale}/app…`. Show a visible "Back to Foundry"
  // on EVERY state, not dependent on browser history. Unsafe/external returns → no control.
  const [returnTarget] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? sanitizeRoomReturn(new URLSearchParams(window.location.search).get("return"))
      : null,
  );
  const backLabel = returnTarget?.startsWith("/ko/") ? "← 파운드리로 돌아가기" : "← Back to Foundry";
  return (
    <main
      className="flex min-h-[100dvh] flex-col bg-[#0B1F3A] text-white antialiased"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6">
        {returnTarget ? (
          <a
            href={returnTarget}
            data-testid="room-back-to-foundry"
            className="self-start pb-3 pt-1 text-sm text-white/55 hover:text-white/85"
          >
            {backLabel}
          </a>
        ) : null}
        {children}
      </div>
    </main>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium uppercase tracking-[0.18em] text-[#C9A66B]/90">{children}</span>
  );
}

const api = (token: string, path = "") =>
  `/api/bty/foundry/public/${encodeURIComponent(token)}${path}`;

/** Best-effort device IANA tz for the follow-up due-date resolution (Slice 3.1B-3K). Capture-only. */
function deviceTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export default function FoundryJoinClient({ token }: { token: string }) {
  const [locale, setLocale] = useState<Locale>("en");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [response, setResponse] = useState("");
  // Shared Understanding answer (Slice 3.1B-3G) — SEPARATE from the private `response`.
  const [sharedResponse, setSharedResponse] = useState("");
  const [decisionResponse, setDecisionResponse] = useState("");
  // The REFLECT answer (Slice 3.2R-R8B) — a different question, a different column, its own state.
  const [reflectResponse, setReflectResponse] = useState("");
  const [reflectError, setReflectError] = useState(false);
  const [decisionError, setDecisionError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [responseError, setResponseError] = useState(false);
  const [sharedError, setSharedError] = useState(false);
  const [playerError, setPlayerError] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // Slice 3.1B-3D: the learner claimed their own assigned learning for this session.
  const [assignmentConnected, setAssignmentConnected] = useState(false);
  // 3.1B-3D fix: neutral "no matching assignment" (wrong account on an assigned event) —
  // never reveals the assignee. And the currently authenticated account, so the learner can
  // SEE and choose which account claims (the external-browser session may differ from the app).
  const [assignmentNoMatch, setAssignmentNoMatch] = useState(false);
  const [account, setAccount] = useState<{ email: string | null } | null | "loading">("loading");
  // Open-link vs assigned entry (Slice 3.1B-3H): an assigned learner arrives with a sanitized
  // `?return=/{locale}/app…` (→ "Back to Foundry"); an open-link web learner has none, so after a
  // successful authenticated claim we show the "Saved to your BTY" handoff into the app shell.
  const [roomReturn] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? sanitizeRoomReturn(new URLSearchParams(window.location.search).get("return"))
      : null,
  );
  const [checkpoint, setCheckpoint] = useState<{ index: number; resume: () => void } | null>(null);
  const [reflection, setReflection] = useState<LivingReflection | null>(null);
  const [reflectionLoading, setReflectionLoading] = useState(false);
  /** Shown only after a reconcile confirmed the state the learner wanted was NOT reached. */
  const [joinError, setJoinError] = useState(false);
  const [videoEvidenceError, setVideoEvidenceError] = useState(false);
  const [videoRetrying, setVideoRetrying] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [reflectionError, setReflectionError] = useState(false);
  const busyRef = useRef(false);
  const autoClaimedRef = useRef(false);
  const completionStateRef = useRef<CompletionState | null>(null);
  const wakeRef = useRef<WakeLockController | null>(null);
  const reflectionRequestedRef = useRef(false);

  const t = COPY[locale];
  /*
    R4-R3B1 — decided by the domain authority from the frozen snapshot, never by this component.
    Read here (not inside the branch) so the same value is available wherever the terminal state
    is rendered, and so a missing field degrades to "no follow-up promised" rather than throwing.
  */
  const identity = terminalIdentityCopy(snapshot?.follow_up_days, locale);

  useEffect(() => setLocale(resolveLocale()), []);

  /** Refresh and RETURN what the server said, so a caller can reconcile against it. */
  const load = useCallback(async (): Promise<Snapshot | null> => {
    try {
      const res = await fetch(api(token), { credentials: "include", cache: "no-store", signal: timeoutSignal() });
      const next = (await res.json()) as Snapshot;
      setSnapshot(next);
      return next;
    } catch {
      /* PRESERVE the live room: one refresh that did not answer is not an inactive event. */
      setSnapshot((prev) => prev ?? { event: null, participant: null, training: null, stage: "inactive", xp_status: "none" });
      return null;
    } finally {
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = useCallback(
    async (path: string, body?: unknown): Promise<PostResult> => {
      try {
        const res = await fetch(api(token, path), {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
          signal: timeoutSignal(),
        });
        const data = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, data, settled: true };
      } catch {
        /*
          We stopped waiting, or the connection never came back. NOT a failure — the server may
          well have acted. Every caller that cares must go and ask rather than guess. Catching
          here also removes the unhandled rejection the fire-and-forget callers used to produce.
        */
        return { ok: false, status: 0, data: null, settled: false };
      }
    },
    [token],
  );

  const applyResult = useCallback((data: unknown) => {
    const d = data as
      | (Partial<Snapshot> & { ok?: boolean; stage?: Stage; assignmentClaim?: string })
      | null;
    if (d?.ok && d.stage) {
      /*
        MERGE, NEVER REBUILD — the same defect R8A-R1 found on the document client (3.2R-R8B).
        This rebuilt the snapshot field by field and never named `journey`, so any POST result
        that came back through here silently deleted the published program from a YouTube
        learner's screen. It was not reported, but it is the identical shape, and `journey` has
        been in this type since 3.2C. A partial payload must never remove what is on screen.
      */
      setSnapshot((prev) => ({
        event: d.event ?? null,
        participant: d.participant ?? null,
        training: d.training ?? null,
        journey: d.journey ?? prev?.journey ?? null,
        reflection_required: d.reflection_required ?? prev?.reflection_required ?? false,
        stage: d.stage!,
        xp_status: d.xp_status ?? "none",
      }));
      // Slice 3.1B-3D: show the narrow connection message ONLY on a fresh claim of the
      // learner's OWN assignment. Every other outcome (no match / conflict) is silent — no
      // alarm, no disclosure of another assignee.
      if (d.assignmentClaim === "claimed" || d.assignmentClaim === "already_claimed") {
        setAssignmentConnected(true);
        setAssignmentNoMatch(false);
      } else if (d.assignmentClaim === "no_matching_assignment" || d.assignmentClaim === "claim_conflict") {
        // Neutral: this event HAS assignments but not for the signed-in account. Never
        // reveal the assignee. 'not_applicable' (open-link) stays silent.
        setAssignmentNoMatch(true);
        setAssignmentConnected(false);
      }
      return true;
    }
    return false;
  }, []);

  // --- actions ---
  const onJoin = useCallback(async () => {
    if (busyRef.current) return;
    if (name.trim().length < 1) return setNameError(true);
    busyRef.current = true;
    setBusy(true);
    setNameError(false);
    setJoinError(false);
    try {
      const { ok, data, settled } = await post("/join", { display_name: name.trim() });
      const d = data as { error?: string } | null;
      if (ok) {
        await load();
      } else if (settled && (d?.error === "name_required" || d?.error === "name_too_long")) {
        setNameError(true);
      } else {
        /*
          Either an unrecognised refusal or we stopped waiting. Joining is idempotent from the
          learner's side — the participant session cookie identifies them — so ASK whether they
          are in the room before accusing anything, and never create a second participant by
          retrying blind.
        */
        const reconciled = await load();
        if (!reconciled?.participant) setJoinError(true);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [name, post, load]);

  const onVideoStarted = useCallback(() => {
    /*
      DELIBERATELY SILENT, AND MEASURED BEFORE BEING LEFT THAT WAY (Slice R4-R2I).

      `video_started_at` is written once (`.is("video_started_at", null)`) and is read by exactly
      one thing: the HOST's roster label "watching". It gates NO learner transition — the public
      stage projection reads `engagementCompleted`, which is `video_completed_at`. And
      `videoComplete` writes `video_started_at: prog.video_started_at ?? now`, so a lost start is
      BACKFILLED by the very next durable write.

      So losing this can never block the learner, and telling them about it would be noise about
      something that repairs itself. `post` now catches internally, which removes the unhandled
      rejection this used to produce; that was the only real defect here.
    */
    void post("/progress/start");
  }, [post]);

  /**
   * THE EXPOSURE GATE, AND IT ONLY FIRES ONCE (Slice R4-R2I).
   *
   * The player calls this when the video ends. Unlike the PDF room's heartbeats there is no
   * second chance: if this write is lost, the learner has watched the whole video and the room
   * simply never advances — no spinner, no message, nothing to press. That was the measured
   * silent dead end.
   *
   * The server write is idempotent (`if (!prog.video_completed_at)` plus
   * `.is("video_completed_at", null)`), so asking again is free. What we must NOT do is decide
   * client-side that the video finished: the evidence stays the server's to record.
   */
  const submitVideoComplete = useCallback(async () => {
    const { data, settled, ok } = await post("/progress/video-complete");
    if (settled && ok && applyResult(data)) {
      setVideoEvidenceError(false);
      return;
    }
    // Uncertain or refused → ask the server what it actually holds.
    const reconciled = await load();
    if (reconciled && reconciled.stage !== "watch") {
      setVideoEvidenceError(false);
      return;
    }
    setVideoEvidenceError(true);
  }, [post, applyResult, load]);

  const onVideoEnded = useCallback(async () => {
    await submitVideoComplete();
  }, [submitVideoComplete]);

  /** The learner's own retry of the exposure write. Re-requests; never asserts. */
  const onRetryVideoComplete = useCallback(async () => {
    if (videoRetrying) return;
    setVideoRetrying(true);
    try {
      await submitVideoComplete();
    } finally {
      setVideoRetrying(false);
    }
  }, [submitVideoComplete, videoRetrying]);

  const sharedQuestion = snapshot?.training?.shared_question ?? null;
  /*
    WHAT BTY PROPOSED vs WHAT THE LEARNER DECIDES (Slice 3.2M-1).

    `actionDecisionContext` is BTY's sentence — shown as context, never prefilled into the answer.
    A decision someone read is not a decision they made, and the field would be worthless as
    evidence if it arrived already filled in.
  */
  const actionDecisionContext =
    snapshot?.journey?.elements.find((e) => e.kind === "action_decision")?.content ?? null;
  /*
    WHETHER A REFLECT ANSWER IS OWED IS THE SERVER'S ANSWER, NOT THIS COMPONENT'S (3.2R-R8B).
    The same flag, the same domain gate and the same column as the document learner: REFLECTED
    is one evidence authority and must not come to mean two things per content type.
  */
  const reflectRequired = Boolean(snapshot?.reflection_required);
  const onComplete = useCallback(async () => {
    if (busyRef.current) return;
    if (response.trim().length < 1) return setResponseError(true);
    // A configured shared question requires a non-empty shared answer BEFORE completion.
    if (sharedQuestion && sharedResponse.trim().length < 1) return setSharedError(true);
    // The program asked them to decide something — completing without one would make the record
    // claim a decision that was never made. The server enforces this too.
    if (actionDecisionContext && decisionResponse.trim().length < 1) return setDecisionError(true);
    if (reflectRequired && reflectResponse.trim().length < 1) return setReflectError(true);
    busyRef.current = true;
    setBusy(true);
    setResponseError(false);
    setSharedError(false);
    setDecisionError(false);
    setSubmitError(false);
    try {
      const { ok, data, settled } = await post("/progress/complete", {
        response_text: response.trim(),
        ...(reflectRequired ? { reflection_response: reflectResponse.trim() } : {}),
        ...(sharedQuestion ? { shared_response: sharedResponse.trim() } : {}),
        ...(actionDecisionContext ? { decision_response: decisionResponse.trim() } : {}),
        tz: deviceTz(),
      });
      /*
        THE RECONCILE (Slice R4-R2I, the rule R4-R2G measured and R4-R2H reused).

        A completion that does not answer in time has NOT necessarily failed. Server completion
        is idempotent — an early return once `completed_at` is set, plus `.is("completed_at",
        null)` on the update and `.is("xp_awarded_at", null)` on the award — so asking again is
        free and can neither double-complete nor double-award. We ask, and we believe the answer.
      */
      if (!settled) {
        const reconciled = await load();
        if (!isCompletedStage(reconciled)) setSubmitError(true);
        return;
      }
      const d = data as { error?: string } | null;
      if (ok) applyResult(data);
      else if (d?.error === "response_required" || d?.error === "response_too_long") setResponseError(true);
      else if (d?.error === "shared_response_required" || d?.error === "shared_response_too_long") setSharedError(true);
      else if (d?.error === "reflection_required") setReflectError(true);
      else if (d?.error === "decision_required" || d?.error === "response_too_long") setDecisionError(true);
      else {
        // An unrecognised refusal: reconcile before saying anything, then say only what is true.
        const reconciled = await load();
        if (!isCompletedStage(reconciled)) setSubmitError(true);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [response, sharedResponse, sharedQuestion, decisionResponse, actionDecisionContext, reflectRequired, reflectResponse, post, applyResult, load]);

  const onClaim = useCallback(
    async (silent: boolean) => {
      /*
        A SILENT CLAIM MUST NEVER TAKE THE INTERACTION LOCK (Slice R4-R2I, the R4-R2H rule).

        `busyRef` was acquired regardless of `silent`, and every handler opens with
        `if (busyRef.current) return`. The assignment-reconcile claim that fires on
        `completed_awarded` is silent, so a stalled one disabled every control in the room while
        `setBusy` was deliberately skipped — no spinner, nothing on screen to explain it.

        The lock now belongs to the VISIBLE interaction only. `reconciledRef` still fires the
        silent path once per mount and the server claim is idempotent, so nothing was traded away.
      */
      if (silent) {
        const { ok, data } = await post("/progress/claim-xp", { tz: deviceTz() });
        if (ok) applyResult(data);
        return;
      }
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        const { ok, status, settled, data } = await post("/progress/claim-xp", { tz: deviceTz() });
        if (ok) applyResult(data);
        else if (status === 401) {
          // Need to sign in first — return here afterward.
          const next = encodeURIComponent(`/f/${token}`);
          window.location.href = `/${locale}/bty/login?next=${next}`;
        } else if (!settled) {
          // Never a false failure over a claim that may have landed — ask instead.
          await load();
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [post, applyResult, load, token, locale],
  );

  // 3.1B-3D fix: do NOT auto-claim. When the learner reaches the claimable state, load the
  // CURRENTLY authenticated account so they can see and choose it before claiming. The room
  // may run in an external browser whose Supabase session differs from the BTY app, so the
  // account must be shown here, not inferred from the app.
  useEffect(() => {
    if (snapshot?.stage !== "completed_claimable" || autoClaimedRef.current) return;
    autoClaimedRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        /*
          R4-R2J — the last unbounded request in this client. It is already caught, so it could
          never throw; but with no bound a stalled session read left `account` on "loading"
          forever, and the terminal render gates BOTH the claim control and the sign-in button
          behind that. The learner reached TRAINING COMPLETE and could do nothing with their XP.

          One line, and no new state or copy is needed: the existing catch sets `account = null`,
          which is exactly the signed-out branch — "Sign in to save". A timeout now degrades to
          the correct actionable path instead of an indefinite wait.
        */
        const res = await fetch("/api/auth/session", {
          credentials: "include",
          cache: "no-store",
          signal: timeoutSignal(),
        });
        const data = (await res.json().catch(() => ({}))) as { user?: { email?: string | null } | null };
        if (!cancelled) setAccount(data.user ? { email: data.user.email ?? null } : null);
      } catch {
        if (!cancelled) setAccount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [snapshot?.stage]);

  // 3.1B-3D (fix): if the session is already XP-awarded but we don't yet know the assignment
  // result (e.g. XP was awarded by a prior/stale claim before the assignment could connect),
  // do ONE silent claim-xp to reconcile the assignment. Idempotent — no double XP, and the
  // server now connects the assignment on the early-return path.
  const reconciledRef = useRef(false);
  useEffect(() => {
    if (snapshot?.stage !== "completed_awarded") return;
    if (assignmentConnected || assignmentNoMatch || reconciledRef.current) return;
    reconciledRef.current = true;
    void onClaim(true);
  }, [snapshot?.stage, assignmentConnected, assignmentNoMatch, onClaim]);

  const switchAccount = useCallback(() => {
    // Sign out (middleware clears cookies at /bty/logout) then return here to sign in as a
    // different account. Account switching = logout + login for Supabase sessions.
    const next = encodeURIComponent(`/f/${token}`);
    window.location.href = `/${locale}/bty/logout?next=${next}`;
  }, [token, locale]);

  const goSignIn = useCallback(() => {
    const next = encodeURIComponent(`/f/${token}`);
    window.location.href = `/${locale}/bty/login?next=${next}`;
  }, [token, locale]);

  // Keep the screen awake while the video plays; release the moment it stops.
  useEffect(() => {
    if (isPlaying && !wakeRef.current) {
      wakeRef.current = keepScreenAwake();
    } else if (!isPlaying && wakeRef.current) {
      wakeRef.current.release();
      wakeRef.current = null;
    }
    return () => {
      if (wakeRef.current) {
        wakeRef.current.release();
        wakeRef.current = null;
      }
    };
  }, [isPlaying]);

  // Once the training is complete, ask for the Living Reflection (once). The
  // client-computed CompletionState (ephemeral) is sent as meaning; the server
  // grounds and persists. Idempotent — a returning visitor gets the stored one.
  /**
   * LIVING REFLECTION, BOUNDED AND RETRYABLE (Slice R4-R2I).
   *
   * MEASURED before touching it: `reflectionLoading` already cleared in its `finally`, so it
   * could not hang — but the request was unbounded and `post` rethrew, so a rejected one became
   * an UNHANDLED REJECTION, and `reflectionRequestedRef` was set BEFORE the call so it could
   * never be retried. The learner's reflection simply never appeared, silently and permanently.
   *
   * Nothing about what a reflection IS changes here: same endpoint, same payload, same
   * completion-state input, same gate (a journey-enabled Run still does not ask for one). Only
   * the failure has a shape now.
   */
  const requestReflection = useCallback(async () => {
    setReflectionLoading(true);
    setReflectionError(false);
    try {
      const { data, settled, ok } = await post("/reflection", {
        completion_state: completionStateRef.current,
        locale,
      });
      const d = data as { ok?: boolean; reflection?: LivingReflection } | null;
      if (settled && ok && d?.ok && d.reflection) {
        setReflection(d.reflection);
        return;
      }
      setReflectionError(true);
    } finally {
      setReflectionLoading(false);
    }
  }, [post, locale]);

  const completedStage = snapshot?.stage === "completed_awarded" || snapshot?.stage === "completed_claimable";
  useEffect(() => {
    // Living Reflection boundary (Slice 3.2C-B3A): a Journey-enabled Run must NOT
    // invoke the ungrounded runtime Living Reflection (which could introduce facts
    // outside the approved Journey). Its grounded reflection element is already shown
    // in the reading sequence. Legacy Runs keep the existing runtime reflection.
    if (!completedStage || reflectionRequestedRef.current || snapshot?.journey) return;
    reflectionRequestedRef.current = true;
    void requestReflection();
  }, [completedStage, snapshot?.journey, requestReflection]);

  const onContinueCheckpoint = useCallback(() => {
    checkpoint?.resume();
    setCheckpoint(null);
  }, [checkpoint]);

  if (!loaded || !snapshot) {
    return (
      <Frame>
        <div aria-hidden className="flex-1" />
      </Frame>
    );
  }

  const title = snapshot.event?.title ?? "";
  const stage = snapshot.stage;

  if (stage === "inactive") return <Frame><Centered>{t.inactive}</Centered></Frame>;
  if (stage === "removed") return <Frame><Centered>{t.removed}</Centered></Frame>;

  if (stage === "closed") {
    return (
      <Frame>
        <Block eyebrow={t.closedTitle} title={title} body={t.closedBody} />
      </Frame>
    );
  }

  if (stage === "closed_incomplete") {
    return (
      <Frame>
        <Block eyebrow={t.endedTitle} title={title} body={t.endedBody} />
      </Frame>
    );
  }

  // Completed family — the SAME "training complete" surface; XP presentation is
  // driven by xp_status (awarded / claimable / owner-ineligible / daily-limit).
  // Owner-ineligible and daily-limit are shown calmly — never as an error.
  if (stage === "completed_awarded" || stage === "completed_claimable") {
    const xp = snapshot.xp_status;
    return (
      <Frame>
        <div className="btyFadeIn flex flex-1 flex-col justify-center gap-6 py-6">
          {/* The Living Reflection — a mirror, not a score. Shown above the XP. */}
          {reflection ? (
            <section className="flex flex-col gap-4">
              <Eyebrow>{t.reflectionEyebrow}</Eyebrow>
              <ReflectionSection label={t.secWhatEmerged} body={reflection.whatEmerged} />
              <ReflectionSection label={t.secWhereStretched} body={reflection.whereYouStretched} />
              <p className="border-l-2 border-[#C9A66B]/60 pl-4 text-lg font-medium italic leading-relaxed text-white">
                “{reflection.livingSentence}”
              </p>
              <ReflectionSection label={t.secNextInvitation} body={reflection.nextInvitation} />
            </section>
          ) : reflectionLoading ? (
            <p className="text-sm leading-6 text-white/45">{t.reflectionLoading}</p>
          ) : reflectionError ? (
            <div className="flex items-center justify-between gap-3" data-testid="reflection-error">
              <span className="text-sm leading-6 text-white/45">{t.reflectionFailed}</span>
              <button
                type="button"
                onClick={() => void requestReflection()}
                data-testid="reflection-retry"
                className="shrink-0 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80"
              >
                {t.reflectionRetry}
              </button>
            </div>
          ) : null}

          <div className="flex flex-col gap-4">
          <Eyebrow>{t.trainingComplete}</Eyebrow>
          {assignmentConnected ? (
            <p className="rounded-lg border border-[#C9A66B]/30 bg-[#C9A66B]/[0.08] px-4 py-2.5 text-sm leading-6 text-[#E5B769]" data-testid="assignment-connected">
              {t.assignmentConnected}
            </p>
          ) : assignmentNoMatch ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm leading-6 text-white/60" data-testid="assignment-no-match">
              {t.assignmentNoMatch}
            </p>
          ) : null}
          {xp === "awarded" ? (
            <>
              <p className="text-3xl font-semibold text-[#C9A66B]">{t.xpAwarded}</p>
              <p className="text-sm leading-6 text-white/60">{t.carryOne}</p>
            </>
          ) : xp === "claimable" ? (
            <>
              {/*
                R4-R3B1 — the reason to sign in, before the reward for signing in. `identity` is
                built from the FROZEN `follow_up_days`; when the Host set no checkpoint it carries
                no follow-up sentence and this block degrades to exactly the previous screen plus
                one true line about the completion already being safe.
              */}
              <p className="text-sm leading-6 text-white/70" data-testid="terminal-completion-saved">
                {identity.completionSaved}
              </p>
              {identity.followUp ? (
                <div className="flex flex-col gap-1" data-testid="terminal-followup">
                  <p className="text-base leading-6 text-white/85">{identity.followUp.meaning}</p>
                  <p className="text-base leading-6 text-white/85">{identity.followUp.signInReason}</p>
                  <p className="text-sm leading-6 text-white/50" data-testid="terminal-xp-secondary">
                    {identity.followUp.xpSecondary}
                  </p>
                </div>
              ) : (
                <p className="text-base leading-6 text-white/80">{t.xpClaimable}</p>
              )}
              {/* 3.1B-3D fix: account is OBSERVABLE + chosen before claiming. */}
              {account === "loading" ? (
                <p className="text-sm text-white/45" data-testid="claim-account-loading">{t.accountLoading}</p>
              ) : account ? (
                <div className="flex flex-col gap-2" data-testid="claim-account">
                  <p className="text-sm text-white/70">
                    {t.signedInAs}{" "}
                    <span className="font-medium text-white/90" data-testid="claim-account-email">
                      {account.email ?? t.accountUnknownEmail}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => onClaim(false)}
                    disabled={busy}
                    data-testid="claim-continue"
                    className="rounded-xl bg-[#C9A66B] px-5 py-3.5 text-base font-semibold text-[#0B1F3A] transition-opacity disabled:opacity-60"
                  >
                    {busy ? t.saving : t.continueWithAccount}
                  </button>
                  <button
                    type="button"
                    onClick={switchAccount}
                    disabled={busy}
                    data-testid="claim-switch-account"
                    className="text-sm text-white/50 underline underline-offset-4 hover:text-white/70"
                  >
                    {t.useAnotherAccount}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={goSignIn}
                  data-testid="claim-signin"
                  className="rounded-xl bg-[#C9A66B] px-5 py-3.5 text-base font-semibold text-[#0B1F3A]"
                >
                  {t.signInToSave}
                </button>
              )}
            </>
          ) : xp === "daily_limit" ? (
            <p className="text-sm leading-6 text-white/60">{t.xpDailyLimit}</p>
          ) : (
            // owner_ineligible / none — completion stands, quietly.
            <p className="text-sm leading-6 text-white/60">{t.carryOne}</p>
          )}
          {/* Open-link → BTY handoff (Slice 3.1B-3H): shown ONLY after a successful authenticated
              claim (ownership reconciled: xp awarded to this account) and ONLY for an open-link
              entry (no assigned `?return`). Navigation is non-mutating — it never re-runs completion
              or claim. Assigned learners keep the Frame's "Back to Foundry". */}
          {/*
            NOW TRY IT (Slice 3.2M-2). The training and its practice were already bound in
            data by `source_event_id`; they were never connected in anyone's journey. Shown
            only when a practice actually exists AND this completion belongs to an account —
            an anonymous completion cannot be attributed to a person, so offering them a
            practice whose result nobody could credit would be a dead end dressed as a step.
          */}
          {snapshot.practice && xp === "awarded" ? (
            <div className="rounded-xl border border-[#C9A66B]/40 bg-[#C9A66B]/[0.06] p-4" data-testid="now-try-it">
              <Eyebrow>{t.practiceHeading}</Eyebrow>
              <p className="mt-2 text-sm leading-6 text-white/85">{t.practiceBody}</p>
              <a
                href={`/${locale}/bty-arena/practice/${encodeURIComponent(snapshot.practice.id)}`}
                data-testid="now-try-it-link"
                className="mt-3 inline-block rounded-xl bg-[#C9A66B] px-5 py-3 text-sm font-semibold text-[#0B1F3A]"
              >
                {t.practiceCta}
              </a>
            </div>
          ) : null}

          {!roomReturn && xp === "awarded" ? (
            <div
              data-testid="saved-to-bty"
              className="mt-2 flex flex-col gap-2 rounded-xl border border-[#C9A66B]/25 bg-[#C9A66B]/[0.06] px-4 py-3"
            >
              <p className="text-base font-semibold text-[#C9A66B]">{t.savedTitle}</p>
              <p className="text-sm leading-6 text-white/70">{t.savedBody}</p>
              <a
                href={`/${locale}/app?tab=foundry&view=my-learning`}
                data-testid="continue-to-bty"
                className="mt-1 self-start rounded-xl bg-[#C9A66B] px-5 py-3 text-base font-semibold text-[#0B1F3A]"
              >
                {t.continueToBty}
              </a>
            </div>
          ) : null}
          </div>
        </div>
      </Frame>
    );
  }

  if (stage === "watch" && snapshot.training) {
    // A player error (e.g. 101/150 owner-disabled embedding) keeps the response
    // LOCKED — no ENDED fires, so no video-complete / completion / XP. We surface
    // a calm message and never offer a "watch on YouTube" completion path.
    if (playerError !== null) {
      return (
        <Frame>
          <div className="btyFadeIn flex flex-1 flex-col justify-center gap-3">
            <Eyebrow>{t.playerErrorTitle}</Eyebrow>
            <p className="text-base leading-6 text-white/80">{t.playerErrorBody}</p>
            <p className="text-sm leading-6 text-white/50">{t.playerErrorHint}</p>
            {/* Short diagnostic reference (raw YouTube error code) — display only;
                does NOT unlock the response or XP. */}
            <p className="mt-2 text-xs text-white/30">Reference: YT-{playerError}</p>
          </div>
        </Frame>
      );
    }
    const videoId = snapshot.training.youtube_video_id;
    return (
      <Frame>
        <div className="btyFadeIn flex flex-1 flex-col justify-center gap-4">
          {/* Immersive mode: while playing, the surrounding UI recedes so only the
              training remains. It returns the moment playback pauses or ends. */}
          <div
            className="flex flex-col gap-2 transition-opacity duration-500"
            style={{ opacity: isPlaying ? 0 : 1, pointerEvents: isPlaying ? "none" : "auto" }}
            aria-hidden={isPlaying}
          >
            <Eyebrow>{t.todaysTraining}</Eyebrow>
            <h1 className="text-xl font-semibold leading-snug text-white">{title}</h1>
            {/* Reality-Grounded Journey (Slice 3.2C-B3A): the Host-approved structured
                context the learner reads before/around the material. Absent → legacy. */}
            <JourneyReading
              journey={snapshot.journey ?? null}
              locale={locale}
              reflection={
                reflectRequired
                  ? {
                      value: reflectResponse,
                      onChange: (v) => {
                        setReflectResponse(v);
                        setReflectError(false);
                      },
                      error: reflectError,
                      placeholder: t.reflectPlaceholder,
                      errorText: t.reflectError,
                    }
                  : null
              }
            />
          </div>
          <YouTubePlayer
            videoId={videoId}
            onStarted={onVideoStarted}
            onEnded={onVideoEnded}
            onError={(_kind, code) => setPlayerError(code)}
            onIntegrity={(state) => {
              completionStateRef.current = state;
            }}
            onPlayingChange={setIsPlaying}
            onCheckpoint={(index, resume) => setCheckpoint({ index, resume })}
          />
          {/*
            THE ONE-SHOT GATE, MADE RECOVERABLE (Slice R4-R2I). Shown only after the write was
            attempted AND a reconcile found the server still holding no exposure. A learner who
            has watched the whole video is never left with nothing to press.
          */}
          {videoEvidenceError && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-300/30 bg-amber-300/[0.06] px-3 py-2">
              <span className="text-xs leading-5 text-amber-200/90" data-testid="video-not-recorded">
                {t.videoNotRecorded}
              </span>
              <button
                type="button"
                onClick={() => void onRetryVideoComplete()}
                disabled={videoRetrying}
                data-testid="video-retry"
                className="shrink-0 rounded-lg border border-amber-300/40 px-3 py-1.5 text-xs font-medium text-amber-100 disabled:opacity-60"
              >
                {t.videoRetry}
              </button>
            </div>
          )}
          <p
            className="text-sm leading-6 text-white/55 transition-opacity duration-500"
            style={{ opacity: isPlaying ? 0 : 1 }}
            aria-hidden={isPlaying}
          >
            {t.finishVideo}
          </p>
        </div>

        {checkpoint ? (
          <div className="btyFadeIn fixed inset-0 z-50 flex items-center justify-center bg-[#0B1F3A]/92 px-6 backdrop-blur-sm">
            <div className="flex w-full max-w-sm flex-col gap-5 text-center">
              <Eyebrow>{t.checkpointEyebrow}</Eyebrow>
              <p className="text-lg font-medium leading-relaxed text-white">
                {selectCheckpointPrompt(videoId, checkpoint.index, locale)}
              </p>
              <button
                type="button"
                onClick={onContinueCheckpoint}
                className="self-center rounded-xl bg-[#C9A66B] px-6 py-3 text-base font-semibold text-[#0B1F3A]"
              >
                {t.checkpointContinue}
              </button>
            </div>
          </div>
        ) : null}
      </Frame>
    );
  }

  if (stage === "response") {
    return (
      <Frame>
        <div className="btyFadeIn flex flex-1 flex-col justify-center gap-4">
          <Eyebrow>{t.carryForward}</Eyebrow>
          {snapshot.training?.completion_prompt ? (
            <p className="text-lg font-medium leading-relaxed text-white">
              {snapshot.training.completion_prompt}
            </p>
          ) : null}
          {/* Anti-summary framing: a personal-reflection question the video alone
              can't answer — never "what was the main point?". */}
          <p className="text-sm leading-6 text-[#C9A66B]/85">
            {selectReflectionPrompt(snapshot.training?.youtube_video_id ?? token, locale)}
          </p>
          <textarea
            rows={4}
            maxLength={1000}
            value={response}
            onChange={(e) => {
              setResponse(e.target.value);
              if (responseError) setResponseError(false);
            }}
            placeholder={t.responsePlaceholder}
            aria-label={t.carryForward}
            aria-invalid={responseError}
            className="w-full resize-none rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base leading-6 text-white placeholder:text-white/30 outline-none focus:border-[#C9A66B]/60"
          />
          {responseError ? <p className="text-xs text-white/50">{t.responseError}</p> : null}
          {submitError ? (
            <p className="text-xs text-red-300" data-testid="submit-error">
              {t.completionDidNotGoThrough}
            </p>
          ) : null}

          {actionDecisionContext ? (
            /* YOUR DECISION (Slice 3.2M-1). BTY's proposed decision is CONTEXT above the field;
               the answer is the learner's own, never prefilled, and required to complete. */
            <div className="rounded-xl border border-[#C9A66B]/40 bg-[#C9A66B]/[0.06] p-4" data-testid="decision-section">
              <Eyebrow>{t.decisionHeading}</Eyebrow>
              <p className="mt-2 text-sm leading-6 text-white/70" data-testid="decision-context">{actionDecisionContext}</p>
              <p className="mt-3 text-sm font-medium leading-6 text-white/90">{t.decisionAsk}</p>
              <p className="mt-1 text-xs text-[#C9A66B]/90" data-testid="decision-disclosure">{t.decisionDisclosure}</p>
              <textarea
                rows={3}
                maxLength={1000}
                value={decisionResponse}
                onChange={(e) => {
                  setDecisionResponse(e.target.value);
                  if (decisionError) setDecisionError(false);
                }}
                placeholder={t.decisionPlaceholder}
                aria-label={t.decisionAsk}
                aria-invalid={decisionError}
                data-testid="decision-input"
                className="mt-3 w-full resize-none rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base leading-6 text-white placeholder:text-white/30 outline-none focus:border-[#C9A66B]/60"
              />
              {decisionError ? <p className="mt-2 text-xs text-red-300" data-testid="decision-error">{t.decisionError}</p> : null}
            </div>
          ) : null}

          {sharedQuestion ? (
            /* Shared Understanding — VISUALLY + semantically separate from the private reflection
               above. The learner is explicitly told this answer is shared with the Host. */
            <div className="rounded-xl border border-[#C9A66B]/40 bg-[#C9A66B]/[0.06] p-4" data-testid="shared-understanding-section">
              <Eyebrow>{t.sharedHeading}</Eyebrow>
              <p className="mt-2 text-sm leading-6 text-white/90">{sharedQuestion}</p>
              <p className="mt-1 text-xs text-[#C9A66B]/90" data-testid="shared-disclosure">{t.sharedDisclosure}</p>
              <textarea
                rows={3}
                maxLength={1000}
                value={sharedResponse}
                onChange={(e) => {
                  setSharedResponse(e.target.value);
                  if (sharedError) setSharedError(false);
                }}
                placeholder={t.sharedPlaceholder}
                aria-label={t.sharedHeading}
                aria-invalid={sharedError}
                data-testid="shared-understanding-input"
                className="mt-3 w-full resize-none rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base leading-6 text-white placeholder:text-white/30 outline-none focus:border-[#C9A66B]/60"
              />
              {sharedError ? <p className="mt-2 text-xs text-red-300">{t.sharedError}</p> : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onComplete}
            disabled={busy}
            className="rounded-xl bg-[#C9A66B] px-5 py-3.5 text-base font-semibold text-[#0B1F3A] transition-opacity disabled:opacity-60"
          >
            {busy ? t.completing : t.complete}
          </button>
        </div>
      </Frame>
    );
  }

  // pre_join (default)
  return (
    <Frame>
      <div className="btyFadeIn flex flex-1 flex-col justify-center gap-5">
        <div className="flex flex-col gap-2">
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h1 className="text-2xl font-semibold uppercase leading-snug tracking-wide text-white">{title}</h1>
          <p className="text-sm leading-6 text-white/60">{t.enterName}</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onJoin();
          }}
          className="flex flex-col gap-3"
        >
          <input
            type="text"
            autoComplete="name"
            enterKeyHint="go"
            maxLength={60}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError(false);
            }}
            placeholder={t.namePlaceholder}
            aria-label={t.namePlaceholder}
            aria-invalid={nameError}
            className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-base text-white placeholder:text-white/35 outline-none focus:border-[#C9A66B]/60"
          />
          {nameError ? <p className="text-xs text-white/50">{t.nameError}</p> : null}
          {joinError ? (
            <p className="text-xs text-red-300" data-testid="join-error">
              {t.joinDidNotGoThrough}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-[#C9A66B] px-4 py-3.5 text-base font-semibold text-[#0B1F3A] transition-opacity disabled:opacity-60"
          >
            {busy ? t.joining : t.join}
          </button>
        </form>
      </div>
    </Frame>
  );
}

function ReflectionSection({ label, body }: { label: string; body: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-[0.14em] text-white/40">{label}</span>
      <p className="text-base leading-7 text-white/85">{body}</p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="btyFadeIn flex flex-1 flex-col justify-center">
      <p className="text-base leading-6 text-white/70">{children}</p>
    </div>
  );
}

function Block({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="btyFadeIn flex flex-1 flex-col justify-center gap-3">
      <Eyebrow>{eyebrow}</Eyebrow>
      {title ? <h1 className="text-2xl font-semibold leading-snug text-white">{title}</h1> : null}
      <p className="text-sm leading-6 text-white/60">{body}</p>
    </div>
  );
}
