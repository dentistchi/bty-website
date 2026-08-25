"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveRoomLocale, resolveRoomLocaleOnClient } from "./roomLocale";
import type { SavedLocale } from "@/lib/localePreference";
import { useRoomDraft, type DraftFields } from "./useDeviceDraft";
import { useSuggestedName } from "./useSuggestedName";
import { PdfReader, type ReadingHeartbeat } from "./PdfReader";
import { JourneyReading, type Journey } from "./JourneyReading";
import { sanitizeRoomReturn } from "@/lib/bty/foundry/roomReturn";
import { terminalIdentityCopy } from "./terminalIdentityCopy";
import { mergeSnapshot } from "./snapshotMerge";

/**
 * Foundry PDF Study Room — participant experience.
 *
 * A no-instruction flow: scan → name → read (progress saved) → reflect (unlocks
 * when the reading requirement is met) → complete → credit. Direct language, no
 * Foundry jargon. Reading progress and completion are server-authoritative; this
 * client reports and renders, it never awards. Mirrors the YouTube participant
 * client's shape and visual language but for a document.
 */

type Locale = "en" | "ko";

type Stage =
  | "pre_join"
  | "read"
  | "response"
  | "completed_awarded"
  | "completed_claimable"
  | "closed_incomplete"
  | "closed"
  | "removed"
  | "inactive";

type XpStatus = "awarded" | "claimable" | "owner_ineligible" | "daily_limit" | "none";

type DocInfo = {
  page_count: number;
  min_read_seconds: number;
  intro: string | null;
  last_page: number | null;
  distinct_pages_viewed: number;
  active_read_ms: number;
  reading_complete: boolean;
  completion_prompt: string | null;
  shared_question: string | null;
};

type Snapshot = {
  content_type: "document";
  event: { title: string; status: "open" | "closed" } | null;
  /** R4-R5C4A — opaque per-participant namespace for the DEVICE-LOCAL draft. Optional:
   *  a server that does not send it simply yields no draft, never an error. */
  participant: { display_name: string; draft_ns?: string } | null;
  /** R4-R5C7A — prefill for the join field; present only pre-join. Optional: absent means no suggestion. */
  suggested_name?: string | null;
  document: DocInfo | null;
  /** The published program, from the frozen event snapshot (Slice 3.2R-R8A). */
  journey?: Journey;
  /** This event asks a distinct REFLECT question — server-derived (Slice 3.2R-R8B). */
  reflection_required?: boolean;
  stage: Stage;
  xp_status: XpStatus;
  /**
   * R4-R3B1 — the frozen follow-up checkpoint (7 / 30 / null). Carried so the terminal state can
   * say what signing in is FOR. `terminalIdentityCopy` decides what it means; this is raw.
   */
  follow_up_days?: 7 | 30 | null;
};

