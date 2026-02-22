"use client";

import React from "react";
import { useParams } from "next/navigation";
import { SCENARIOS } from "@/lib/bty/scenario/scenarios";
import type { Scenario } from "@/lib/bty/scenario/types";
import { evaluateChoice, evaluateFollowUp } from "@/lib/bty/arena/engine";

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

type SystemMsg = { id: string; en: string; ko: string };

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
  try {
    const res = await fetch("/api/arena/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    });
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

  function continueNextScenario() {
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

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, opacity: 0.7 }}>bty arena</div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Simulation</h1>
          <div style={{ marginTop: 6, fontSize: 14, opacity: 0.7 }}>
            한 판으로 끝. 멈춰도 이어짐. (MVP: 1 + 보완 1)
          </div>
          <div style={{ marginTop: 4, fontSize: 11, opacity: 0.4, fontFamily: "monospace" }}>
            Step {step} · Phase {phase} · Run {runId?.slice(0, 8) ?? "—"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={pause} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>
            Pause
          </button>
          <button onClick={resetRun} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>
            Reset
          </button>
        </div>
      </div>

      <div style={{ marginTop: 18, padding: 18, border: "1px solid #eee", borderRadius: 14 }}>
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>{current.title}</h2>
        <p style={{ marginTop: 0, lineHeight: 1.6, opacity: 0.9 }}>{current.context}</p>

        {/* Step 1: Start Gate */}
        {step === 1 && (
          <div style={{ marginTop: 20 }}>
            <button
              onClick={onStartSimulation}
              style={{
                padding: "14px 20px",
                borderRadius: 12,
                border: "1px solid #111",
                background: "#111",
                color: "white",
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Start Simulation
            </button>
          </div>
        )}

        {/* choice list: step 2 only */}
        {step === 2 && (
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {current.choices.map((c) => {
            const active = selectedChoiceId === c.choiceId;
            const disabled = false;
            return (
              <button
                key={c.choiceId}
                disabled={disabled}
                onClick={() => setSelectedChoiceId(c.choiceId)}
                style={{
                  textAlign: "left",
                  padding: 14,
                  borderRadius: 14,
                  border: active ? "2px solid #111" : "1px solid #e5e5e5",
                  background: active ? "rgba(0,0,0,0.03)" : "white",
                  opacity: disabled && !active ? 0.6 : 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
                  Choice {c.choiceId} · {c.intent}
                </div>
                <div style={{ fontSize: 15 }}>{c.label}</div>
              </button>
            );
          })}
        </div>
        )}

        {/* primary actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button
            onClick={onConfirmChoice}
            disabled={step !== 2 || !selectedChoiceId}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #111",
              background: "#111",
              color: "white",
              opacity: step !== 2 || !selectedChoiceId ? 0.5 : 1,
              cursor: step !== 2 || !selectedChoiceId ? "not-allowed" : "pointer",
            }}
          >
            Confirm
          </button>

          <button
            onClick={continueNextScenario}
            disabled={step !== 7}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "white",
              opacity: step !== 7 ? 0.5 : 1,
              cursor: step !== 7 ? "not-allowed" : "pointer",
            }}
          >
            Continue
          </button>
        </div>

        {/* output: step >= 3 && choice 있을 때만 (step 중심) */}
        {step >= 3 && choice && (
          <div style={{ marginTop: 18, borderTop: "1px solid #eee", paddingTop: 16 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>SYSTEM OUTPUT</div>

            {systemMessage && (
              <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12, marginBottom: 10 }}>
                <div style={{ fontWeight: 700 }}>{systemMessage.en}</div>
                <div style={{ opacity: 0.8, marginTop: 6 }}>{systemMessage.ko}</div>
              </div>
            )}

            <div style={{ fontSize: 18, fontWeight: 700 }}>XP +{lastXp}</div>
            <div style={{ marginTop: 8, fontWeight: 600 }}>{choice.microInsight}</div>
            <div style={{ marginTop: 10, lineHeight: 1.6, opacity: 0.9 }}>{choice.result}</div>

            {/* step 3: Next -> Reflection */}
            {step === 3 && (
              <div style={{ marginTop: 14 }}>
                <button
                  onClick={goToReflection}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #111",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            )}

            {/* Reflection (step 4): 선택형 3개 */}
            {step === 4 && (
              <div style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Reflection</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {REFLECTION_OPTIONS.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => submitReflection(idx)}
                      style={{
                        textAlign: "left",
                        padding: 12,
                        borderRadius: 12,
                        border: "1px solid #e5e5e5",
                        background: "white",
                        cursor: "pointer",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 6 · Consolidation */}
            {step === 6 && choice && (
              <div style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 14, background: "rgba(0,0,0,0.02)" }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Step 6 · Consolidation</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.9, marginBottom: 12 }}>
                  <p style={{ margin: "0 0 8px 0" }}>You chose {choice.choiceId} ({choice.intent}).</p>
                  <p style={{ margin: "0 0 8px 0" }}>Key insight: {choice.microInsight}</p>
                  <p style={{ margin: 0 }}>Principle: &quot;Stabilize people first, then fix the system.&quot;</p>
                </div>
                <button
                  onClick={() => {
                    setStep(7);
                    setPhase("DONE");
                    persist({ step: 7, phase: "DONE" });
                  }}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #111",
                    background: "#111",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  Complete
                </button>
              </div>
            )}

            {/* step 5: Follow-up UI */}
            {step === 5 && hasFollowUp && choice.followUp && (
              <div style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{choice.followUp.prompt}</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {followUpOptions.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => submitFollowUp(idx)}
                      style={{
                        textAlign: "left",
                        padding: 12,
                        borderRadius: 12,
                        border: "1px solid #e5e5e5",
                        background: "white",
                        cursor: "pointer",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 7 · Complete: DONE 화면 명시 */}
            {step === 7 && (
              <div style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 14, background: "rgba(0,0,0,0.02)" }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Step 7 · Complete</div>
                <div style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.9 }}>
                  이 시나리오 기록이 저장되었습니다. Continue로 다음 시나리오로 이동합니다.
                </div>
              </div>
            )}

            {/* step 7: Done (follow-up 선택 시 추가 표시) */}
            {step === 7 && hasFollowUp && choice.followUp && typeof followUpIndex === "number" && (
              <div style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 14 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>FOLLOW-UP SELECTED</div>
                <div style={{ marginTop: 6, fontWeight: 700 }}>{followUpOptions[followUpIndex]}</div>
                <div style={{ marginTop: 10, opacity: 0.85 }}>
                  다음 단계는 <b>Continue</b>로 진행합니다. (MVP: 1 + 보완 1 완료)
                </div>
              </div>
            )}

            {/* step 3: Next 버튼만 (위에 이미 렌더) */}

            {/* step 5: 보완 선택 건너뛰고 → step 6 (Consolidation) */}
            {step === 5 && (
              <div style={{ marginTop: 14 }}>
                <button
                  onClick={() => {
                    setStep(6);
                    persist({ step: 6 });
                  }}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: "1px solid #999",
                    background: "white",
                    color: "#555",
                    cursor: "pointer",
                  }}
                >
                  보완 선택 건너뛰고 Continue
                </button>
              </div>
            )}

            {/* step 7: Continue → 다음 시나리오 */}
            {step === 7 && (
              <div style={{ marginTop: 20 }}>
                <button
                  onClick={continueNextScenario}
                  style={{
                    padding: "14px 20px",
                    borderRadius: 12,
                    border: "1px solid #111",
                    background: "#111",
                    color: "white",
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: "pointer",
                    width: "100%",
                    maxWidth: 320,
                  }}
                >
                  Continue → 다음 시나리오
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
