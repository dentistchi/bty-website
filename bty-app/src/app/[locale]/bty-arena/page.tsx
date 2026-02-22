"use client";

import React from "react";
import { SCENARIOS } from "@/lib/bty/scenario/scenarios";
import type { Scenario } from "@/lib/bty/scenario/types";

// ---------- types for local UI state ----------
type ArenaPhase = "CHOOSING" | "SHOW_RESULT" | "FOLLOW_UP" | "DONE";

type SavedArenaState = {
  version: 1;
  scenarioId: string;
  phase: ArenaPhase;
  selectedChoiceId?: string;
  followUpIndex?: number;
  lastXp?: number;
  lastSystemMessage?: string;
  updatedAtISO: string;
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

function computeXp(xpBase: number, difficulty: number): number {
  // 단순 MVP: 반올림
  const raw = xpBase * (difficulty ?? 1);
  return Math.max(0, Math.round(raw));
}

type SystemMsg = { id: string; en: string; ko: string };

// MVP용: 아주 단순한 트리거(나중에 streak/스탯과 연결)
const SYSTEM_MESSAGES: SystemMsg[] = [
  { id: "arch_init", en: "Architecture initialized. The framework is stable.", ko: "Architecture initialized. 프레임워크가 안정화되었습니다." },
  { id: "telemetry", en: "Leadership telemetry active. Your choices refine the arena.", ko: "Leadership telemetry active. 선택이 아레나를 학습시킵니다." },
  { id: "gratitude", en: "Gratitude frequency synchronized. Cultural impact detected.", ko: "감사 로그 기록됨. 문화적 영향이 감지되었습니다." },
  { id: "consistency", en: "Consistency detected. Operational rhythm established.", ko: "Consistency detected. 운영 리듬이 형성되었습니다." },
  { id: "integrity", en: "Integrity spike detected. Ethical alignment increased.", ko: "Integrity spike detected. 원칙 정렬이 강화되었습니다." },
];

function pickSystemMessage(params: { xp: number; gratitudeDelta?: number; integrityDelta?: number }): SystemMsg {
  const { xp, gratitudeDelta = 0, integrityDelta = 0 } = params;

  if (gratitudeDelta >= 2) return SYSTEM_MESSAGES.find((m) => m.id === "gratitude")!;
  if (integrityDelta >= 3) return SYSTEM_MESSAGES.find((m) => m.id === "integrity")!;
  if (xp >= 90) return SYSTEM_MESSAGES.find((m) => m.id === "telemetry")!;
  return SYSTEM_MESSAGES.find((m) => m.id === "arch_init")!;
}

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

export default function BtyArenaPage() {
  const [scenario, setScenario] = React.useState<Scenario | null>(null);
  const [phase, setPhase] = React.useState<ArenaPhase>("CHOOSING");

  const [selectedChoiceId, setSelectedChoiceId] = React.useState<string | null>(null);
  const [lastXp, setLastXp] = React.useState<number>(0);
  const [systemMessage, setSystemMessage] = React.useState<SystemMsg | null>(null);

  const [followUpIndex, setFollowUpIndex] = React.useState<number | null>(null);

  // resume on mount
  React.useEffect(() => {
    const streakInfo = updateStreak();

    const saved = loadState();
    if (saved) {
      const s = getScenarioById(saved.scenarioId) ?? pickRandomScenario();
      setScenario(s);
      setPhase(saved.phase);
      setSelectedChoiceId(saved.selectedChoiceId ?? null);
      setFollowUpIndex(typeof saved.followUpIndex === "number" ? saved.followUpIndex : null);
      setLastXp(saved.lastXp ?? 0);

      if (saved.lastSystemMessage) {
        const msg = SYSTEM_MESSAGES.find((m) => m.id === saved.lastSystemMessage) ?? null;
        setSystemMessage(msg);
      } else if (streakInfo.message) {
        setSystemMessage(streakInfo.message);
      }
      return;
    }

    // new session
    setScenario(pickRandomScenario());
    if (streakInfo.message) setSystemMessage(streakInfo.message);
  }, []);

  if (!scenario) return null;

  const choice = scenario.choices.find((c) => c.choiceId === selectedChoiceId) ?? null;
  const hasFollowUp = Boolean(choice?.followUp?.enabled && choice.followUp.options?.length);

  function persist(next: Partial<SavedArenaState>) {
    saveState({
      version: 1,
      scenarioId: scenario.scenarioId,
      phase,
      selectedChoiceId: selectedChoiceId ?? undefined,
      followUpIndex: followUpIndex ?? undefined,
      lastXp,
      lastSystemMessage: systemMessage?.id,
      updatedAtISO: safeNowISO(),
      ...next,
    });
  }

  function onConfirmChoice() {
    if (!selectedChoiceId) return;

    const c = scenario.choices.find((x) => x.choiceId === selectedChoiceId);
    if (!c) return;

    const xp = computeXp(c.xpBase, c.difficulty);

    const msg = pickSystemMessage({
      xp,
      gratitudeDelta: c.hiddenDelta?.gratitude ?? 0,
      integrityDelta: c.hiddenDelta?.integrity ?? 0,
    });

    setLastXp(xp);
    setSystemMessage(msg);

    // 결과 출력 단계로
    setPhase("SHOW_RESULT");
    persist({ phase: "SHOW_RESULT", lastXp: xp, lastSystemMessage: msg.id });
  }

  function goToFollowUp() {
    setPhase("FOLLOW_UP");
    persist({ phase: "FOLLOW_UP" });
  }

  function submitFollowUp(idx: number) {
    setFollowUpIndex(idx);
    setPhase("DONE");
    persist({ phase: "DONE", followUpIndex: idx });
  }

  function continueNextScenario() {
    const next = pickRandomScenario(scenario.scenarioId);
    setScenario(next);

    setPhase("CHOOSING");
    setSelectedChoiceId(null);
    setFollowUpIndex(null);
    setLastXp(0);

    // 시스템 메시지는 유지하되, 새로 시작 느낌만 살짝:
    // (원하면 여기서 arch_init 같은 걸로 바꿔도 됨)
    persist({
      scenarioId: next.scenarioId,
      phase: "CHOOSING",
      selectedChoiceId: undefined,
      followUpIndex: undefined,
      lastXp: 0,
    });
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
    setSelectedChoiceId(null);
    setFollowUpIndex(null);
    setLastXp(0);
    setSystemMessage(SYSTEM_MESSAGES.find((m) => m.id === "arch_init") ?? null);
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
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>{scenario.title}</h2>
        <p style={{ marginTop: 0, lineHeight: 1.6, opacity: 0.9 }}>{scenario.context}</p>

        {/* choice list */}
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {scenario.choices.map((c) => {
            const active = selectedChoiceId === c.choiceId;
            const disabled = phase !== "CHOOSING";
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

        {/* primary actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button
            onClick={onConfirmChoice}
            disabled={phase !== "CHOOSING" || !selectedChoiceId}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #111",
              background: "#111",
              color: "white",
              opacity: phase !== "CHOOSING" || !selectedChoiceId ? 0.5 : 1,
              cursor: phase !== "CHOOSING" || !selectedChoiceId ? "not-allowed" : "pointer",
            }}
          >
            Confirm
          </button>

          <button
            onClick={continueNextScenario}
            disabled={phase === "CHOOSING"}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "white",
              opacity: phase === "CHOOSING" ? 0.5 : 1,
              cursor: phase === "CHOOSING" ? "not-allowed" : "pointer",
            }}
          >
            Continue
          </button>
        </div>

        {/* output */}
        {phase !== "CHOOSING" && choice && (
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

            {/* follow up gate */}
            {hasFollowUp && phase === "SHOW_RESULT" && (
              <div style={{ marginTop: 14 }}>
                <button
                  onClick={goToFollowUp}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #111",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  보완 선택 (1개만)
                </button>
              </div>
            )}

            {phase === "FOLLOW_UP" && hasFollowUp && choice.followUp && (
              <div style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{choice.followUp.prompt}</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {choice.followUp.options.map((opt, idx) => (
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

            {phase === "DONE" && hasFollowUp && choice.followUp && typeof followUpIndex === "number" && (
              <div style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 14 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>FOLLOW-UP SELECTED</div>
                <div style={{ marginTop: 6, fontWeight: 700 }}>{choice.followUp.options[followUpIndex]}</div>
                <div style={{ marginTop: 10, opacity: 0.85 }}>
                  다음 단계는 <b>Continue</b>로 진행합니다. (MVP: 1 + 보완 1 완료)
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