type Copy = {
  eyebrow: string;
  /*
    THE FIELD SAYS WHAT IT IS FOR (Slice R4-R5C7A).

    "What's your name?" reads as an identity challenge to someone who signed in moments earlier —
    the measured trust break was "I already signed in, why doesn't BTY know me?". The field's real
    job is narrower and answerable: this is the name a Host and an observing colleague will see
    next to this training. Saying so makes it purposeful even for the ~23% of accounts that carry
    no provider name and must still type one.

    Deliberately NOT "account name", "Google name", "profile name" or "verified name" — the
    learner does not need BTY's auth architecture explained to fill in one field.
  */
  /**
   * R4-R5C9A — shown ONLY when the server reports a live Apply window (`created`/`exists`).
   *
   * The terminal's only other forward-looking sentence describes a follow-up — something BTY will
   * do to the learner — which reads as WAIT. The product expects them to ACT during those days.
   * This says act, when, and where it comes back; Today still owns the action itself.
   *
   * KO uses the product's OWN tab label 오늘, not the English word "Today".
   */
  applyNarration: string;
  enterName: string;
  namePlaceholder: string;
  join: string;
  joining: string;
  readThis: string;
  progressSaved: string;
  pagesProgress: (viewed: number, total: number) => string;
  keepReading: string;
  readingDone: string;
  beforeYouFinish: string;
  responsePlaceholder: string;
  reflectPlaceholder: string;
  reflectError: string;
  sharedHeading: string;
  sharedDisclosure: string;
  sharedPlaceholder: string;
  sharedError: string;
  complete: string;
  completing: string;
  /*
    YOUR DECISION (Slice 3.2R-R2.5). 3.2M-1 added the decision to the YouTube learner and the
    document SERVICE, and never to this client — so a document training whose journey asks for a
    decision could not be completed at all: the server refused `decision_required` for an answer
    the learner was never shown a field for.
  */
  decisionHeading: string;
  decisionAsk: string;
  decisionDisclosure: string;
  decisionPlaceholder: string;
  decisionError: string;
  trainingComplete: string;
  xpAwarded: string;
  xpClaimable: string;
  saveXp: string;
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
  /** Slice R4-R5B2 — the assigned learner's primary exit; names the Learn tab it returns to. */
  backToLearn: string;
  saving: string;
  xpDailyLimit: string;
  xpOwner: string;
  closedTitle: string;
  closedBody: string;
  endedTitle: string;
  endedBody: string;
  removed: string;
  inactive: string;
  nameError: string;
  responseError: string;
  /*
    R4-R2H — three sentences, each stating only what is known, and each shown ONLY after a
    reconcile has failed to find the server in the state the learner was trying to reach. None
    of them claims the server failed while we merely stopped listening.
  */
  completionDidNotGoThrough: string;
  readingNotRecorded: string;
  readingRetry: string;
  joinDidNotGoThrough: string;
  pdfLoading: string;
  pdfUnavailable: string;
  pdfUnavailableHint: string;
  pageOf: (page: number, total: number) => string;
  prev: string;
  nextPage: string;
  continueAfterReading: string;
  docLoadError: string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    eyebrow: "TRAINING",
    applyNarration: "Use what you decided in real work this week. You'll see it again in Today.",
    enterName: "Name shown for this training",
    namePlaceholder: "Your name",
    join: "Continue",
    joining: "Opening…",
    readThis: "Read the document",
    progressSaved: "Your place is saved.",
    pagesProgress: (v, t) => `${v} of ${t} pages read`,
    keepReading: "Read every page to continue.",
    readingDone: "You’ve read the document.",
    beforeYouFinish: "BEFORE YOU FINISH",
    responsePlaceholder: "Write what you will say…",
    reflectPlaceholder: "Write what usually happens…",
    reflectError: "Please answer the reflect question to complete.",
    sharedHeading: "Show what you understood",
    sharedDisclosure: "Your response will be shared with the training host.",
    sharedPlaceholder: "Answer the question above…",
    sharedError: "Please answer the shared question to complete.",
    complete: "Complete training",
    completing: "Saving…",
    decisionHeading: "Your decision",
    decisionAsk: "What will you do?",
    decisionDisclosure: "In your own words. This is shared with the training host.",
    decisionPlaceholder: "Next time I will…",
    decisionError: "Please say what you will do to complete.",
    trainingComplete: "TRAINING COMPLETE",
    xpAwarded: "+10 Core XP",
    xpClaimable: "10 Core XP is ready to save.",
    saveXp: "Save XP to BTY",
    savedTitle: "Saved to your BTY",
    savedBody: "Your training is saved in My Learning.",
    continueToBty: "Continue to BTY",
    backToLearn: "Back to Learn",
    saving: "Saving…",
    xpDailyLimit: "Today’s Core XP is already saved. Come back tomorrow.",
    xpOwner: "Thanks for hosting this training.",
    closedTitle: "THIS EVENT IS CLOSED",
    closedBody: "New participants can no longer join.",
    endedTitle: "EVENT CLOSED",
    endedBody: "This session has ended.",
    removed: "Your access to this event has ended.",
    inactive: "This invitation is no longer active.",
    nameError: "Please enter your name.",
    responseError: "Please answer this to complete.",
    completionDidNotGoThrough: "That didn’t go through. Tap again to try.",
    readingNotRecorded: "We couldn’t record that you finished reading.",
    readingRetry: "Save again",
    joinDidNotGoThrough: "We couldn’t join the training. Tap again to try.",
    pdfLoading: "Loading…",
    pdfUnavailable: "The document could not be loaded.",
    pdfUnavailableHint: "Reload the page, or ask the host to check the event.",
    pageOf: (p, t) => `${p} / ${t}`,
    prev: "Back",
    nextPage: "Next page",
    continueAfterReading: "Continue",
    docLoadError: "This document is not available. Ask the host to check the event.",
  },
  ko: {
    eyebrow: "학습",
    applyNarration: "이번 주에 정한 것을 실제 업무에서 해보세요. 오늘 탭에서 다시 볼 수 있어요.",
    enterName: "이 학습에 표시할 이름",
    namePlaceholder: "이름",
    join: "계속하기",
    joining: "여는 중…",
    readThis: "문서를 읽어 주세요",
    progressSaved: "읽던 위치가 저장됩니다.",
    pagesProgress: (v, t) => `${t}쪽 중 ${v}쪽 읽음`,
    keepReading: "모든 페이지를 읽으면 계속됩니다.",
    readingDone: "문서를 모두 읽었습니다.",
    beforeYouFinish: "마치기 전에",
    responsePlaceholder: "무엇을 말할지 적어 주세요…",
    reflectPlaceholder: "평소 어떤 일이 일어나는지 적어 주세요…",
    reflectError: "완료하려면 성찰 질문에 답해 주세요.",
    sharedHeading: "배운 내용을 설명해 주세요",
    sharedDisclosure: "이 답변은 교육 담당자에게 공유됩니다.",
    sharedPlaceholder: "위 질문에 답해 주세요…",
    sharedError: "완료하려면 공유 질문에 답해 주세요.",
    complete: "훈련 완료",
    completing: "저장 중…",
    decisionHeading: "당신의 결정",
    decisionAsk: "무엇을 하시겠습니까?",
    decisionDisclosure: "직접 작성해 주세요. 이 답변은 교육 담당자에게 공유됩니다.",
    decisionPlaceholder: "다음에는 …",
    decisionError: "완료하려면 무엇을 할지 적어 주세요.",
    trainingComplete: "훈련 완료",
    xpAwarded: "+10 Core XP",
    xpClaimable: "10 Core XP를 저장할 수 있습니다.",
    saveXp: "BTY에 XP 저장",
    savedTitle: "BTY에 저장되었습니다",
    savedBody: "이 교육은 내 학습에 저장되었습니다.",
    continueToBty: "BTY로 계속하기",
    backToLearn: "학습으로 돌아가기",
    saving: "저장 중…",
    xpDailyLimit: "오늘의 Core XP는 이미 저장되었습니다. 내일 다시 오세요.",
    xpOwner: "이 훈련을 열어 주셔서 감사합니다.",
    closedTitle: "종료된 이벤트입니다",
    closedBody: "더 이상 참여할 수 없습니다.",
    endedTitle: "이벤트 종료",
    endedBody: "이 세션은 종료되었습니다.",
    removed: "이 이벤트에 대한 접근이 종료되었습니다.",
    inactive: "더 이상 유효하지 않은 초대입니다.",
    nameError: "이름을 입력해 주세요.",
    responseError: "완료하려면 답변을 작성해 주세요.",
    completionDidNotGoThrough: "전송되지 않았습니다. 다시 눌러 주세요.",
    readingNotRecorded: "읽기를 마쳤다는 기록을 저장하지 못했습니다.",
    readingRetry: "다시 시도",
    joinDidNotGoThrough: "훈련에 참여하지 못했습니다. 다시 시도해 주세요.",
    pdfLoading: "불러오는 중…",
    pdfUnavailable: "문서를 불러오지 못했습니다.",
    pdfUnavailableHint: "다시 시도하거나 호스트에게 문의하세요.",
    pageOf: (p, t) => `${p} / ${t}`,
    prev: "이전",
    nextPage: "다음 페이지",
    continueAfterReading: "계속하기",
    docLoadError: "문서를 사용할 수 없습니다. 호스트에게 확인을 요청하세요.",
  },
};

