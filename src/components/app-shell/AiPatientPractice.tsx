"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserTurnRecorder,
  CaptureError,
  detectVoiceMode,
  recordWithTeams,
  type CaptureFailure,
  type VoiceMode,
} from "@/lib/bty/arena/aiPatient/voiceCapture";
import { AI_PATIENT_TRAINING_TITLE } from "@/domain/arena/aiPatient/caseAcceptance01";
import type { ShownFeedback } from "@/domain/arena/aiPatient/feedback";

/**
 * AI PATIENT PRACTICE — a spoken (or typed) conversation with ONE fictional patient, then coaching.
 *
 * The conversation is real: every patient line comes from the server's model call, every spoken turn
 * from a real recording. There is no scripted fallback and no simulated audio. When the microphone
 * cannot be used the learner keeps going by typing, and the screen says why.
 *
 * Nothing is saved: the server returns a sealed session that this component holds in memory and sends
 * back, and it is gone when the learner leaves.
 */

type Turn = { role: "tc" | "patient"; text: string };
type View = {
  state: string;
  turns: Turn[];
  expiresAt: number;
  serverNow: number;
  turnsLeft: number;
  limits: { sessionSeconds: number; maxLearnerTurns: number; maxLearnerChars: number; maxAudioSeconds: number };
};
type Phase = "intro" | "starting" | "talking" | "reviewing" | "feedback";
type Pending = { kind: "text"; text: string } | { kind: "audio"; clip: Blob };

const FETCH_TIMEOUT_MS = 60_000;
const SLOW_AFTER_MS = 8_000;

