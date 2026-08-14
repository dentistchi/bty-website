"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PdfReader, type ReadingHeartbeat } from "./PdfReader";
import { JourneyReading, type Journey } from "./JourneyReading";
import { sanitizeRoomReturn } from "@/lib/bty/foundry/roomReturn";

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
  participant: { display_name: string } | null;
  document: DocInfo | null;
  /** The published program, from the frozen event snapshot (Slice 3.2R-R8A). */
  journey?: Journey;
  /** This event asks a distinct REFLECT question — server-derived (Slice 3.2R-R8B). */
  reflection_required?: boolean;
  stage: Stage;
  xp_status: XpStatus;
};

type Copy = {
  eyebrow: string;
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
  trainingComplete: string;
  xpAwarded: string;
  xpClaimable: string;
  saveXp: string;
  savedTitle: string;
  savedBody: string;
  continueToBty: string;
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
  pdfLoading: string;
  pdfUnavailable: string;
  pdfUnavailableHint: string;
  pageOf: (page: number, total: number) => string;
  prev: string;
  nextPage: string;
  continueToReflection: string;
  docLoadError: string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    eyebrow: "FOUNDRY",
    enterName: "Enter your name to join.",
    namePlaceholder: "Your name",
    join: "Join",
    joining: "Joining…",
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
    trainingComplete: "TRAINING COMPLETE",
    xpAwarded: "+10 Core XP",
    xpClaimable: "10 Core XP is ready to save.",
    saveXp: "Save XP to BTY",
    savedTitle: "Saved to your BTY",
    savedBody: "Your reflection is private and available in My Learning.",
    continueToBty: "Continue to BTY",
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
    pdfLoading: "Loading…",
    pdfUnavailable: "The document could not be loaded.",
    pdfUnavailableHint: "Reload the page, or ask the host to check the event.",
    pageOf: (p, t) => `${p} / ${t}`,
    prev: "Back",
    nextPage: "Next page",
    continueToReflection: "Continue to reflection",
    docLoadError: "This document is not available. Ask the host to check the event.",
  },
  ko: {
    eyebrow: "FOUNDRY",
    enterName: "이름을 입력하고 입장하세요.",
    namePlaceholder: "이름",
    join: "입장",
    joining: "입장 중…",
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
    trainingComplete: "훈련 완료",
    xpAwarded: "+10 Core XP",
    xpClaimable: "10 Core XP를 저장할 수 있습니다.",
    saveXp: "BTY에 XP 저장",
    savedTitle: "BTY에 저장되었습니다",
    savedBody: "이 성찰은 비공개이며 내 학습에서 다시 볼 수 있습니다.",
    continueToBty: "BTY로 계속하기",
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
    pdfLoading: "불러오는 중…",
    pdfUnavailable: "문서를 불러오지 못했습니다.",
    pdfUnavailableHint: "다시 시도하거나 호스트에게 문의하세요.",
    pageOf: (p, t) => `${p} / ${t}`,
    prev: "이전",
    nextPage: "다음 페이지",
    continueToReflection: "성찰로 계속",
    docLoadError: "문서를 사용할 수 없습니다. 호스트에게 확인을 요청하세요.",
  },
};

function resolveLocale(): Locale {
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ko")) return "ko";
  return "en";
}

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
  return <span className="text-xs font-medium uppercase tracking-[0.18em] text-[#C9A66B]/90">{children}</span>;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center text-center">{children}</div>;
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