function Frame({ children }: { children: React.ReactNode }) {
  // Slice 3.1B-3F.1 (parity with FoundryJoinClient): when the PDF Room was opened from a Required
  // assignment it carries a sanitized same-origin `?return=/{locale}/app…`. Show a visible "Back
  // to Foundry" on EVERY stage (not dependent on WebView history, which the native shell may not
  // expose). Returning is pure navigation — it never completes the assignment. Unsafe/external or
  // absent returns (e.g. an open-link QR scan) → no control, exactly like the video player.
  const [returnTarget] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? sanitizeRoomReturn(new URLSearchParams(window.location.search).get("return"))
      : null,
  );
  /*
    THE CONTROL IS NAMED FOR WHERE IT GOES (Slice R4-R5B2).

    `Foundry` is the internal system name; the tab this returns to is called **Learn**. Measured
    before renaming: `sanitizeRoomReturn` admits only `/{en|ko}/app…`, and the repository has
    exactly ONE producer of a room `?return=` — `FoundryRequiredLearning`, which always emits
    `/{loc}/app?tab=foundry`, and `resolveInitialAppTab` aliases `foundry → learn`. So this control
    truthfully lands on Learn and the label is accurate, not merely Foundry-free. A test pins that
    sole producer, so a future second producer aiming elsewhere fails rather than silently lying.
  */
  const backLabel = returnTarget?.startsWith("/ko/") ? "← 학습으로 돌아가기" : "← Back to Learn";
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
  return <span className="text-xs font-medium uppercase tracking-[0.18em] text-[#C9A66B]/90">{children}</span>;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center text-center">{children}</div>;
}

