"use client";

import React from "react";
import { useParams } from "next/navigation";
import {
  pickRandomBeginnerScenario,
} from "@/lib/bty/scenario/beginnerScenarios";
import type { BeginnerScenario } from "@/lib/bty/scenario/beginnerTypes";
import { getMaturityFeedback } from "@/lib/bty/scenario/beginnerTypes";
import { CardSkeleton } from "@/components/bty-arena";
import { arenaFetch } from "@/lib/http/arenaFetch";

type BeginnerStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const stepLabelsEn: Record<BeginnerStep, string> = {
  1: "Situation",
  2: "Emotion",
  3: "Risk",
  4: "Values",
  5: "Decision",
  6: "Growth",
  7: "Reflection",
};

const stepLabelsKo: Record<BeginnerStep, string> = {
  1: "상황",
  2: "감정",
  3: "위험",
  4: "가치",
  5: "결정",
  6: "성장",
  7: "성찰",
};

function getStepLabel(step: BeginnerStep, locale: string): string {
  return locale === "ko" ? stepLabelsKo[step] : stepLabelsEn[step];
}

function OptionButton({
  label,
  selected,
  onClick,
}: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        display: "block",
        width: "100%",
        padding: "14px 16px",
        marginBottom: 10,
        borderRadius: 12,
        border: selected ? "2px solid #111" : "1px solid #e5e5e5",
        background: selected ? "#f5f5f5" : "white",
        fontSize: 15,
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function PrimaryButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        padding: "14px 24px",
        borderRadius: 12,
        border: "1px solid #111",
        background: disabled ? "#ccc" : "#111",
        color: "white",
        fontSize: 16,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        marginTop: 8,
      }}
    >
      {label}
    </button>
  );
}

const UI_KO = {
  stepOf: "단계",
  startReflection: "성찰 시작",
  next: "다음",
  complete: "완료",
  yourResult: "결과",
  score: "점수",
  tryAnother: "다른 시나리오 해보기",
  whatEmotion: "지금 가장 가까운 감정은?",
  whatWouldYouDo: "어떻게 하시겠어요?",
  reflectionPrompt: "한 문장으로: 이 판에서 가져갈 것은?",
  reflectionPlaceholder: "예: 반응하기 전에 잠깐 멈추겠다.",
  failedToStart: "시작에 실패했습니다",
  failedToComplete: "완료에 실패했습니다",
};

const UI_EN = {
  stepOf: "Step",
  startReflection: "Start reflection",
  next: "Next",
  complete: "Complete",
  yourResult: "Your result",
  score: "Score",
  tryAnother: "Try another scenario",
  whatEmotion: "What emotion is closest right now?",
  whatWouldYouDo: "What would you do?",
  reflectionPrompt: "In one sentence: what will you take from this?",
  reflectionPlaceholder: "e.g. I'll pause before reacting.",
  failedToStart: "Failed to start",
  failedToComplete: "Failed to complete",
};

