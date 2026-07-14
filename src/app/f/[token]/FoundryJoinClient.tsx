"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { YouTubePlayer } from "./YouTubePlayer";
import type { CompletionState } from "@/domain/foundry/watch-integrity";
import type { LivingReflection } from "@/domain/foundry/living-reflection";
import { selectReflectionPrompt, selectCheckpointPrompt } from "@/lib/bty/foundry/events/reflectionExpression";
import { keepScreenAwake, type WakeLockController } from "@/lib/native/keepAwake";

type Locale = "en" | "ko";

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

type Snapshot = {
  event: { title: string; status: "open" | "closed" } | null;
  participant: { display_name: string } | null;
  training: { youtube_video_id: string; completion_prompt: string | null } | null;
  stage: Stage;
  xp_status: XpStatus;
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
  complete: string;
  completing: string;
  trainingComplete: string;
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
    complete: "Complete training",
    completing: "Saving…",
    trainingComplete: "TRAINING COMPLETE",
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
    complete: "훈련 완료",
    completing: "저장 중…",
    trainingComplete: "훈련 완료",
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
  return (
    <main
      className="flex min-h-[100dvh] flex-col bg-[#0B1F3A] text-white antialiased"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6">{children}</div>
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

export default function FoundryJoinClient({ token }: { token: string }) {
  const [locale, setLocale] = useState<Locale>("en");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [responseError, setResponseError] = useState(false);
  const [playerError, setPlayerError] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [checkpoint, setCheckpoint] = useState<{ index: number; resume: () => void } | null>(null);
  const [reflection, setReflection] = useState<LivingReflection | null>(null);
  const [reflectionLoading, setReflectionLoading] = useState(false);
  const busyRef = useRef(false);
  const autoClaimedRef = useRef(false);
  const completionStateRef = useRef<CompletionState | null>(null);
  const wakeRef = useRef<WakeLockController | null>(null);
  const reflectionRequestedRef = useRef(false);

  const t = COPY[locale];

  useEffect(() => setLocale(resolveLocale()), []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(api(token), { credentials: "include", cache: "no-store" });
      setSnapshot((await res.json()) as Snapshot);
    } catch {
      setSnapshot({ event: null, participant: null, training: null, stage: "inactive", xp_status: "none" });
    } finally {
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = useCallback(
    async (path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: unknown }> => {
      const res = await fetch(api(token, path), {
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
    const d = data as { ok?: boolean; event?: Snapshot["event"]; participant?: Snapshot["participant"]; training?: Snapshot["training"]; stage?: Stage; xp_status?: Snapshot["xp_status"] } | null;
    if (d?.ok && d.stage) {
      setSnapshot({
        event: d.event ?? null,
        participant: d.participant ?? null,
        training: d.training ?? null,
        stage: d.stage,
        xp_status: d.xp_status ?? "none",
      });
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
    try {
      const { ok, data } = await post("/join", { display_name: name.trim() });
      const d = data as { error?: string } | null;
      if (ok) await load();
      else if (d?.error === "name_required" || d?.error === "name_too_long") setNameError(true);
      else await load();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [name, post, load]);

  const onVideoStarted = useCallback(() => {
    void post("/progress/start");
  }, [post]);

  const onVideoEnded = useCallback(async () => {
    const { data } = await post("/progress/video-complete");
    if (!applyResult(data)) await load();
  }, [post, applyResult, load]);

  const onComplete = useCallback(async () => {
    if (busyRef.current) return;
    if (response.trim().length < 1) return setResponseError(true);
    busyRef.current = true;
    setBusy(true);
    setResponseError(false);
    try {
      const { ok, data } = await post("/progress/complete", { response_text: response.trim() });
      const d = data as { error?: string } | null;
      if (ok) applyResult(data);
      else if (d?.error === "response_required" || d?.error === "response_too_long") setResponseError(true);
      else await load();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [response, post, applyResult, load]);

  const onClaim = useCallback(
    async (silent: boolean) => {
      if (busyRef.current) return;
      busyRef.current = true;
      if (!silent) setBusy(true);
      try {
        const { ok, status, data } = await post("/progress/claim-xp");
        if (ok) applyResult(data);
        else if (status === 401 && !silent) {
          // Need to sign in first — return here afterward.
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

  // Auto-claim once when returning to a claimable state (e.g. back from login).
  useEffect(() => {
    if (snapshot?.stage === "completed_claimable" && !autoClaimedRef.current) {
      autoClaimedRef.current = true;
      void onClaim(true);
    }
  }, [snapshot?.stage, onClaim]);

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
  const completedStage = snapshot?.stage === "completed_awarded" || snapshot?.stage === "completed_claimable";
  useEffect(() => {
    if (!completedStage || reflectionRequestedRef.current) return;
    reflectionRequestedRef.current = true;
    setReflectionLoading(true);
    void (async () => {
      try {
        const { data } = await post("/reflection", { completion_state: completionStateRef.current, locale });
        const d = data as { ok?: boolean; reflection?: LivingReflection } | null;
        if (d?.ok && d.reflection) setReflection(d.reflection);
      } finally {
        setReflectionLoading(false);
      }
    })();
  }, [completedStage, post, locale]);

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
          ) : null}

          <div className="flex flex-col gap-4">
          <Eyebrow>{t.trainingComplete}</Eyebrow>
          {xp === "awarded" ? (
            <>
              <p className="text-3xl font-semibold text-[#C9A66B]">{t.xpAwarded}</p>
              <p className="text-sm leading-6 text-white/60">{t.carryOne}</p>
            </>
          ) : xp === "claimable" ? (
            <>
              <p className="text-base leading-6 text-white/80">{t.xpClaimable}</p>
              <button
                type="button"
                onClick={() => onClaim(false)}
                disabled={busy}
                className="rounded-xl bg-[#C9A66B] px-5 py-3.5 text-base font-semibold text-[#0B1F3A] transition-opacity disabled:opacity-60"
              >
                {busy ? t.saving : t.saveXp}
              </button>
            </>
          ) : xp === "daily_limit" ? (
            <p className="text-sm leading-6 text-white/60">{t.xpDailyLimit}</p>
          ) : (
            // owner_ineligible / none — completion stands, quietly.
            <p className="text-sm leading-6 text-white/60">{t.carryOne}</p>
          )}
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
