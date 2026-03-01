"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { getContextForUser } from "@/lib/bty/scenario/engine";
import { SCENARIOS } from "@/lib/bty/scenario/scenarios";
import type { Scenario } from "@/lib/bty/scenario/types";
import { evaluateChoice, evaluateFollowUp } from "@/lib/bty/arena/engine";
import {
  ArenaHeader,
  ScenarioIntro,
  ChoiceList,
  PrimaryActions,
  OutputPanel,
  TierMilestoneModal,
  CardSkeleton,
  ArenaRankingSidebar,
  type SystemMsg,
} from "@/components/bty-arena";
import BtyTopNav from "@/components/bty/BtyTopNav";
import { getMilestoneToShow } from "@/lib/bty/arena/milestone";
import { arenaFetch } from "@/lib/http/arenaFetch";

// ---------- types for local UI state ----------
type ArenaPhase = "CHOOSING" | "SHOW_RESULT" | "FOLLOW_UP" | "DONE";
type ArenaStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Minimum trimmed length for reflection text to grant bonus XP. */
const MIN_REFLECTION_LENGTH = 3;
/** Bonus XP when user writes a meaningful one-sentence reflection (encourages serious engagement). */
const REFLECTION_BONUS_XP = 10;

type SavedArenaState = {
  version: 1;
  scenarioId: string;
  phase: ArenaPhase;
  selectedChoiceId?: string;
  followUpIndex?: number;
  lastXp?: number;
  lastSystemMessage?: string;
  runId?: string;
  updatedAtISO: string;
  /** 7-step authoritative state (backward compatible: absent => inferred from phase) */
  step?: ArenaStep;
  reflectionIndex?: number;
  reflectionText?: string;
  reflectionBonusXp?: number;
  /** true when user submitted "Other (Write your own)" — show "Other submitted" and allow continue */
  otherSubmitted?: boolean;
  /** When set, Step 3 "Other" block shows praise + suggestion from free-response API. */
  freeResponseFeedback?: { praise: string; suggestion: string } | null;
};

const STORAGE_KEY = "btyArenaState:v1";
const STREAK_KEY = "btyArenaStreak:v1";

// ---------- helpers ----------
function safeNowISO() {
  return new Date().toISOString();
}

function loadState(): SavedArenaState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedArenaState;
    if (parsed?.version !== 1) return null;
    if (!parsed?.scenarioId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveState(state: SavedArenaState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, updatedAtISO: safeNowISO() }));
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

function getScenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.scenarioId === id);
}

/** Pick a random scenario. If userTier is provided, only scenarios with minTier <= userTier (or no minTier) are included. */
function pickRandomScenario(excludeId?: string, userTier?: number): Scenario {
  let pool = excludeId ? SCENARIOS.filter((s) => s.scenarioId !== excludeId) : [...SCENARIOS];
  if (typeof userTier === "number") {
    pool = pool.filter((s) => s.minTier == null || s.minTier <= userTier);
  }
  const arr = pool.length > 0 ? pool : SCENARIOS;
  return arr[Math.floor(Math.random() * arr.length)];
}

// followUp.options를 항상 배열로 정규화(없으면 빈 배열) — TS18048 방지
function normalizeFollowUpOptions(choice: { followUp?: { options?: string[] } } | null | undefined): string[] {
  return choice?.followUp?.options ?? [];
}

/** Infer step from phase for backward compatibility when loading saved state without step */
function stepFromPhase(phase: ArenaPhase): ArenaStep {
  switch (phase) {
    case "CHOOSING":
      return 2;
    case "SHOW_RESULT":
      return 3;
    case "FOLLOW_UP":
      return 5;
    case "DONE":
      return 7;
    default:
      return 2;
  }
}

const OTHER_CHOICE_ID = "__OTHER__";

/** One-sentence takeaway per play: supports repeated learning (one clear takeaway per scenario). */
const REFLECTION_PROMPT_EN = "In one sentence: what will you take from this scenario?";
const REFLECTION_PROMPT_KO = "한 문장으로: 이 판에서 가져갈 것은?";

function getReflectionPrompt(locale: string): string {
  return locale === "ko" ? REFLECTION_PROMPT_KO : REFLECTION_PROMPT_EN;
}

