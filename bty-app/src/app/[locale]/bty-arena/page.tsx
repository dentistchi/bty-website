"use client";

import React from "react";
import { useParams } from "next/navigation";
import { SCENARIOS } from "@/lib/bty/scenario/scenarios";
import type { Scenario } from "@/lib/bty/scenario/types";
import { evaluateChoice, evaluateFollowUp } from "@/lib/bty/arena/engine";
import {
  ArenaHeader,
  ScenarioIntro,
  ChoiceList,
  PrimaryActions,
  OutputPanel,
  type SystemMsg,
} from "@/components/bty-arena";

// ---------- types for local UI state ----------
type ArenaPhase = "CHOOSING" | "SHOW_RESULT" | "FOLLOW_UP" | "DONE";
type ArenaStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

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

function pickRandomScenario(excludeId?: string): Scenario {
  const pool = excludeId ? SCENARIOS.filter((s) => s.scenarioId !== excludeId) : SCENARIOS;
  // fallback if only 1 scenario
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

const REFLECTION_OPTIONS = [
  "내가 놓친 시스템 원인은?",
  "다음엔 어떤 신호를 더 빨리 볼까?",
  "원칙을 유지하면서도 관계 비용을 줄이는 방법은?",
];

// MVP용: 아주 단순한 트리거(나중에 streak/스탯과 연결)
const SYSTEM_MESSAGES: SystemMsg[] = [
  { id: "arch_init", en: "Architecture initialized. The framework is stable.", ko: "Architecture initialized. 프레임워크가 안정화되었습니다." },
  { id: "telemetry", en: "Leadership telemetry active. Your choices refine the arena.", ko: "Leadership telemetry active. 선택이 아레나를 학습시킵니다." },
  { id: "gratitude", en: "Gratitude frequency synchronized. Cultural impact detected.", ko: "감사 로그 기록됨. 문화적 영향이 감지되었습니다." },
  { id: "consistency", en: "Consistency detected. Operational rhythm established.", ko: "Consistency detected. 운영 리듬이 형성되었습니다." },
  { id: "integrity", en: "Integrity spike detected. Ethical alignment increased.", ko: "Integrity spike detected. 원칙 정렬이 강화되었습니다." },
];

// streak: 하루 1회 방문 기준(초간단)
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

    // 아주 단순: 연속 여부는 "어제"만 체크
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

// ---------- API helpers (runId race 방지 + 이벤트 전송) ----------
async function createRun(scenarioId: string, locale: string | undefined): Promise<string | null> {
  try {
    const res = await fetch("/api/arena/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId, locale: locale ?? null }),
      credentials: "same-origin",
    });
    const data = (await res.json()) as { run?: { run_id: string } };
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
    const res = await fetch("/api/arena/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    });
    console.log("[arena] event res", res.status);
    if (!res.ok) throw new Error(await res.text());
  } catch (e) {
    console.warn("Arena postArenaEvent failed", e);
  }
}

export default function BtyArenaPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : null;

  const [scenario, setScenario] = React.useState<Scenario | null>(null);
  const [phase, setPhase] = React.useState<ArenaPhase>("CHOOSING");
  const [step, setStep] = React.useState<ArenaStep>(1);
  const [reflectionIndex, setReflectionIndex] = React.useState<number | null>(null);

  const [selectedChoiceId, setSelectedChoiceId] = React.useState<string | null>(null);
  const [lastXp, setLastXp] = React.useState<number>(0);
  const [systemMessage, setSystemMessage] = React.useState<SystemMsg | null>(null);

  const [followUpIndex, setFollowUpIndex] = React.useState<number | null>(null);
  const [runId, setRunId] = React.useState<string | null>(null);

  React.useEffect(() => {
    console.log("[arena] step", { step, phase, runId: runId ?? null });
  }, [step, phase, runId]);

  // resume on mount
  React.useEffect(() => {
    const streakInfo = updateStreak();

    const saved = loadState();
    if (saved) {
      const s = getScenarioById(saved.scenarioId) ?? pickRandomScenario();
      setScenario(s);
      setPhase(saved.phase);
      setStep(saved.step ?? stepFromPhase(saved.phase));
      setReflectionIndex(typeof saved.reflectionIndex === "number" ? saved.reflectionIndex : null);
      setSelectedChoiceId(saved.selectedChoiceId ?? null);
      setFollowUpIndex(typeof saved.followUpIndex === "number" ? saved.followUpIndex : null);
      setLastXp(saved.lastXp ?? 0);
      setRunId(saved.runId ?? null);

      if (saved.lastSystemMessage) {
        const msg = SYSTEM_MESSAGES.find((m) => m.id === saved.lastSystemMessage) ?? null;
        setSystemMessage(msg);
      } else if (streakInfo.message) {
        setSystemMessage(streakInfo.message);
      }
      return;
    }

    // new session: create run and persist runId
    const s = pickRandomScenario();
    setScenario(s);
    if (streakInfo.message) setSystemMessage(streakInfo.message);

    fetch("/api/arena/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: s.scenarioId, locale }),
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((data: { run?: { run_id: string } }) => {
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

  if (!scenario) {
    return <div>Scenario not found.</div>;
  }

  const current = scenario;
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
      selectedChoiceId: selectedChoiceId ?? undefined,
      followUpIndex: followUpIndex ?? undefined,
      lastXp,
      lastSystemMessage: systemMessage?.id,
      runId: runId ?? undefined,
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
    if (!selectedChoiceId) return;

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

  function goToReflection() {
    setStep(4);
    persist({ step: 4 });
  }

  function goToFollowUp() {
    setPhase("FOLLOW_UP");
    setStep(5);
    persist({ phase: "FOLLOW_UP", step: 5 });
  }

  async function submitReflection(idx: number) {
    const rid = await ensureRunId();
    const payload = {
      runId: rid,
      scenarioId: current.scenarioId,
      step: 4,
      eventType: "REFLECTION_SELECTED",
      reflectionIndex: idx,
    };
    console.log("[arena] postArenaEvent (reflection)", { step: payload.step, eventType: payload.eventType, scenarioId: payload.scenarioId });
    await postArenaEvent(payload);

    setReflectionIndex(idx);
    if (hasFollowUp) {
      setStep(5);
      setPhase("FOLLOW_UP");
      persist({ step: 5, phase: "FOLLOW_UP", reflectionIndex: idx });
    } else {
      setStep(6);
      persist({ step: 6, reflectionIndex: idx });
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
    const currentRunId = runId;
    if (currentRunId) {
      try {
        await fetch("/api/arena/run/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: currentRunId }),
          credentials: "same-origin",
        });
      } catch (e) {
        console.warn("Arena run complete failed", e);
      }
    }

    const next = pickRandomScenario(current.scenarioId);
    setScenario(next);

    setPhase("CHOOSING");
    setStep(1);
    setReflectionIndex(null);
    setSelectedChoiceId(null);
    setFollowUpIndex(null);
    setLastXp(0);
    setRunId(null);

    persist({
      scenarioId: next.scenarioId,
      phase: "CHOOSING",
      step: 1,
      reflectionIndex: undefined,
      selectedChoiceId: undefined,
      followUpIndex: undefined,
      lastXp: 0,
      runId: undefined,
    });

    fetch("/api/arena/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: next.scenarioId, locale }),
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((data: { run?: { run_id: string } }) => {
        if (data.run?.run_id) {
          setRunId(data.run.run_id);
          persist({ runId: data.run.run_id });
        }
      })
      .catch((e) => console.warn("Arena run create (continue) failed", e));
  }

  function pause() {
    persist({});
    // UI 상 피드백은 systemMessage로 처리
    setSystemMessage({
      id: "arch_init",
      en: "Session preserved. You can resume anytime.",
      ko: "세션 저장됨. 언제든 이어할 수 있습니다.",
    });
  }

  function resetRun() {
    clearState();
    const next = pickRandomScenario();
    setScenario(next);
    setPhase("CHOOSING");
    setStep(1);
    setReflectionIndex(null);
    setSelectedChoiceId(null);
    setFollowUpIndex(null);
    setLastXp(0);
    setRunId(null);
    setSystemMessage(SYSTEM_MESSAGES.find((m) => m.id === "arch_init") ?? null);

    fetch("/api/arena/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: next.scenarioId, locale }),
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((data: { run?: { run_id: string } }) => {
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
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px" }}>
      <ArenaHeader step={step} phase={phase} runId={runId} onPause={pause} onReset={resetRun} />

      <div style={{ marginTop: 18, padding: 18, border: "1px solid #eee", borderRadius: 14 }}>
        {step === 1 && (
          <ScenarioIntro title={current.title} context={current.context} onStart={onStartSimulation} />
        )}

        {step >= 2 && step !== 1 && (
          <>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>{current.title}</h2>
            <p style={{ marginTop: 0, lineHeight: 1.6, opacity: 0.9 }}>{current.context}</p>
          </>
        )}

        {step === 2 && (
          <ChoiceList
            choices={current.choices}
            selectedChoiceId={selectedChoiceId}
            onSelect={setSelectedChoiceId}
          />
        )}

        <PrimaryActions
          confirmDisabled={step !== 2 || !selectedChoiceId}
          continueDisabled={step !== 7}
          onConfirm={onConfirmChoice}
          onContinue={continueNextScenario}
        />

        {step >= 3 && choice && (
          <OutputPanel
            step={step as 3 | 4 | 5 | 6 | 7}
            choice={choice}
            systemMessage={systemMessage}
            lastXp={lastXp}
            reflectionOptions={REFLECTION_OPTIONS}
            followUpPrompt={choice.followUp?.prompt ?? ""}
            followUpOptions={followUpOptions}
            hasFollowUp={hasFollowUp}
            followUpIndex={followUpIndex}
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
  );
}
