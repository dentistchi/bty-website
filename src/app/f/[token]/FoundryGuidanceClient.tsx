"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useRoomDraft, type DraftFields } from "./useDeviceDraft";
import { useSuggestedName } from "./useSuggestedName";
import { JourneyReading, type Journey } from "./JourneyReading";
import { sanitizeRoomReturn } from "@/lib/bty/foundry/roomReturn";
import { terminalIdentityCopy } from "./terminalIdentityCopy";
import { mergeSnapshot } from "./snapshotMerge";

/**
 * Foundry GUIDANCE room — participant experience for written guidance and live discussion
 * (Slice R4-R2G).
 *
 * The flow: scan → name → read what the Host wrote → say so → answer the training's questions →
 * complete → credit. Same spine, same visual language and same completion contract as the video
 * and PDF rooms; only the middle step differs, because these two types have no artifact for BTY
 * to observe.
 *
 * WHAT THE MIDDLE STEP CLAIMS, EXACTLY.
 *
 * Written guidance: the learner presses "I’ve read this guidance", and that is recorded as
 * having read it — nothing more. It is not a claim about understanding, and the screen never
 * suggests otherwise.
 *
 * Live discussion: the learner presses "I took part in this discussion". BTY DID NOT SEE THE
 * DISCUSSION. It took no attendance, verified nothing, and observed nothing; all it holds is the
 * learner's own statement, and the screen says so in those words rather than reporting the
 * discussion as done. The control is deliberately worded in the first person for that reason —
 * "I took part" is a thing a learner can truthfully say; "Discussion completed" is a thing only
 * a system that watched it could say.
 *
 * The button never awards anything. Core XP arrives with the ordinary completion below it, on
 * the same terms as every other content type.
 */

type Locale = "en" | "ko";
type GuidanceType = "written_guidance" | "live_discussion";

type Stage =
  | "pre_join"
  | "declare"
  | "response"
  | "completed_awarded"
  | "completed_claimable"
  | "closed_incomplete"
  | "closed"
  | "removed"
  | "inactive";

type XpStatus = "awarded" | "claimable" | "owner_ineligible" | "daily_limit" | "none";

type GuidanceInfo = {
  material_text: string;
  completion_prompt: string | null;
  shared_question: string | null;
};

