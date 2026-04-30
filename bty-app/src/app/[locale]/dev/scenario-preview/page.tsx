"use client";

import React from "react";
import { useParams } from "next/navigation";
import { loadScenario } from "@/lib/bty/scenario/browserLoader";

const SCENARIO_ID = "core_04_manager_neutrality_as_abandonment";

export default function ScenarioPreviewPage() {
  const params = useParams();
  const locale = params?.locale === "ko" ? "ko" : "en";
  const [scenario, setScenario] = React.useState<any | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedPrimary, setSelectedPrimary] = React.useState<string | null>(null);
  const [selectedTradeoff, setSelectedTradeoff] = React.useState<string | null>(null);
  const [selectedActionDecision, setSelectedActionDecision] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    loadScenario(SCENARIO_ID, locale)
      .then((nextScenario) => {
        if (!cancelled) {
          setScenario(nextScenario);
          setError(null);
          setSelectedPrimary(null);
          setSelectedTradeoff(null);
          setSelectedActionDecision(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setScenario(null);
          setError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [locale]);

  const selectedBranch =
    selectedPrimary && scenario?.escalationBranches
      ? scenario.escalationBranches[selectedPrimary]
      : null;
  const selectedActionBlock =
    selectedBranch && selectedTradeoff
      ? selectedBranch.action_decision
      : null;
  const selectedActionChoice =
    selectedActionBlock?.choices?.find((choice: any) => choice.id === selectedActionDecision) ?? null;
  const isActionCommitment =
    selectedActionChoice?.meaning?.is_action_commitment ??
    selectedActionChoice?.is_action_commitment ??
    null;

  const resetFromPrimary = (choiceId: string) => {
    setSelectedPrimary(choiceId);
    setSelectedTradeoff(null);
    setSelectedActionDecision(null);
  };

  const resetFromTradeoff = (choiceId: string) => {
    setSelectedTradeoff(choiceId);
    setSelectedActionDecision(null);
  };

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">Scenario JSON Preview</h1>
      {error ? <p className="mt-4 text-red-700">{error}</p> : null}
      {scenario ? (
        <div className="mt-6 space-y-4">
          <section className="rounded-2xl border p-4">
            <h2>{scenario.title}</h2>
            <p>{scenario.role}</p>
            <p>{scenario.pressure || scenario.context}</p>
            <div className="mt-4 space-y-2">
              {scenario.choices?.map((choice: any) => {
                const choiceId = choice.id || choice.choiceId;
                return (
                  <button
                    key={choiceId}
                    type="button"
                    onClick={() => resetFromPrimary(choiceId)}
                    className="block w-full rounded-xl border px-3 py-2 text-left"
                  >
                    {choice.label}
                  </button>
                );
              })}
            </div>
            <pre>{scenario.dbScenarioId}</pre>
          </section>

          {selectedPrimary ? (
            <section className="rounded-2xl border p-4">
              <h3>Situation Update</h3>
              {selectedBranch ? (
                <>
                  <p>{selectedBranch.escalation_text}</p>
                  <div className="mt-4 space-y-2">
                    {selectedBranch.second_choices?.map((choice: any) => (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => resetFromTradeoff(choice.id)}
                        className="block w-full rounded-xl border px-3 py-2 text-left"
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-red-700">Missing escalationBranches.{selectedPrimary}</p>
              )}
            </section>
          ) : null}

          {selectedTradeoff ? (
            <section className="rounded-2xl border p-4">
              <h3>Action Decision</h3>
              {selectedActionBlock ? (
                <>
                  <p>{selectedActionBlock.context || selectedActionBlock.prompt}</p>
                  <div className="mt-4 space-y-2">
                    {selectedActionBlock.choices?.map((choice: any) => (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => setSelectedActionDecision(choice.id)}
                        className="block w-full rounded-xl border px-3 py-2 text-left"
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-red-700">Missing action_decision for {selectedPrimary}_{selectedTradeoff}</p>
              )}
            </section>
          ) : null}

          {selectedActionDecision ? (
            <section className="rounded-2xl border p-4">
              <h3>Result</h3>
              <dl>
                <dt>selectedPrimary</dt>
                <dd>{selectedPrimary}</dd>
                <dt>selectedTradeoff</dt>
                <dd>{selectedTradeoff}</dd>
                <dt>selectedActionDecision</dt>
                <dd>{selectedActionDecision}</dd>
                <dt>is_action_commitment</dt>
                <dd>{String(isActionCommitment)}</dd>
                <dt>dbScenarioId</dt>
                <dd>{scenario.dbScenarioId}</dd>
              </dl>
            </section>
          ) : null}
        </div>
      ) : !error ? (
        <p className="mt-4">Loading scenario...</p>
      ) : null}
    </main>
  );
}