/** A tenth of a second of silence, played inside the Start tap so later replies may play on iOS. */
function silentWavDataUri(): string {
  const rate = 8000;
  const n = rate / 10;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + n, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  w(36, "data");
  v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  let bin = "";
  new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  try {
    const res = await fetch(url, { method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    return res.ok ? { ok: true, data } : { ok: false, status: res.status, error: data.error ?? "failed" };
  } catch {
    return { ok: false, status: 0, error: "network" };
  }
}

const ERROR_COPY: Record<string, string> = {
  network: "The connection dropped. Your last turn was not lost — try sending it again.",
  provider_failed: "The patient didn't answer that time. Try sending it again.",
  patient_left_role: "The patient's answer didn't come through properly, so it wasn't shown. Try sending it again.",
  transcription_failed: "Your recording couldn't be turned into text. Try again, or type it.",
  audio_unreadable: "That recording couldn't be read. Try again, or type it.",
  nothing_heard: "Nothing was heard in that recording. Try again a little closer to the microphone, or type it.",
  audio_too_large: "That recording was too long. Keep each turn under 45 seconds.",
  too_long: "That turn is too long. Keep it under 600 characters.",
  voice_unavailable: "Voice isn't available right now. You can keep going by typing.",
  session_over: "This conversation has ended.",
  feedback_unreadable: "Feedback couldn't be written that time. Try again.",
  feedback_window_closed: "Feedback is no longer available for this conversation. Start a new one.",
  session_invalid: "This conversation could not be continued. Start a new one.",
  llm_unavailable: "AI patient practice is not available right now.",
  ai_patient_unconfigured: "AI patient practice is not set up yet.",
  UNAUTHENTICATED: "Please sign in to BTY again.",
};
const errorCopy = (e: string) => ERROR_COPY[e] ?? "Something went wrong. Try again.";

const CAPTURE_COPY: Record<CaptureFailure, string> = {
  permission_denied:
    "BTY can't use your microphone. In Teams, go to Settings › App permissions › BTY and allow Media, or allow the microphone in your browser. You can keep going by typing.",
  cancelled: "Recording cancelled.",
  unsupported: "Voice isn't supported on this device. You can keep going by typing.",
  no_audio: "No sound was recorded. Check your microphone and try again, or type.",
  failed: "The microphone didn't start. Try again, or type.",
};

const STATUS_LABEL: Record<string, string> = {
  seen: "Seen",
  partly: "Partly",
  not_seen: "Not seen",
  not_applicable: "Didn't come up",
  unclear: "Unclear",
};

const CONCERN_LABEL: Record<string, string> = {
  clinical_misrepresentation: "Clinical recommendation or urgency",
  insurance_guarantee: "Insurance or cost promise",
  pressure_or_urgency: "Pressure to decide",
  other: "Patient's right to decide",
};

export function AiPatientPractice({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [acknowledged, setAcknowledged] = useState(false);
  const [view, setView] = useState<View | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [patientName, setPatientName] = useState("Dana");
  const [briefing, setBriefing] = useState("");
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("none");
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [patientVoiceOn, setPatientVoiceOn] = useState(true);
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [slow, setSlow] = useState(false);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState<Pending | null>(null);
  const [blockedAudioIndex, setBlockedAudioIndex] = useState<number | null>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<ShownFeedback | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const recorderRef = useRef<BrowserTurnRecorder | null>(null);
  const viewRef = useRef<View | null>(null);
  const endedRef = useRef(false);
  /** Read inside async callbacks, so a value set in the same tick (Start) is already visible. */
  const voiceAvailableRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  viewRef.current = view;

  useEffect(() => {
    let alive = true;
    void detectVoiceMode().then((m) => alive && setVoiceMode(m));
    return () => {
      alive = false;
      recorderRef.current?.cancel();
      audioRef.current?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== "talking") return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (typeof el.scrollTo === "function") el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else el.scrollTop = el.scrollHeight; // older WebViews
  }, [view?.turns.length, sending]);

  const remainingMs = view ? Math.max(0, view.expiresAt - (now + clockOffset)) : 0;
  const timeUp = phase === "talking" && view !== null && remainingMs === 0;

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    setSpeakingIndex(null);
  }, []);

  /** Speak one patient line from the sealed transcript. A blocked autoplay offers a Play button instead. */
  const speak = useCallback(
    async (index: number, sealed: string) => {
      const audio = audioRef.current;
      if (!audio || !voiceAvailableRef.current) return;
      try {
        const res = await fetch("/api/arena/ai-patient/speech", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: sealed, index }),
        });
        if (!res.ok) return;
        const blob = await res.blob();
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = URL.createObjectURL(blob);
        audio.src = audioUrlRef.current;
        audio.onended = () => setSpeakingIndex(null);
        setSpeakingIndex(index);
        await audio.play();
        setBlockedAudioIndex(null);
      } catch {
        setSpeakingIndex(null);
        setBlockedAudioIndex(index);
      }
    },
    [],
  );

  const applyView = useCallback((next: View) => {
    setClockOffset(next.serverNow - Date.now());
    setNow(Date.now());
    setView(next);
  }, []);

  const start = useCallback(async () => {
    setNotice(null);
    setFeedback(null);
    setFeedbackError(null);
    setFailed(null);
    endedRef.current = false;
    // Unlock audio playback inside this tap (iOS and Teams mobile only allow it from a gesture).
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = silentWavDataUri();
    try {
      // Older WebViews return undefined rather than a promise.
      const unlocked = audioRef.current.play() as Promise<void> | undefined;
      if (unlocked && typeof unlocked.catch === "function") unlocked.catch(() => undefined);
    } catch {
      /* playback stays locked; replies will offer "Tap to hear" */
    }
    setPhase("starting");
    const r = await postJson<View & { patientName: string; briefing: string; voiceAvailable: boolean }>("/api/arena/ai-patient/start", { acknowledged: true });
    if (!r.ok) {
      setNotice(errorCopy(r.error));
      setPhase("intro");
      return;
    }
    setPatientName(r.data.patientName);
    setBriefing(r.data.briefing);
    voiceAvailableRef.current = r.data.voiceAvailable;
    setVoiceAvailable(r.data.voiceAvailable);
    applyView(r.data);
    setPhase("talking");
    if (r.data.voiceAvailable && patientVoiceOn) void speak(0, r.data.state);
  }, [applyView, patientVoiceOn, speak]);

  const send = useCallback(
    async (pending: Pending) => {
      const current = viewRef.current;
      if (!current || sending) return;
      setSending(true);
      setSlow(false);
      setNotice(null);
      setFailed(null);
      const slowTimer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let result: { ok: true; data: View & { patientText: string } } | { ok: false; status: number; error: string };
      if (pending.kind === "text") {
        result = await postJson("/api/arena/ai-patient/turn", { state: current.state, text: pending.text }, controller.signal);
      } else {
        try {
          const form = new FormData();
          form.append("state", current.state);
          form.append("audio", pending.clip, "turn");
          const res = await fetch("/api/arena/ai-patient/turn", { method: "POST", credentials: "include", cache: "no-store", body: form, signal: controller.signal });
          const data = (await res.json().catch(() => ({}))) as View & { patientText: string; error?: string };
          result = res.ok ? { ok: true, data } : { ok: false, status: res.status, error: data.error ?? "failed" };
        } catch {
          result = { ok: false, status: 0, error: "network" };
        }
      }
      clearTimeout(slowTimer);
      clearTimeout(abortTimer);
      setSending(false);
      setSlow(false);
      if (!result.ok) {
        setNotice(errorCopy(result.error));
        if (result.error === "session_over") {
          endedRef.current = true;
          return;
        }
        // Keep what the learner said so they can resend it; nothing was added to the session.
        if (["network", "provider_failed", "patient_left_role", "transcription_failed"].includes(result.error)) setFailed(pending);
        if (pending.kind === "text" && result.error !== "too_long") setDraft(pending.text);
        return;
      }
      applyView(result.data);
      if (pending.kind === "text") setDraft("");
      if (voiceAvailable && patientVoiceOn) void speak(result.data.turns.length - 1, result.data.state);
    },
    [applyView, patientVoiceOn, sending, speak, voiceAvailable],
  );

  const toggleRecording = useCallback(async () => {
    setNotice(null);
    stopAudio(); // the learner may interrupt the patient at any time
    if (voiceMode === "teams_native") {
      try {
        const clip = await recordWithTeams(1);
        await send({ kind: "audio", clip });
      } catch (e) {
        const kind = e instanceof CaptureError ? e.kind : "failed";
        if (kind !== "cancelled") setNotice(CAPTURE_COPY[kind]);
        if (kind === "permission_denied" || kind === "unsupported") setVoiceMode("none");
      }
      return;
    }
    if (recorderRef.current?.recording) {
      setRecording(false);
      try {
        const clip = await recorderRef.current.stop();
        recorderRef.current = null;
        await send({ kind: "audio", clip });
      } catch (e) {
        recorderRef.current = null;
        setNotice(CAPTURE_COPY[e instanceof CaptureError ? e.kind : "failed"]);
      }
      return;
    }
    const maxSeconds = viewRef.current?.limits.maxAudioSeconds ?? 45;
    const recorder = new BrowserTurnRecorder(maxSeconds, () => {
      setRecording(false);
      void (async () => {
        try {
          const clip = await recorder.stop();
          recorderRef.current = null;
          await send({ kind: "audio", clip });
        } catch (e) {
          recorderRef.current = null;
          setNotice(CAPTURE_COPY[e instanceof CaptureError ? e.kind : "failed"]);
        }
      })();
    });
    try {
      await recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch (e) {
      const kind = e instanceof CaptureError ? e.kind : "failed";
      setNotice(CAPTURE_COPY[kind]);
      if (kind === "permission_denied" || kind === "unsupported") setVoiceMode("none");
    }
  }, [send, stopAudio, voiceMode]);

  const finish = useCallback(async () => {
    const current = viewRef.current;
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setRecording(false);
    stopAudio();
    if (!current) return;
    if (!current.turns.some((t) => t.role === "tc")) {
      setPhase("intro");
      setView(null);
      return;
    }
    setPhase("reviewing");
    setFeedbackError(null);
    const r = await postJson<{ feedback: ShownFeedback }>("/api/arena/ai-patient/feedback", { state: current.state });
    if (!r.ok) {
      setFeedbackError(errorCopy(r.error));
      setPhase("feedback");
      return;
    }
    setFeedback(r.data.feedback);
    setPhase("feedback");
  }, [stopAudio]);

  // Time up or turns used: the conversation ends and feedback follows on its own.
  useEffect(() => {
    if (phase !== "talking" || sending || !view) return;
    if ((timeUp || view.turnsLeft === 0) && !endedRef.current) {
      endedRef.current = true;
      setNotice(timeUp ? "Time's up — here's your feedback." : "That's the last turn — here's your feedback.");
      void finish();
    }
  }, [finish, phase, sending, timeUp, view]);

  const clock = useMemo(() => {
    const s = Math.ceil(remainingMs / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }, [remainingMs]);

  // ------------------------------------------------------------------ intro --
  if (phase === "intro" || phase === "starting") {
    return (
      <div className="flex flex-col gap-4" data-testid="ai-patient-intro">
        <button type="button" onClick={onBack} className="self-start text-xs font-medium text-white/60 hover:text-white/85" data-testid="ai-patient-back">
          ‹ Back
        </button>
        <header className="flex flex-col gap-1">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#C9A66B]/80">AI patient practice</span>
          <h1 data-bty-main-heading="" className="text-[1.35rem] font-semibold leading-tight tracking-tight text-white">
            When the patient says “I need to think about it”
          </h1>
          <p className="text-[0.85rem] text-white/60">Builds on: {AI_PATIENT_TRAINING_TITLE}</p>
        </header>
        <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[0.9rem] leading-relaxed text-white/85">
          <p>Talk with Dana, a patient who has just heard Dr. Patel recommend a crown. Speak or type as you would at the front desk. You have up to 5 minutes; then you get coaching on what you said.</p>
          <p className="text-white/60">Dana has one real concern she won&apos;t say right away. Your job is to understand it, not to win the case.</p>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-[#C9A66B]/40 bg-[#C9A66B]/10 px-4 py-3 text-[0.85rem] leading-relaxed text-white/85" data-testid="ai-patient-notice">
          <p className="font-semibold text-white">Fictional patient · practice only</p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>Dana and Dr. Patel are invented. Never use a real patient&apos;s name or details.</li>
            <li>Dana is played by AI. It can say things a real patient wouldn&apos;t.</li>
            <li>If you speak, your voice is sent to BTY&apos;s AI provider to be turned into text. BTY does not keep the recording or the conversation.</li>
            <li>Feedback is written by AI from what you said. It isn&apos;t a score and can be wrong — talk it over with your mentor.</li>
          </ul>
          <label className="mt-1 flex items-start gap-2">
            <input
              id="ai-patient-ack"
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1 h-4 w-4"
              data-testid="ai-patient-ack"
            />
            <span>I understand this is a fictional patient and I won&apos;t use real patient information.</span>
          </label>
        </div>
        {notice ? <p className="text-[0.85rem] text-amber-200" role="alert">{notice}</p> : null}
        <button
          type="button"
          disabled={!acknowledged || phase === "starting"}
          onClick={() => void start()}
          className="rounded-2xl bg-[#C9A66B] px-4 py-3 text-[0.95rem] font-semibold text-[#0B1F3A] disabled:opacity-50"
          data-testid="ai-patient-start"
        >
          {phase === "starting" ? "Starting…" : "Start conversation"}
        </button>
        <p className="text-[0.75rem] text-white/50">
          {voiceMode === "none" ? "Voice isn't available on this device — you'll type your side." : "You can speak or type."}
        </p>
      </div>
    );
  }

  // --------------------------------------------------------------- feedback --
  if (phase === "reviewing" || phase === "feedback") {
    return (
      <div className="flex flex-col gap-4" data-testid="ai-patient-feedback">
        <header className="flex flex-col gap-1">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#C9A66B]/80">Coaching</span>
          <h1 data-bty-main-heading="" className="text-[1.3rem] font-semibold leading-tight text-white">
            What happened in your conversation
          </h1>
        </header>
        {notice && phase === "reviewing" ? <p className="text-[0.85rem] text-white/70">{notice}</p> : null}
        {phase === "reviewing" ? <p className="text-[0.9rem] text-white/70" data-testid="ai-patient-reviewing">Reading your conversation…</p> : null}
        {feedbackError ? (
          <div className="flex flex-col gap-2">
            <p className="text-[0.9rem] text-amber-200" role="alert">{feedbackError}</p>
            <button type="button" onClick={() => void finish()} className="self-start rounded-xl border border-white/20 px-3 py-2 text-sm text-white/85">
              Try again
            </button>
          </div>
        ) : null}
        {feedback ? <FeedbackBody feedback={feedback} patientName={patientName} /> : null}
        {view ? (
          <details className="rounded-2xl border border-white/10 px-4 py-3 text-[0.85rem] text-white/75">
            <summary className="cursor-pointer text-white/85">Your conversation</summary>
            <ol className="mt-2 flex flex-col gap-1.5">
              {view.turns.map((t, i) => (
                <li key={i}>
                  <span className="font-semibold text-white/85">{t.role === "tc" ? "You" : patientName}:</span> {t.text}
                </li>
              ))}
            </ol>
          </details>
        ) : null}
        {phase === "feedback" ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setView(null);
                setFeedback(null);
                setPhase("intro");
              }}
              className="rounded-2xl bg-[#C9A66B] px-4 py-3 text-[0.95rem] font-semibold text-[#0B1F3A]"
              data-testid="ai-patient-again"
            >
              Practice again
            </button>
            <button type="button" onClick={onBack} className="rounded-2xl border border-white/20 px-4 py-3 text-[0.95rem] text-white/85">
              Back to Practice
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  // ----------------------------------------------------------- conversation --
  const turns = view?.turns ?? [];
  const canSpeak = voiceMode !== "none" && voiceAvailable;
  return (
    <div className="flex min-h-0 flex-col gap-3" data-testid="ai-patient-talking">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[0.95rem] font-semibold text-white">{patientName}</span>
          <span className="text-[0.75rem] text-white/55">Fictional patient · {view?.turnsLeft ?? 0} turns left</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`tabular-nums text-[0.95rem] ${remainingMs < 60_000 ? "text-amber-200" : "text-white/80"}`} aria-label="Time left" data-testid="ai-patient-clock">
            {clock}
          </span>
          <button type="button" onClick={() => void finish()} className="rounded-xl border border-white/20 px-3 py-1.5 text-[0.8rem] text-white/85" data-testid="ai-patient-end">
            End
          </button>
        </div>
      </div>
      {briefing ? <p className="rounded-xl bg-white/[0.03] px-3 py-2 text-[0.8rem] leading-relaxed text-white/60">{briefing}</p> : null}

      <div ref={listRef} className="flex max-h-[52vh] min-h-[12rem] flex-col gap-2 overflow-y-auto pr-1" data-testid="ai-patient-transcript" aria-live="polite">
        {turns.map((t, i) => (
          <div key={i} className={`flex ${t.role === "tc" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-[0.9rem] leading-relaxed ${
                t.role === "tc" ? "bg-[#C9A66B]/20 text-white" : "border border-white/10 bg-white/[0.04] text-white/90"
              }`}
              data-testid={t.role === "tc" ? "turn-tc" : "turn-patient"}
            >
              {t.text}
              {t.role === "patient" && canSpeak ? (
                <button
                  type="button"
                  onClick={() => (speakingIndex === i ? stopAudio() : view && void speak(i, view.state))}
                  className={`ml-2 align-middle text-[0.72rem] underline-offset-2 hover:underline ${blockedAudioIndex === i ? "text-[#C9A66B]" : "text-white/50"}`}
                >
                  {speakingIndex === i ? "Stop" : blockedAudioIndex === i ? "Tap to hear" : "Play"}
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {sending ? (
          <p className="text-[0.8rem] text-white/55" data-testid="ai-patient-waiting">
            {slow ? `${patientName} is taking a moment… still working.` : `${patientName} is answering…`}
          </p>
        ) : null}
      </div>

      {notice ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-[0.82rem] text-amber-100" role="alert">
          <span>{notice}</span>
          {failed ? (
            <button type="button" onClick={() => void send(failed)} className="self-start text-[0.8rem] font-semibold underline" data-testid="ai-patient-retry">
              Send again
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {canSpeak ? (
          <button
            type="button"
            onClick={() => void toggleRecording()}
            disabled={sending}
            className={`rounded-2xl px-4 py-3 text-[0.95rem] font-semibold disabled:opacity-50 ${recording ? "bg-red-500/85 text-white" : "bg-[#C9A66B] text-[#0B1F3A]"}`}
            data-testid="ai-patient-mic"
            aria-pressed={recording}
          >
            {recording ? "Stop and send" : voiceMode === "teams_native" ? "Record what you say" : "Tap to speak"}
          </button>
        ) : null}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const text = draft.trim();
            if (text) void send({ kind: "text", text });
          }}
        >
          <label htmlFor="ai-patient-text" className="sr-only">
            Type what you say
          </label>
          <textarea
            id="ai-patient-text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const text = draft.trim();
                if (text) void send({ kind: "text", text });
              }
            }}
            maxLength={view?.limits.maxLearnerChars ?? 600}
            rows={2}
            placeholder={canSpeak ? "Or type what you say…" : "Type what you say…"}
            disabled={sending || recording}
            className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-[0.9rem] text-white placeholder:text-white/55"
            data-testid="ai-patient-input"
          />
          <button type="submit" disabled={sending || recording || !draft.trim()} className="rounded-xl border border-white/20 px-3 py-2 text-[0.85rem] text-white/85 disabled:opacity-40" data-testid="ai-patient-send">
            Send
          </button>
        </form>
        {voiceAvailable ? (
          <label className="flex items-center gap-2 text-[0.75rem] text-white/55">
            <input id="ai-patient-voice" type="checkbox" checked={patientVoiceOn} onChange={(e) => setPatientVoiceOn(e.target.checked)} className="h-3.5 w-3.5" />
            Hear {patientName}&apos;s replies aloud
          </label>
        ) : null}
      </div>
    </div>
  );
}

function FeedbackBody({ feedback, patientName }: { feedback: ShownFeedback; patientName: string }) {
  const surfaced = feedback.concernSurfaced;
  return (
    <div className="flex flex-col gap-4" data-testid="ai-patient-feedback-body">
      <section className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <span className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-white/55">{patientName}&apos;s real concern</span>
        <p className="text-[0.95rem] text-white">It was {feedback.hiddenConcern.label}.</p>
        <p className="text-[0.85rem] text-white/70">
          {surfaced.status === "yes"
            ? "You brought it into the open."
            : surfaced.status === "partly"
              ? "You got close to it."
              : surfaced.status === "no"
                ? "It didn't come out in this conversation."
                : "The review couldn't tell from your words whether it came out."}
          {surfaced.quote ? <span className="mt-1 block text-white/60">“{surfaced.quote}”</span> : null}
        </p>
      </section>

      {feedback.concerns.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3" data-testid="ai-patient-concerns">
          <span className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-amber-100">Worth a second look</span>
          {feedback.concerns.map((c, i) => (
            <div key={i} className="flex flex-col gap-0.5 text-[0.85rem] text-white/85">
              <span className="font-semibold">{CONCERN_LABEL[c.kind] ?? CONCERN_LABEL.other}</span>
              {c.quote ? (
                <span className="text-white/70">
                  “{c.quote}”{c.quoteVerified ? "" : " (the AI couldn't match this to your exact words)"}
                </span>
              ) : null}
              <span className="text-white/70">{c.explanation}</span>
            </div>
          ))}
          {feedback.suggestMentorReview ? <p className="text-[0.8rem] text-amber-100/90">Talk this through with your mentor. BTY has not told anyone.</p> : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        {feedback.observations.map((o) => (
          <div key={o.key} className="flex flex-col gap-1 rounded-xl border border-white/10 px-3 py-2" data-testid={`obs-${o.key}`}>
            <div className="flex items-start justify-between gap-3">
              <span className="text-[0.88rem] text-white/90">{o.label}</span>
              <span className="shrink-0 rounded-md border border-white/15 px-2 py-0.5 text-[0.7rem] text-white/70">{STATUS_LABEL[o.status] ?? o.status}</span>
            </div>
            {o.quotes.map((q, i) => (
              <span key={i} className="text-[0.8rem] text-white/60">
                “{q}”
              </span>
            ))}
            {o.note ? <span className="text-[0.8rem] text-white/65">{o.note}</span> : null}
          </div>
        ))}
      </section>

      {feedback.nextStep ? (
        <section className="flex flex-col gap-1 rounded-2xl bg-[#C9A66B]/15 px-4 py-3">
          <span className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[#C9A66B]">Try next time</span>
          <p className="text-[0.9rem] text-white/90">{feedback.nextStep}</p>
        </section>
      ) : null}

      {feedback.safetyScreen === "unavailable" ? (
        <p className="rounded-xl border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-[0.8rem] text-amber-100" data-testid="ai-patient-screen-unavailable">
          The separate safety check couldn&apos;t run this time, so a problem may not be listed above. Try again, or go over the conversation with your mentor.
        </p>
      ) : null}

      <p className="text-[0.75rem] leading-relaxed text-white/50">
        A separate AI check looks for misstatements about the dentist&apos;s recommendation, insurance promises and pressure. It can miss things.{" "}
        This feedback was written by AI from the transcript only. It isn&apos;t a score or a certification, it can be wrong, and it says nothing about real patients.
      </p>
    </div>
  );
}