const SYSTEM_MESSAGES: SystemMsg[] = [
  { id: "arch_init", en: "Architecture initialized. The framework is stable.", ko: "아키텍처 초기화됨. 프레임워크가 안정화되었습니다." },
  { id: "telemetry", en: "Leadership telemetry active. Your choices refine the arena.", ko: "리더십 원격 측정 활성. 선택이 아레나를 다듬습니다." },
  { id: "gratitude", en: "Gratitude frequency synchronized. Cultural impact detected.", ko: "감사 빈도 동기화됨. 문화적 영향이 감지되었습니다." },
  { id: "consistency", en: "Consistency detected. Operational rhythm established.", ko: "일관성 감지됨. 운영 리듬이 확립되었습니다." },
  { id: "integrity", en: "Integrity spike detected. Ethical alignment increased.", ko: "무결성 상승 감지. 윤리 정렬이 높아졌습니다." },
  { id: "other_recorded", en: "Other recorded.", ko: "기타 기록됨." },
];

function updateStreak(): { streak: number; message?: SystemMsg } {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    const today = new Date();
    const dayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

    if (!raw) {
      localStorage.setItem(STREAK_KEY, JSON.stringify({ streak: 1, lastDayKey: dayKey }));
      return { streak: 1 };
    }

    const parsed = JSON.parse(raw) as { streak: number; lastDayKey: string };
    if (parsed.lastDayKey === dayKey) return { streak: parsed.streak };

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yKey = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;

    const nextStreak = parsed.lastDayKey === yKey ? parsed.streak + 1 : 1;
    localStorage.setItem(STREAK_KEY, JSON.stringify({ streak: nextStreak, lastDayKey: dayKey }));

    if (nextStreak === 3) return { streak: nextStreak, message: SYSTEM_MESSAGES.find((m) => m.id === "consistency") };
    return { streak: nextStreak };
  } catch {
    return { streak: 1 };
  }
}

async function createRun(scenarioId: string, locale: string | undefined): Promise<string | null> {
  try {
    const data = await arenaFetch<{ run?: { run_id: string } }>("/api/arena/run", {
      json: { scenarioId, locale: locale ?? null },
    });
    return data.run?.run_id ?? null;
  } catch (e) {
    console.warn("Arena createRun failed", e);
    return null;
  }
}

async function postArenaEvent(payload: Record<string, unknown>): Promise<void> {
  if (payload.runId == null || payload.runId === "") {
    console.warn("[arena] post event skipped: runId missing", payload);
    return;
  }
  console.log("[arena] post event", payload);
  try {
    await arenaFetch("/api/arena/event", { json: payload });
  } catch (e) {
    console.warn("Arena postArenaEvent failed", e);
  }
}