type Snapshot = {
  content_type: GuidanceType;
  event: { title: string; status: "open" | "closed" } | null;
  /** R4-R5C4A — opaque per-participant namespace for the DEVICE-LOCAL draft. Optional:
   *  a server that does not send it simply yields no draft, never an error. */
  participant: { display_name: string; draft_ns?: string } | null;
  /** R4-R5C7A — prefill for the join field; present only pre-join. Optional: absent means no suggestion. */
  suggested_name?: string | null;
  guidance: GuidanceInfo | null;
  declared: boolean;
  journey?: Journey;
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
  eyebrow: (t: GuidanceType) => string;
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
  nameError: string;
  /**
   * R4-R2J — shown ONLY after a reconcile confirmed the learner is not in the room. Joining is
   * server-idempotent (a still-joined session is reused, never duplicated), so asking is free
   * and this never accuses the server of a failure we merely stopped waiting for.
   */
  joinDidNotGoThrough: string;
  /** The heading over the Host's own text. */
  materialHeading: (t: GuidanceType) => string;
  /** What the learner is being asked to do with it, stated without overclaiming. */
  materialLead: (t: GuidanceType) => string;
  /** The declaration control — first person, always. */
  declare: (t: GuidanceType) => string;
  declaring: string;
  /** Shown after declaring: what BTY now holds, in plain words. */
  declared: (t: GuidanceType) => string;
  /** The honesty line for live discussion — what BTY does NOT know. */
  discussionHonesty: string;
  beforeYouFinish: string;
  responsePlaceholder: string;
  responseError: string;
  /**
   * Shown ONLY after we stopped waiting AND asked the server whether it acted, and it had not.
   * Never shown on a timeout alone — a learner whose training is finished must not be told it
   * failed.
   */
  didNotGoThrough: string;
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
  xpAwarded: string;
  xpClaimable: string;
  saveXp: string;
  saving: string;
  savedTitle: string;
  savedBody: string;
  continueToBty: string;
  /** Slice R4-R5B2 — the assigned learner's primary exit; names the Learn tab it returns to. */
  backToLearn: string;
  xpDailyLimit: string;
  xpOwner: string;
  closedTitle: string;
  closedBody: string;
  endedTitle: string;
  endedBody: string;
  removed: string;
  inactive: string;
  unavailable: string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    eyebrow: (t) => (t === "written_guidance" ? "Guidance" : "Team discussion"),
    applyNarration: "Use what you decided in real work this week. You'll see it again in Today.",
    enterName: "Name shown for this training",
    namePlaceholder: "Your name",
    join: "Continue",
    joining: "Opening…",
    nameError: "Add your name to continue.",
    joinDidNotGoThrough: "We couldn’t join the training. Tap again to try.",
    materialHeading: (t) => (t === "written_guidance" ? "Read this" : "Discuss this with your team"),
    materialLead: (t) =>
      t === "written_guidance"
        ? "Your host wrote this for you."
        : "Your host set this out for your team to talk through together.",
    declare: (t) => (t === "written_guidance" ? "I’ve read this guidance" : "I took part in this discussion"),
    declaring: "Saving…",
    declared: (t) =>
      t === "written_guidance"
        ? "Recorded: you've read this guidance."
        : "Recorded: you said you took part.",
    /*
      THE HONESTY LINE. It is not a disclaimer bolted on — it is the only accurate description
      of what this room can know, and the Founder's D1 requires it to be visible rather than
      merely true in the database.
    */
    discussionHonesty: "BTY wasn’t in the room — this is your own word for it, not a record that the discussion happened.",
    beforeYouFinish: "Before you finish",
    responsePlaceholder: "Write your answer.",
    responseError: "Write your answer to finish.",
    didNotGoThrough: "That didn’t go through. Tap again to try.",
    reflectPlaceholder: "Write what already happens.",
    reflectError: "Answer this to finish.",
    sharedHeading: "Show what you understood",
    sharedDisclosure: "Your host will read this answer.",
    sharedPlaceholder: "Write your answer.",
    sharedError: "Answer this to finish.",
    decisionHeading: "Your decision",
    decisionAsk: "What will you do?",
    decisionDisclosure: "This becomes yours to act on.",
    decisionPlaceholder: "Write what you’ll do.",
    decisionError: "Write what you’ll do to finish.",
    complete: "Complete",
    completing: "Completing…",
    trainingComplete: "Training complete",
    xpAwarded: "10 Core XP added.",
    xpClaimable: "Sign in to keep your 10 Core XP.",
    saveXp: "Save my XP",
    saving: "Saving…",
    savedTitle: "Saved",
    savedBody: "This training is now in My Learning.",
    continueToBty: "Continue to BTY",
    backToLearn: "Back to Learn",
    xpDailyLimit: "You’ve reached today’s Core XP limit — the training is still complete.",
    xpOwner: "You created this training, so no Core XP is added.",
    closedTitle: "This training is closed",
    closedBody: "Ask your host to reopen it.",
    endedTitle: "This training ended",
    endedBody: "It closed before you finished.",
    removed: "You’re no longer part of this training.",
    inactive: "This link isn’t active.",
    unavailable: "This training can’t be opened right now.",
  },
  ko: {
    eyebrow: (t) => (t === "written_guidance" ? "가이드" : "팀 논의"),
    applyNarration: "이번 주에 정한 것을 실제 업무에서 해보세요. 오늘 탭에서 다시 볼 수 있어요.",
    enterName: "이 학습에 표시할 이름",
    namePlaceholder: "이름",
    join: "계속하기",
    joining: "여는 중…",
    nameError: "계속하려면 이름을 입력하세요.",
    joinDidNotGoThrough: "훈련에 참여하지 못했습니다. 다시 눌러 주세요.",
    materialHeading: (t) => (t === "written_guidance" ? "이 내용을 읽어 주세요" : "팀과 함께 논의해 주세요"),
    materialLead: (t) =>
      t === "written_guidance" ? "호스트가 직접 작성한 내용입니다." : "호스트가 팀이 함께 이야기하도록 정리한 내용입니다.",
    declare: (t) => (t === "written_guidance" ? "이 가이드를 읽었습니다" : "이 논의에 참여했습니다"),
    declaring: "저장 중…",
    declared: (t) => (t === "written_guidance" ? "기록됨: 이 가이드를 읽었습니다." : "기록됨: 참여했다고 알려 주셨습니다."),
    discussionHonesty: "BTY는 그 자리에 없었습니다. 이것은 본인의 진술이며, 논의가 실제로 있었다는 기록이 아닙니다.",
    beforeYouFinish: "마치기 전에",
    responsePlaceholder: "답을 작성하세요.",
    responseError: "마치려면 답을 작성하세요.",
    didNotGoThrough: "전송되지 않았습니다. 다시 눌러 주세요.",
    reflectPlaceholder: "지금 실제로 어떤 일이 일어나는지 적어 주세요.",
    reflectError: "마치려면 답해 주세요.",
    sharedHeading: "이해한 내용을 보여 주세요",
    sharedDisclosure: "호스트가 이 답을 읽습니다.",
    sharedPlaceholder: "답을 작성하세요.",
    sharedError: "마치려면 답해 주세요.",
    decisionHeading: "당신의 결정",
    decisionAsk: "무엇을 하시겠습니까?",
    decisionDisclosure: "이 결정은 당신이 실행할 몫이 됩니다.",
    decisionPlaceholder: "무엇을 할지 작성하세요.",
    decisionError: "마치려면 무엇을 할지 작성하세요.",
    complete: "완료하기",
    completing: "완료 중…",
    trainingComplete: "훈련 완료",
    xpAwarded: "코어 XP 10 적립되었습니다.",
    xpClaimable: "로그인하면 코어 XP 10을 받을 수 있습니다.",
    saveXp: "내 XP 저장하기",
    saving: "저장 중…",
    savedTitle: "저장됨",
    savedBody: "이 훈련은 이제 내 학습에 있습니다.",
    continueToBty: "BTY로 이동",
    backToLearn: "학습으로 돌아가기",
    xpDailyLimit: "오늘의 코어 XP 한도에 도달했습니다. 훈련은 완료되었습니다.",
    xpOwner: "직접 만든 훈련이라 코어 XP는 적립되지 않습니다.",
    closedTitle: "종료된 훈련입니다",
    closedBody: "호스트에게 다시 열어 달라고 요청하세요.",
    endedTitle: "훈련이 종료되었습니다",
    endedBody: "완료하기 전에 종료되었습니다.",
    removed: "이 훈련의 참여자가 아닙니다.",
    inactive: "유효하지 않은 링크입니다.",
    unavailable: "지금은 이 훈련을 열 수 없습니다.",
  },
};