/**
 * HOW LONG A LEARNER WAITS BEFORE WE STOP WAITING AND GO AND ASK (Slice R4-R2H).
 *
 * The same bound R4-R2G proved on the guidance room, for the same measured reason: a completion
 * whose durable write had already landed left the screen saying "Completing…" because the UI's
 * only notion of "done" was the response arriving. Twenty seconds is far beyond the handful of
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
function isCompletedStage(s: Snapshot | null): boolean {
  return s?.stage === "completed_awarded" || s?.stage === "completed_claimable";
}

const docApi = (token: string, path = "") =>
  `/api/bty/foundry/public/${encodeURIComponent(token)}/doc${path}`;

/** Best-effort device IANA tz for the follow-up due-date resolution (Slice 3.1B-3K). Capture-only. */
function deviceTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export default function FoundryDocumentClient({
  token,
  savedLocale = null,
}: {
  token: string;
  /** The BTY language preference, resolved server-side from `NEXT_LOCALE` (Slice R4-R5C16A). */
  savedLocale?: SavedLocale | null;
}) {
  const [locale, setLocale] = useState<Locale>(() => resolveRoomLocale(savedLocale, null));
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  /*
    R4-R5C9A — the server's Apply outcome, captured from the completion/claim response and held
    for the terminal. Sticky by design: it is set only when the server reports created/exists, and
    a later action response that carries nothing must not silently retract a true statement.
  */
  const [applyWindow, setApplyWindow] = useState<"created" | "exists" | null>(null);
  const [name, setName] = useState("");
  /*
    R4-R5C7A — when the account already carries a name, the field arrives filled in. The learner
    still decides what is submitted: this seeds once, never over typing, and never re-applies.
  */
  const nameTouched = useRef(false);
  useSuggestedName(snapshot?.suggested_name, name, setName, nameTouched);
  const [response, setResponse] = useState("");
  // Shared Understanding answer (Slice 3.1B-3G) — SEPARATE state from the private `response`.
  const [sharedResponse, setSharedResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [responseError, setResponseError] = useState(false);
  /** Shown only after a reconcile confirmed the server did NOT complete (Slice R4-R2H). */
  const [submitError, setSubmitError] = useState(false);
  /** Shown only after a join reconcile found no participant (Slice R4-R2H). */
  const [joinError, setJoinError] = useState(false);
  /*
    READING EVIDENCE, AND WHEN TO SAY SO (Slice R4-R2H).

    A heartbeat is a background write and a lost one is usually harmless: the next beat carries
    the learner forward, and the server unions page coverage. So a failure is REMEMBERED, not
    announced — `readingEvidenceLost` is cleared by the very next beat that lands, which is why
    a transient blip never reaches the learner.

    It only becomes the learner's problem at the transition: they have been through every page
    of the document locally, the server still does not say reading is complete, and we know a
    write was lost. Then, and only then, there is something honest and actionable to show.
  */
  const [readingEvidenceLost, setReadingEvidenceLost] = useState(false);
  const [readingRetrying, setReadingRetrying] = useState(false);
  /** Pages this client has actually displayed — client truth, independent of the server. */
  const localViewedRef = useRef<number[]>([]);
  const lastBeatRef = useRef<ReadingHeartbeat | null>(null);
  const [localViewedCount, setLocalViewedCount] = useState(0);
  // The REFLECT answer (Slice 3.2R-R8B) — a different question, a different column, its own state.
  const [reflectResponse, setReflectResponse] = useState("");
  const [reflectError, setReflectError] = useState(false);
  const [decisionResponse, setDecisionResponse] = useState("");

  /*
    DEVICE-LOCAL DRAFT (Slice R4-R5C4A). The four answers above live only in this component until
    Complete; before this slice, a refresh threw them away in silence. `useRoomDraft` restores
    them once — before `draftReady`, so it can never land on top of live typing — persists them
    debounced to THIS device, and deletes them only when the SERVER says the training finished.
    It writes nothing to any database and adds nothing to the completion payload.
  */
  const draftFields: DraftFields = useMemo(
    () => ({ response, sharedResponse, decisionResponse, reflectResponse }),
    [response, sharedResponse, decisionResponse, reflectResponse],
  );
  const restoreDraft = useCallback((d: DraftFields) => {
    setResponse(d.response);
    setSharedResponse(d.sharedResponse);
    setDecisionResponse(d.decisionResponse);
    setReflectResponse(d.reflectResponse);
  }, []);
  const { ready: draftReady } = useRoomDraft(
    snapshot?.participant?.draft_ns ?? null,
    draftFields,
    restoreDraft,
    isCompletedStage(snapshot),
  );

  const [decisionError, setDecisionError] = useState(false);
  const [sharedError, setSharedError] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState(false);
  // Open-link vs assigned entry (Slice 3.1B-3H): assigned learners arrive with a sanitized
  // `?return=/{locale}/app…`; an open-link web learner has none → show the "Saved to your BTY"
  // handoff after a successful authenticated claim.
  const [roomReturn] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? sanitizeRoomReturn(new URLSearchParams(window.location.search).get("return"))
      : null,
  );
  const busyRef = useRef(false);
  const autoClaimedRef = useRef(false);
  const fileRequestedRef = useRef(false);
  const reflectionRef = useRef<HTMLDivElement | null>(null);

  const t = COPY[locale];
  /* R4-R3B1 — decided by the domain authority from the frozen snapshot, never by this component. */
  const identity = terminalIdentityCopy(snapshot?.follow_up_days, locale);

  /*
    The post-reading continue action (final page, reading requirement met) scrolls to the
    already-rendered, server-unlocked completion surface. It never fakes completion — that
    surface only exists in the DOM when the server marked reading_complete.

    IT USED TO SAY "Continue to reflection" (Slice 3.2R-R8B-R2). That was true when the only
    question a document learner ever answered lived below the PDF. After R8B the REFLECT
    question and its answer box are ABOVE the document, and this button leads DOWN to BEFORE YOU
    FINISH and SHOW WHAT YOU UNDERSTOOD — so the label was naming a section the learner had
    already passed, and pointing away from it.

    "Continue" / "계속하기" is the phrase the sibling learner client already uses for exactly
    this move (`checkpointContinue`). It is also contract-NEUTRAL, which is why it needs no
    derivation: a legacy document event, whose single question really does sit after the PDF,
    is served just as truthfully as a new-contract one. A label naming a destination would have
    had to be derived per event; this one is simply true in both.
  */
  const onContinue = useCallback(() => {
    reflectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Only reachable when no BTY preference exists; otherwise the initializer already decided.
  useEffect(() => setLocale(resolveRoomLocaleOnClient(savedLocale)), [savedLocale]);

  /**
   * Refresh from the server and RETURN what it said, so a caller can reconcile against it.
   * Bounded for the same reason the writes are: an unbounded reconcile would reintroduce
   * exactly the hang it exists to end.
   */
  const load = useCallback(async (): Promise<Snapshot | null> => {
    try {
      const res = await fetch(docApi(token, "/snapshot"), {
        credentials: "include",
        cache: "no-store",
        signal: timeoutSignal(),
      });
      const next = (await res.json()) as Snapshot;
      setSnapshot(next);
      return next;
    } catch {
      /*
        PRESERVE what the learner is already looking at. Replacing a live snapshot with
        `inactive` because one refresh did not answer would erase a room that is fine.
      */
      setSnapshot((prev) =>
        prev ?? { content_type: "document", event: null, participant: null, document: null, stage: "inactive", xp_status: "none" },
      );
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
        const res = await fetch(docApi(token, path), {
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
          We stopped waiting, or the connection never came back. THIS IS NOT A FAILURE — the
          server may well have acted. It reports only that we do not know, and the caller must
          go and ask rather than guess.
        */
        return { ok: false, status: 0, data: null, settled: false };
      }
    },
    [token],
  );

  /** What the room falls back to when an action lands before the first load resolves. */
  const EMPTY_SNAPSHOT: Snapshot = {
    content_type: "document",
    event: null,
    participant: null,
    document: null,
    journey: null,
    reflection_required: false,
    stage: "inactive",
    xp_status: "none",
  };

  const applyResult = useCallback((data: unknown) => {
    const d = data as (Partial<Snapshot> & { ok?: boolean; applyWindow?: string }) | null;
    if (d?.ok && d.stage) {
      /*
        R4-R5C9A — capture the server's Apply outcome. STICKY: only a positive outcome writes, so a
        later action response that carries no field cannot retract a true statement.
      */
      if (d.applyWindow === "created" || d.applyWindow === "exists") setApplyWindow(d.applyWindow);
      /*
        MERGE, NEVER REBUILD (Slice 3.2R-R8A-R1).

        This reconstructed the snapshot field by field, so any key it did not name was silently
        dropped. R8A added `journey` to the server response and the device still showed no
        program: `load()` fetched it correctly, then the reader's FIRST heartbeat came back
        through here and replaced the snapshot with an object that had no journey. It rendered
        and disappeared within a second — which reads exactly like "it was never deployed".

        Now the previous value survives a response that does not carry the key, so a partial
        payload can never delete a field the learner is looking at. A field-by-field rebuild is
        the shape of this bug; preserving `prev` is the fix.

        R4-R3B1-R1 — the per-key form of that fix was not enough. `follow_up_days` was added and
        this literal dropped it exactly as it had dropped `journey`, because naming the keys is
        itself the defect. The rule is now generic: base is `prev`, and only SUPPLIED response
        fields overwrite it. See `snapshotMerge.ts`.
      */
      setSnapshot((prev) =>
        mergeSnapshot<Snapshot>(prev, d, EMPTY_SNAPSHOT, { content_type: "document", stage: d.stage! }),
      );
      return true;
    }
    return false;
  }, []);

  const stage = snapshot?.stage;
  const showReader = stage === "read" || stage === "response";

  // Fetch a signed url once we're a participant who needs the document.
  useEffect(() => {
    if (!showReader || fileRequestedRef.current) return;
    fileRequestedRef.current = true;
    (async () => {
      try {
        const res = await fetch(docApi(token, "/file"), {
          credentials: "include",
          cache: "no-store",
          signal: timeoutSignal(),
        });
        const d = (await res.json()) as { ok?: boolean; url?: string };
        if (d?.ok && d.url) setFileUrl(d.url);
        else setFileError(true);
      } catch {
        setFileError(true);
      }
    })();
  }, [showReader, token]);

  // --- actions ---
  const onJoin = useCallback(async () => {
    if (busyRef.current) return;
    if (name.trim().length < 1) return setNameError(true);
    busyRef.current = true;
    setBusy(true);
    setNameError(false);
    setJoinError(false);
    try {
      // Join reuses the content-agnostic public join route. Bounded like every other write, and
      // reconciled the same way: joining twice is harmless, so we ask before we accuse.
      let res: Response | null = null;
      try {
        res = await fetch(`/api/bty/foundry/public/${encodeURIComponent(token)}/join`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ display_name: name.trim() }),
          signal: timeoutSignal(),
        });
      } catch {
        res = null;
      }
      if (!res) {
        const reconciled = await load();
        if (!reconciled?.participant) setJoinError(true);
        return;
      }
      const d = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.ok) await load();
      else if (d?.error === "name_required" || d?.error === "name_too_long") setNameError(true);
      else {
        const reconciled = await load();
        if (!reconciled?.participant) setJoinError(true);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [name, token, load]);

  const onHeartbeat = useCallback(
    (beat: ReadingHeartbeat) => {
      // Client-side page coverage, kept whether or not the write lands.
      const merged = Array.from(new Set([...localViewedRef.current, ...(beat.viewedPages ?? [])]));
      localViewedRef.current = merged;
      setLocalViewedCount(merged.length);
      lastBeatRef.current = beat;

      // Background write: applied when it lands, remembered when it does not, never announced.
      void post("/reading", {
        last_page: beat.lastPage,
        viewed_pages: beat.viewedPages,
        active_ms_delta: beat.activeMsDelta,
      }).then(({ settled, ok, data }) => {
        if (settled && ok) {
          applyResult(data);
          setReadingEvidenceLost(false);
          return;
        }
        setReadingEvidenceLost(true);
      });
    },
    [post, applyResult],
  );

  /**
   * Re-assert reading evidence after a lost heartbeat, WITHOUT inflating it.
   *
   * `active_ms_delta: 0` is deliberate and load-bearing. Re-sending a delta whose original may
   * in fact have been applied would count the same reading time twice, and reading time is half
   * of the server's gate — that would WEAKEN the evidence threshold, which this slice may not
   * do. Page coverage is a set union and is therefore safe to re-send; the time the learner has
   * genuinely spent keeps accumulating through ordinary beats.
   *
   * So this re-asserts what is idempotent, then asks the server to re-evaluate its own gate. If
   * the gate is met, the learner advances. If it is not, the ordinary "keep reading" state is
   * the truth and the error clears, because the write is no longer the thing standing in the way.
   */
  const onRetryReading = useCallback(async () => {
    if (readingRetrying) return;
    setReadingRetrying(true);
    try {
      const { settled, ok, data } = await post("/reading", {
        last_page: lastBeatRef.current?.lastPage ?? 1,
        viewed_pages: localViewedRef.current,
        active_ms_delta: 0,
      });
      if (settled && ok) {
        applyResult(data);
        setReadingEvidenceLost(false);
        return;
      }
      await load();
    } finally {
      setReadingRetrying(false);
    }
  }, [post, applyResult, load, readingRetrying]);

  const sharedQuestion = snapshot?.document?.shared_question ?? null;
  /*
    WHETHER A REFLECT ANSWER IS OWED IS THE SERVER'S ANSWER, NOT THIS COMPONENT'S (3.2R-R8B).
    The client renders the control the snapshot tells it to and sends what it collected; the
    server re-derives the requirement from the frozen event and refuses if it disagrees.
  */
  const reflectRequired = Boolean(snapshot?.reflection_required);
  /*
    WHAT BTY PROPOSED vs WHAT THE LEARNER DECIDES (Slice 3.2R-R2.5, porting 3.2M-1).

    Read from the SAME frozen journey the snapshot already carries and the SAME element the
    server's `journeyActionDecision` gate reads, so the field is shown exactly when an answer is
    owed. BTY's sentence is CONTEXT above the field and is never prefilled: a decision someone
    read is not a decision they made.
  */
  const actionDecisionContext =
    snapshot?.journey?.elements.find((e) => e.kind === "action_decision")?.content ?? null;
  const onComplete = useCallback(async () => {
    if (busyRef.current) return;
    if (reflectRequired && reflectResponse.trim().length < 1) return setReflectError(true);
    if (response.trim().length < 1) return setResponseError(true);
    if (actionDecisionContext && decisionResponse.trim().length < 1) return setDecisionError(true);
    // A configured shared question requires a non-empty shared answer BEFORE completion.
    if (sharedQuestion && sharedResponse.trim().length < 1) return setSharedError(true);
    busyRef.current = true;
    setBusy(true);
    setResponseError(false);
    setSharedError(false);
    setReflectError(false);
    setDecisionError(false);
    setSubmitError(false);
    try {
      const { ok, data, settled } = await post("/complete", {
        response_text: response.trim(),
        ...(sharedQuestion ? { shared_response: sharedResponse.trim() } : {}),
        ...(reflectRequired ? { reflection_response: reflectResponse.trim() } : {}),
        ...(actionDecisionContext ? { decision_response: decisionResponse.trim() } : {}),
        tz: deviceTz(),
      });
      /*
        THE RECONCILE (Slice R4-R2H, the rule R4-R2G proved).

        A completion that does not answer in time has NOT necessarily failed — in the measured
        production case the row was already written. Server completion is idempotent (an early
        return once `completed_at` is set, plus `.is("completed_at", null)` on the update), so
        asking again is free and cannot double-complete or double-award. We ask, and we believe
        the answer.
      */
      if (!settled) {
        const reconciled = await load();
        if (!isCompletedStage(reconciled)) setSubmitError(true);
        return;
      }
      const d = data as { error?: string } | null;
      if (ok) applyResult(data);
      else if (d?.error === "reflection_required") setReflectError(true);
      /*
        A REFUSAL THE LEARNER CAN ACT ON (Slice 3.2R-R2.5). Without this branch a
        `decision_required` fell through to `await load()`: the snapshot silently reloaded and
        the screen did not change, which is exactly what "Complete training cannot be pressed"
        looks like from the outside.
      */
      else if (d?.error === "decision_required") setDecisionError(true);
      else if (d?.error === "response_required" || d?.error === "response_too_long") setResponseError(true);
      else if (d?.error === "shared_response_required" || d?.error === "shared_response_too_long" || d?.error === "response_too_long")
        setSharedError(true);
      else {
        // An unrecognised refusal: reconcile before saying anything, then say only what is true.
        const reconciled = await load();
        if (!isCompletedStage(reconciled)) setSubmitError(true);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [response, sharedResponse, sharedQuestion, reflectRequired, reflectResponse, actionDecisionContext, decisionResponse, post, applyResult, load]);

  const onClaim = useCallback(
    async (silent: boolean) => {
      /*
        A SILENT CLAIM MUST NEVER TAKE THE INTERACTION LOCK (Slice R4-R2H).

        MEASURED: `busyRef` was acquired regardless of `silent`, and every handler opens with
        `if (busyRef.current) return`. The auto-claim that fires on reaching either terminal
        stage is silent, so a stalled one locked every control in the room while `setBusy` was
        deliberately skipped — no spinner, no message, taps doing nothing at all. That is worse
        than an honest spinner, because nothing on screen suggests waiting.

        The lock now belongs to the VISIBLE interaction only. The silent path still cannot run
        twice (`autoClaimedRef` fires once per mount) and the server claim is idempotent, so
        dropping the lock here costs no safety.
      */
      if (silent) {
        const { ok, data } = await post("/claim-xp", { tz: deviceTz() });
        if (ok) applyResult(data);
        return;
      }
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        const { ok, status, settled, data } = await post("/claim-xp", { tz: deviceTz() });
        if (ok) applyResult(data);
        else if (status === 401) {
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

  /*
    ONE SILENT claim-xp ON EITHER TERMINAL STAGE. Retained, with its reason corrected (R4-R5B1).

    WHAT THIS COMMENT USED TO SAY, AND WHY IT WAS WRONG. It claimed "claim-xp is the SOLE surface
    that runs claimAssignmentForParticipant" and that "the video client already reconciles on
    completed_awarded (FoundryJoinClient)". The second half was false: that client's effect opens
    `if (snapshot?.stage !== "completed_claimable" ... ) return;` and is itself labelled "3.1B-3D
    fix: do NOT auto-claim" — it loads the account, it does not claim. So this room was not reaching
    parity with the video room; it was the only room that worked, and the comment made the gap look
    closed. A false precedent in a comment is how the defect survived.

    The first half is no longer true either: `completeDocumentTraining` now runs the assignment claim
    server-side for an authenticated learner, in the same authenticated block as follow-up and apply.
    Assignment truth is owned by the completion service, not by this effect.

    SO WHY KEEP IT. Two branches, and only one became redundant:
      · completed_claimable — REQUIRED, and unrelated to assignments. This is the anonymous-then-
        authenticated path: completion happened with no session, so XP is still unawarded and only
        claim-xp can award it. Removing this would break XP claiming for open-link learners. The
        silent path deliberately takes no interaction lock and, on 401, does nothing at all.
      · completed_awarded — now redundant for NEW completions, and deliberately retained as
        reconciliation for rows completed BEFORE this slice, whose assignments were never claimed.
    Both stay idempotent: autoClaimedRef fires once per mount, the RPC answers already_claimed, and
    the awarded early-return connects the assignment with NO second XP award.
  */
  useEffect(() => {
    if (
      (snapshot?.stage === "completed_claimable" || snapshot?.stage === "completed_awarded") &&
      !autoClaimedRef.current
    ) {
      autoClaimedRef.current = true;
      void onClaim(true);
    }
  }, [snapshot?.stage, onClaim]);

  // --- render ---
  if (!loaded || !snapshot) {
    return <Frame><div className="flex-1" /></Frame>;
  }

  if (stage === "inactive") {
    return (
      <Frame>
        <Centered>
          <p className="text-sm text-white/70">{t.inactive}</p>
        </Centered>
      </Frame>
    );
  }
  if (stage === "removed") {
    return (
      <Frame>
        <Centered>
          <p className="text-sm text-white/70">{t.removed}</p>
        </Centered>
      </Frame>
    );
  }
  if (stage === "closed") {
    return (
      <Frame>
        <Centered>
          <Eyebrow>{t.closedTitle}</Eyebrow>
          <p className="mt-3 text-sm text-white/70">{t.closedBody}</p>
        </Centered>
      </Frame>
    );
  }
  if (stage === "closed_incomplete") {
    return (
      <Frame>
        <Centered>
          <Eyebrow>{t.endedTitle}</Eyebrow>
          <p className="mt-3 text-sm text-white/70">{t.endedBody}</p>
        </Centered>
      </Frame>
    );
  }

  // pre_join
  if (stage === "pre_join") {
    return (
      <Frame>
        <div className="pt-8">
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h1 className="mt-2 text-2xl font-semibold leading-tight">{snapshot.event?.title}</h1>
          <p className="mt-6 text-sm text-white/70">{t.enterName}</p>
        </div>
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void onJoin();
          }}
        >
          <input
            value={name}
            onChange={(e) => {
              nameTouched.current = true;
              setName(e.target.value);
              setNameError(false);
            }}
            maxLength={60}
            placeholder={t.namePlaceholder}
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white placeholder-white/40 outline-none focus:bg-white/15"
          />
          {nameError && <p className="mt-2 text-xs text-red-300">{t.nameError}</p>}
          {joinError && (
            <p className="mt-2 text-xs text-red-300" data-testid="doc-join-error">
              {t.joinDidNotGoThrough}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full rounded-xl bg-[#C9A66B] px-4 py-3 font-medium text-[#0B1F3A] disabled:opacity-60"
          >
            {busy ? t.joining : t.join}
          </button>
        </form>
        <div className="flex-1" />
      </Frame>
    );
  }

  // completed
  if (stage === "completed_awarded" || stage === "completed_claimable") {
    const xp = snapshot.xp_status;
    return (
      <Frame>
        <Centered>
          <Eyebrow>{t.trainingComplete}</Eyebrow>
          <h1 className="mt-3 text-xl font-semibold">{snapshot.event?.title}</h1>
          <div className="mt-8 w-full">
            {xp === "awarded" && (
              <>
                <p className="text-lg font-semibold text-[#C9A66B]">{t.xpAwarded}</p>
                {/*
                  THE SAME TRUTH, TOLD TO THE PERSON IT APPLIES TO (Slice R4-R5B2, Repair E). See the
                  full note in FoundryJoinClient. `identity` is already built here from the frozen
                  `follow_up_days`; only `meaning` is reused, because it is the one sentence still
                  true for someone already signed in whose XP is already awarded. No checkpoint →
                  `followUp` is null → nothing is said.
                */}
                {/*
                  REALITY NARRATION (Slice R4-R5C9A) — narrate, never navigate.

                  Rendered from `applyWindow`, the server's own materialization outcome, and from nothing else:
                  not the decision text, not auth, not follow-up days, not the room type. `created` and `exists`
                  are one truth; `skipped`/`error` say nothing, which is what keeps this from promising a Reality
                  step to the many completions that correctly have none.

                  It sits BEFORE the follow-up sentence on purpose, so the sequence reads: finished -> act this
                  week -> we will check back. Quiet body text, NO CTA: Today owns the action, holds the learner's
                  own sentence, and applies the suppression rules.
                */}
                {applyWindow ? (
                  <p className="text-sm leading-6 text-white/80" data-testid="apply-narration">
                    {t.applyNarration}
                  </p>
                ) : null}
                {identity.followUp ? (
                  <p className="mt-2 text-sm leading-6 text-white/80" data-testid="awarded-followup">
                    {identity.followUp.meaning}
                  </p>
                ) : null}
              </>
            )}
            {xp === "claimable" && (
              <>
                {/*
                  R4-R3B1 — the reason to sign in, before the reward. Built from the FROZEN
                  `follow_up_days`; a training with no checkpoint promises nothing and this
                  degrades to the previous screen plus one true line about the completion.
                */}
                <p className="text-sm leading-6 text-white/70" data-testid="terminal-completion-saved">
                  {identity.completionSaved}
                </p>
                {identity.followUp ? (
                  <div className="mt-2 flex flex-col gap-1" data-testid="terminal-followup">
                    <p className="text-sm leading-6 text-white/85">{identity.followUp.meaning}</p>
                    <p className="text-sm leading-6 text-white/85">{identity.followUp.signInReason}</p>
                    <p className="text-xs leading-5 text-white/50" data-testid="terminal-xp-secondary">
                      {identity.followUp.xpSecondary}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-white/80">{t.xpClaimable}</p>
                )}
                <button
                  type="button"
                  onClick={() => onClaim(false)}
                  disabled={busy}
                  className="mt-4 w-full rounded-xl bg-[#C9A66B] px-4 py-3 font-medium text-[#0B1F3A] disabled:opacity-60"
                >
                  {busy ? t.saving : t.saveXp}
                </button>
              </>
            )}
            {xp === "daily_limit" && <p className="text-sm text-white/70">{t.xpDailyLimit}</p>}
            {xp === "owner_ineligible" && <p className="text-sm text-white/70">{t.xpOwner}</p>}
            {/* Open-link → BTY handoff (Slice 3.1B-3H): only after a successful authenticated claim
                (xp awarded to this account) and only for an open-link entry (no assigned return).
                Non-mutating navigation into the app-shell My Learning view. */}
            {!roomReturn && xp === "awarded" ? (
              <div
                data-testid="saved-to-bty"
                className="mt-6 flex flex-col gap-2 rounded-xl border border-[#C9A66B]/25 bg-[#C9A66B]/[0.06] px-4 py-3 text-left"
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

            {/*
              THE ASSIGNED LEARNER'S WAY OUT (Slice R4-R5B2, Repair C) — see the full note in
              FoundryJoinClient. href is the ALREADY-SANITIZED `roomReturn`, verbatim; nothing is
              reconstructed and `sanitizeRoomReturn` is untouched. Open-link keeps its own branch
              and its own destination above.
            */}
            {roomReturn && xp === "awarded" ? (
              <a
                href={roomReturn}
                data-testid="assigned-return"
                className="mt-6 inline-block rounded-xl bg-[#C9A66B] px-5 py-3 text-base font-semibold text-[#0B1F3A]"
              >
                {t.backToLearn}
              </a>
            ) : null}
          </div>
        </Centered>
      </Frame>
    );
  }

  // read / response — reader always visible; reflection unlocks when reading is done.
  const doc = snapshot.document;
  const readingComplete = Boolean(doc?.reading_complete);
  /* All three conditions, or the learner is told nothing (Slice R4-R2H). */
  const readingRetryNeeded =
    readingEvidenceLost && !readingComplete && doc != null && localViewedCount >= doc.page_count;
  return (
    <Frame>
      <div className="pt-2">
        <Eyebrow>{t.readThis}</Eyebrow>
        <h1 className="mt-2 text-lg font-semibold leading-tight">{snapshot.event?.title}</h1>
        {doc?.intro && <p className="mt-2 whitespace-pre-line text-sm text-white/70">{doc.intro}</p>}
        <p className="mt-1 text-xs text-white/50">{t.progressSaved}</p>
      </div>

      {/*
        THE AUTHORED PROGRAM, BEFORE THE DOCUMENT (Slice 3.2R-R8A).

        The frozen event snapshot has always carried the whole journey; this path never read it,
        so a PDF learner met a seven-part program as one question. It renders ABOVE the reader
        because the program is what the reading is FOR — the same order the YouTube learner has
        had since 3.2C, where the journey precedes the video.

        `completion_check` is excluded by `JourneyReading` itself: it already has its own
        surface at the end, now correctly labelled BEFORE YOU FINISH.

        The REFLECT answer control is attached to the REFLECT block inside `JourneyReading`
        (Slice 3.2R-R8B), so the question the learner answers is the one they are reading.
      */}
      <div className="mt-5">
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
                  disabled: busy || !draftReady,
                }
              : null
          }
        />
      </div>

      <div className="mt-4">
        {fileError ? (
          <div className="rounded-2xl bg-white/5 px-5 py-8 text-center">
            <p className="text-sm font-medium text-white">{t.docLoadError}</p>
          </div>
        ) : fileUrl ? (
          <PdfReader
            fileUrl={fileUrl}
            initialPage={doc?.last_page ?? 1}
            onHeartbeat={onHeartbeat}
            readingComplete={readingComplete}
            onContinue={onContinue}
            copy={{
              loading: t.pdfLoading,
              unavailable: t.pdfUnavailable,
              unavailableHint: t.pdfUnavailableHint,
              pageOf: t.pageOf,
              prev: t.prev,
              nextPage: t.nextPage,
              continueAfterReading: t.continueAfterReading,
            }}
          />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-2xl bg-white/5 text-sm text-white/60">
            {t.pdfLoading}
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-white/60">
          <span>{doc ? t.pagesProgress(doc.distinct_pages_viewed, doc.page_count) : ""}</span>
          <span>{readingComplete ? t.readingDone : t.keepReading}</span>
        </div>
        {/*
          THE BLOCKED TRANSITION, and nothing before it (Slice R4-R2H). Shown only when all
          three are true: a write was lost, the server still does not consider the reading done,
          and this client has actually displayed every page. A learner who is simply still
          reading never sees it.
        */}
        {readingRetryNeeded && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-300/30 bg-amber-300/[0.06] px-3 py-2">
            <span className="text-xs leading-5 text-amber-200/90" data-testid="doc-reading-not-recorded">
              {t.readingNotRecorded}
            </span>
            <button
              type="button"
              onClick={() => void onRetryReading()}
              disabled={readingRetrying}
              data-testid="doc-reading-retry"
              className="shrink-0 rounded-lg border border-amber-300/40 px-3 py-1.5 text-xs font-medium text-amber-100 disabled:opacity-60"
            >
              {t.readingRetry}
            </button>
          </div>
        )}
      </div>

      {readingComplete && (
        <div className="mt-6" ref={reflectionRef}>
          {/* The completion check — what the learner will SAY. Never the REFLECT question,
              which is answered above beside the section that asks it (Slice 3.2R-R8B). */}
          <Eyebrow>{t.beforeYouFinish}</Eyebrow>
          {doc?.completion_prompt && (
            <p className="mt-2 text-sm text-white/85">{doc.completion_prompt}</p>
          )}
          <form
            className="mt-3"
            onSubmit={(e) => {
              e.preventDefault();
              void onComplete();
            }}
          >
            <textarea
              value={response}
            disabled={!draftReady}
              onChange={(e) => {
                setResponse(e.target.value);
                setResponseError(false);
              }}
              maxLength={1000}
              rows={4}
              placeholder={t.responsePlaceholder}
              className="w-full resize-none rounded-xl bg-white/10 px-4 py-3 text-white placeholder-white/40 outline-none focus:bg-white/15"
            />
            {responseError && <p className="mt-2 text-xs text-red-300">{t.responseError}</p>}
            {submitError && (
              <p className="mt-2 text-xs text-red-300" data-testid="doc-submit-error">
                {t.completionDidNotGoThrough}
              </p>
            )}

            {actionDecisionContext && (
              /* YOUR DECISION (Slice 3.2R-R2.5, porting 3.2M-1 to the document room). BTY's
                 proposed decision is CONTEXT above the field; the answer is the learner's own,
                 never prefilled, and required to complete — the same contract the server
                 already enforced and this client never offered. */
              <div className="mt-6 rounded-xl border border-[#C9A66B]/40 bg-[#C9A66B]/[0.06] p-4" data-testid="decision-section">
                <Eyebrow>{t.decisionHeading}</Eyebrow>
                <p className="mt-2 text-sm leading-6 text-white/70" data-testid="decision-context">{actionDecisionContext}</p>
                <p className="mt-3 text-sm font-medium leading-6 text-white/90">{t.decisionAsk}</p>
                <p className="mt-1 text-xs text-[#C9A66B]/90" data-testid="decision-disclosure">{t.decisionDisclosure}</p>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={decisionResponse}
            disabled={!draftReady}
                  onChange={(e) => {
                    setDecisionResponse(e.target.value);
                    if (decisionError) setDecisionError(false);
                  }}
                  placeholder={t.decisionPlaceholder}
                  aria-label={t.decisionAsk}
                  aria-invalid={decisionError}
                  data-testid="decision-input"
                  className="mt-3 w-full resize-none rounded-xl bg-white/10 px-4 py-3 text-white placeholder-white/40 outline-none focus:bg-white/15"
                />
                {decisionError && <p className="mt-2 text-xs text-red-300" data-testid="decision-error">{t.decisionError}</p>}
              </div>
            )}

            {sharedQuestion && (
              /* Shared Understanding — VISUALLY + semantically separate from the private reflection
                 above. The learner is explicitly told this answer is shared with the Host. */
              <div className="mt-6 rounded-xl border border-[#C9A66B]/40 bg-[#C9A66B]/[0.06] p-4" data-testid="shared-understanding-section">
                <Eyebrow>{t.sharedHeading}</Eyebrow>
                <p className="mt-2 text-sm text-white/85">{sharedQuestion}</p>
                <p className="mt-1 text-xs text-[#C9A66B]/90" data-testid="shared-disclosure">{t.sharedDisclosure}</p>
                <textarea
                  value={sharedResponse}
            disabled={!draftReady}
                  onChange={(e) => {
                    setSharedResponse(e.target.value);
                    setSharedError(false);
                  }}
                  maxLength={1000}
                  rows={3}
                  placeholder={t.sharedPlaceholder}
                  data-testid="shared-understanding-input"
                  className="mt-3 w-full resize-none rounded-xl bg-white/10 px-4 py-3 text-white placeholder-white/40 outline-none focus:bg-white/15"
                />
                {sharedError && <p className="mt-2 text-xs text-red-300">{t.sharedError}</p>}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-3 w-full rounded-xl bg-[#C9A66B] px-4 py-3 font-medium text-[#0B1F3A] disabled:opacity-60"
            >
              {busy ? t.completing : t.complete}
            </button>
          </form>
        </div>
      )}

      <div className="flex-1" />
    </Frame>
  );
}
