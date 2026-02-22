"use client";

import { useEffect, useMemo, useState } from "react";

type ChoiceId = "A" | "B" | "C" | "D";

type Scenario = {
  scenarioId: string;
  title: string;
  context: string;
  choices: {
    choiceId: ChoiceId;
    label: string;
    intent: string;
  }[];
};

type SubmitResult = {
  ok: true;
  scenarioId: string;
  choiceId: ChoiceId;
  xpEarned: number;
  hiddenDelta: Record<string, number>;
  microInsight: string;
  result: string;
  followUp?: {
    enabled: boolean;
    prompt?: string;
    options?: string[];
  };
};

export default function BtyArenaPage() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [picked, setPicked] = useState<ChoiceId | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => !!scenario && !!picked && !loading, [scenario, picked, loading]);

  async function loadScenario() {
    setLoading(true);
    setResult(null);
    setPicked(null);
    const res = await fetch("/api/bty-arena/scenario", { cache: "no-store" });
    const json = await res.json();
    setScenario(json?.scenario ?? null);
    setLoading(false);
  }

  async function submit() {
    if (!scenario || !picked) return;
    setLoading(true);
    const res = await fetch("/api/bty-arena/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenarioId: scenario.scenarioId, choiceId: picked }),
    });
    const json = (await res.json()) as SubmitResult | { ok: false; error: string };
    if (json?.ok) setResult(json);
    setLoading(false);
  }

  useEffect(() => {
    loadScenario();
  }, []);

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="text-xs text-gray-500">bty arena</div>
        <h1 className="text-2xl font-semibold">Simulation</h1>
        <div className="text-sm text-gray-600 mt-1">
          한 판으로 끝. 멈춰도 다시 이어갈 수 있는 구조로 확장 예정.
        </div>
      </div>

      {!scenario ? (
        <div className="border rounded-2xl p-6">Loading scenario...</div>
      ) : (
        <div className="border rounded-2xl p-6 bg-white">
          <h2 className="text-xl font-semibold">{scenario.title}</h2>
          <p className="text-gray-700 mt-3 leading-relaxed">{scenario.context}</p>

          <div className="mt-6 grid gap-3">
            {scenario.choices.map((c) => (
              <button
                key={c.choiceId}
                onClick={() => setPicked(c.choiceId)}
                className={`text-left border rounded-xl p-4 transition ${
                  picked === c.choiceId ? "border-black" : "hover:border-gray-400"
                }`}
                disabled={loading || !!result}
              >
                <div className="text-xs text-gray-500 mb-1">
                  Choice {c.choiceId} · {c.intent}
                </div>
                <div className="font-medium">{c.label}</div>
              </button>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="rounded-lg px-4 py-2 bg-black text-white disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              onClick={loadScenario}
              disabled={loading}
              className="rounded-lg px-4 py-2 border disabled:opacity-50"
            >
              New Scenario
            </button>
          </div>

          {result && (
            <div className="mt-6 border-t pt-6">
              <div className="text-sm text-gray-500">SYSTEM OUTPUT</div>
              <div className="mt-2 font-semibold">XP +{result.xpEarned}</div>
              <div className="mt-2 text-gray-800">{result.microInsight}</div>
              <div className="mt-3 text-gray-700 leading-relaxed">{result.result}</div>

              {result.followUp?.enabled && (
                <div className="mt-5 p-4 rounded-xl bg-gray-50 border">
                  <div className="font-medium">{result.followUp.prompt ?? "Follow-up"}</div>
                  <ul className="mt-2 text-sm text-gray-700 list-disc pl-5">
                    {(result.followUp.options ?? []).map((o, idx) => (
                      <li key={idx}>{o}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
