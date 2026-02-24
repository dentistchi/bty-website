"use client";

import React from "react";
import { useParams } from "next/navigation";
import {
  pickRandomBeginnerScenario,
} from "@/lib/bty/scenario/beginnerScenarios";
import type { BeginnerScenario } from "@/lib/bty/scenario/beginnerTypes";
import { getMaturityFeedback } from "@/lib/bty/scenario/beginnerTypes";
import BtyTopNav from "@/components/bty/BtyTopNav";
import { arenaFetch } from "@/lib/http/arenaFetch";

type BeginnerStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const stepLabels: Record<BeginnerStep, string> = {
  1: "Situation",
  2: "Emotion",
  3: "Risk",
  4: "Values",
  5: "Decision",
  6: "Growth",
  7: "Reflection",
};

function OptionButton({
  label,
  selected,
  onClick,
}: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
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

export default function BeginnerArenaPage() {
  const params = useParams();
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
      setError(e instanceof Error ? e.message : "Failed to start");
    } finally {
      setLoading(false);
    }
  }, [scenario]);

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
      await sendEvent(2, { emotionIndex });
      setStep(3);
      return;
    }
    if (step === 3 && riskIndex !== null) {
      await sendEvent(3, { riskIndex });
      setStep(4);
      return;
    }
    if (step === 4 && integrityIndex !== null) {
      await sendEvent(4, { integrityIndex });
      setStep(5);
      return;
    }
    if (step === 5 && decisionIndex !== null) {
      await sendEvent(5, { decisionIndex });
      setStep(6);
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
        setError(e instanceof Error ? e.message : "Failed to complete");
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
        <BtyTopNav />
        <p style={{ marginTop: 24 }}>Loading...</p>
      </div>
    );
  }

  if (completed) {
    const feedback = getMaturityFeedback(completed.score);
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px" }}>
        <BtyTopNav />
        <div style={{ marginTop: 24, padding: 24, border: "1px solid #eee", borderRadius: 14 }}>
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>Your result</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 22 }}>{feedback.label}</h2>
          <p style={{ margin: "0 0 16px", lineHeight: 1.5 }}>{feedback.message}</p>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.8 }}>
            Score: {completed.score} / 20
          </p>
          <PrimaryButton
            label="Try another scenario"
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

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px" }}>
      <BtyTopNav />
      <div style={{ marginBottom: 8, fontSize: 14, opacity: 0.7 }}>
        Beginner · Step {step} of 7: {stepLabels[step]}
      </div>
      <div style={{ padding: 20, border: "1px solid #eee", borderRadius: 14 }}>
        {step === 1 && (
          <>
            <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>{scenario.title}</h2>
            <p style={{ margin: 0, lineHeight: 1.6, opacity: 0.9 }}>{scenario.context}</p>
            <div style={{ marginTop: 20 }}>
              <PrimaryButton label="Start reflection" onClick={goNext} disabled={loading} />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 16 }}>What emotion is closest right now?</p>
            {scenario.emotionOptions.map((opt, i) => (
              <OptionButton
                key={i}
                label={opt}
                selected={emotionIndex === i}
                onClick={() => setEmotionIndex(i)}
              />
            ))}
            <PrimaryButton
              label="Next"
              onClick={goNext}
              disabled={emotionIndex === null || loading}
            />
          </>
        )}

        {step === 3 && (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 16 }}>{scenario.hiddenRiskQuestion}</p>
            {scenario.riskOptions.map((opt, i) => (
              <OptionButton
                key={i}
                label={opt}
                selected={riskIndex === i}
                onClick={() => setRiskIndex(i)}
              />
            ))}
            <PrimaryButton label="Next" onClick={goNext} disabled={riskIndex === null || loading} />
          </>
        )}

        {step === 4 && (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 16 }}>{scenario.integrityTrigger}</p>
            {scenario.integrityOptions.map((opt, i) => (
              <OptionButton
                key={i}
                label={opt}
                selected={integrityIndex === i}
                onClick={() => setIntegrityIndex(i)}
              />
            ))}
            <PrimaryButton
              label="Next"
              onClick={goNext}
              disabled={integrityIndex === null || loading}
            />
          </>
        )}

        {step === 5 && (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 16 }}>What would you do?</p>
            {scenario.decisionOptions.map((opt, i) => (
              <OptionButton
                key={opt.id}
                label={opt.label}
                selected={decisionIndex === i}
                onClick={() => setDecisionIndex(i)}
              />
            ))}
            <PrimaryButton
              label="Next"
              onClick={goNext}
              disabled={decisionIndex === null || loading}
            />
          </>
        )}

        {step === 6 && (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 16, fontStyle: "italic" }}>
              {scenario.growth}
            </p>
            <PrimaryButton label="Next" onClick={goNext} disabled={loading} />
          </>
        )}

        {step === 7 && (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 16 }}>
              In one sentence: what will you take from this?
            </p>
            <input
              type="text"
              value={reflectionText}
              onChange={(e) => setReflectionText(e.target.value)}
              placeholder="e.g. I'll pause before reacting."
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
            <PrimaryButton label="Complete" onClick={goNext} disabled={loading} />
          </>
        )}

        {error && (
          <p style={{ marginTop: 12, color: "#c00", fontSize: 14 }}>{error}</p>
        )}
      </div>
    </div>
  );
}
