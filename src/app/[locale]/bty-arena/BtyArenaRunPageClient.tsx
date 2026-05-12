"use client";

import React from "react";
import Link from "next/link";
import {
  ArenaHeader,
  TierMilestoneModal,
  CardSkeleton,
  ArenaRankingSidebar,
  EmptyState,
  LoadingFallback,
  ArenaToast,
  ArenaRunHistory,
  ChoiceList,
  EliteArenaStep2Context,
  EliteArenaPostChoiceBlock,
  ArenaPendingContractGate,
  ArenaBlockedSurface,
  ArenaReexposurePanel,
  EliteActionDecisionStep,
  ArenaBindingError,
  ArenaAligningLoader,
  ArenaRuntimeStateBanner,
} from "@/components/bty-arena";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { getMessages } from "@/lib/i18n";
import type { ScenarioChoice } from "@/lib/bty/scenario/types";
import type { ArenaPipelineDefault } from "@/lib/bty/arena/arenaPipelineConfig";
import { arenaEntryHrefForDestination } from "@/lib/bty/arena/arenaRuntimeDestination";
import { isArenaServerEntryShellRuntimeState } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";
import { snapshotQualifiesAsReexposureGate } from "@/lib/bty/arena/arenaSessionRouterClient";
import { useArenaSession } from "./hooks/useArenaSession";
import { loadScenario, type BrowserScenario } from "@/lib/bty/scenario/browserLoader";
import {
  activatePrimaryChoice,
  createScenarioDecisionEvent,
  getNextScenario,
  getScenarioById,
  initializeScenarioFlow,
  scenarioList,
  selectActionDecision,
  selectPrimaryChoice,
  selectTradeoffChoice,
  type RuntimeFlowContext,
} from "@/data/scenario";

type JsonEngineTerminalState = "ACTION_REQUIRED" | "NEXT_SCENARIO_READY";

type JsonContractFieldErrors = Partial<Record<"who" | "what" | "when" | "evidence", string>>;
type JsonContractApiFieldErrors = Partial<Record<keyof JsonContractPayload, string[]>>;
type JsonContractPayload = {
  scenario_id: string;
  db_scenario_id: string;
  selected_primary: string;
  selected_tradeoff: string;
  selected_action_decision: string;
  path: string;
  action_label: string;
  who: string;
  what: string;
  when: string;
  evidence: string;
};

/**
 * Canonical Arena session UI — `/[locale]/bty-arena`.
 * **P5:** Snapshot gate order — `BtyArenaRunPageClient.snapshot-gates.test.tsx`.
 *
 * **Elite 3-choice:** primary → forced tradeoff → **action decision** (distinct step) → run complete / server snapshot gates.
 * Snapshot `runtime_state` outranks local step; ACTION_* → My Page contract; FORCED_RESET → Center; REEXPOSURE_DUE → re-exposure panel.
 */