export default function BtyArenaPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "en";

  const [levelChecked, setLevelChecked] = React.useState(false);
  const [coreXpTotal, setCoreXpTotal] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    arenaFetch<{ coreXpTotal?: number }>("/api/arena/core-xp")
      .then((data) => {
        if (!cancelled && typeof data.coreXpTotal === "number") setCoreXpTotal(data.coreXpTotal);
        if (!cancelled) setLevelChecked(true);
      })
      .catch(() => {
        if (!cancelled) setLevelChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!levelChecked || coreXpTotal === null) return;
    if (coreXpTotal < 200) router.replace(`/${locale}/bty-arena/beginner`);
  }, [levelChecked, coreXpTotal, locale, router]);

  const [scenario, setScenario] = React.useState<Scenario | null>(null);
  const [phase, setPhase] = React.useState<ArenaPhase>("CHOOSING");
  const [step, setStep] = React.useState<ArenaStep>(1);
  const [reflectionIndex, setReflectionIndex] = React.useState<number | null>(null);
  const [reflectionText, setReflectionText] = React.useState("");
  const [reflectionBonusXp, setReflectionBonusXp] = React.useState(0);

  const [selectedChoiceId, setSelectedChoiceId] = React.useState<string | null>(null);
  const [lastXp, setLastXp] = React.useState<number>(0);
  const [systemMessage, setSystemMessage] = React.useState<SystemMsg | null>(null);

  const [followUpIndex, setFollowUpIndex] = React.useState<number | null>(null);
  const [runId, setRunId] = React.useState<string | null>(null);
  const [otherOpen, setOtherOpen] = React.useState(false);
  const [otherText, setOtherText] = React.useState("");
  const [otherSubmitting, setOtherSubmitting] = React.useState(false);
  const [otherSubmitted, setOtherSubmitted] = React.useState(false);
  const [otherError, setOtherError] = React.useState<string | null>(null);
  const [freeResponseFeedback, setFreeResponseFeedback] = React.useState<{ praise: string; suggestion: string } | null>(null);
  /** Set when POST /api/arena/run/complete fails (e.g. RLS); user may not appear on leaderboard. */
  const [completeError, setCompleteError] = React.useState<string | null>(null);

  /** Result from POST /api/arena/reflect (summary, questions, next_action). Shown in ConsolidationBlock. */
  type ReflectResult = { summary: string; questions: string[]; next_action: string; detected?: { tags: string[]; topTag?: string } };
  const [reflectResult, setReflectResult] = React.useState<ReflectResult | null>(null);

  type MilestoneModalState = {
    milestone: 25 | 50 | 75;
    previousSubName?: string;
    subName: string;
    subNameRenameAvailable: boolean;
  };
  const [milestoneModal, setMilestoneModal] = React.useState<MilestoneModalState | null>(null);

  React.useEffect(() => {
    console.log("[arena] otherOpen", otherOpen);
  }, [otherOpen]);

  React.useEffect(() => {
    if (!otherOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOtherOpen(false);
        setOtherText("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [otherOpen]);

  React.useEffect(() => {
    console.log("[arena] step", { step, phase, runId: runId ?? null });
  }, [step, phase, runId]);

  // resume on mount
  React.useEffect(() => {
    const streakInfo = updateStreak();

    const saved = loadState();
    if (saved) {
      const s = getScenarioById(saved.scenarioId) ?? pickRandomScenario();
      let phase = saved.phase;
      let step = (saved.step ?? stepFromPhase(saved.phase)) as number;
      // Safety: correct invalid step range so resume never leaves choices inactive
      if (step < 1 || step > 7) {
        step = 1;
        phase = "CHOOSING";
      }
      const noSelection = saved.selectedChoiceId == null || saved.selectedChoiceId === undefined;
      // Safety: phase not CHOOSING but no selection => inconsistent; force CHOOSING (unless Other was submitted)
      if (phase !== "CHOOSING" && noSelection && !saved.otherSubmitted) {
        phase = "CHOOSING";
        step = 1;
      }
      setScenario(s);
      setPhase(phase);
      setStep(step as ArenaStep);
      setReflectionIndex(typeof saved.reflectionIndex === "number" ? saved.reflectionIndex : null);
      setReflectionText(typeof saved.reflectionText === "string" ? saved.reflectionText : "");
      setReflectionBonusXp(typeof saved.reflectionBonusXp === "number" ? saved.reflectionBonusXp : 0);
      setSelectedChoiceId(noSelection && saved.otherSubmitted ? OTHER_CHOICE_ID : (saved.selectedChoiceId ?? null));
      setOtherSubmitted(Boolean(saved.otherSubmitted));
      setFollowUpIndex(typeof saved.followUpIndex === "number" ? saved.followUpIndex : null);
      setLastXp(saved.lastXp ?? 0);
      setRunId(saved.runId ?? null);
      setFreeResponseFeedback(saved.freeResponseFeedback ?? null);

      if (saved.lastSystemMessage) {
        const msg = SYSTEM_MESSAGES.find((m) => m.id === saved.lastSystemMessage) ?? null;
        setSystemMessage(msg);
      } else if (streakInfo.message) {
        setSystemMessage(streakInfo.message);
      }
      return;
    }

    // new session: create run and persist runId
    const userTier = coreXpTotal !== null ? Math.floor(coreXpTotal / 10) : undefined;
    const s = pickRandomScenario(undefined, userTier);
    setScenario(s);
    if (streakInfo.message) setSystemMessage(streakInfo.message);

    arenaFetch<{ run?: { run_id: string } }>("/api/arena/run", {
      json: { scenarioId: s.scenarioId, locale },
    })
      .then((data) => {
        if (data.run?.run_id) {
          setRunId(data.run.run_id);
          saveState({
            version: 1,
            scenarioId: s.scenarioId,
            phase: "CHOOSING",
            step: 1,
            runId: data.run.run_id,
            updatedAtISO: safeNowISO(),
          });
        }
      })
      .catch((e) => console.warn("Arena run create failed", e));
  }, []);

  React.useEffect(() => {
    console.log("[arena] step", { step, phase, runId: runId ?? null });
  }, [step, phase, runId]);

  if (!levelChecked) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
        <BtyTopNav />
        <div style={{ marginTop: 24, display: "grid", gap: 20 }}>
          <CardSkeleton lines={3} showLabel={true} />
          <CardSkeleton lines={2} showLabel={true} />
        </div>
      </div>
    );
  }
  if (coreXpTotal !== null && coreXpTotal < 200) {
    router.replace(`/${locale}/bty-arena/beginner`);
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
        <BtyTopNav />
        <div style={{ marginTop: 24, display: "grid", gap: 20 }}>
          <CardSkeleton lines={2} showLabel={true} />
        </div>
      </div>
    );
  }

  if (!scenario) {
    return <div>Scenario not found.</div>;
  }

  const current = scenario;
  const displayTitle = locale === "ko" && current.titleKo ? current.titleKo : current.title;
  const displayContext = locale === "ko" && current.contextKo ? current.contextKo : current.context;
  const choice = current.choices.find((c) => c.choiceId === selectedChoiceId) ?? null;
  const followUpOptions = normalizeFollowUpOptions(choice);
  const hasFollowUp = Boolean(choice?.followUp?.enabled && followUpOptions.length);

  function persist(next: Partial<SavedArenaState>) {
    saveState({
      version: 1,
      scenarioId: current.scenarioId,
      phase,
      step,
      reflectionIndex: reflectionIndex ?? undefined,
      reflectionText: reflectionText || undefined,
      reflectionBonusXp: reflectionBonusXp || undefined,
      selectedChoiceId: selectedChoiceId ?? undefined,
      followUpIndex: followUpIndex ?? undefined,
      lastXp,
      lastSystemMessage: systemMessage?.id,
      runId: runId ?? undefined,
      otherSubmitted: otherSubmitted || undefined,
      freeResponseFeedback: freeResponseFeedback ?? undefined,
      updatedAtISO: safeNowISO(),
      ...next,
    });
  }

  async function ensureRunId(): Promise<string | null> {
    if (runId) return runId;
    const id = await createRun(current.scenarioId, locale ?? undefined);
    if (id) {
      setRunId(id);
      persist({ runId: id });
      return id;
    }
    return null;
  }

  async function onConfirmChoice() {
    if (!selectedChoiceId || selectedChoiceId === OTHER_CHOICE_ID) return;

    const c = current.choices.find((x) => x.choiceId === selectedChoiceId);
    if (!c) return;

    const evalResult = evaluateChoice({
      scenarioId: current.scenarioId,
      choiceId: c.choiceId,
      intent: c.intent,
      xpBase: c.xpBase,
      difficulty: c.difficulty,
      hiddenDelta: c.hiddenDelta ?? {},
    });
    const xp = evalResult.xp;
    const msg =
      SYSTEM_MESSAGES.find((m) => m.id === evalResult.systemMessageId) ??
      SYSTEM_MESSAGES.find((m) => m.id === "arch_init")!;

    const rid = await ensureRunId();
    const payload = {
      runId: rid,
      scenarioId: current.scenarioId,
      step: 2,
      eventType: "CHOICE_CONFIRMED",
      choiceId: c.choiceId,
      xp,
      deltas: c.hiddenDelta ?? null,
      meta: { intent: c.intent },
    };
    console.log("[arena] postArenaEvent (choice)", { step: payload.step, eventType: payload.eventType, scenarioId: payload.scenarioId });
    await postArenaEvent(payload);

    setLastXp(xp);
    setSystemMessage(msg);
    setPhase("SHOW_RESULT");
    setStep(3);
    persist({ phase: "SHOW_RESULT", step: 3, lastXp: xp, lastSystemMessage: msg.id });
  }

  async function submitOther() {
    setOtherError(null);
    setOtherSubmitting(true);
    try {
      const trimmed = otherText.trim();
      if (trimmed.length > 0) {
        const rid = await ensureRunId();
        if (!rid) {
          setOtherError(locale === "ko" ? "런을 시작할 수 없습니다." : "Could not start run.");
          setOtherSubmitting(false);
          return;
        }
        try {
          const res = await arenaFetch<{ ok?: boolean; xp?: number; feedback?: { praise: string; suggestion: string } }>(
            "/api/arena/free-response",
            { json: { runId: rid, scenarioId: current.scenarioId, responseText: trimmed, locale } }
          );
          if (res.ok && typeof res.xp === "number" && res.feedback) {
            const otherMsg = SYSTEM_MESSAGES.find((m) => m.id === "other_recorded") ?? SYSTEM_MESSAGES[0];
            setLastXp(res.xp);
            setSystemMessage(otherMsg);
            setFreeResponseFeedback(res.feedback);
            setPhase("SHOW_RESULT");
            setStep(3);
            setSelectedChoiceId(OTHER_CHOICE_ID);
            setOtherSubmitted(true);
            persist({
              phase: "SHOW_RESULT",
              step: 3,
              lastXp: res.xp,
              lastSystemMessage: "other_recorded",
              selectedChoiceId: OTHER_CHOICE_ID,
              otherSubmitted: true,
              freeResponseFeedback: res.feedback,
            });
            setOtherOpen(false);
            setOtherText("");
            setOtherSubmitting(false);
            return;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg === "UNAUTHENTICATED" || msg.includes("401")) {
            setOtherError(locale === "ko" ? "로그인이 필요합니다." : "Please sign in.");
          } else if (msg === "FREE_RESPONSE_ALREADY_SUBMITTED" || msg === "RUN_NOT_FOUND") {
            setOtherError(locale === "ko" ? "이미 제출되었거나 세션이 만료되었습니다." : "Already submitted or session expired.");
          } else {
            setOtherError(locale === "ko" ? "제출에 실패했습니다. 다시 시도해 주세요." : "Submission failed. Please try again.");
          }
          setOtherSubmitting(false);
          return;
        }
      }

      const rid = await ensureRunId();
      const eventPayload = {
        runId: rid,
        scenarioId: current.scenarioId,
        step: 2,
        eventType: "OTHER_SELECTED",
        xp: 0,
      };
      console.log("[arena] postArenaEvent (other)", { step: eventPayload.step, eventType: eventPayload.eventType, scenarioId: eventPayload.scenarioId });
      await postArenaEvent(eventPayload);
      const otherMsg = SYSTEM_MESSAGES.find((m) => m.id === "other_recorded") ?? SYSTEM_MESSAGES[0];
      setLastXp(0);
      setSystemMessage(otherMsg);
      setFreeResponseFeedback(null);
      setPhase("SHOW_RESULT");
      setStep(3);
      setSelectedChoiceId(OTHER_CHOICE_ID);
      persist({ phase: "SHOW_RESULT", step: 3, lastXp: 0, lastSystemMessage: "other_recorded", selectedChoiceId: OTHER_CHOICE_ID, otherSubmitted: true });
    } finally {
      setOtherSubmitting(false);
    }
    setOtherOpen(false);
    setOtherText("");
  }

  function goToReflection() {
    setStep(4);
    persist({ step: 4 });
  }

  function goToFollowUp() {
    setPhase("FOLLOW_UP");
    setStep(5);
    persist({ phase: "FOLLOW_UP", step: 5 });
  }

  async function submitReflection(idx: number, text?: string) {
    const trimmed = typeof text === "string" ? text.trim() : "";
    const meaningful = trimmed.length >= MIN_REFLECTION_LENGTH;
    const bonus = meaningful ? REFLECTION_BONUS_XP : 0;

    const rid = await ensureRunId();
    const payload = {
      runId: rid,
      scenarioId: current.scenarioId,
      step: 4,
      eventType: "REFLECTION_SELECTED",
      reflectionIndex: idx,
      reflectionText: trimmed || undefined,
      reflectionBonusXp: bonus,
    };
    console.log("[arena] postArenaEvent (reflection)", { step: payload.step, reflectionBonusXp: bonus, scenarioId: payload.scenarioId });
    await postArenaEvent(payload);

    setReflectionIndex(idx);
    setReflectionText(trimmed);
    setReflectionBonusXp(bonus);
    setReflectResult(null);

    // Call Reflection Deepening API when user wrote something (server resolves levelId from tenure).
    if (trimmed.length > 0) {
      try {
        const res = await arenaFetch<{ ok?: boolean; summary?: string; questions?: string[]; next_action?: string; detected?: { tags: string[]; topTag?: string } }>(
          "/api/arena/reflect",
          {
            json: {
              userText: trimmed,
              scenario: {
                situation: [displayTitle, displayContext].filter(Boolean).join(" — ").slice(0, 280),
                userChoice: trimmed,
              },
            },
          }
        );
        if (res?.summary != null) {
          setReflectResult({
            summary: res.summary,
            questions: Array.isArray(res.questions) ? res.questions : [],
            next_action: res.next_action ?? "",
            detected: res.detected,
          });
        }
      } catch (e) {
        console.warn("[arena] reflect API failed", e);
      }
    }

    if (hasFollowUp) {
      setStep(5);
      setPhase("FOLLOW_UP");
      persist({ step: 5, phase: "FOLLOW_UP", reflectionIndex: idx, reflectionText: trimmed || undefined, reflectionBonusXp: bonus });
    } else {
      setStep(6);
      persist({ step: 6, reflectionIndex: idx, reflectionText: trimmed || undefined, reflectionBonusXp: bonus });
    }
  }

  async function submitFollowUp(idx: number) {
    if (!choice) return;
    const fu = evaluateFollowUp({
      scenarioId: current.scenarioId,
      choiceId: choice.choiceId,
      followUpIndex: idx,
    });

    const rid = await ensureRunId();
    const payload = {
      runId: rid,
      scenarioId: current.scenarioId,
      step: 5,
      eventType: "FOLLOW_UP_SELECTED",
      followUpIndex: idx,
      xp: fu.xp,
    };
    console.log("[arena] postArenaEvent (follow-up)", { step: payload.step, eventType: payload.eventType, scenarioId: payload.scenarioId });
    await postArenaEvent(payload);

    setFollowUpIndex(idx);
    setStep(6);
    persist({ step: 6, followUpIndex: idx });
  }

  async function continueNextScenario() {
    setCompleteError(null);
    clearState();
    const currentRunId = runId;
    let core: { coreXpTotal?: number; subName?: string; subNameRenameAvailable?: boolean } | null = null;
    if (currentRunId) {
      try {
        await arenaFetch("/api/arena/run/complete", { json: { runId: currentRunId } });
        core = await arenaFetch<{
          coreXpTotal?: number;
          subName?: string;
          subNameRenameAvailable?: boolean;
        }>("/api/arena/core-xp").catch(() => null);
        if (core && typeof core.coreXpTotal === "number") {
          const toShow = getMilestoneToShow(core.coreXpTotal);
          if (toShow) {
            setMilestoneModal({
              milestone: toShow.milestone,
              previousSubName: toShow.previousSubName,
              subName: core.subName ?? "Spark",
              subNameRenameAvailable: Boolean(core.subNameRenameAvailable),
            });
          }
        }
      } catch (e) {
        console.warn("Arena run complete failed", e);
        const msg = e instanceof Error ? e.message : String(e);
        setCompleteError(
          locale === "ko"
            ? `저장 실패: ${msg}. 리더보드에 반영되지 않았을 수 있어요.`
            : `Save failed: ${msg}. You may not appear on the leaderboard.`
        );
      }
    }

    const nextTier = core && typeof core.coreXpTotal === "number" ? Math.floor(core.coreXpTotal / 10) : (coreXpTotal !== null ? Math.floor(coreXpTotal / 10) : undefined);
    const next = pickRandomScenario(current.scenarioId, nextTier);
    setScenario(next);
    setPhase("CHOOSING");
    setStep(1);
    setReflectionIndex(null);
    setReflectionText("");
    setReflectionBonusXp(0);
    setReflectResult(null);
    setSelectedChoiceId(null);
    setFollowUpIndex(null);
    setLastXp(0);
    setRunId(null);
    setOtherOpen(false);
    setOtherText("");
    setOtherSubmitting(false);
    setOtherSubmitted(false);
    setFreeResponseFeedback(null);
    console.log("[arena] continueNextScenario applied", { step: 1, phase: "CHOOSING" });

    arenaFetch<{ run?: { run_id: string } }>("/api/arena/run", {
      json: { scenarioId: next.scenarioId, locale },
    })
      .then((data) => {
        if (data.run?.run_id) {
          setRunId(data.run.run_id);
          saveState({
            version: 1,
            scenarioId: next.scenarioId,
            phase: "CHOOSING",
            step: 1,
            runId: data.run.run_id,
            updatedAtISO: safeNowISO(),
          });
        }
      })
      .catch((e) => console.warn("Arena run create (continue) failed", e));
  }

  function pause() {
    persist({});
    setSystemMessage({
      id: "arch_init",
      en: "Session preserved. You can resume anytime.",
    });
  }

  function resetRun() {
    clearState();
    const userTier = coreXpTotal !== null ? Math.floor(coreXpTotal / 10) : undefined;
    const next = pickRandomScenario(undefined, userTier);
    setScenario(next);
    setPhase("CHOOSING");
    setStep(1);
    setReflectionIndex(null);
    setReflectionText("");
    setReflectionBonusXp(0);
    setSelectedChoiceId(null);
    setFollowUpIndex(null);
    setLastXp(0);
    setRunId(null);
    setOtherOpen(false);
    setOtherText("");
    setOtherSubmitting(false);
    setOtherSubmitted(false);
    setFreeResponseFeedback(null);
    setSystemMessage(SYSTEM_MESSAGES.find((m) => m.id === "arch_init") ?? null);

    arenaFetch<{ run?: { run_id: string } }>("/api/arena/run", {
      json: { scenarioId: next.scenarioId, locale },
    })
      .then((data) => {
        if (data.run?.run_id) {
          setRunId(data.run.run_id);
          saveState({
            version: 1,
            scenarioId: next.scenarioId,
            phase: "CHOOSING",
            step: 1,
            runId: data.run.run_id,
            updatedAtISO: safeNowISO(),
          });
        }
      })
      .catch((e) => console.warn("Arena run create (reset) failed", e));
  }

  async function onStartSimulation() {
    const rid = await ensureRunId();
    try {
      await postArenaEvent({
        runId: rid,
        scenarioId: current.scenarioId,
        step: 1,
        eventType: "SCENARIO_STARTED",
      });
    } catch (e) {
      console.warn("Arena SCENARIO_STARTED event failed", e);
    }
    setStep(2);
    setPhase("CHOOSING");
    persist({ step: 2, phase: "CHOOSING" });
  }

  function handleComplete() {
    setStep(7);
    setPhase("DONE");
    persist({ step: 7, phase: "DONE" });
  }

  function handleSkipFollowUp() {
    setStep(6);
    persist({ step: 6 });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        maxWidth: 1200,
        margin: "0 auto",
        padding: "24px 16px",
      }}
      className="bty-arena-page-root lg:flex-row lg:gap-6"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
          maxWidth: 860,
          margin: "0 auto",
          width: "100%",
        }}
      >
      <BtyTopNav />
      <div style={{ marginTop: 18 }}>
        {step === 1 && (
          <div className="bty-hero" style={{ paddingTop: 32, paddingBottom: 40, marginBottom: 28 }}>
            <p className="bty-hero-title" style={{ margin: 0, fontSize: "clamp(1.75rem, 4vw, 2rem)", fontWeight: 700, letterSpacing: "0.02em", lineHeight: 1.35, color: "var(--arena-text)" }}>
              {locale === "ko" ? "오늘도 한 걸음, Arena에서." : "One step today, in the Arena."}
            </p>
          </div>
        )}
        <ArenaHeader locale={locale} step={step} phase={phase} runId={runId} onPause={pause} onReset={resetRun} showPause={false} />
        {completeError && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 10,
              background: "#fff7f7",
              border: "1px solid #f1c0c0",
              fontSize: 14,
              color: "#8b2e2e",
            }}
          >
            {completeError}
          </div>
        )}
      <div style={{ marginTop: 18, padding: 18, border: "1px solid #eee", borderRadius: 14 }}>
        {step === 1 && (
          <ScenarioIntro
            locale={locale}
            title={displayTitle}
            context={getContextForUser(displayContext)}
            onStart={onStartSimulation}
          />
        )}

        {step >= 2 && step !== 1 && (
          <>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>{displayTitle}</h2>
            <p style={{ marginTop: 0, lineHeight: 1.6, opacity: 0.9 }}>{getContextForUser(displayContext)}</p>
          </>
        )}

        {step === 2 && (
          <>
            <ChoiceList
              choices={current.choices}
              selectedChoiceId={selectedChoiceId === OTHER_CHOICE_ID ? null : selectedChoiceId}
              onSelect={(id) => {
                setSelectedChoiceId(id);
                setOtherOpen(false);
                setOtherText("");
              }}
            />
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedChoiceId(OTHER_CHOICE_ID);
                  setOtherOpen(true);
                }}
                style={{
                  padding: "12px 16px",
                  borderRadius: 14,
                  border: "1px solid #e5e5e5",
                  background: "white",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                {locale === "ko" ? "기타 (직접 입력)" : "Other (Write your own)"}
              </button>
            </div>
          </>
        )}

        {step === 2 && phase === "CHOOSING" && (
          <PrimaryActions
            locale={locale}
            confirmDisabled={!selectedChoiceId || selectedChoiceId === OTHER_CHOICE_ID}
            continueDisabled
            onConfirm={onConfirmChoice}
            onContinue={continueNextScenario}
            showContinue={false}
          />
        )}

        {step >= 3 && selectedChoiceId === OTHER_CHOICE_ID && (
          <div style={{ marginTop: 18, padding: 16, border: "1px solid #e5e5e5", borderRadius: 14 }}>
            {freeResponseFeedback ? (
              <>
                <p style={{ margin: "0 0 8px", fontWeight: 600 }}>{freeResponseFeedback.praise}</p>
                {freeResponseFeedback.suggestion && (
                  <p style={{ margin: "0 0 8px", fontSize: 14, opacity: 0.9 }}>{freeResponseFeedback.suggestion}</p>
                )}
                <p style={{ margin: 0, fontSize: 14, opacity: 0.8 }}>XP +{lastXp}</p>
              </>
            ) : (
              <>
                <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
                  {locale === "ko" && systemMessage?.ko ? systemMessage.ko : systemMessage?.en ?? (locale === "ko" ? "기타 기록됨." : "Other recorded.")}
                </p>
                <p style={{ margin: 0, fontSize: 14, opacity: 0.8 }}>XP +{lastXp}</p>
              </>
            )}
            <button
              type="button"
              onClick={continueNextScenario}
              style={{
                marginTop: 12,
                padding: "10px 20px",
                borderRadius: 10,
                border: "none",
                background: "#111",
                color: "white",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              {locale === "ko" ? "다음 시나리오" : "Next scenario"}
            </button>
          </div>
        )}

        {step >= 3 && choice && (
          <OutputPanel
            locale={locale}
            step={step as 3 | 4 | 5 | 6 | 7}
            choice={choice}
            systemMessage={systemMessage}
            lastXp={lastXp}
            reflectionBonusXp={reflectionBonusXp}
            reflectionPrompt={getReflectionPrompt(locale)}
            reflectionOptions={[]}
            followUpPrompt={choice.followUp?.prompt ?? ""}
            followUpOptions={followUpOptions}
            hasFollowUp={hasFollowUp}
            followUpIndex={followUpIndex}
            reflectResult={reflectResult}
            onNextToReflection={goToReflection}
            onSubmitReflection={submitReflection}
            onSubmitFollowUp={submitFollowUp}
            onSkipFollowUp={handleSkipFollowUp}
            onComplete={handleComplete}
            onContinue={continueNextScenario}
          />
        )}
      </div>
      </div>

      {otherOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            role="presentation"
            onClick={() => {
              setOtherOpen(false);
              setOtherText("");
              setOtherError(null);
            }}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
            }}
          />
          <div
            role="dialog"
            aria-label={locale === "ko" ? "기타 (직접 입력)" : "Other (Write your own)"}
            style={{
              position: "relative",
              width: "min(640px, 92vw)",
              background: "white",
              borderRadius: 16,
              padding: 16,
              boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 800, marginBottom: 8 }}>
              {locale === "ko" ? "기타 (직접 입력)" : "Other (Write your own)"}
            </div>
            <textarea
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder={locale === "ko" ? "직접 입력해 주세요..." : "Write your own..."}
              rows={3}
              style={{ width: "100%", padding: 10, borderRadius: 8, resize: "vertical", boxSizing: "border-box" }}
            />
            {otherError && (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#c00" }}>{otherError}</p>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setOtherOpen(false);
                  setOtherText("");
                  setOtherError(null);
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid #e5e5e5",
                  background: "white",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                {locale === "ko" ? "취소" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={otherSubmitting}
                onClick={submitOther}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "#111",
                  color: "white",
                  cursor: otherSubmitting ? "not-allowed" : "pointer",
                  fontSize: 14,
                  opacity: otherSubmitting ? 0.6 : 1,
                }}
              >
                {locale === "ko" ? "제출" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {milestoneModal && (
        <TierMilestoneModal
          milestone={milestoneModal.milestone}
          subName={milestoneModal.subName}
          previousSubName={milestoneModal.previousSubName}
          subNameRenameAvailable={milestoneModal.subNameRenameAvailable}
          onRename={
            milestoneModal.subNameRenameAvailable
              ? async (name: string) => {
                  await arenaFetch("/api/arena/sub-name", { json: { subName: name } });
                }
              : undefined
          }
          onClose={() => setMilestoneModal(null)}
        />
      )}
    </div>
    <aside
      aria-label={locale === "ko" ? "실시간 순위" : "Live ranking"}
      style={{ width: 280, flexShrink: 0, paddingTop: 32 }}
      className="hidden lg:block"
    >
      <ArenaRankingSidebar locale={locale} />
    </aside>
  </div>
  );
}