export default function FoundryDocumentClient({ token }: { token: string }) {
  const [locale, setLocale] = useState<Locale>("en");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [response, setResponse] = useState("");
  // Shared Understanding answer (Slice 3.1B-3G) — SEPARATE state from the private `response`.
  const [sharedResponse, setSharedResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [responseError, setResponseError] = useState(false);
  // The REFLECT answer (Slice 3.2R-R8B) — a different question, a different column, its own state.
  const [reflectResponse, setReflectResponse] = useState("");
  const [reflectError, setReflectError] = useState(false);
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

  // "Continue to reflection" (final page, reading requirement met) reveals the
  // already-rendered, server-unlocked reflection form. It never fakes completion —
  // the reflection only exists in the DOM when the server marked reading_complete.
  const onContinue = useCallback(() => {
    reflectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => setLocale(resolveLocale()), []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(docApi(token, "/snapshot"), { credentials: "include", cache: "no-store" });
      setSnapshot((await res.json()) as Snapshot);
    } catch {
      setSnapshot({ content_type: "document", event: null, participant: null, document: null, stage: "inactive", xp_status: "none" });
    } finally {
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = useCallback(
    async (path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: unknown }> => {
      const res = await fetch(docApi(token, path), {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, data };
    },
    [token],
  );

  const applyResult = useCallback((data: unknown) => {
    const d = data as (Partial<Snapshot> & { ok?: boolean }) | null;
    if (d?.ok && d.stage) {
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
      */
      setSnapshot((prev) => ({
        content_type: "document",
        event: d.event ?? null,
        participant: d.participant ?? null,
        document: d.document ?? null,
        journey: d.journey ?? prev?.journey ?? null,
        reflection_required: d.reflection_required ?? prev?.reflection_required ?? false,
        stage: d.stage!,
        xp_status: d.xp_status ?? "none",
      }));
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
        const res = await fetch(docApi(token, "/file"), { credentials: "include", cache: "no-store" });
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
    try {
      // Join reuses the content-agnostic public join route.
      const res = await fetch(`/api/bty/foundry/public/${encodeURIComponent(token)}/join`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: name.trim() }),
      });
      const d = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.ok) await load();
      else if (d?.error === "name_required" || d?.error === "name_too_long") setNameError(true);
      else await load();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [name, token, load]);

  const onHeartbeat = useCallback(
    (beat: ReadingHeartbeat) => {
      // Fire-and-forget; apply the returned snapshot so reading_complete unlocks
      // the reflection without a hard stage switch.
      void post("/reading", {
        last_page: beat.lastPage,
        viewed_pages: beat.viewedPages,
        active_ms_delta: beat.activeMsDelta,
      }).then(({ data }) => {
        applyResult(data);
      });
    },
    [post, applyResult],
  );

  const sharedQuestion = snapshot?.document?.shared_question ?? null;
  /*
    WHETHER A REFLECT ANSWER IS OWED IS THE SERVER'S ANSWER, NOT THIS COMPONENT'S (3.2R-R8B).
    The client renders the control the snapshot tells it to and sends what it collected; the
    server re-derives the requirement from the frozen event and refuses if it disagrees.
  */
  const reflectRequired = Boolean(snapshot?.reflection_required);
  const onComplete = useCallback(async () => {
    if (busyRef.current) return;
    if (reflectRequired && reflectResponse.trim().length < 1) return setReflectError(true);
    if (response.trim().length < 1) return setResponseError(true);
    // A configured shared question requires a non-empty shared answer BEFORE completion.
    if (sharedQuestion && sharedResponse.trim().length < 1) return setSharedError(true);
    busyRef.current = true;
    setBusy(true);
    setResponseError(false);
    setSharedError(false);
    setReflectError(false);
    try {
      const { ok, data } = await post("/complete", {
        response_text: response.trim(),
        ...(sharedQuestion ? { shared_response: sharedResponse.trim() } : {}),
        ...(reflectRequired ? { reflection_response: reflectResponse.trim() } : {}),
        tz: deviceTz(),
      });
      const d = data as { error?: string } | null;
      if (ok) applyResult(data);
      else if (d?.error === "reflection_required") setReflectError(true);
      else if (d?.error === "response_required" || d?.error === "response_too_long") setResponseError(true);
      else if (d?.error === "shared_response_required" || d?.error === "shared_response_too_long" || d?.error === "response_too_long")
        setSharedError(true);
      else await load();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [response, sharedResponse, sharedQuestion, reflectRequired, reflectResponse, post, applyResult, load]);

  const onClaim = useCallback(
    async (silent: boolean) => {
      if (busyRef.current) return;
      busyRef.current = true;
      if (!silent) setBusy(true);
      try {
        const { ok, status, data } = await post("/claim-xp", { tz: deviceTz() });
        if (ok) applyResult(data);
        else if (status === 401 && !silent) {
          const next = encodeURIComponent(`/f/${token}`);
          window.location.href = `/${locale}/bty/login?next=${next}`;
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [post, applyResult, token, locale],
  );

  // One silent claim-xp on EITHER terminal completion stage so the assignment connects
  // (claim-xp is the SOLE surface that runs claimAssignmentForParticipant). completed_claimable
  // = XP still to award (anonymous-then-auth); completed_awarded = an authenticated
  // completeDocumentTraining already awarded XP inline (Slice 3.1B-3F). WITHOUT covering the
  // awarded stage, an authenticated PDF learner's assignment is never connected and the Required
  // Learning card never moves to Completed — the video client already reconciles on
  // completed_awarded (FoundryJoinClient); this brings the document path to parity. Idempotent:
  // autoClaimedRef fires once per mount, the server claim is already_claimed-safe, and the
  // awarded early-return still connects the assignment with NO second XP award.
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
              setName(e.target.value);
              setNameError(false);
            }}
            maxLength={60}
            placeholder={t.namePlaceholder}
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white placeholder-white/40 outline-none focus:bg-white/15"
          />
          {nameError && <p className="mt-2 text-xs text-red-300">{t.nameError}</p>}
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
              <p className="text-lg font-semibold text-[#C9A66B]">{t.xpAwarded}</p>
            )}
            {xp === "claimable" && (
              <>
                <p className="text-sm text-white/80">{t.xpClaimable}</p>
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
          </div>
        </Centered>
      </Frame>
    );
  }

  // read / response — reader always visible; reflection unlocks when reading is done.
  const doc = snapshot.document;
  const readingComplete = Boolean(doc?.reading_complete);
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
                  disabled: busy,
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
              continueToReflection: t.continueToReflection,
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

            {sharedQuestion && (
              /* Shared Understanding — VISUALLY + semantically separate from the private reflection
                 above. The learner is explicitly told this answer is shared with the Host. */
              <div className="mt-6 rounded-xl border border-[#C9A66B]/40 bg-[#C9A66B]/[0.06] p-4" data-testid="shared-understanding-section">
                <Eyebrow>{t.sharedHeading}</Eyebrow>
                <p className="mt-2 text-sm text-white/85">{sharedQuestion}</p>
                <p className="mt-1 text-xs text-[#C9A66B]/90" data-testid="shared-disclosure">{t.sharedDisclosure}</p>
                <textarea
                  value={sharedResponse}
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