function resolveLocale(): Locale {
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ko")) return "ko";
  return "en";
}

function Frame({ children }: { children: React.ReactNode }) {
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
 * HOW LONG A LEARNER WAITS BEFORE WE STOP WAITING AND GO AND ASK (Slice R4-R2G-R1).
 *
 * MEASURED, not guessed. On the first production written-guidance completion the durable write
 * landed at 18:37:38.61 — seconds after the tap — and the learner sat on "Completing…" until
 * ~18:49. The training was finished in the database for twelve minutes while the screen said it
 * was still going, because the UI's only notion of "done" was the HTTP response arriving, and
 * nothing bounded that wait. There is no retry or backoff anywhere in this client; it was one
 * request with no ceiling.
 *
 * Twenty seconds is far beyond the handful of sequential round-trips a completion performs, so a
 * healthy request is never cut short — and a stalled one stops being invisible.
 */
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * `AbortController` + `setTimeout` rather than `AbortSignal.timeout`, because this room is opened
 * inside the native shell's WKWebView on whatever iOS the learner happens to carry, and the older
 * form is the one that is universally present.
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

const guidanceApi = (token: string, path = "") =>
  `/api/bty/foundry/public/${encodeURIComponent(token)}/guidance${path}`;

function deviceTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export default function FoundryGuidanceClient({
  token,
  contentType,
}: {
  token: string;
  /** Resolved SERVER-SIDE from the signed token before this client mounts. */
  contentType: GuidanceType;
}) {
  const [locale, setLocale] = useState<Locale>("en");
  /*
    THE CANONICAL RETURN, READ WHERE THE ENDING IS DECIDED (Slice R4-R5B2).

    `Frame` has always read this to draw the small back link; the terminal state never had it, which
    is why this room's finish button went to `/` — the site root — even for a learner who arrived
    from inside the app. Same helper, same mount-time read, same strict allow-list: this is the read
    the video and document rooms have both had all along, not a new mechanism.
  */
  const [roomReturn] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? sanitizeRoomReturn(new URLSearchParams(window.location.search).get("return"))
      : null,
  );
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
  const [nameError, setNameError] = useState(false);
  const [joinError, setJoinError] = useState(false);
  const [response, setResponse] = useState("");
  const [responseError, setResponseError] = useState(false);
  const [sharedResponse, setSharedResponse] = useState("");
  const [sharedError, setSharedError] = useState(false);
  const [decisionResponse, setDecisionResponse] = useState("");
  const [decisionError, setDecisionError] = useState(false);
  const [reflectResponse, setReflectResponse] = useState("");

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

  const [reflectError, setReflectError] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [claimed, setClaimed] = useState(false);

  const t = COPY[locale];
  /* R4-R3B1 — decided by the domain authority from the frozen snapshot, never by this component. */
  const identity = terminalIdentityCopy(snapshot?.follow_up_days, locale);

  useEffect(() => setLocale(resolveLocale()), []);

  /** Refresh from the server and RETURN what it said, so a caller can reconcile against it. */
  const load = useCallback(async (): Promise<Snapshot | null> => {
    try {
      const res = await fetch(guidanceApi(token, "/snapshot"), {
        credentials: "include",
        cache: "no-store",
        signal: timeoutSignal(),
      });
      const next = (await res.json()) as Snapshot;
      setSnapshot(next);
      return next;
    } catch {
      setSnapshot((prev) =>
        prev ?? {
          content_type: contentType,
          event: null,
          participant: null,
          guidance: null,
          declared: false,
          stage: "inactive",
          xp_status: "none",
        },
      );
      return null;
    } finally {
      setLoaded(true);
    }
  }, [token, contentType]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = useCallback(
    async (path: string, body?: unknown): Promise<PostResult> => {
      try {
        const res = await fetch(guidanceApi(token, path), {
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
          server may well have acted, and on the completion path it demonstrably did. So this
          reports only that we do not know, and the caller must go and ask.
        */
        return { ok: false, status: 0, data: null, settled: false };
      }
    },
    [token],
  );

  /** What the room falls back to when an action lands before the first load resolves. */
  const EMPTY_SNAPSHOT: Snapshot = useMemo(
    () => ({
      content_type: contentType,
      event: null,
      participant: null,
      guidance: null,
      declared: false,
      journey: null,
      reflection_required: false,
      stage: "inactive",
      xp_status: "none",
    }),
    [contentType],
  );

  /**
   * MERGE, NEVER REBUILD — the rule this room stated and then broke (Slice R4-R3B1-R1).
   *
   * The header above already said a field-by-field rebuild drops any key the response does not
   * carry. It then listed the keys anyway, so when `follow_up_days` was added to the snapshot it
   * was dropped here: `load()` fetched 7, the learner declared, this rebuilt the object without
   * it, and the terminal fell back to XP-only copy on a training that HAD a 7-day checkpoint.
   * That was the Founder's screen. The rule is now enforced by shape rather than by memory —
   * `prev` is the base, only SUPPLIED fields overwrite it. See `snapshotMerge.ts`.
   */
  const applyResult = useCallback(
    (data: unknown) => {
      const d = data as (Partial<Snapshot> & { ok?: boolean; applyWindow?: string }) | null;
      if (d?.ok && d.stage) {
        /*
          R4-R5C9A — capture the server's Apply outcome. STICKY: only a positive outcome writes, so a
          later action response that carries no field cannot retract a true statement.
        */
        if (d.applyWindow === "created" || d.applyWindow === "exists") setApplyWindow(d.applyWindow);
        setSnapshot((prev) =>
          mergeSnapshot<Snapshot>(prev, d, EMPTY_SNAPSHOT, { content_type: contentType, stage: d.stage! }),
        );
        return true;
      }
      return false;
    },
    [contentType, EMPTY_SNAPSHOT],
  );

  const onJoin = useCallback(async () => {
    if (busyRef.current) return;
    if (name.trim().length < 1) return setNameError(true);
    busyRef.current = true;
    setBusy(true);
    setNameError(false);
    setJoinError(false);
    try {
      /*
        THE LAST UNBOUNDED REQUEST IN THIS CLIENT (Slice R4-R2J).

        R4-R2G bounded `load()` and `post()` here and left this raw fetch behind — the audit
        found it. It held `busyRef`, which every handler checks first, so a stalled join pinned
        the room's interaction lock and the button read "Opening…" indefinitely; a rejected one
        propagated past the missing catch as an unhandled rejection and left the form silently
        unchanged.

        Retrying is safe without any new logic: `joinEvent` reuses a still-joined session and
        creates no second participant, so the honest move on an uncertain outcome is to ASK
        whether the learner is already in the room.
      */
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
      // The name rules are the SERVER's answer, so they apply only when the server actually replied.
      if (!res.ok && (d?.error === "name_required" || d?.error === "name_too_long")) {
        setNameError(true);
        return;
      }
      const reconciled = await load();
      if (!res.ok && !reconciled?.participant) setJoinError(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [name, token, load]);

  /** The learner's own exposure declaration. Awards nothing; unlocks the completion step. */
  const onDeclare = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setSubmitError(false);
    try {
      const r = await post("/declare");
      if (r.settled) {
        if (!applyResult(r.data)) await load();
        return;
      }
      // Stopped waiting: the stamp is write-once, so ASK whether it landed.
      const reconciled = await load();
      if (!reconciled?.declared) setSubmitError(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [post, applyResult, load]);

  const onComplete = useCallback(async () => {
    if (busyRef.current) return;
    if (response.trim().length < 1) return setResponseError(true);
    busyRef.current = true;
    setBusy(true);
    setSubmitError(false);
    try {
      const r = await post("/complete", {
        response_text: response.trim(),
        shared_response: sharedResponse.trim() || undefined,
        decision_response: decisionResponse.trim() || undefined,
        reflection_response: reflectResponse.trim() || undefined,
        tz: deviceTz(),
      });

      /*
        THE RECONCILE, and the reason this repair exists (Slice R4-R2G-R1).

        A completion that does not answer in time has NOT necessarily failed. In production it had
        already succeeded — the row was written seconds after the tap — and the only thing missing
        was the response. Server-side completion is idempotent (`.is("completed_at", null)` plus an
        early return once complete), so asking again is free and cannot double-award.

        So we ask, and we believe the answer: finished ⇒ the learner sees their finished training;
        not finished ⇒ one honest, retryable sentence. Never an indefinite "Completing…", and never
        a failure message over a training that is done.
      */
      if (!r.settled) {
        const reconciled = await load();
        if (!isCompletedStage(reconciled)) setSubmitError(true);
        return;
      }

      const err = (r.data as { error?: string } | null)?.error;
      if (err === "shared_response_required") setSharedError(true);
      else if (err === "decision_required") setDecisionError(true);
      else if (err === "reflection_required") setReflectError(true);
      else if (err === "response_required" || err === "response_too_long") setResponseError(true);
      else if (!applyResult(r.data)) {
        const reconciled = await load();
        if (!isCompletedStage(reconciled)) setSubmitError(true);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [response, sharedResponse, decisionResponse, reflectResponse, post, applyResult, load]);

  const onClaim = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await post("/claim-xp", { tz: deviceTz() });
      if (!r.settled) {
        await load();
        return;
      }
      if (r.status === 401) {
        /*
          LOCALE-PREFIXED, LIKE ITS TWO SIBLINGS (Slice R4-R3B1-R1).

          This sent the learner to `/bty/login?next=…`. The platform 307s an unprefixed path to
          `/en/bty/login` and the redirect DROPS THE QUERY STRING, so login received no return
          target and defaulted to `/en/bty` — the legacy Arena page. The Founder signed in, landed
          there, and the claim endpoint was never reached: `linked_user_id`, `xp_awarded_at`, the
          follow-up and the apply window were all still empty afterwards, with `updated_at`
          unchanged since completion.

          The two other learner rooms have always prefixed the locale. Ownership is untouched by
          this: the participant cookie is host-only on an origin the learner never leaves, and the
          claim still requires room token + matching session cookie + authenticated user.
        */
        window.location.href = `/${locale}/bty/login?next=${encodeURIComponent(`/f/${token}`)}`;
        return;
      }
      if (applyResult(r.data)) setClaimed(true);
      else await load();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    /*
      `locale` and `token` BELONG HERE (Slice R4-R3B1-R1). Without them this callback closes over
      the FIRST render's locale, which is always the "en" default because the device locale is
      resolved in a mount effect. A Korean learner pressing this button would have been sent to
      the English login and back into an English shell, silently. Join and Document have always
      carried both; this room was the outlier. The KO regression drives the device path rather
      than reading the template, which is why it caught this and a URL-shape assertion would not.
    */
  }, [post, applyResult, load, locale, token]);

  if (!loaded || !snapshot) {
    return (
      <Frame>
        <Centered>
          <div className="h-8 w-8 animate-pulse rounded-full bg-white/15" />
        </Centered>
      </Frame>
    );
  }

  const stage = snapshot.stage;

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
          <h1 className="text-lg font-semibold">{t.closedTitle}</h1>
          <p className="mt-2 text-sm text-white/70">{t.closedBody}</p>
        </Centered>
      </Frame>
    );
  }
  if (stage === "closed_incomplete") {
    return (
      <Frame>
        <Centered>
          <h1 className="text-lg font-semibold">{t.endedTitle}</h1>
          <p className="mt-2 text-sm text-white/70">{t.endedBody}</p>
        </Centered>
      </Frame>
    );
  }

  if (stage === "pre_join") {
    return (
      <Frame>
        <Centered>
          <Eyebrow>{t.eyebrow(contentType)}</Eyebrow>
          <h1 className="mt-2 text-lg font-semibold leading-tight">{snapshot.event?.title}</h1>
          <p className="mt-6 text-sm text-white/70">{t.enterName}</p>
          <form
            className="mt-3 w-full"
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
              aria-label={t.enterName}
              aria-invalid={nameError}
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-center text-white placeholder-white/40 outline-none focus:bg-white/15"
            />
            {nameError && <p className="mt-2 text-xs text-red-300">{t.nameError}</p>}
            {joinError && (
              <p className="mt-2 text-xs text-red-300" data-testid="guidance-join-error">
                {t.joinDidNotGoThrough}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="mt-3 w-full rounded-xl bg-[#C9A66B] px-4 py-3 font-medium text-[#0B1F3A] disabled:opacity-60"
            >
              {busy ? t.joining : t.join}
            </button>
          </form>
        </Centered>
      </Frame>
    );
  }

  if (stage === "completed_awarded" || stage === "completed_claimable") {
    const xp = snapshot.xp_status;
    return (
      <Frame>
        <Centered>
          <div className="w-full">
            <h1 className="text-lg font-semibold">{claimed ? t.savedTitle : t.trainingComplete}</h1>
            {claimed ? (
              <p className="mt-2 text-sm text-white/70">{t.savedBody}</p>
            ) : xp === "awarded" ? (
              <>
                <p className="mt-2 text-sm text-emerald-300/90">{t.xpAwarded}</p>
                {/*
                  Repair E (R4-R5B2) — see the full note in FoundryJoinClient. Only `meaning` is
                  reused: it is the one sentence that stays true for a learner already signed in
                  whose XP is already awarded. No checkpoint → nothing said.
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
            ) : xp === "daily_limit" ? (
              <p className="mt-2 text-sm text-white/70">{t.xpDailyLimit}</p>
            ) : xp === "owner_ineligible" ? (
              <p className="mt-2 text-sm text-white/70">{t.xpOwner}</p>
            ) : (
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
                  onClick={() => void onClaim()}
                  disabled={busy}
                  data-testid="guidance-claim-xp"
                  className="mt-4 w-full rounded-xl bg-[#C9A66B] px-4 py-3 font-medium text-[#0B1F3A] disabled:opacity-60"
                >
                  {busy ? t.saving : t.saveXp}
                </button>
              </>
            )}
            {/*
              THE CANONICAL RETURN WINS OVER THE SITE ROOT (Slice R4-R5B2).

              This was `href="/"` unconditionally — the root, which then resolves through locale
              routing to wherever the app happens to send a fresh visit. For a learner who arrived
              from Required Learning that is strictly worse than the place they came from, and it
              discarded a validated destination the room was already holding.

              With a `roomReturn` the anchor uses it VERBATIM and the label names it. Without one —
              every open-link and QR visitor — the previous behaviour is untouched, deliberately:
              a visitor who never came from the app has no app context to be returned to.
            */}
            {(claimed || xp === "awarded") && (
              <a
                href={roomReturn ?? "/"}
                data-testid={roomReturn ? "assigned-return" : "continue-to-bty"}
                className="mt-4 inline-block rounded-xl bg-[#C9A66B] px-5 py-3 text-base font-semibold text-[#0B1F3A]"
              >
                {roomReturn ? t.backToLearn : t.continueToBty}
              </a>
            )}
          </div>
        </Centered>
      </Frame>
    );
  }

  // declare / response — the Host's text is always visible; the questions unlock once declared.
  const guidance = snapshot.guidance;
  if (!guidance) {
    return (
      <Frame>
        <Centered>
          <p className="text-sm text-white/70">{t.unavailable}</p>
        </Centered>
      </Frame>
    );
  }

  const declared = snapshot.declared;
  const actionDecisionContext =
    snapshot.journey?.elements.find((e) => e.kind === "action_decision")?.content ?? null;
  const sharedQuestion = guidance.shared_question;
  const reflectRequired = Boolean(snapshot.reflection_required);

  return (
    <Frame>
      <div className="pt-2">
        <Eyebrow>{t.eyebrow(contentType)}</Eyebrow>
        <h1 className="mt-2 text-lg font-semibold leading-tight">{snapshot.event?.title}</h1>
      </div>

      {/* The authored program, before the material — the same order the video and PDF rooms use. */}
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

      {/*
        THE MATERIAL ITSELF — the Host's own words, rendered as learning content and not as
        metadata. `whitespace-pre-wrap` because a Host writing an agenda writes it in lines.
      */}
      <section className="mt-6" data-testid="guidance-material">
        <Eyebrow>{t.materialHeading(contentType)}</Eyebrow>
        <p className="mt-2 text-xs text-white/50">{t.materialLead(contentType)}</p>
        <p className="mt-3 whitespace-pre-wrap text-[0.95rem] leading-7 text-white/90" data-testid="guidance-material-text">
          {guidance.material_text}
        </p>
      </section>

      {/*
        THE DECLARATION. Rendered AFTER the material, never before it — for written guidance the
        Founder's D2 requires the acknowledgement to follow the rendering, and for live discussion
        the topic has to be readable before anyone can say they discussed it.
      */}
      <div className="mt-6">
        {declared ? (
          <p className="text-sm text-emerald-300/90" data-testid="guidance-declared">
            {t.declared(contentType)}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => void onDeclare()}
            disabled={busy}
            data-testid="guidance-declare"
            className="w-full rounded-xl border border-[#C9A66B]/50 bg-[#C9A66B]/[0.08] px-4 py-3 font-medium text-white disabled:opacity-60"
          >
            {busy ? t.declaring : t.declare(contentType)}
          </button>
        )}
        {submitError && !declared && (
          <p className="mt-2 text-xs text-red-300" data-testid="guidance-declare-error">
            {t.didNotGoThrough}
          </p>
        )}
        {contentType === "live_discussion" && (
          <p className="mt-2 text-xs leading-5 text-white/50" data-testid="guidance-discussion-honesty">
            {t.discussionHonesty}
          </p>
        )}
      </div>

      {declared && (
        <div className="mt-8">
          <Eyebrow>{t.beforeYouFinish}</Eyebrow>
          {guidance.completion_prompt && (
            <p className="mt-2 text-sm text-white/85" data-testid="guidance-completion-prompt">
              {guidance.completion_prompt}
            </p>
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
              aria-label={t.beforeYouFinish}
              className="w-full resize-none rounded-xl bg-white/10 px-4 py-3 text-white placeholder-white/40 outline-none focus:bg-white/15"
            />
            {responseError && <p className="mt-2 text-xs text-red-300">{t.responseError}</p>}

            {actionDecisionContext && (
              <div className="mt-6 rounded-xl border border-[#C9A66B]/40 bg-[#C9A66B]/[0.06] p-4" data-testid="decision-section">
                <Eyebrow>{t.decisionHeading}</Eyebrow>
                <p className="mt-2 text-sm leading-6 text-white/70" data-testid="decision-context">
                  {actionDecisionContext}
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-white/90">{t.decisionAsk}</p>
                <p className="mt-1 text-xs text-[#C9A66B]/90">{t.decisionDisclosure}</p>
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
                {decisionError && <p className="mt-2 text-xs text-red-300">{t.decisionError}</p>}
              </div>
            )}

            {sharedQuestion && (
              <div className="mt-6 rounded-xl border border-[#C9A66B]/40 bg-[#C9A66B]/[0.06] p-4" data-testid="shared-understanding-section">
                <Eyebrow>{t.sharedHeading}</Eyebrow>
                <p className="mt-2 text-sm text-white/85">{sharedQuestion}</p>
                <p className="mt-1 text-xs text-[#C9A66B]/90">{t.sharedDisclosure}</p>
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
              data-testid="guidance-complete"
              className="mt-3 w-full rounded-xl bg-[#C9A66B] px-4 py-3 font-medium text-[#0B1F3A] disabled:opacity-60"
            >
              {busy ? t.completing : t.complete}
            </button>
            {submitError && (
              <p className="mt-2 text-xs text-red-300" data-testid="guidance-submit-error">
                {t.didNotGoThrough}
              </p>
            )}
          </form>
        </div>
      )}

      <div className="flex-1" />
    </Frame>
  );
}