export default function BtyArenaRunPageClient({
  pipelineDefault = "legacy",
}: {
  pipelineDefault?: ArenaPipelineDefault;
}) {
  /** Prop ignored for routing — `useArenaSession` uses `getArenaPipelineDefaultForClient()` only. */
  const s = useArenaSession(pipelineDefault);
  const { locale, t } = s;

  const [selectedJsonScenarioId, setSelectedJsonScenarioId] = React.useState<string>(
    "core_04_manager_neutrality_as_abandonment",
  );
  const [currentScenario, setCurrentScenario] = React.useState<BrowserScenario | null>(null);
  const [jsonSelectedPrimary, setJsonSelectedPrimary] = React.useState<string | null>(null);
  const [jsonSelectedTradeoff, setJsonSelectedTradeoff] = React.useState<string | null>(null);
  const [jsonSelectedActionDecision, setJsonSelectedActionDecision] = React.useState<string | null>(null);
  const [jsonEngineState, setJsonEngineState] = React.useState<JsonEngineTerminalState | null>(null);
  const [jsonFlow, setJsonFlow] = React.useState<RuntimeFlowContext>(() => activatePrimaryChoice(initializeScenarioFlow()));
  const [jsonNoChangeRisk, setJsonNoChangeRisk] = React.useState<string | null>(null);
  const [jsonReExposureDueCandidate, setJsonReExposureDueCandidate] = React.useState(false);
  const [reexposureInternalStatusCopy, setReexposureInternalStatusCopy] = React.useState<string | null>(null);
  const staleReexposureRecoveryRanRef = React.useRef(false);

  const [contractDraftOpen, setContractDraftOpen] = React.useState(false);
  const [contractWho, setContractWho] = React.useState("");
  const [contractWhat, setContractWhat] = React.useState("");
  const [contractWhen, setContractWhen] = React.useState("");
  const [contractEvidence, setContractEvidence] = React.useState("");
  const [isSavingContract, setIsSavingContract] = React.useState(false);
  const [contractSaveError, setContractSaveError] = React.useState<string | null>(null);
  const [contractSaveSuccess, setContractSaveSuccess] = React.useState(false);
  const [savedContractId, setSavedContractId] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<JsonContractFieldErrors>({});

  React.useEffect(() => {
    setContractDraftOpen(false);
    setContractWho("");
    setContractWhat("");
    setContractWhen("");
    setContractEvidence("");
    setFieldErrors({});
    setContractSaveError(null);
    setContractSaveSuccess(false);
    setSavedContractId(null);
    setIsSavingContract(false);
  }, [currentScenario?.scenarioId, jsonEngineState]);

  /**
   * Validate response assist (fallback only):
   * - clear local due candidate when server marks clear candidate
   * - surface internal copy when intervention sensitivity is up (no raw counts shown)
   */
  React.useEffect(() => {
    const tr = s.lastReexposureTransition;
    if (!tr) return;
    if (tr.re_exposure_clear_candidate) {
      setJsonReExposureDueCandidate(false);
    }
    if (tr.intervention_sensitivity_up) {
      setReexposureInternalStatusCopy(t.arenaReexposureInternalStatusInterventionSensitivityUp);
      return;
    }
    setReexposureInternalStatusCopy(null);
  }, [s.lastReexposureTransition, t.arenaReexposureInternalStatusInterventionSensitivityUp]);

  const openContractDraft = () => {
    setContractDraftOpen(true);
    setContractSaveError(null);
    setContractSaveSuccess(false);
    setSavedContractId(null);
    setFieldErrors({});
    setContractWhat(jsonActionLabel || "");
  };

  const clearSaveStatusOnEdit = () => {
    if (contractSaveSuccess) setContractSaveSuccess(false);
    if (savedContractId) setSavedContractId(null);
    if (contractSaveError) setContractSaveError(null);
  };

  const validateContractDraft = () => {
    const next: JsonContractFieldErrors = {};
    if (!contractWho.trim()) next.who = "Required";
    if (!contractWhat.trim()) next.what = "Required";
    if (!contractWhen.trim()) next.when = "Required";
    if (!contractEvidence.trim()) next.evidence = "Required";
    return next;
  };

  async function saveJsonActionContract() {
    if (isSavingContract || !currentScenario) return;
    const scenario = currentScenario;

    const next = validateContractDraft();
    setFieldErrors(next);
    setContractSaveError(null);
    setContractSaveSuccess(false);
    setSavedContractId(null);
    if (Object.keys(next).length > 0) return;

    const contractDraft = {
      who: contractWho.trim(),
      what: contractWhat.trim(),
      when: contractWhen.trim(),
      evidence: contractEvidence.trim(),
    };
    const payload: JsonContractPayload = {
      scenario_id: scenario.scenarioId || (scenario as BrowserScenario & { id?: string }).id || "",
      db_scenario_id: scenario.dbScenarioId,
      selected_primary: jsonSelectedPrimary ?? "",
      selected_tradeoff: jsonSelectedTradeoff ?? "",
      selected_action_decision: jsonSelectedActionDecision ?? "",
      path: jsonPathDisplay,
      action_label: jsonActionLabel,
      who: contractDraft.who,
      what: contractDraft.what,
      when: contractDraft.when,
      evidence: contractDraft.evidence,
    };

    setIsSavingContract(true);
    try {
      const response = await fetch("/api/arena/action-contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      if (response.status === 200) {
        const body = (await response.json().catch(() => null)) as { id?: unknown } | null;
        setSavedContractId(typeof body?.id === "string" ? body.id : null);
        setContractSaveSuccess(true);
        return;
      }

      if (response.status === 401) {
        setContractSaveError("Login required to save Action Contract");
        return;
      }

      if (response.status === 400) {
        const body = (await response.json().catch(() => null)) as { fieldErrors?: JsonContractApiFieldErrors } | null;
        const apiFieldErrors = body?.fieldErrors;
        const mapped: JsonContractFieldErrors = {};
        for (const field of ["who", "what", "when", "evidence"] as const) {
          const message = apiFieldErrors?.[field]?.[0];
          if (message) mapped[field] = message;
        }
        setFieldErrors(mapped);
        setContractSaveError(Object.keys(mapped).length > 0 ? null : "Invalid Action Contract");
        return;
      }

      setContractSaveError("Failed to save Action Contract");
    } catch {
      setContractSaveError("Failed to save Action Contract");
    } finally {
      setIsSavingContract(false);
    }
  };

  const draftInputClass =
    "mt-1 w-full rounded-xl border border-bty-border bg-bty-surface px-3 py-2 text-sm text-bty-navy placeholder:text-bty-navy/40";


  /**
   * Load public `/data/scenario/...` for JSON runtime strip. Excludes `production` and Vitest (`test`).
   * Also enables when `NEXT_PUBLIC_BTY_DEV_BYPASS_AUTH` is set (matches middleware dev bypass intent).
   */
  const jsonCatalogDevMode =
    process.env.NODE_ENV !== "production" &&
    (process.env.NODE_ENV !== "test" || process.env.NEXT_PUBLIC_BTY_DEV_JSON_RUNTIME_TEST === "true") &&
    (
      process.env.NODE_ENV === "development" ||
      process.env.NEXT_PUBLIC_BTY_DEV_BYPASS_AUTH === "true" ||
      process.env.NEXT_PUBLIC_BTY_DEV_JSON_RUNTIME_TEST === "true"
    );

  React.useEffect(() => {
    if (!jsonCatalogDevMode) return;
    loadScenario(selectedJsonScenarioId, locale === "ko" ? "ko" : "en")
      .then((nextScenario) => {
        setCurrentScenario(nextScenario);
        setJsonSelectedPrimary(null);
        setJsonSelectedTradeoff(null);
        setJsonSelectedActionDecision(null);
        setJsonEngineState(null);
        setJsonFlow(activatePrimaryChoice(initializeScenarioFlow()));
        setJsonNoChangeRisk(null);
        setJsonReExposureDueCandidate(false);
      })
      .catch(console.error);
  }, [locale, selectedJsonScenarioId, jsonCatalogDevMode]);

  const selectJsonScenarioId = React.useCallback((id: string) => {
    if (id === selectedJsonScenarioId) return;
    setSelectedJsonScenarioId(id);
    setCurrentScenario(null);
    setJsonSelectedPrimary(null);
    setJsonSelectedTradeoff(null);
    setJsonSelectedActionDecision(null);
    setJsonEngineState(null);
    setJsonFlow(activatePrimaryChoice(initializeScenarioFlow()));
    setJsonNoChangeRisk(null);
    setJsonReExposureDueCandidate(false);
  }, [selectedJsonScenarioId]);

  const jsonSelectedBranch =
    jsonSelectedPrimary && currentScenario?.escalationBranches
      ? currentScenario.escalationBranches[jsonSelectedPrimary]
      : null;
  const jsonSelectedActionBlock =
    jsonSelectedBranch && jsonSelectedTradeoff
      ? jsonSelectedBranch.action_decision
      : null;
  const jsonPathDisplay =
    jsonSelectedPrimary && jsonSelectedTradeoff && jsonSelectedActionDecision
      ? `${jsonSelectedPrimary} → ${jsonSelectedTradeoff} → ${jsonSelectedActionDecision}`
      : "";

  const jsonPrimaryLabel = (() => {
    if (!currentScenario?.choices || !jsonSelectedPrimary) return "";
    const row = currentScenario.choices.find(
      (c: { id?: string; choiceId?: string; label?: unknown }) =>
        (c.id ?? c.choiceId) === jsonSelectedPrimary,
    );
    return row?.label != null ? String(row.label) : "";
  })();

  const jsonTradeoffLabel = (() => {
    if (!jsonSelectedTradeoff || !jsonSelectedBranch) return "";
    const second = (jsonSelectedBranch as { second_choices?: Array<{ id: string; label: string }> }).second_choices;
    const row = second?.find((c) => c.id === jsonSelectedTradeoff);
    return row?.label ?? "";
  })();

  const jsonActionLabel = (() => {
    if (!jsonSelectedActionDecision || !jsonSelectedActionBlock) return "";
    const choices = (jsonSelectedActionBlock as { choices?: Array<{ id: string; label: string }> }).choices;
    const row = choices?.find((c) => c.id === jsonSelectedActionDecision);
    return row?.label ?? "";
  })();

  const postJsonScenarioDecisionEvent = React.useCallback(
    async (decisionEvent: ReturnType<typeof createScenarioDecisionEvent>) => {
      if (!s.runId) return false;
      try {
        const res = await fetch("/api/arena/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            runId: s.runId,
            scenarioId: decisionEvent.dbScenarioId,
            step: 5,
            eventType: "JSON_SCENARIO_DECISION_COMPLETED",
            choiceId: decisionEvent.actionChoiceId,
            xp: 0,
            meta: {
              scenarioDecisionEvent: decisionEvent,
              action_contract_candidate: decisionEvent.isActionCommitment === true,
              no_change_risk_candidate: decisionEvent.isActionCommitment === false,
            },
          }),
        });
        const body = (await res.json().catch(() => null)) as { reExposureDueCandidate?: unknown } | null;
        return body?.reExposureDueCandidate === true;
      } catch {
        // Snapshot/runtime gating remains source of truth; event write is best-effort.
        return false;
      }
    },
    [s.runId],
  );

  const jsonPathLabelsDisplay =
    jsonPrimaryLabel && jsonTradeoffLabel && jsonActionLabel
      ? `${jsonPrimaryLabel} → ${jsonTradeoffLabel} → ${jsonActionLabel}`
      : "";

  const commitJsonActionDecision = React.useCallback(
    (choiceId: string) => {
      if (jsonSelectedActionDecision != null) return;
      if (!currentScenario || !jsonSelectedPrimary || !jsonSelectedTradeoff) return;
      if (jsonFlow.state !== "ACTION_DECISION_ACTIVE") return;
      const branch = currentScenario.escalationBranches?.[jsonSelectedPrimary] as
        | { action_decision?: { choices?: Array<Record<string, unknown> & { id?: string; meaning?: { is_action_commitment?: boolean }; is_action_commitment?: boolean }> } }
        | undefined;
      const block = branch?.action_decision;
      const choice = block?.choices?.find((c) => c.id === choiceId);
      const commitment =
        choice?.meaning?.is_action_commitment ?? choice?.is_action_commitment ?? false;
      const runtimeScenario =
        getScenarioById(currentScenario.scenarioId, locale === "ko" ? "ko" : "en") ??
        getScenarioById(selectedJsonScenarioId, locale === "ko" ? "ko" : "en");
      if (!runtimeScenario) return;
      const decisionEvent = createScenarioDecisionEvent({
        userId: "auth_user",
        runtimeScenario,
        primaryChoiceId: jsonSelectedPrimary as "A" | "B" | "C" | "D",
        secondChoiceId: jsonSelectedTradeoff as "X" | "Y",
        actionChoiceId: choiceId as "AD1" | "AD2",
      });
      setJsonSelectedActionDecision(choiceId);
      const nextFlow = selectActionDecision(
        jsonFlow,
        choiceId as "AD1" | "AD2",
        commitment === true,
      );
      setJsonFlow(nextFlow);
      setJsonEngineState(nextFlow.state === "ACTION_REQUIRED" ? "ACTION_REQUIRED" : "NEXT_SCENARIO_READY");
      setJsonNoChangeRisk(
        commitment === true
          ? null
          : "No-action commitment selected. Track no_change risk before next scenario.",
      );
      void postJsonScenarioDecisionEvent(decisionEvent).then((candidate) => {
        if (candidate) {
          setJsonReExposureDueCandidate(true);
          setJsonEngineState(null);
        }
      });
    },
    [
      currentScenario,
      jsonSelectedPrimary,
      jsonSelectedTradeoff,
      jsonSelectedActionDecision,
      jsonFlow,
      locale,
      selectedJsonScenarioId,
      postJsonScenarioDecisionEvent,
    ],
  );

  const selectJsonPrimary = (choiceId: string) => {
    if (jsonFlow.state !== "PRIMARY_CHOICE_ACTIVE") return;
    const nextFlow = selectPrimaryChoice(jsonFlow, choiceId as "A" | "B" | "C" | "D");
    setJsonSelectedPrimary(choiceId);
    setJsonSelectedTradeoff(null);
    setJsonSelectedActionDecision(null);
    setJsonEngineState(null);
    setJsonFlow(nextFlow);
    setJsonNoChangeRisk(null);
  };

  const selectJsonTradeoff = (choiceId: string) => {
    if (jsonFlow.state !== "TRADEOFF_ACTIVE") return;
    const nextFlow = selectTradeoffChoice(jsonFlow, choiceId as "X" | "Y");
    setJsonSelectedTradeoff(choiceId);
    setJsonSelectedActionDecision(null);
    setJsonEngineState(null);
    setJsonFlow(nextFlow);
    setJsonNoChangeRisk(null);
  };

  const goToNextJsonScenario = React.useCallback(() => {
    if (jsonEngineState !== "NEXT_SCENARIO_READY" || !currentScenario) return;
    const runtimeCurrent =
      getScenarioById(currentScenario.scenarioId, locale === "ko" ? "ko" : "en") ??
      getScenarioById(selectedJsonScenarioId, locale === "ko" ? "ko" : "en");
    if (!runtimeCurrent?.nextScenarioId) return;
    const nextRuntime = getNextScenario(runtimeCurrent.scenarioId, locale === "ko" ? "ko" : "en");
    if (!nextRuntime) return;
    const nextFolderId = scenarioList.find((id) => {
      const lookup = getScenarioById(id, locale === "ko" ? "ko" : "en");
      return lookup?.scenarioId === nextRuntime.scenarioId;
    });
    if (nextFolderId) {
      selectJsonScenarioId(nextFolderId);
    }
  }, [currentScenario, jsonEngineState, locale, selectedJsonScenarioId, selectJsonScenarioId]);

  /** Prefer binding overlay; fall back to session snapshot for tests / partial mocks. */
  const gateSnapshot = s.effectiveArenaSnapshot ?? s.arenaServerSnapshot;
  const localeNorm = locale === "ko" ? "ko" : "en";
  const reexposureDueSurfaceWanted =
    (s.effectiveArenaSnapshot?.runtime_state === "REEXPOSURE_DUE" &&
      (s.playContext !== "next_scenario" || s.scenario == null)) ||
    (s.effectiveArenaSnapshot?.runtime_state === "NEXT_SCENARIO_READY" &&
      s.effectiveArenaSnapshot?.re_exposure?.due === true &&
      s.playContext !== "next_scenario");
  const effectiveReexposureShell =
    Boolean(s.effectiveArenaSnapshot) &&
    reexposureDueSurfaceWanted &&
    snapshotQualifiesAsReexposureGate(s.effectiveArenaSnapshot!);
  const staleReexposureRecoveryActive =
    Boolean(s.effectiveArenaSnapshot) &&
    reexposureDueSurfaceWanted &&
    !snapshotQualifiesAsReexposureGate(s.effectiveArenaSnapshot!);

  React.useEffect(() => {
    if (!staleReexposureRecoveryActive) {
      staleReexposureRecoveryRanRef.current = false;
      return;
    }
    if (staleReexposureRecoveryRanRef.current) return;
    staleReexposureRecoveryRanRef.current = true;
    void (async () => {
      try {
        await fetch(`/api/arena/session/delayed-outcomes?locale=${encodeURIComponent(localeNorm)}`, {
          credentials: "include",
          cache: "no-store",
        });
      } catch {
        /* ignore */
      }
      setJsonReExposureDueCandidate(false);
      s.recoverStaleReexposureShell();
    })();
  }, [staleReexposureRecoveryActive, localeNorm, s]);

  const tLoading = getMessages(locale === "ko" ? "ko" : "en").loading;
  const devRuntimeBannerTestId = process.env.NODE_ENV !== "production";

  /** Before any session gates / `s.scenario` UI — public JSON catalog strip when loaded. */
  if (currentScenario && jsonCatalogDevMode) {
    const scenario = currentScenario;
    const serverSnapshotReExposureDue = s.effectiveArenaSnapshot?.runtime_state === "REEXPOSURE_DUE";
    const showJsonReExposureDue = serverSnapshotReExposureDue || jsonReExposureDueCandidate;
    return (
    <ScreenShell locale={localeNorm} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunPageMainRegionAria}>
      <div className="mx-auto max-w-lg space-y-4 px-2" data-testid="arena-dev-json-only-root">
        <div
          data-testid="json-scenario-source"
          className="rounded-lg border border-dashed border-bty-border bg-bty-soft/40 px-3 py-2 font-mono text-xs text-bty-navy/90"
        >
          JSON SOURCE: {scenario.scenarioId} / {scenario.dbScenarioId}
        </div>
        <div className="rounded-2xl border border-bty-border bg-bty-surface p-4 shadow-sm">
          <label htmlFor="json-scenario-select" className="text-sm font-medium text-bty-navy">
            Scenario (public JSON)
          </label>
          <select
            id="json-scenario-select"
            data-testid="json-scenario-select"
            className="mt-2 w-full rounded-xl border border-bty-border bg-bty-surface px-3 py-2 text-sm text-bty-navy"
            value={selectedJsonScenarioId}
            onChange={(e) => selectJsonScenarioId(e.target.value)}
          >
            {scenarioList.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
        <section
          data-testid="json-primary-panel"
          className="mb-6 rounded-2xl border border-bty-border bg-bty-surface p-4 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-bty-navy">{scenario.title}</h2>
          <p className="mt-2 text-sm text-bty-navy/90">{scenario.role}</p>
          <p className="mt-1 text-sm text-bty-navy/85">{scenario.pressure || scenario.context}</p>
          <div className="mt-4 space-y-2">
            {scenario.choices?.map((choice: Record<string, unknown> & { id?: string; choiceId?: string; label?: unknown }) => {
              const choiceId = (choice.id ?? choice.choiceId) as string;
              return (
                <button
                  key={choiceId}
                  type="button"
                  data-testid={`json-primary-choice-${choiceId}`}
                  onClick={() => selectJsonPrimary(choiceId)}
                  className="block w-full rounded-xl border border-bty-border px-3 py-2 text-left"
                >
                  {String(choice.label ?? "")}
                </button>
              );
            })}
          </div>
        </section>

        {jsonSelectedPrimary && jsonFlow.state !== "PRIMARY_CHOICE_ACTIVE" ? (
          <section
            data-testid="json-tradeoff-panel"
            className="mb-6 rounded-2xl border border-bty-border bg-bty-surface p-4 shadow-sm"
          >
            <h3 className="text-base font-semibold text-bty-navy">Situation Update</h3>
            {jsonSelectedBranch ? (
              <>
                <p className="mt-2 text-sm">{String((jsonSelectedBranch as { escalation_text?: string }).escalation_text ?? "")}</p>
                <div className="mt-4 space-y-2">
                  {((jsonSelectedBranch as { second_choices?: Array<{ id: string; label: string }> }).second_choices ?? []).map(
                    (choice) => (
                      <button
                        key={choice.id}
                        type="button"
                        data-testid={`json-tradeoff-choice-${choice.id}`}
                        onClick={() => selectJsonTradeoff(choice.id)}
                        className="block w-full rounded-xl border border-bty-border px-3 py-2 text-left"
                      >
                        {choice.label}
                      </button>
                    ),
                  )}
                </div>
              </>
            ) : (
              <p className="text-red-700">Missing escalationBranches.{jsonSelectedPrimary}</p>
            )}
          </section>
        ) : null}

        {jsonSelectedTradeoff &&
        (jsonFlow.state === "ACTION_DECISION_ACTIVE" ||
          jsonFlow.state === "ACTION_REQUIRED" ||
          jsonFlow.state === "NEXT_SCENARIO_READY") ? (
          <section
            data-testid="json-action-decision-panel"
            className="mb-6 rounded-2xl border border-bty-border bg-bty-surface p-4 shadow-sm"
          >
            <h3 className="text-base font-semibold text-bty-navy">Action Decision</h3>
            {jsonSelectedActionBlock ? (
              <>
                <p className="mt-2 text-sm">
                  {String(
                    (jsonSelectedActionBlock as { context?: string; prompt?: string }).context ??
                      (jsonSelectedActionBlock as { prompt?: string }).prompt ??
                      "",
                  )}
                </p>
                <div className="mt-4 space-y-2">
                  {(
                    (jsonSelectedActionBlock as { choices?: Array<{ id: string; label: string }> }).choices ?? []
                  ).map((choice) => (
                    <button
                      key={choice.id}
                      type="button"
                      data-testid={`json-action-choice-${choice.id}`}
                      onClick={() => commitJsonActionDecision(choice.id)}
                      className="block w-full rounded-xl border border-bty-border px-3 py-2 text-left"
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-red-700">
                Missing action_decision for {jsonSelectedPrimary}_{jsonSelectedTradeoff}
              </p>
            )}
          </section>
        ) : null}

        {jsonEngineState === "ACTION_REQUIRED" ? (
          <section
            className="mb-6 rounded-2xl border border-bty-border bg-bty-surface/90 p-4 text-sm text-bty-navy"
            data-testid="json-engine-action-required"
            data-json-engine-state="ACTION_REQUIRED"
          >
            {/** Visual shell aligned with `ArenaBlockedSurface` → `GenericBlockedState` (no contract payload). */}
            <p className="m-0 font-medium">Action commitment recorded</p>
            <div className="mt-3 space-y-2 text-bty-navy/85">
              <p className="m-0">
                <span className="font-medium text-bty-navy">scenarioId</span>{" "}
                <span className="font-mono text-xs text-bty-navy/90">{scenario.scenarioId}</span>
              </p>
              <p className="m-0">
                <span className="font-medium text-bty-navy">dbScenarioId</span>{" "}
                <span className="font-mono text-xs text-bty-navy/90">{scenario.dbScenarioId}</span>
              </p>
              <p className="m-0">
                <span className="font-medium text-bty-navy">Path (ids)</span>{" "}
                <span className="font-mono text-xs text-bty-navy/90">{jsonPathDisplay}</span>
              </p>
              {jsonPathLabelsDisplay ? (
                <p className="m-0">
                  <span className="font-medium text-bty-navy">Path (labels)</span>{" "}
                  <span className="text-xs leading-snug text-bty-navy/90">{jsonPathLabelsDisplay}</span>
                </p>
              ) : null}
              <div className="mt-2 border-t border-bty-border/60 pt-2">
                <p className="m-0 mb-1 font-medium text-bty-navy">Selected labels</p>
                <p className="m-0 text-xs leading-relaxed">
                  <span className="font-medium text-bty-navy/90">Primary</span>{" "}
                  <span className="font-mono text-bty-navy/80">({jsonSelectedPrimary})</span>{" "}
                  {jsonPrimaryLabel ? <span>— {jsonPrimaryLabel}</span> : null}
                </p>
                <p className="mt-1 m-0 text-xs leading-relaxed">
                  <span className="font-medium text-bty-navy/90">Tradeoff</span>{" "}
                  <span className="font-mono text-bty-navy/80">({jsonSelectedTradeoff})</span>{" "}
                  {jsonTradeoffLabel ? <span>— {jsonTradeoffLabel}</span> : null}
                </p>
                <p className="mt-1 m-0 text-xs leading-relaxed">
                  <span className="font-medium text-bty-navy/90">Action</span>{" "}
                  <span className="font-mono text-bty-navy/80">({jsonSelectedActionDecision})</span>{" "}
                  {jsonActionLabel ? <span>— {jsonActionLabel}</span> : null}
                </p>
              </div>
            </div>
            <button
              type="button"
              data-testid="json-placeholder-create-action-contract"
              className="mt-4 flex w-full min-h-[44px] items-center justify-center rounded-2xl border border-bty-border bg-bty-soft/80 px-4 text-sm font-semibold text-bty-navy shadow-sm transition hover:bg-bty-soft"
              onClick={openContractDraft}
            >
              Create Action Contract
            </button>

            {contractDraftOpen ? (
              <div
                className="mt-4 rounded-2xl border border-bty-border/80 bg-bty-surface p-4 shadow-sm ring-1 ring-bty-border/30"
                data-testid="json-action-contract-draft-panel"
              >
                <h4 className="m-0 text-sm font-semibold text-bty-navy">Action Contract Draft</h4>
                <dl className="mt-3 space-y-2 text-xs text-bty-navy/85">
                  <div>
                    <dt className="font-medium text-bty-navy">scenarioId</dt>
                    <dd className="mt-0.5 font-mono text-bty-navy/90">{scenario.scenarioId}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-bty-navy">dbScenarioId</dt>
                    <dd className="mt-0.5 font-mono text-bty-navy/90">{scenario.dbScenarioId}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-bty-navy">Path (ids)</dt>
                    <dd className="mt-0.5 font-mono text-bty-navy/90">{jsonPathDisplay}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-bty-navy">Action label</dt>
                    <dd className="mt-0.5 text-bty-navy/90">{jsonActionLabel || "—"}</dd>
                  </div>
                </dl>
                <div className="mt-3 rounded-xl border border-dashed border-bty-border/80 bg-bty-soft/30 px-3 py-2">
                  <p className="m-0 text-xs font-medium text-bty-navy">Suggested action (from decision)</p>
                  <p className="mt-1 m-0 text-sm leading-snug text-bty-navy/90">{jsonActionLabel || "—"}</p>
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <label htmlFor="json-contract-who" className="text-xs font-medium text-bty-navy">
                      Who <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="json-contract-who"
                      data-testid="json-contract-who"
                      className={draftInputClass}
                      value={contractWho}
                      onChange={(e) => {
                        setContractWho(e.target.value);
                        clearSaveStatusOnEdit();
                      }}
                      autoComplete="off"
                    />
                    {fieldErrors.who ? (
                      <p className="mt-1 m-0 text-xs text-red-600" role="alert">
                        {fieldErrors.who}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label htmlFor="json-contract-what" className="text-xs font-medium text-bty-navy">
                      What <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      id="json-contract-what"
                      data-testid="json-contract-what"
                      className={`${draftInputClass} min-h-[72px] resize-y`}
                      value={contractWhat}
                      onChange={(e) => {
                        setContractWhat(e.target.value);
                        clearSaveStatusOnEdit();
                      }}
                      rows={3}
                    />
                    {fieldErrors.what ? (
                      <p className="mt-1 m-0 text-xs text-red-600" role="alert">
                        {fieldErrors.what}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label htmlFor="json-contract-when" className="text-xs font-medium text-bty-navy">
                      When <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="json-contract-when"
                      data-testid="json-contract-when"
                      className={draftInputClass}
                      value={contractWhen}
                      onChange={(e) => {
                        setContractWhen(e.target.value);
                        clearSaveStatusOnEdit();
                      }}
                      autoComplete="off"
                    />
                    {fieldErrors.when ? (
                      <p className="mt-1 m-0 text-xs text-red-600" role="alert">
                        {fieldErrors.when}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label htmlFor="json-contract-evidence" className="text-xs font-medium text-bty-navy">
                      Evidence <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      id="json-contract-evidence"
                      data-testid="json-contract-evidence"
                      className={`${draftInputClass} min-h-[72px] resize-y`}
                      value={contractEvidence}
                      onChange={(e) => {
                        setContractEvidence(e.target.value);
                        clearSaveStatusOnEdit();
                      }}
                      rows={3}
                    />
                    {fieldErrors.evidence ? (
                      <p className="mt-1 m-0 text-xs text-red-600" role="alert">
                        {fieldErrors.evidence}
                      </p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="json-contract-save-action"
                  className="mt-4 flex w-full min-h-[44px] items-center justify-center rounded-2xl border border-bty-border bg-bty-navy px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSavingContract}
                  onClick={saveJsonActionContract}
                >
                  {isSavingContract ? "Saving..." : "Save Action Contract"}
                </button>
                {contractSaveError ? (
                  <p
                    className="mt-3 m-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
                    data-testid="json-contract-save-error"
                    role="alert"
                  >
                    {contractSaveError}
                  </p>
                ) : null}
                {contractSaveSuccess ? (
                  <p
                    className="mt-3 m-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900"
                    data-testid="json-contract-save-success"
                    role="status"
                    aria-live="polite"
                  >
                    Action Contract saved
                    {savedContractId ? <span className="ml-1 font-mono text-xs">ID: {savedContractId}</span> : null}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {showJsonReExposureDue ? (
          <section
            className="mb-6 rounded-2xl border border-bty-border bg-bty-surface/90 p-4 text-sm text-bty-navy"
            data-testid="json-engine-reexposure-due"
            data-json-engine-state="REEXPOSURE_DUE"
          >
            <p className="m-0 font-medium">{t.arenaReexposureBlockedNextTitleV2}</p>
            <p className="mt-2 text-xs text-bty-navy/80">
              {t.arenaReexposureBlockedNextDescriptionV2}
            </p>
            <button
              type="button"
              disabled
              aria-disabled
              data-testid="json-placeholder-load-next-scenario-blocked-reexposure"
              className="mt-4 flex w-full min-h-[44px] cursor-not-allowed items-center justify-center rounded-2xl border border-bty-border bg-bty-soft/50 px-4 text-sm font-semibold text-bty-navy/45"
            >
              {t.arenaReexposureBlockedNextButtonV2}
            </button>
          </section>
        ) : null}

        {!showJsonReExposureDue && jsonEngineState === "NEXT_SCENARIO_READY" ? (
          <section
            className="mb-6 rounded-2xl border border-bty-border bg-bty-surface/90 p-4 text-sm text-bty-navy"
            data-testid="json-engine-next-scenario-ready"
            data-json-engine-state="NEXT_SCENARIO_READY"
          >
            <p className="m-0 font-medium">Ready for next scenario</p>
            <div className="mt-3 space-y-2 text-bty-navy/85">
              <p className="m-0">
                <span className="font-medium text-bty-navy">Path (ids)</span>{" "}
                <span className="font-mono text-xs text-bty-navy/90">{jsonPathDisplay}</span>
              </p>
              {jsonPathLabelsDisplay ? (
                <p className="m-0">
                  <span className="font-medium text-bty-navy">Path (labels)</span>{" "}
                  <span className="text-xs leading-snug text-bty-navy/90">{jsonPathLabelsDisplay}</span>
                </p>
              ) : null}
            </div>
            {jsonNoChangeRisk ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                {jsonNoChangeRisk}
              </p>
            ) : null}
            <button
              type="button"
              onClick={goToNextJsonScenario}
              disabled={!currentScenario}
              aria-disabled={!currentScenario}
              data-testid="json-placeholder-load-next-scenario"
              className="mt-4 flex w-full min-h-[44px] items-center justify-center rounded-2xl border border-bty-border bg-bty-soft/80 px-4 text-sm font-semibold text-bty-navy shadow-sm disabled:cursor-not-allowed disabled:bg-bty-soft/50 disabled:text-bty-navy/45"
            >
              Load Next Scenario
            </button>
          </section>
        ) : null}
      </div>
    </ScreenShell>
  );
  }

  if (jsonCatalogDevMode && !currentScenario) {
    return (
      <ScreenShell locale={localeNorm} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunPageMainRegionAria}>
        <div
          data-testid="arena-dev-json-only-loading"
          className="mx-auto max-w-lg px-2"
          aria-busy="true"
          aria-label={tLoading.message}
        >
          <LoadingFallback icon="📋" message={tLoading.message} withSkeleton />
        </div>
      </ScreenShell>
    );
  }

  if (!s.levelChecked) {
    return (
      <ScreenShell
        locale={locale}
        fullWidth
        contentClassName="pb-24"
        mainAriaLabel={t.runPageLevelCheckMainRegionAria}
      >
        <div
          data-testid="arena-play-loading"
          aria-busy="true"
          aria-label={tLoading.message}
          className="mx-auto max-w-lg px-2"
        >
          <LoadingFallback icon="📋" message={tLoading.message} withSkeleton />
        </div>
      </ScreenShell>
    );
  }

  if (s.requiresBeginnerPath) {
    return (
      <ScreenShell
        locale={locale}
        fullWidth
        contentClassName="pb-24"
        mainAriaLabel={t.runPageBeginnerPathMainRegionAria}
      >
        <div data-testid="arena-play-gate-beginner" aria-busy="true" className="mx-auto max-w-lg px-2">
          <CardSkeleton lines={2} showLabel={true} />
        </div>
      </ScreenShell>
    );
  }

  if (staleReexposureRecoveryActive) {
    return (
      <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunPageMainRegionAria}>
        <div data-testid="arena-reexposure-stale-recovery" className="mx-auto max-w-lg px-2">
          <ArenaAligningLoader message={t.arenaReexposureStaleRecoveryMessage} />
        </div>
      </ScreenShell>
    );
  }

  if (s.scenarioLoading) {
    return (
      <ScreenShell
        locale={locale}
        fullWidth
        contentClassName="pb-24"
        mainAriaLabel={t.runPageLevelCheckMainRegionAria}
      >
        <div data-testid="arena-play-loading-scenario" className="mx-auto max-w-lg px-2">
          <ArenaAligningLoader message={t.arenaAligningLoaderTitle} lead={t.arenaAligningLoaderLead} />
        </div>
      </ScreenShell>
    );
  }

  /** Snapshot authority: re-exposure shell outranks local progression (only when pending outcome id is valid). */
  if (effectiveReexposureShell) {
    const shell = s.effectiveArenaSnapshot;
    if (!shell) return null;
    const rexId = shell.re_exposure?.scenario_id;
    return (
      <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunPageMainRegionAria}>
        <div data-testid="arena-play-snapshot-reexposure" className="mx-auto max-w-lg px-2">
          <ArenaReexposurePanel
            locale={locale}
            reexposureScenarioId={rexId}
            pendingOutcomeId={shell.re_exposure?.pending_outcome_id}
            onEnterScenario={s.beginReexposurePlay}
            enterLoading={s.reexposureEnterLoading}
          />
          {reexposureInternalStatusCopy ? (
            <p
              data-testid="arena-reexposure-internal-status"
              className="mt-3 rounded-xl border border-bty-border/60 bg-bty-surface/80 px-3 py-2 text-xs text-bty-secondary"
            >
              {reexposureInternalStatusCopy}
            </p>
          ) : null}
        </div>
      </ScreenShell>
    );
  }

  // Snapshot-first (outranks local uiStep): ACTION_* → FORCED_RESET → NEXT_SCENARIO_READY → then elite uiStep.
  if (s.arenaActionBlocking) {
    return (
      <>
        <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunPageMainRegionAria}>
          <div className="bty-arena-page-root mx-auto flex max-w-[1200px] flex-col gap-6 px-4 lg:flex-row lg:gap-6">
            <div
              data-testid="arena-play-main-pending-contract"
              className="flex min-w-0 flex-1 flex-col"
              style={{ maxWidth: 860, margin: "0 auto", width: "100%" }}
            >
              {s.arenaRuntimeBanner ? (
                <ArenaRuntimeStateBanner
                  devTestId={devRuntimeBannerTestId}
                  runtimeState={s.arenaRuntimeBanner.runtimeState}
                  gateLabel={s.arenaRuntimeBanner.gateLabel}
                />
              ) : null}

              <div>
                <ArenaHeader
                  locale={locale}
                  step={s.step}
                  phase={s.phase}
                  runId={s.runId}
                  onPause={s.pause}
                  onReset={s.resetRun}
                  showPause={false}
                  identity={s.arenaIdentity}
                />
                {s.pendingActionContract ? (
                  <ArenaPendingContractGate
                    locale={locale}
                    contract={s.pendingActionContract}
                    runtimeState={
                      gateSnapshot?.runtime_state === "ACTION_REQUIRED" ||
                      gateSnapshot?.runtime_state === "ACTION_SUBMITTED" ||
                      gateSnapshot?.runtime_state === "ACTION_AWAITING_VERIFICATION"
                        ? gateSnapshot.runtime_state
                        : null
                    }
                    onRetry={s.retryArenaSession}
                    retryLoading={s.scenarioLoading}
                    qrAllowed={gateSnapshot?.gates.qr_allowed === true}
                    onCompleteByQr={s.startPendingContractQrFlow}
                    qrLoading={s.pendingContractQrLoading}
                  />
                ) : gateSnapshot ? (
                  <ArenaBlockedSurface
                    snapshot={gateSnapshot}
                    locale={locale}
                    pendingContract={null}
                    onRetrySession={s.retryArenaSession}
                    retryLoading={s.scenarioLoading}
                  />
                ) : (
                  <div data-testid="arena-play-action-block-no-contract-payload" className="mt-4">
                    <EmptyState
                      icon="📋"
                      message={t.arenaRunErrorTitle}
                      hint={t.arenaRunErrorDescription}
                    />
                  </div>
                )}
              </div>
              <ArenaRunHistory locale={locale} />
            </div>
            <aside
              aria-label={t.liveRanking}
              style={{ width: 280, flexShrink: 0, paddingTop: 32 }}
              className="hidden lg:block"
            >
              <ArenaRankingSidebar locale={locale} />
            </aside>
          </div>
        </ScreenShell>
        {s.toast && <ArenaToast message={s.toast} />}
      </>
    );
  }

  if (gateSnapshot?.runtime_state === "FORCED_RESET_PENDING") {
    const centerHref = arenaEntryHrefForDestination(locale, "center_forced_reset");
    return (
      <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunErrorMainRegionAria}>
        <div data-testid="arena-play-snapshot-forced-reset" className="mx-auto max-w-lg px-2">
          {s.arenaRuntimeBanner ? (
            <ArenaRuntimeStateBanner
              devTestId={devRuntimeBannerTestId}
              runtimeState={s.arenaRuntimeBanner.runtimeState}
              gateLabel={s.arenaRuntimeBanner.gateLabel}
            />
          ) : null}
          <div
            className="rounded-3xl border border-bty-border/80 bg-bty-surface/95 p-6 shadow-sm ring-1 ring-bty-border/40"
            role="region"
            aria-label={t.arenaForcedResetGateTitle}
          >
            <h2 className="m-0 text-lg font-semibold text-bty-navy">{t.arenaForcedResetGateTitle}</h2>
            <p className="mt-2 m-0 text-sm leading-relaxed text-bty-navy/85">{t.arenaForcedResetGateLead}</p>
            <p className="mt-3 m-0 text-xs text-bty-secondary">{t.arenaSnapshotForcedResetPlaceholder}</p>
            <div className="mt-6">
              <Link
                href={centerHref}
                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                style={{ background: "var(--arena-accent, #5b8fa8)" }}
                data-testid="arena-forced-reset-go-center"
              >
                {t.arenaForcedResetGoCenterCta}
              </Link>
            </div>
          </div>
        </div>
      </ScreenShell>
    );
  }

  if (gateSnapshot?.runtime_state === "NEXT_SCENARIO_READY") {
    const actionStatus = gateSnapshot.action_contract?.status ?? null;
    const actionStatusLc = typeof actionStatus === "string" ? actionStatus.trim().toLowerCase() : "";
    /** Submitted/escalated contracts are not a permanent block on "Load next" (MVP aligns with QR success copy). */
    const hasBlockingContractForNext =
      gateSnapshot.action_contract?.exists === true &&
      actionStatusLc !== "approved" &&
      actionStatusLc !== "completed" &&
      actionStatusLc !== "submitted" &&
      actionStatusLc !== "escalated";
    const hasPendingReexposure =
      gateSnapshot.re_exposure?.due === true &&
      s.playContext !== "next_scenario" &&
      snapshotQualifiesAsReexposureGate(gateSnapshot);
    if (hasPendingReexposure) {
      return (
        <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunPageMainRegionAria}>
          <div data-testid="arena-play-snapshot-reexposure" className="mx-auto max-w-lg px-2">
            <ArenaReexposurePanel
              locale={locale}
              reexposureScenarioId={gateSnapshot.re_exposure?.scenario_id}
              pendingOutcomeId={gateSnapshot.re_exposure?.pending_outcome_id}
              onEnterScenario={s.beginReexposurePlay}
              enterLoading={s.reexposureEnterLoading}
            />
            {reexposureInternalStatusCopy ? (
              <p
                data-testid="arena-reexposure-internal-status"
                className="mt-3 rounded-xl border border-bty-border/60 bg-bty-surface/80 px-3 py-2 text-xs text-bty-secondary"
              >
                {reexposureInternalStatusCopy}
              </p>
            ) : null}
          </div>
        </ScreenShell>
      );
    }
    if (hasBlockingContractForNext) {
      return (
        <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunPageMainRegionAria}>
          <div data-testid="arena-play-snapshot-next-scenario-blocked" className="mx-auto max-w-lg px-2">
            <EmptyState
              icon="📋"
              message={t.arenaPlaySurfaceBlockedTitle}
              hint={t.arenaSnapshotPlaySurfaceBlockedHint}
            />
          </div>
        </ScreenShell>
      );
    }
    /**
     * When `gates.next_allowed`, always show the next-ready / Continue shell — never fall through to
     * `canRenderScenarioProgressionUi` (Play paused): `NEXT_SCENARIO_READY` sets `arenaPlaySurfaceAllowed` false
     * in `useArenaSession`, so mid-run “fall through to main play” was unreachable and surfaced Play paused.
     */
    const nextUnlocked = gateSnapshot.gates?.next_allowed === true;
    /** Legacy: allow fall-through to main elite wrap-up only when next is not explicitly unlocked. */
    const midRunEliteNextReady =
      Boolean(s.scenario?.eliteSetup) &&
      Boolean(s.runId) &&
      (s.phase === "DONE" || s.phase === "ACTION_DECISION");
    if (nextUnlocked || !midRunEliteNextReady) {
      return (
        <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunPageMainRegionAria}>
          <div data-testid="arena-play-snapshot-next-scenario-ready" className="mx-auto max-w-lg px-2">
            {s.arenaRuntimeBanner ? (
              <ArenaRuntimeStateBanner
                devTestId={devRuntimeBannerTestId}
                runtimeState={s.arenaRuntimeBanner.runtimeState}
                gateLabel={s.arenaRuntimeBanner.gateLabel}
              />
            ) : null}
            <div className="rounded-2xl border border-bty-border bg-bty-surface p-4 shadow-sm">
              <EmptyState
                icon="📋"
                message={t.arenaPostContractNextScenarioTitle}
                hint={s.nextScenarioLoading ? t.arenaSnapshotNextScenarioReadyHint : t.arenaPostContractNextScenarioHint}
              />
              {s.nextScenarioLoading ? (
                <div className="mt-4" aria-busy="true" aria-label={t.preparingNewScenarioAria}>
                  <CardSkeleton lines={2} showLabel={false} />
                </div>
              ) : (
                <div className="mt-4">
                  <button
                    type="button"
                    data-testid="arena-next-scenario-continue"
                    onClick={() => void Promise.resolve(s.continueNextScenario())}
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                    style={{ background: "var(--arena-accent, #5b8fa8)" }}
                  >
                    {t.arenaContinueToNextScenarioCta}
                  </button>
                </div>
              )}
            </div>
          </div>
        </ScreenShell>
      );
    }
  }

  /**
   * Safety net: valid gate shells may have `scenario == null` without being a catalog miss — never show
   * `scenarioNotFound` for these (aligning / blocked surfaces are handled above when routing is correct).
   */
  if (
    !s.scenario &&
    !s.scenarioLoading &&
    gateSnapshot != null &&
    isArenaServerEntryShellRuntimeState(gateSnapshot.runtime_state)
  ) {
    return (
      <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunPageMainRegionAria}>
        <div data-testid="arena-play-gate-shell-fallback" className="mx-auto max-w-lg px-2">
          <LoadingFallback icon="📋" message={t.arenaSnapshotPlaySurfaceBlockedHint} />
        </div>
      </ScreenShell>
    );
  }

  if (!s.scenario) {
    return (
      <ScreenShell
        locale={locale}
        fullWidth
        contentClassName="pb-24"
        mainAriaLabel={t.runPageNoScenarioMainRegionAria}
      >
        <div data-testid="arena-play-empty-scenario" className="mx-auto max-w-lg px-2">
          <div className="rounded-2xl border border-bty-border bg-bty-surface p-4 shadow-sm">
            <EmptyState
              icon="📋"
              message={s.scenarioInitError ?? t.scenarioNotFound}
              hint={t.scenarioNotFoundHint}
            />
          </div>
        </div>
      </ScreenShell>
    );
  }

  if (!s.scenario.eliteSetup) {
    return (
      <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunPageMainRegionAria}>
        <div data-testid="arena-play-non-elite-scenario" className="mx-auto max-w-lg px-2">
          <EmptyState
            icon="📋"
            message={t.arenaRunErrorTitle}
            hint={t.arenaRunErrorDescription}
          />
        </div>
      </ScreenShell>
    );
  }

  if (!s.canRenderScenarioProgressionUi) {
    return (
      <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.runPageNoScenarioMainRegionAria}>
        <div data-testid="arena-play-snapshot-play-surface-blocked" className="mx-auto max-w-lg px-2">
          {s.arenaRuntimeBanner ? (
            <ArenaRuntimeStateBanner
              devTestId={devRuntimeBannerTestId}
              runtimeState={s.arenaRuntimeBanner.runtimeState}
              gateLabel={s.arenaRuntimeBanner.gateLabel}
            />
          ) : null}
          <EmptyState
            icon="📋"
            message={t.arenaPlaySurfaceBlockedTitle}
            hint={t.arenaSnapshotPlaySurfaceBlockedHint}
          />
        </div>
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell locale={locale} fullWidth contentClassName="pb-24" mainAriaLabel={t.arenaRunPageMainRegionAria}>
        <div className="bty-arena-page-root mx-auto flex max-w-[1200px] flex-col gap-6 px-4 lg:flex-row lg:gap-6">
          <div
            data-testid="arena-play-main"
            className="flex min-w-0 flex-1 flex-col"
            style={{ maxWidth: 860, margin: "0 auto", width: "100%" }}
          >
            {s.arenaRuntimeBanner ? (
              <ArenaRuntimeStateBanner
                devTestId={devRuntimeBannerTestId}
                runtimeState={s.arenaRuntimeBanner.runtimeState}
                gateLabel={s.arenaRuntimeBanner.gateLabel}
              />
            ) : null}
            <div>
              {s.playUiSegment === "primary_choice" && s.recallPrompt && !s.scenario.eliteSetup && (
                <div
                  data-testid="arena-recall-prompt"
                  role="note"
                  className="mb-4 rounded-xl border border-bty-border/80 bg-bty-soft/60 px-4 py-3 text-sm leading-relaxed"
                  style={{ color: "var(--arena-text-soft)" }}
                >
                  {s.recallPrompt.message}
                </div>
              )}

              <ArenaHeader
                locale={locale}
                step={s.step}
                phase={s.phase}
                runId={s.runId}
                onPause={s.pause}
                onReset={s.resetRun}
                showPause={false}
                identity={s.arenaIdentity}
              />

              {s.resetRunLoading && (
                <div style={{ marginTop: 10 }} aria-busy="true" aria-label={t.preparingNewScenarioAria}>
                  <p
                    style={{
                      margin: 0,
                      padding: "8px 0 6px",
                      fontSize: 13,
                      color: "var(--arena-text-soft)",
                      opacity: 0.9,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                    aria-live="polite"
                  >
                    <span aria-hidden style={{ fontSize: 16 }}>
                      🔄
                    </span>
                    {t.preparingNewScenarioAria}…
                  </p>
                  <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
                </div>
              )}
              {s.completeError && (
                <div
                  role="alert"
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
                  {s.completeError}
                </div>
              )}

              <div
                role="region"
                aria-label={t.scenarioProgressPanelAria}
                className="mt-[18px] rounded-2xl border border-bty-border bg-bty-surface p-3 shadow-sm"
              >
                {s.playUiSegment === "primary_choice" ? (
                  <p
                    data-testid="arena-flow-phase-instruction-primary"
                    className="m-0 mb-3 rounded-xl border border-bty-border/80 bg-bty-soft/50 px-3 py-2.5 text-sm font-medium leading-snug text-bty-navy"
                  >
                    {t.arenaFlowPhasePrimaryInstruction}
                  </p>
                ) : null}
                {s.playUiSegment === "forced_tradeoff" ? (
                  <p
                    data-testid="arena-flow-phase-instruction-tradeoff"
                    className="m-0 mb-3 rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2.5 text-sm font-medium leading-snug text-amber-950"
                  >
                    {t.arenaFlowPhaseTradeoffInstruction}
                  </p>
                ) : null}
                {s.playUiSegment === "action_decision" ? (
                  <p
                    data-testid="arena-flow-phase-instruction-action-decision"
                    className="m-0 mb-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-3 py-2.5 text-sm font-medium leading-snug text-emerald-950"
                  >
                    {t.arenaFlowPhaseActionDecisionInstruction}
                  </p>
                ) : null}
                {(s.playUiSegment === "forced_tradeoff" ||
                  s.playUiSegment === "action_decision" ||
                  s.playUiSegment === "run_complete") && (
                  <h2 className="m-0 mb-2 text-lg font-semibold text-bty-navy">{s.displayTitle}</h2>
                )}

                {s.playUiSegment === "primary_choice" && (
                  <>
                    <EliteArenaStep2Context
                      title={s.displayTitle}
                      contextBody={s.contextForUser}
                      eliteSetup={s.scenario.eliteSetup}
                      locale={locale}
                    />
                    <p className="mb-3 text-sm font-medium leading-snug text-bty-navy/90">{s.t.elitePrimaryPickHint}</p>
                    <ChoiceList
                      locale={locale}
                      variant="elite"
                      choices={s.scenario.choices}
                      selectedChoiceId={null}
                      busy={s.confirmingChoice || !s.primaryChoiceInteractive}
                      onSelect={(id) => void s.commitElitePrimaryChoice(id as ScenarioChoice["choiceId"])}
                    />
                  </>
                )}

                {s.playUiSegment === "action_decision" &&
                  s.selectedChoiceId &&
                  s.scenario.escalationBranches?.[s.selectedChoiceId]?.action_decision != null && (
                    <EliteActionDecisionStep
                      locale={locale}
                      block={s.scenario.escalationBranches[s.selectedChoiceId]!.action_decision!}
                      onChoice={(id) => void s.submitActionDecision(id)}
                      choiceDisabled={s.actionDecisionSubmitting}
                    />
                  )}
                {s.playUiSegment === "action_decision" &&
                  !(
                    s.selectedChoiceId &&
                    s.scenario.escalationBranches?.[s.selectedChoiceId]?.action_decision != null
                  ) && <ArenaBindingError reason={t.eliteBindingIntegrityError} />}

                {(s.playUiSegment === "forced_tradeoff" || s.playUiSegment === "run_complete") && (
                  <EliteArenaPostChoiceBlock
                    key={`${s.scenario.scenarioId}-${s.playUiSegment}-${s.selectedChoiceId ?? "done"}`}
                    locale={locale}
                    step={s.step}
                    phase={s.phase}
                    runCompletePrimary={s.playUiSegment === "run_complete"}
                    scenario={s.scenario}
                    choice={s.choice}
                    selectedChoiceId={s.selectedChoiceId}
                    onSecondChoice={s.submitSecondChoice}
                    secondChoiceSubmitting={s.secondChoiceSubmitting}
                    onContinueNextScenario={s.continueNextScenario}
                    continueLoading={s.nextScenarioLoading}
                  />
                )}
              </div>

              <ArenaRunHistory locale={locale} />
            </div>
          </div>

          <aside
            aria-label={t.liveRanking}
            style={{ width: 280, flexShrink: 0, paddingTop: 32 }}
            className="hidden lg:block"
          >
            <ArenaRankingSidebar locale={locale} />
          </aside>
        </div>
      </ScreenShell>

      {s.milestoneModal && (
        <TierMilestoneModal
          milestone={s.milestoneModal.milestone}
          subName={s.milestoneModal.subName}
          previousSubName={s.milestoneModal.previousSubName}
          subNameRenameAvailable={s.milestoneModal.subNameRenameAvailable}
          onRename={s.milestoneModal.subNameRenameAvailable ? s.onRenameSubName : undefined}
          onClose={s.closeMilestoneModal}
        />
      )}

      {s.toast && <ArenaToast message={s.toast} />}
    </>
  );
}