export default function BeginnerArenaPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "en";
  const ui = locale === "ko" ? UI_KO : UI_EN;
  const [scenario, setScenario] = React.useState<BeginnerScenario | null>(null);
  const [runId, setRunId] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<BeginnerStep>(1);
  const [emotionIndex, setEmotionIndex] = React.useState<number | null>(null);
  const [riskIndex, setRiskIndex] = React.useState<number | null>(null);
  const [integrityIndex, setIntegrityIndex] = React.useState<number | null>(null);
  const [decisionIndex, setDecisionIndex] = React.useState<number | null>(null);
  const [reflectionText, setReflectionText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [completed, setCompleted] = React.useState<{
    score: number;
    band: string;
    label: string;
    message: string;
  } | null>(null);

  // Pick scenario and start run on mount
  React.useEffect(() => {
    const s = pickRandomBeginnerScenario();
    setScenario(s);
  }, []);

  const startRun = React.useCallback(async () => {
    if (!scenario) return;
    setLoading(true);
    setError(null);
    try {
      const res = await arenaFetch<{ run: { run_id: string } }>("/api/arena/beginner-run", {
        json: { scenarioId: scenario.scenarioId },
      });
      setRunId(res.run.run_id);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.failedToStart);
    } finally {
      setLoading(false);
    }
  }, [scenario, locale]);

  const sendEvent = React.useCallback(
    async (stepNum: 2 | 3 | 4 | 5, payload: Record<string, number>) => {
      if (!runId || !scenario) return;
      const body: Record<string, unknown> = { runId, step: stepNum, ...payload };
      await arenaFetch("/api/arena/beginner-event", { json: body });
    },
    [runId, scenario]
  );

  const goNext = React.useCallback(async () => {
    if (!scenario) return;
    if (step === 1) {
      await startRun();
      return;
    }
    if (step === 2 && emotionIndex !== null) {
      setLoading(true);
      try { await sendEvent(2, { emotionIndex }); setStep(3); } finally { setLoading(false); }
      return;
    }
    if (step === 3 && riskIndex !== null) {
      setLoading(true);
      try { await sendEvent(3, { riskIndex }); setStep(4); } finally { setLoading(false); }
      return;
    }
    if (step === 4 && integrityIndex !== null) {
      setLoading(true);
      try { await sendEvent(4, { integrityIndex }); setStep(5); } finally { setLoading(false); }
      return;
    }
    if (step === 5 && decisionIndex !== null) {
      setLoading(true);
      try { await sendEvent(5, { decisionIndex }); setStep(6); } finally { setLoading(false); }
      return;
    }
    if (step === 6) {
      setStep(7);
      return;
    }
    if (step === 7) {
      setLoading(true);
      setError(null);
      try {
        const res = await arenaFetch<{
          ok: boolean;
          beginner_maturity_score: number;
          band: string;
          label: string;
          message: string;
        }>("/api/arena/beginner-complete", {
          json: {
            runId,
            scenarioId: scenario.scenarioId,
            emotionIndex: emotionIndex ?? 0,
            riskIndex: riskIndex ?? 0,
            integrityIndex: integrityIndex ?? 0,
            decisionIndex: decisionIndex ?? 0,
            reflectionText: reflectionText.trim() || null,
          },
        });
        setCompleted({
          score: res.beginner_maturity_score,
          band: res.band,
          label: res.label,
          message: res.message,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : ui.failedToComplete);
      } finally {
        setLoading(false);
      }
    }
  }, [
    scenario,
    step,
    runId,
    emotionIndex,
    riskIndex,
    integrityIndex,
    decisionIndex,
    reflectionText,
    startRun,
    sendEvent,
  ]);

  if (!scenario) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
        <div style={{ marginTop: 0, display: "grid", gap: 20 }}>
          <CardSkeleton lines={3} showLabel={true} />
          <CardSkeleton lines={2} showLabel={true} />
        </div>
      </div>
    );
  }

  if (completed) {
    const feedback = getMaturityFeedback(completed.score, locale);
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ marginTop: 0, padding: 24, border: "1px solid #eee", borderRadius: 14 }}>
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>{ui.yourResult}</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 22 }}>{feedback.label}</h2>
          <p style={{ margin: "0 0 16px", lineHeight: 1.5 }}>{feedback.message}</p>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.8 }}>
            {ui.score}: {completed.score} / 20
          </p>
          <PrimaryButton
            label={ui.tryAnother}
            onClick={() => {
              setCompleted(null);
              setScenario(pickRandomBeginnerScenario());
              setRunId(null);
              setStep(1);
              setEmotionIndex(null);
              setRiskIndex(null);
              setIntegrityIndex(null);
              setDecisionIndex(null);
              setReflectionText("");
            }}
          />
        </div>
      </div>
    );
  }

  const isKo = locale === "ko";
  const displayTitle = isKo && scenario.titleKo ? scenario.titleKo : scenario.title;
  const displayContext = isKo && scenario.contextKo ? scenario.contextKo : scenario.context;
  const emotionOpts = isKo && scenario.emotionOptionsKo ? scenario.emotionOptionsKo : scenario.emotionOptions;
  const riskQ = isKo && scenario.hiddenRiskQuestionKo ? scenario.hiddenRiskQuestionKo : scenario.hiddenRiskQuestion;
  const riskOpts = isKo && scenario.riskOptionsKo ? scenario.riskOptionsKo : scenario.riskOptions;
  const integrityTrig = isKo && scenario.integrityTriggerKo ? scenario.integrityTriggerKo : scenario.integrityTrigger;
  const integrityOpts = isKo && scenario.integrityOptionsKo ? scenario.integrityOptionsKo : scenario.integrityOptions;
  const decisionOpts = isKo && scenario.decisionOptionsKo ? scenario.decisionOptionsKo : scenario.decisionOptions;
  const growthText = isKo && scenario.growthKo ? scenario.growthKo : scenario.growth;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ marginBottom: 8, fontSize: 14, opacity: 0.7 }}>
        {locale === "ko" ? "입문" : "Beginner"} · {ui.stepOf} {step} / 7: {getStepLabel(step, locale)}
      </div>
      <div style={{ padding: 20, border: "1px solid #eee", borderRadius: 14 }}>
        {loading && (
          <div style={{ marginBottom: 16 }} aria-busy="true" aria-label={locale === "ko" ? "진행 중…" : "Loading…"}>
            <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
          </div>
        )}
        {step === 1 && (
          <>
            <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>{displayTitle}</h2>
            <p style={{ margin: 0, lineHeight: 1.6, opacity: 0.9 }}>{displayContext}</p>
            <div style={{ marginTop: 20 }}>
              <PrimaryButton label={ui.startReflection} onClick={goNext} disabled={loading} />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 16 }}>{ui.whatEmotion}</p>
            {emotionOpts.map((opt, i) => (
              <OptionButton
                key={i}
                label={opt}
                selected={emotionIndex === i}
                onClick={() => setEmotionIndex(i)}
              />
            ))}
            <PrimaryButton
              label={ui.next}
              onClick={goNext}
              disabled={emotionIndex === null || loading}
            />
          </>
        )}

        {step === 3 && (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 16 }}>{riskQ}</p>
            {riskOpts.map((opt, i) => (
              <OptionButton
                key={i}
                label={opt}
                selected={riskIndex === i}
                onClick={() => setRiskIndex(i)}
              />
            ))}
            <PrimaryButton label={ui.next} onClick={goNext} disabled={riskIndex === null || loading} />
          </>
        )}

        {step === 4 && (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 16 }}>{integrityTrig}</p>
            {integrityOpts.map((opt, i) => (
              <OptionButton
                key={i}
                label={opt}
                selected={integrityIndex === i}
                onClick={() => setIntegrityIndex(i)}
              />
            ))}
            <PrimaryButton
              label={ui.next}
              onClick={goNext}
              disabled={integrityIndex === null || loading}
            />
          </>
        )}

        {step === 5 && (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 16 }}>{ui.whatWouldYouDo}</p>
            {decisionOpts.map((opt, i) => (
              <OptionButton
                key={opt.id}
                label={opt.label}
                selected={decisionIndex === i}
                onClick={() => setDecisionIndex(i)}
              />
            ))}
            <PrimaryButton
              label={ui.next}
              onClick={goNext}
              disabled={decisionIndex === null || loading}
            />
          </>
        )}

        {step === 6 && (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 16, fontStyle: "italic" }}>
              {growthText}
            </p>
            <PrimaryButton label={ui.next} onClick={goNext} disabled={loading} />
          </>
        )}

        {step === 7 && (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 16 }}>
              {ui.reflectionPrompt}
            </p>
            <input
              type="text"
              value={reflectionText}
              onChange={(e) => setReflectionText(e.target.value)}
              placeholder={ui.reflectionPlaceholder}
              maxLength={120}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #e5e5e5",
                fontSize: 15,
                boxSizing: "border-box",
              }}
            />
            <PrimaryButton label={ui.complete} onClick={goNext} disabled={loading} />
          </>
        )}

        {loading && (
          <div style={{ marginTop: 12 }} aria-busy="true" aria-label={locale === "ko" ? "완료 처리 중…" : "Completing…"}>
            <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
          </div>
        )}

        {error && (
          <p style={{ marginTop: 12, color: "#c00", fontSize: 14 }}>{error}</p>
        )}
      </div>
    </div>
  );
}
