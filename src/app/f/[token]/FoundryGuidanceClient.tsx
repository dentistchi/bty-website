"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { JourneyReading, type Journey } from "./JourneyReading";
import { sanitizeRoomReturn } from "@/lib/bty/foundry/roomReturn";

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
  participant: { display_name: string } | null;
  guidance: GuidanceInfo | null;
  declared: boolean;
  journey?: Journey;
  reflection_required?: boolean;
  stage: Stage;
  xp_status: XpStatus;
};

type Copy = {
  eyebrow: (t: GuidanceType) => string;
  enterName: string;
  namePlaceholder: string;
  join: string;
  joining: string;
  nameError: string;
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
    enterName: "What's your name?",
    namePlaceholder: "Your name",
    join: "Continue",
    joining: "Opening…",
    nameError: "Add your name to continue.",
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
    enterName: "이름이 어떻게 되나요?",
    namePlaceholder: "이름",
    join: "계속하기",
    joining: "여는 중…",
    nameError: "계속하려면 이름을 입력하세요.",
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
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [response, setResponse] = useState("");
  const [responseError, setResponseError] = useState(false);
  const [sharedResponse, setSharedResponse] = useState("");
  const [sharedError, setSharedError] = useState(false);
  const [decisionResponse, setDecisionResponse] = useState("");
  const [decisionError, setDecisionError] = useState(false);
  const [reflectResponse, setReflectResponse] = useState("");
  const [reflectError, setReflectError] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [claimed, setClaimed] = useState(false);

  const t = COPY[locale];

  useEffect(() => setLocale(resolveLocale()), []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(guidanceApi(token, "/snapshot"), { credentials: "include", cache: "no-store" });
      setSnapshot((await res.json()) as Snapshot);
    } catch {
      setSnapshot({
        content_type: contentType,
        event: null,
        participant: null,
        guidance: null,
        declared: false,
        stage: "inactive",
        xp_status: "none",
      });
    } finally {
      setLoaded(true);
    }
  }, [token, contentType]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = useCallback(
    async (path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: unknown }> => {
      const res = await fetch(guidanceApi(token, path), {
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

  /**
   * MERGE, NEVER REBUILD — the same rule the PDF room learned the hard way (3.2R-R8A-R1): a
   * field-by-field rebuild silently drops any key the response does not carry, and the learner
   * watches the program vanish a second after it appears.
   */
  const applyResult = useCallback(
    (data: unknown) => {
      const d = data as (Partial<Snapshot> & { ok?: boolean }) | null;
      if (d?.ok && d.stage) {
        setSnapshot((prev) => ({
          content_type: contentType,
          event: d.event ?? prev?.event ?? null,
          participant: d.participant ?? prev?.participant ?? null,
          guidance: d.guidance ?? prev?.guidance ?? null,
          declared: d.declared ?? prev?.declared ?? false,
          journey: d.journey ?? prev?.journey ?? null,
          reflection_required: d.reflection_required ?? prev?.reflection_required ?? false,
          stage: d.stage!,
          xp_status: d.xp_status ?? "none",
        }));
        return true;
      }
      return false;
    },
    [contentType],
  );

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
      if (!res.ok && (d?.error === "name_required" || d?.error === "name_too_long")) setNameError(true);
      await load();
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
    try {
      const r = await post("/declare");
      if (!applyResult(r.data)) await load();
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
    try {
      const r = await post("/complete", {
        response_text: response.trim(),
        shared_response: sharedResponse.trim() || undefined,
        decision_response: decisionResponse.trim() || undefined,
        reflection_response: reflectResponse.trim() || undefined,
        tz: deviceTz(),
      });
      const err = (r.data as { error?: string } | null)?.error;
      if (err === "shared_response_required") setSharedError(true);
      else if (err === "decision_required") setDecisionError(true);
      else if (err === "reflection_required") setReflectError(true);
      else if (err === "response_required" || err === "response_too_long") setResponseError(true);
      else if (!applyResult(r.data)) await load();
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
      if (r.status === 401) {
        window.location.href = `/bty/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      if (applyResult(r.data)) setClaimed(true);
      else await load();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [post, applyResult, load]);

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
              <p className="mt-2 text-sm text-emerald-300/90">{t.xpAwarded}</p>
            ) : xp === "daily_limit" ? (
              <p className="mt-2 text-sm text-white/70">{t.xpDailyLimit}</p>
            ) : xp === "owner_ineligible" ? (
              <p className="mt-2 text-sm text-white/70">{t.xpOwner}</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-white/70">{t.xpClaimable}</p>
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
            {(claimed || xp === "awarded") && (
              <a
                href="/"
                className="mt-4 inline-block rounded-xl bg-[#C9A66B] px-5 py-3 text-base font-semibold text-[#0B1F3A]"
              >
                {t.continueToBty}
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
                  disabled: busy,
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
          </form>
        </div>
      )}

      <div className="flex-1" />
    </Frame>
  );
}
