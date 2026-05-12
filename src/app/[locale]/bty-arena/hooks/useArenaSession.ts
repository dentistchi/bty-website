"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { getContextForUser } from "@/lib/bty/scenario/engine";
import type { Scenario } from "@/lib/bty/scenario/types";
import { evaluateChoice, evaluateFollowUp } from "@/lib/bty/arena/engine";
import type { SystemMsg } from "@/components/bty-arena";
import { getMilestoneToShow } from "@/lib/bty/arena/milestone";
import type { CoreXpGetResponse } from "@/lib/bty/arena/coreXpApi";
import type { ArenaHeaderIdentity } from "@/components/bty-arena/ArenaHeader";
import { arenaFetch } from "@/lib/http/arenaFetch";
import {
  arenaSessionRouterSnapshotScenarioReady,
  fetchArenaSessionRouterPackWithRetry,
  parseArenaSessionRouterSnapshotFromJson,
  reexposureSnapshotFromSessionPack,
  snapshotQualifiesAsReexposureGate,
  type ArenaPendingContractPayload,
  type ArenaSessionRouterPack,
} from "@/lib/bty/arena/arenaSessionRouterClient";
import type {
  ArenaRuntimeStateId,
  ArenaBindingRuntimeSnapshot,
  ArenaSessionRouterSnapshot,
} from "@/lib/bty/arena/arenaRuntimeSnapshot.types";
import {
  ARENA_SESSION_MODE,
  isArenaActionBlockingRuntimeState,
  isArenaExclusiveGateRuntimeState,
  isArenaServerEntryShellRuntimeState,
  snapshotAllowsArenaScenarioPlaySurface,
} from "@/lib/bty/arena/arenaRuntimeSnapshot.types";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { difficultyFromScenarioChoices } from "@/lib/bty/arena/arenaLabXp";
import { BTY_ARENA_STATE_STORAGE_KEY } from "@/lib/bty/arena/arenaLocalState";
import type { ArenaRecallPrompt } from "@/lib/bty/arena/memoryRecallPrompt.types";
import {
  getArenaPipelineDefaultForClient,
  type ArenaPipelineDefault,
} from "@/lib/bty/arena/arenaPipelineConfig";
import { isStaleEliteRunMetaForResume } from "@/lib/bty/arena/eliteRunResumeCompat";
import {
  ARENA_ENTRY_RESOLUTION_INVALIDATE_EVENT,
  BTY_ACTION_CONTRACT_UPDATED_STORAGE_KEY,
} from "@/lib/bty/arena/arenaEntryResolutionInvalidate";
import { isEliteChainScenarioId } from "@/lib/bty/arena/postLoginEliteEntry";
import { ArenaChoiceHttpError, postArenaChoice } from "@/lib/bty/arena/binding/postArenaChoice";
import { getScenarioById } from "@/data/scenario";
import { pushSignalIfNew } from "@/features/arena/logic/signalStorage";

// ── exported types ──────────────────────────────────────────────
export type ArenaPhase =
  | "CHOOSING"
  | "ESCALATION"
  | "FORCED_TRADEOFF"
  | "ACTION_DECISION"
  | "SHOW_RESULT"
  | "FOLLOW_UP"
  | "DONE";
/**
 * Client step index for the BTY Arena UI. Elite: 3 = escalation, 4 = tradeoff, 5 = action decision, 6 = run complete.
 * `POST /api/arena/run/step` covers steps 3–4; internal step 5 marks end-of-run before POST run/complete (not a snapshot label).
 * Phases `ESCALATION` / `FORCED_TRADEOFF` align with steps 3–4 when `scenario.escalationBranches` is present.
 */
export type ArenaStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Derived from step/phase only when the server allows the play surface — not a primary render authority. */
export type ArenaPlayUiSegment =
  | "none"
  | "primary_choice"
  | "forced_tradeoff"
  | "action_decision"
  | "run_complete"
  | "legacy_escalation";

export type MilestoneModalState = {
  milestone: 25 | 50 | 75;
  previousSubName?: string;
  subName: string;
  subNameRenameAvailable: boolean;
};

export type ReflectResult = {
  summary: string;
  questions: string[];
  next_action: string;
  detected?: { tags: string[]; topTag?: string };
};

export const OTHER_CHOICE_ID = "__OTHER__";

type ReexposureValidateTransition = {
  next_runtime_state: ArenaRuntimeStateId | null;
  re_exposure_clear_candidate: boolean;
  intervention_sensitivity_up: boolean;
};

type ArenaPlayContext = "normal" | "next_scenario" | "re_exposure";

export function deriveReexposureValidateLocalAssist(params: {
  arenaServerSnapshot: ArenaSessionRouterSnapshot | null;
  nextRuntimeState: ArenaRuntimeStateId | null;
  currentScenarioId: string | null;
  clearCandidate: boolean;
}): { localAssistSnapshot: ArenaBindingRuntimeSnapshot | null; clearLocalDueCandidate: boolean } {
  const clearLocalDueCandidate = params.clearCandidate;
  if (!params.nextRuntimeState) {
    return { localAssistSnapshot: null, clearLocalDueCandidate };
  }
  const serverShellActive =
    params.arenaServerSnapshot != null &&
    isArenaServerEntryShellRuntimeState(params.arenaServerSnapshot.runtime_state);
  if (serverShellActive) {
    return { localAssistSnapshot: null, clearLocalDueCandidate };
  }
  const localAssistSnapshot: ArenaBindingRuntimeSnapshot =
    params.nextRuntimeState === "NEXT_SCENARIO_READY"
      ? {
          mode: ARENA_SESSION_MODE,
          runtime_state: "NEXT_SCENARIO_READY",
          state_priority: 40,
          gates: { next_allowed: true, choice_allowed: false, qr_allowed: false },
          action_contract: {
            exists: false,
            id: null,
            status: null,
            verification_type: null,
            deadline_at: null,
          },
          re_exposure: { due: false, scenario_id: null },
        }
      : {
          mode: ARENA_SESSION_MODE,
          runtime_state: "REEXPOSURE_DUE",
          state_priority: 55,
          gates: { next_allowed: false, choice_allowed: false, qr_allowed: false },
          action_contract: {
            exists: false,
            id: null,
            status: null,
            verification_type: null,
            deadline_at: null,
          },
          re_exposure: { due: true, scenario_id: params.currentScenarioId },
        };
  return { localAssistSnapshot, clearLocalDueCandidate };
}

// ── internal types ──────────────────────────────────────────────
type SavedArenaState = {
  version: 1;
  runtimeSchemaVersion?: string;
  scenarioId: string;
  phase: ArenaPhase;
  selectedChoiceId?: string;
  secondChoiceId?: string;
  followUpIndex?: number;
  lastXp?: number;
  lastSystemMessage?: string;
  runId?: string;
  updatedAtISO: string;
  step?: ArenaStep;
  reflectionIndex?: number;
  reflectionText?: string;
  reflectionBonusXp?: number;
  otherSubmitted?: boolean;
  freeResponseFeedback?: { praise: string; suggestion: string } | null;
};

// ── constants ───────────────────────────────────────────────────
const STORAGE_KEY = BTY_ARENA_STATE_STORAGE_KEY;
const ARENA_RUNTIME_SCHEMA_VERSION = "canonical-db-id-v2";
const STREAK_KEY = "btyArenaStreak:v1";
const MIN_REFLECTION_LENGTH = 3;
const REFLECTION_BONUS_XP = 10;

const SYSTEM_MESSAGES: SystemMsg[] = [
  { id: "arch_init", en: "Architecture initialized. The framework is stable.", ko: "아키텍처 초기화됨. 프레임워크가 안정화되었습니다." },
  { id: "telemetry", en: "Leadership telemetry active. Your choices refine the arena.", ko: "리더십 원격 측정 활성. 선택이 아레나를 다듬습니다." },
  { id: "gratitude", en: "Gratitude frequency synchronized. Cultural impact detected.", ko: "감사 빈도 동기화됨. 문화적 영향이 감지되었습니다." },
  { id: "consistency", en: "Consistency detected. Operational rhythm established.", ko: "일관성 감지됨. 운영 리듬이 확립되었습니다." },
  { id: "integrity", en: "Integrity spike detected. Ethical alignment increased.", ko: "무결성 상승 감지. 윤리 정렬이 높아졌습니다." },
  { id: "other_recorded", en: "Other recorded.", ko: "기타 기록됨." },
];

// ── helpers ─────────────────────────────────────────────────────
function safeNowISO() {
  return new Date().toISOString();
}

function loadState(): SavedArenaState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedArenaState;
    if (parsed?.version !== 1 || !parsed?.scenarioId) return null;
    if (parsed.runtimeSchemaVersion !== ARENA_RUNTIME_SCHEMA_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveState(state: SavedArenaState) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...state,
      runtimeSchemaVersion: ARENA_RUNTIME_SCHEMA_VERSION,
      updatedAtISO: safeNowISO(),
    }),
  );
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * True when the user has not committed an Arena choice yet (no XP-bearing selection).
 * Covers the choice screen (step 2) before confirm — session/next may replace stale/basic lobby state.
 * Mid-run resume: once phase !== CHOOSING or a choice/other is recorded, this is false.
 */
function isPreChoiceLobby(saved: SavedArenaState): boolean {
  if (saved.phase !== "CHOOSING") return false;
  if (saved.otherSubmitted) return false;
  if (saved.selectedChoiceId != null && saved.selectedChoiceId !== "") return false;
  return true;
}

/** Lobby localStorage older than this should resync from the arena session router (same or new scenario id). */
const STALE_LOBBY_MS = 2 * 60 * 60 * 1000;
const STALE_BASIC_LOBBY_MS = 15 * 60 * 1000;

function isBasicScenario(s: Scenario): boolean {
  return !s.elite_only && (s.minTier == null || s.minTier === 0);
}

function lobbyStaleThresholdMs(saved: SavedArenaState, scenario: Scenario | null | undefined): number {
  if (scenario && scenario.scenarioId === saved.scenarioId && isBasicScenario(scenario)) {
    return STALE_BASIC_LOBBY_MS;
  }
  return STALE_LOBBY_MS;
}

function isStaleLobby(saved: SavedArenaState, scenario?: Scenario | null): boolean {
  const t = Date.parse(saved.updatedAtISO);
  if (Number.isNaN(t)) return true;
  const age = Date.now() - t;
  return age > lobbyStaleThresholdMs(saved, scenario);
}

/**
 * True when `arena_runs` still has this run for the user and it matches the expected scenario
 * (stale localStorage after DB deletes / rotation).
 *
 * Elite chain (`core_01` / `core_06` / `core_11`): refuses resume of legacy scenario ids, non-`IN_PROGRESS`
 * rows, or runs whose `meta` has pre-canonical escalation without `elite_runtime_compat` (see
 * {@link isStaleEliteRunMetaForResume}).
 */
async function validateRunForResume(runId: string | null | undefined, expectedScenarioId: string): Promise<boolean> {
  if (runId == null || String(runId).trim() === "") return false;
  try {
    const data = await arenaFetch<{
      run?: { scenario_id?: string; status?: string; meta?: Record<string, unknown> };
    }>(`/api/arena/run/${encodeURIComponent(String(runId))}`);
    const run = data.run;
    const sid = run?.scenario_id;
    const expectedDbScenarioId = getScenarioById(expectedScenarioId, "en")?.dbScenarioId ?? null;
    const sidOk =
      typeof sid === "string" &&
      (sid === expectedScenarioId || (expectedDbScenarioId != null && sid === expectedDbScenarioId));
    if (!sidOk) return false;

    if (isEliteChainScenarioId(expectedScenarioId)) {
      if (!isEliteChainScenarioId(sid)) return false;
      const st = typeof run?.status === "string" ? run.status.trim() : "";
      if (st !== "IN_PROGRESS") return false;
      if (isStaleEliteRunMetaForResume(run?.meta)) return false;

      try {
        const runsData = await arenaFetch<{
          runs?: { run_id: string; status?: string; started_at?: string }[];
        }>("/api/arena/runs?limit=20");
        const inProg = (runsData.runs ?? []).filter(
          (r) => String(r.status ?? "").trim().toUpperCase() === "IN_PROGRESS",
        );
        if (inProg.length <= 1) {
          // single (or zero) in-progress — this run is the only candidate
        } else {
          const sorted = [...inProg].sort((a, b) => {
            const ta = Date.parse(String(a.started_at ?? ""));
            const tb = Date.parse(String(b.started_at ?? ""));
            if (Number.isFinite(tb) && Number.isFinite(ta) && tb !== ta) return tb - ta;
            return String(b.run_id ?? "").localeCompare(String(a.run_id ?? ""));
          });
          const latest = sorted[0];
          if (latest != null && String(latest.run_id) !== String(runId)) return false;
        }
      } catch {
        /* keep resume if runs list unavailable */
      }
    }

    return true;
  } catch {
    return false;
  }
}

function normalizeFollowUpOptions(choice: { followUp?: { options?: string[] } } | null | undefined): string[] {
  return choice?.followUp?.options ?? [];
}

function stepFromPhase(phase: ArenaPhase): ArenaStep {
  switch (phase) {
    case "CHOOSING": return 2;
    case "ESCALATION": return 3;
    case "FORCED_TRADEOFF": return 4;
    case "ACTION_DECISION": return 5;
    case "SHOW_RESULT": return 3;
    case "FOLLOW_UP": return 5;
    case "DONE": return 5;
    default: return 2;
  }
}

/** Pre–action-decision saves used step 5 for DONE; migrate to step 6 for run-complete UI. */
function normalizeEliteStoredStep(
  scenario: Scenario | null | undefined,
  phase: ArenaPhase,
  step: number,
): number {
  if (scenario?.eliteSetup && phase === "DONE" && step === 5) return 6;
  return step;
}

function hasEscalationBranchForChoice(scenario: Scenario | null | undefined, choiceId: string | null): boolean {
  if (!scenario?.escalationBranches || choiceId == null || choiceId === "") return false;
  const b = scenario.escalationBranches[choiceId];
  return Boolean(b?.escalation_text && Array.isArray(b.second_choices) && b.second_choices.length > 0);
}

function isCanonicalJsonRuntimeScenario(s: Scenario | null | undefined): boolean {
  if (!s) return false;
  if (s.source === "json") return true;
  if (/^core_\d{2}_/i.test(s.scenarioId)) return true;
  return typeof s.dbScenarioId === "string" && s.dbScenarioId.startsWith("INCIDENT-");
}

function resolveTradeoffDbChoiceIdFromBase(params: {
  scenarioId: string;
  primaryChoiceId: string;
  secondChoiceId: string;
}): string | null {
  const runtime = getScenarioById(params.scenarioId, "en");
  const rows = runtime?.base?.structure?.tradeoff?.[params.primaryChoiceId];
  if (!Array.isArray(rows)) return null;
  const row = rows.find((r) => r.choiceId === params.secondChoiceId);
  if (!row || typeof row.dbChoiceId !== "string" || row.dbChoiceId.trim() === "") return null;
  return row.dbChoiceId.trim();
}

function resolveActionDecisionDbChoiceIdFromBase(params: {
  scenarioId: string;
  primaryChoiceId: string;
  secondChoiceId: string;
  actionChoiceId: string;
}): string | null {
  const runtime = getScenarioById(params.scenarioId, "en");
  const rows = runtime?.base?.structure?.action_decision?.[`${params.primaryChoiceId}_${params.secondChoiceId}`];
  if (!Array.isArray(rows)) return null;
  const row = rows.find((r) => r.choiceId === params.actionChoiceId);
  if (!row || typeof row.dbChoiceId !== "string" || row.dbChoiceId.trim() === "") return null;
  return row.dbChoiceId.trim();
}

/** Elite flow reuses steps 3–7 but never `FOLLOW_UP` phase; normalize stale saves from pre-fix runs. */
function normalizeEliteResumePhase(
  scenario: Scenario | null | undefined,
  phase: ArenaPhase,
  resumeStep: number,
): ArenaPhase {
  if (scenario?.eliteSetup && phase === "FOLLOW_UP" && resumeStep >= 3 && resumeStep <= 6) {
    return "SHOW_RESULT";
  }
  return phase;
}

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

/** Default Arena timer limit in seconds; 0 = no timer. */
const ARENA_TIME_LIMIT_SECONDS = 300;

export type CreateRunOptions = {
  scenario?: Scenario;
  timeLimitSeconds?: number;
};

export type CreateRunResult = {
  run_id: string;
  started_at: string;
  timeLimitSeconds?: number;
};

async function createRun(
  scenarioId: string,
  locale: string | undefined,
  options?: CreateRunOptions
): Promise<CreateRunResult | null> {
  try {
    const difficulty = options?.scenario
      ? difficultyFromScenarioChoices(options.scenario.choices)
      : undefined;
    const timeLimitSeconds = options?.timeLimitSeconds ?? ARENA_TIME_LIMIT_SECONDS;
    const meta =
      timeLimitSeconds > 0
        ? { time_limit: timeLimitSeconds }
        : undefined;
    const scenarioIdForRun =
      typeof options?.scenario?.dbScenarioId === "string" && options.scenario.dbScenarioId.trim() !== ""
        ? options.scenario.dbScenarioId.trim()
        : scenarioId;
    const data = await arenaFetch<{
      run?: { run_id: string; started_at?: string };
    }>("/api/arena/run", {
      json: {
        scenarioId: scenarioIdForRun,
        locale: locale ?? null,
        ...(difficulty != null && { difficulty }),
        ...(meta != null && { meta }),
      },
    });
    const run = data.run;
    if (!run?.run_id) return null;
    const started_at = typeof run.started_at === "string" ? run.started_at : new Date().toISOString();
    return {
      run_id: run.run_id,
      started_at,
      ...(timeLimitSeconds > 0 && { timeLimitSeconds }),
    };
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
  try {
    await arenaFetch("/api/arena/event", { json: payload });
  } catch (e) {
    console.warn("Arena postArenaEvent failed", e);
  }
}

// ── hook ────────────────────────────────────────────────────────
export function useArenaSession(_pipelineFromServer?: ArenaPipelineDefault) {
  /** Client bundle must call Pipeline N `/api/arena/n/session` when `NEXT_PUBLIC_ARENA_PIPELINE_DEFAULT=new`
   * even if the RSC parent passed a mismatched default (OpenNext / edge env drift). */
  const pipelineDefault = getArenaPipelineDefaultForClient();
  const params = useParams();
  const router = useRouter();
  const locale: Locale =
    typeof params?.locale === "string" && (params.locale === "ko" || params.locale === "en")
      ? params.locale
      : "en";
  const t = getMessages(locale).arenaRun;

  // Level gate (Gate 1: tier from API only — do not compute tier from coreXpTotal in UI.)
  // Gate 2: requiresBeginnerPath from API only — do not compare coreXpTotal to 200.)
  const [levelChecked, setLevelChecked] = React.useState(false);
  const [coreXpTotal, setCoreXpTotal] = React.useState<number | null>(null);
  const [tier, setTier] = React.useState<number | null>(null);
  const [requiresBeginnerPath, setRequiresBeginnerPath] = React.useState(false);
  const [arenaIdentity, setArenaIdentity] = React.useState<ArenaHeaderIdentity | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    arenaFetch<CoreXpGetResponse>("/api/arena/core-xp")
      .then((data) => {
        if (cancelled) return;
        if (typeof data.coreXpTotal === "number") setCoreXpTotal(data.coreXpTotal);
        if (typeof data.tier === "number") setTier(data.tier);
        setRequiresBeginnerPath(Boolean(data.requiresBeginnerPath));
        setArenaIdentity({
          codeName: typeof data.codeName === "string" ? data.codeName : "",
          subName: typeof data.subName === "string" ? data.subName : "",
          avatarUrl: data.avatarUrl ?? null,
          avatarCharacterId: data.avatarCharacterId ?? null,
          avatarCharacterImageUrl: data.avatarCharacterImageUrl ?? null,
          avatarOutfitImageUrl: data.avatarOutfitImageUrl ?? null,
          accessoryIds: Array.isArray(data.currentOutfit?.accessoryIds) ? data.currentOutfit.accessoryIds : [],
        });
        setLevelChecked(true);
      })
      .catch(() => {
        if (!cancelled) {
          setArenaIdentity(null);
          setLevelChecked(true);
        }
      });
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    if (!levelChecked || !requiresBeginnerPath) return;
    router.replace(`/${locale}/bty-arena/beginner`);
  }, [levelChecked, requiresBeginnerPath, locale, router]);
  // Gate 2: redirect uses API requiresBeginnerPath only; no coreXpTotal < 200 in UI.

  // Core state
  const [scenario, setScenario] = React.useState<Scenario | null>(null);
  const [scenarioLoading, setScenarioLoading] = React.useState(false);
  const [scenarioInitError, setScenarioInitError] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<ArenaPhase>("CHOOSING");
  const [step, setStep] = React.useState<ArenaStep>(1);
  const [reflectionIndex, setReflectionIndex] = React.useState<number | null>(null);
  const [reflectionText, setReflectionText] = React.useState("");
  const [reflectionBonusXp, setReflectionBonusXp] = React.useState(0);

  const [selectedChoiceId, setSelectedChoiceId] = React.useState<string | null>(null);
  const [selectedSecondChoiceId, setSelectedSecondChoiceId] = React.useState<string | null>(null);
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
  const [completeError, setCompleteError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [nextScenarioLoading, setNextScenarioLoading] = React.useState(false);
  const [confirmingChoice, setConfirmingChoice] = React.useState(false);
  const [followUpSubmitting, setFollowUpSubmitting] = React.useState(false);
  const [escalationAckSubmitting, setEscalationAckSubmitting] = React.useState(false);
  const [secondChoiceSubmitting, setSecondChoiceSubmitting] = React.useState(false);
  const [actionDecisionSubmitting, setActionDecisionSubmitting] = React.useState(false);

  const [reflectResult, setReflectResult] = React.useState<ReflectResult | null>(null);
  const [reflectDeepeningNotice, setReflectDeepeningNotice] = React.useState<string | null>(null);
  const [reflectionSubmitting, setReflectionSubmitting] = React.useState(false);
  const [milestoneModal, setMilestoneModal] = React.useState<MilestoneModalState | null>(null);
  const [resetRunLoading, setResetRunLoading] = React.useState(false);
  const [reexposureEnterLoading, setReexposureEnterLoading] = React.useState(false);
  const [pendingContractQrLoading, setPendingContractQrLoading] = React.useState(false);
  const [playContext, setPlayContext] = React.useState<ArenaPlayContext>("normal");
  /** Set when entering re-exposure play from `REEXPOSURE_DUE`; consumed after POST `/api/arena/re-exposure/validate`. */
  const reexposurePendingOutcomeIdRef = React.useRef<string | null>(null);
  /** GET `re_exposure` slice — kept until `beginReexposurePlay` succeeds so ids survive snapshot churn. */
  const reexposureGateSnapshotRef = React.useRef<ArenaSessionRouterSnapshot | null>(null);
  /** Last server `validation_result` from re-exposure closure (inspectable in dev / future UI). */
  const [lastReexposureValidation, setLastReexposureValidation] = React.useState<string | null>(null);
  /** Last transition contract from POST `/api/arena/re-exposure/validate` (snapshot fallback assist only). */
  const [lastReexposureTransition, setLastReexposureTransition] =
    React.useState<ReexposureValidateTransition | null>(null);
  const [recallPrompt, setRecallPrompt] = React.useState<ArenaRecallPrompt | null>(null);
  /** Session router 409 `action_contract_pending` — blocks next scenario until handled elsewhere (Center / contracts). */
  const [pendingActionContract, setPendingActionContract] = React.useState<ArenaPendingContractPayload | null>(null);
  const pendingActionContractRef = React.useRef<ArenaPendingContractPayload | null>(null);
  React.useEffect(() => {
    pendingActionContractRef.current = pendingActionContract;
  }, [pendingActionContract]);
  /** Server session-router snapshot (authoritative over local step/phase when conflict). */
  const [arenaServerSnapshot, setArenaServerSnapshot] = React.useState<ArenaSessionRouterSnapshot | null>(null);
  /** POST `/api/arena/choice` binding snapshot — merged with session snapshot for live gating. */
  const [bindingRuntimeSnapshot, setBindingRuntimeSnapshot] = React.useState<ArenaBindingRuntimeSnapshot | null>(null);
  /** Bumps arena init effect to re-fetch session router (e.g. after pending contract resolved). */
  const [sessionLoadNonce, setSessionLoadNonce] = React.useState(0);
  const sessionResyncLastAtRef = React.useRef(0);

  /** When My Page / Center completes QR elsewhere, re-fetch session only if this surface still shows a contract gate. */
  React.useEffect(() => {
    const onInvalidate = () => {
      if (pendingActionContract != null) {
        setSessionLoadNonce((n) => n + 1);
      }
    };
    window.addEventListener(ARENA_ENTRY_RESOLUTION_INVALIDATE_EVENT, onInvalidate);
    return () => window.removeEventListener(ARENA_ENTRY_RESOLUTION_INVALIDATE_EVENT, onInvalidate);
  }, [pendingActionContract]);

  /** Auto-resync while contract gate is active (QR may finish in another tab/device). */
  React.useEffect(() => {
    const shouldAutoSync =
      pendingActionContract != null ||
      (arenaServerSnapshot != null &&
        isArenaActionBlockingRuntimeState(arenaServerSnapshot.runtime_state));
    if (!shouldAutoSync) return;
    const cooldownMs = 1500;
    const syncSessionGate = (source: "focus" | "visibility" | "storage") => {
      const now = Date.now();
      if (now - sessionResyncLastAtRef.current < cooldownMs) return;
      sessionResyncLastAtRef.current = now;
      console.info("[BTY SYNC] visibility/focus refetch", {
        source,
        runtimeState: arenaServerSnapshot?.runtime_state ?? null,
        pendingContractId: pendingActionContract?.id ?? null,
      });
      setScenarioLoading(true);
      setPendingActionContract(null);
      const preserveGetReexposure =
        reexposureGateSnapshotRef.current?.runtime_state === "REEXPOSURE_DUE" ||
        arenaServerSnapshot?.runtime_state === "REEXPOSURE_DUE";
      if (!preserveGetReexposure) {
        setArenaServerSnapshot(null);
      }
      setBindingRuntimeSnapshot(null);
      setSessionLoadNonce((n) => n + 1);
    };
    const onFocus = () => syncSessionGate("focus");
    const onVisibility = () => {
      if (document.visibilityState === "visible") syncSessionGate("visibility");
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== BTY_ACTION_CONTRACT_UPDATED_STORAGE_KEY) return;
      syncSessionGate("storage");
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
    };
  }, [pendingActionContract, arenaServerSnapshot]);

  React.useEffect(() => {
    if (scenarioLoading) return;
    if (sessionLoadNonce < 1) return;
    console.info("[BTY SYNC] session refetch complete", {
      runtimeState: arenaServerSnapshot?.runtime_state ?? null,
      pendingContractId: pendingActionContract?.id ?? null,
      nonce: sessionLoadNonce,
    });
  }, [scenarioLoading, sessionLoadNonce, arenaServerSnapshot, pendingActionContract]);

  const runMetaRef = React.useRef<{
    runId: string;
    startedAt: string;
    timeLimitSeconds: number;
  } | null>(null);
  /** Legacy save: elite step 3 + ESCALATION — auto-POST step 3 once to reach second-choice screen. */
  const eliteResumeEscalationRef = React.useRef<string | null>(null);

  // Toast auto-dismiss
  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  // Other modal ESC handler
  React.useEffect(() => {
    if (!otherOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOtherOpen(false); setOtherText(""); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [otherOpen]);

  // Arena init: session router (`session/next` legacy vs `/api/arena/n/session` when Pipeline N) before localStorage merge.
  React.useEffect(() => {
    if (!levelChecked || requiresBeginnerPath) return;

    let cancelled = false;

    (async () => {
      setScenarioLoading(true);
      setScenarioInitError(null);
      setBindingRuntimeSnapshot(null);

      try {
        const serverPack = await fetchArenaSessionRouterPackWithRetry(
          locale === "ko" ? "ko" : "en",
          pipelineDefault,
        );
        if (cancelled) return;

        if (serverPack.outcome === "blocked") {
          reexposureGateSnapshotRef.current = serverPack.snapshot;
          setPendingActionContract(serverPack.contract);
          setArenaServerSnapshot(serverPack.snapshot);
          console.info("[arena][session-router-blocked]", { context: "init" });
          return;
        }

        const reexposureSnap = reexposureSnapshotFromSessionPack(serverPack);
        if (reexposureSnap) {
          applyReexposureHardStop(reexposureSnap, "init");
          return;
        }

        if (serverPack.outcome === "session_shell") {
          applyReexposureHardStop(serverPack.snapshot, "init");
          return;
        }

        reexposureGateSnapshotRef.current = null;

        const streakInfo = updateStreak();
        const saved = loadState();

        const serverNext = serverPack.outcome === "scenario" ? serverPack.scenario : null;
        const routerRecall =
          serverPack.outcome === "scenario" ? (serverPack.recallPrompt ?? null) : null;

        if (!serverNext) {
          setPendingActionContract(null);
          setArenaServerSnapshot(null);
          clearState();
          resetAllLocal();
          setScenario(null);
          setPhase("CHOOSING");
          setStep(2);
          setScenarioInitError(t.scenarioNotFound);
          return;
        }

        setPendingActionContract(null);
        setArenaServerSnapshot(serverPack.outcome === "scenario" ? serverPack.snapshot : null);
        setRecallPrompt(routerRecall);

        if (serverPack.outcome === "scenario") {
          const rs = serverPack.snapshot.runtime_state;
          if (rs === "FORCED_RESET_PENDING") {
            resetAllLocal();
            setScenario(serverNext);
            setPhase("CHOOSING");
            setStep(2);
            setScenarioInitError(null);
            return;
          }
        }

        /** Canonical lobby: fresh scenario from session router + new `arena_runs` row. */
        const applyCanonicalLobby = async (next: Scenario) => {
          if (pendingActionContractRef.current != null) {
            console.warn("[arena] applyCanonicalLobby skipped: pending action contract");
            return;
          }
          if (reexposureGateSnapshotRef.current?.runtime_state === "REEXPOSURE_DUE") {
            console.error("C5 invariant violated: applyCanonicalLobby would bypass REEXPOSURE_DUE shell", {
              catalogScenarioId: next.scenarioId,
            });
            return;
          }
          if (reexposureGateSnapshotRef.current != null) {
            console.warn("[arena] applyCanonicalLobby skipped: server shell gate active");
            return;
          }
          reexposureGateSnapshotRef.current = null;
          setPlayContext("normal");
          clearState();
          resetAllLocal();
          setRecallPrompt(routerRecall);
          setScenario(next);
          setPhase("CHOOSING");
          /** Canonical Arena: skip Legend step-1 intro; first screen is setup + initial choice (step 2). */
          setStep(2);
          if (streakInfo.message) setSystemMessage(streakInfo.message);
          try {
            const data = await arenaFetch<{ run?: { run_id: string } }>("/api/arena/run", {
              json: { scenarioId: next.scenarioId, locale },
            });
            if (cancelled) return;
            if (data.run?.run_id) {
              setRunId(data.run.run_id);
              try {
                await postArenaEvent({
                  runId: data.run.run_id,
                  scenarioId: next.scenarioId,
                  step: 1,
                  eventType: "SCENARIO_STARTED",
                });
              } catch (e) {
                console.warn("Arena SCENARIO_STARTED event failed", e);
              }
              saveState({
                version: 1,
                scenarioId: next.scenarioId,
                phase: "CHOOSING",
                step: 2,
                runId: data.run.run_id,
                updatedAtISO: safeNowISO(),
              });
            }
          } catch (e) {
            console.warn("Arena run create failed", e);
          }
        };

        if (
          serverPack.outcome === "scenario" &&
          serverPack.snapshot.runtime_state === "ARENA_SCENARIO_READY" &&
          saved &&
          serverNext.scenarioId === saved.scenarioId &&
          serverNext.eliteSetup &&
          (saved.phase === "DONE" ||
            (typeof saved.step === "number" && saved.step >= 5))
        ) {
          await applyCanonicalLobby(serverNext);
          return;
        }

        if (!saved) {
          await applyCanonicalLobby(serverNext);
          return;
        }

        const serverAligns = serverNext.scenarioId === saved.scenarioId;
        const runOk =
          saved.runId != null &&
          saved.runId !== "" &&
          (await validateRunForResume(saved.runId, saved.scenarioId));

        // Mid-run: only restore when session agrees on scenario, DB run exists, and row matches scenario.
        if (!isPreChoiceLobby(saved)) {
          if (!serverAligns || !runOk) {
            await applyCanonicalLobby(serverNext);
            return;
          }
          let resumePhase = saved.phase;
          let resumeStep = (saved.step ?? stepFromPhase(saved.phase)) as number;
          if (resumeStep < 1 || resumeStep > 7) {
            resumeStep = 2;
            resumePhase = "CHOOSING";
          }
          const noSelection = saved.selectedChoiceId == null || saved.selectedChoiceId === undefined;
          if (resumePhase !== "CHOOSING" && noSelection && !saved.otherSubmitted) {
            resumePhase = "CHOOSING";
            resumeStep = 2;
          }
          /** Migrate old Legend step-1 intro to canonical first-choice screen. */
          if (resumePhase === "CHOOSING" && resumeStep === 1 && noSelection && !saved.otherSubmitted) {
            resumeStep = 2;
          }
          resumePhase = normalizeEliteResumePhase(serverNext, resumePhase, resumeStep);
          resumeStep = normalizeEliteStoredStep(serverNext, resumePhase, resumeStep);
          let eliteStep = resumeStep;
          let elitePh = resumePhase;
          if (serverNext.eliteSetup && eliteStep >= 6 && eliteStep <= 7) {
            eliteStep = 6;
            elitePh = "DONE";
          }
          setScenario(serverNext);
          setPhase(elitePh);
          setStep(eliteStep as ArenaStep);
          setReflectionIndex(typeof saved.reflectionIndex === "number" ? saved.reflectionIndex : null);
          setReflectionText(typeof saved.reflectionText === "string" ? saved.reflectionText : "");
          setReflectionBonusXp(typeof saved.reflectionBonusXp === "number" ? saved.reflectionBonusXp : 0);
          setSelectedChoiceId(noSelection && saved.otherSubmitted ? OTHER_CHOICE_ID : (saved.selectedChoiceId ?? null));
          setSelectedSecondChoiceId(saved.secondChoiceId ?? null);
          setOtherSubmitted(Boolean(saved.otherSubmitted));
          setFollowUpIndex(typeof saved.followUpIndex === "number" ? saved.followUpIndex : null);
          setLastXp(saved.lastXp ?? 0);
          setRunId(saved.runId ?? null);
          setFreeResponseFeedback(saved.freeResponseFeedback ?? null);
          if (saved.lastSystemMessage) {
            setSystemMessage(SYSTEM_MESSAGES.find((m) => m.id === saved.lastSystemMessage) ?? null);
          } else if (streakInfo.message) {
            setSystemMessage(streakInfo.message);
          }
          return;
        }

        // Pre-choice lobby
        if (!serverAligns || isStaleLobby(saved, serverNext)) {
          await applyCanonicalLobby(serverNext);
          return;
        }

        if (saved.runId && !runOk) {
          await applyCanonicalLobby(serverNext);
          return;
        }

        let resumePhase = saved.phase;
        let resumeStep = (saved.step ?? stepFromPhase(saved.phase)) as number;
        if (resumeStep < 1 || resumeStep > 7) {
          resumeStep = 2;
          resumePhase = "CHOOSING";
        }
        const noSelection = saved.selectedChoiceId == null || saved.selectedChoiceId === undefined;
        if (resumePhase !== "CHOOSING" && noSelection && !saved.otherSubmitted) {
          resumePhase = "CHOOSING";
          resumeStep = 2;
        }
        /** Migrate old Legend step-1 intro to canonical first-choice screen. */
        if (resumePhase === "CHOOSING" && resumeStep === 1 && noSelection && !saved.otherSubmitted) {
          resumeStep = 2;
        }
        resumePhase = normalizeEliteResumePhase(serverNext, resumePhase, resumeStep);
        resumeStep = normalizeEliteStoredStep(serverNext, resumePhase, resumeStep);
        let eliteStepLobby = resumeStep;
        let elitePhLobby = resumePhase;
        if (serverNext.eliteSetup && eliteStepLobby >= 6 && eliteStepLobby <= 7) {
          eliteStepLobby = 6;
          elitePhLobby = "DONE";
        }
        if (serverNext.eliteSetup) {
          console.info("[arena][elite-lobby-restore]", {
            scenarioId: saved.scenarioId,
            phase: elitePhLobby,
            step: eliteStepLobby,
            persistedPhase: saved.phase,
            persistedStep: saved.step,
          });
        }
        setScenario(serverNext);
        setPhase(elitePhLobby);
        setStep(eliteStepLobby as ArenaStep);
        setReflectionIndex(typeof saved.reflectionIndex === "number" ? saved.reflectionIndex : null);
        setReflectionText(typeof saved.reflectionText === "string" ? saved.reflectionText : "");
        setReflectionBonusXp(typeof saved.reflectionBonusXp === "number" ? saved.reflectionBonusXp : 0);
        setSelectedChoiceId(noSelection && saved.otherSubmitted ? OTHER_CHOICE_ID : (saved.selectedChoiceId ?? null));
        setSelectedSecondChoiceId(saved.secondChoiceId ?? null);
        setOtherSubmitted(Boolean(saved.otherSubmitted));
        setFollowUpIndex(typeof saved.followUpIndex === "number" ? saved.followUpIndex : null);
        setLastXp(saved.lastXp ?? 0);
        setRunId(runOk ? saved.runId! : null);
        setFreeResponseFeedback(saved.freeResponseFeedback ?? null);
        if (saved.lastSystemMessage) {
          setSystemMessage(SYSTEM_MESSAGES.find((m) => m.id === saved.lastSystemMessage) ?? null);
        } else if (streakInfo.message) {
          setSystemMessage(streakInfo.message);
        }
        if (runOk && saved.runId) {
          if (serverNext.eliteSetup) {
            console.info("[arena][elite-lobby-persist]", {
              scenarioId: saved.scenarioId,
              phase: elitePhLobby,
              step: eliteStepLobby,
            });
          }
          saveState({
            version: 1,
            scenarioId: saved.scenarioId,
            phase: elitePhLobby,
            step: eliteStepLobby as ArenaStep,
            selectedChoiceId: saved.selectedChoiceId,
            followUpIndex: saved.followUpIndex,
            lastXp: saved.lastXp,
            lastSystemMessage: saved.lastSystemMessage,
            runId: saved.runId,
            otherSubmitted: saved.otherSubmitted,
            freeResponseFeedback: saved.freeResponseFeedback,
            reflectionIndex: saved.reflectionIndex,
            reflectionText: saved.reflectionText,
            reflectionBonusXp: saved.reflectionBonusXp,
            updatedAtISO: safeNowISO(),
          });
        }
        if (!runOk || !saved.runId) {
          try {
            const data = await arenaFetch<{ run?: { run_id: string } }>("/api/arena/run", {
              json: { scenarioId: serverNext.scenarioId, locale },
            });
            if (cancelled) return;
            if (data.run?.run_id) {
              setRunId(data.run.run_id);
              saveState({
                version: 1,
                scenarioId: serverNext.scenarioId,
                phase: "CHOOSING",
                step: resumeStep as ArenaStep,
                runId: data.run.run_id,
                updatedAtISO: safeNowISO(),
              });
            }
          } catch (e) {
            console.warn("Arena run create failed (pre-choice recover)", e);
          }
        }
      } finally {
        if (!cancelled) setScenarioLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [levelChecked, requiresBeginnerPath, locale, pipelineDefault, t.scenarioNotFound, sessionLoadNonce]);

  // ── derived values ──────────────────────────────────────────
  const current = scenario;
  const displayTitle = current
    ? (locale === "ko" && current.titleKo ? current.titleKo : current.title)
    : "";
  const displayContext = current
    ? (locale === "ko" && current.contextKo ? current.contextKo : current.context)
    : "";
  const contextForUser = getContextForUser(displayContext);

  const choice = current?.choices.find((c) => c.choiceId === selectedChoiceId) ?? null;

  /**
   * GET session must win over stale `bindingRuntimeSnapshot` for **all server entry shells**
   * (`ACTION_*`, `REEXPOSURE_DUE`, `FORCED_RESET_PENDING`, `NEXT_SCENARIO_READY`) — otherwise binding
   * snapshots from `postArenaChoice` mask the latest GET authority.
   */
  const serverShellPrioritySnapshot =
    arenaServerSnapshot != null && isArenaServerEntryShellRuntimeState(arenaServerSnapshot.runtime_state)
      ? arenaServerSnapshot
      : null;

  /** While contract 409 or exclusive server gate is active, ignore binding so TRADEOFF/ACTION_DECISION cannot resume over ACTION_* / REEXPOSURE / FORCED_RESET. */
  const bindingSuppressedByExclusiveGate =
    pendingActionContract != null ||
    (arenaServerSnapshot != null &&
      isArenaExclusiveGateRuntimeState(arenaServerSnapshot.runtime_state));

  const effectiveArenaSnapshot = bindingSuppressedByExclusiveGate
    ? serverShellPrioritySnapshot ?? arenaServerSnapshot
    : serverShellPrioritySnapshot ?? bindingRuntimeSnapshot ?? arenaServerSnapshot;

  /** Contract gate authority: 409 pending body and/or effective snapshot ACTION_*. */
  const arenaActionBlocking =
    pendingActionContract != null ||
    (effectiveArenaSnapshot != null &&
      isArenaActionBlockingRuntimeState(effectiveArenaSnapshot.runtime_state));

  const arenaPlaySurfaceAllowed = snapshotAllowsArenaScenarioPlaySurface(
    effectiveArenaSnapshot,
    arenaActionBlocking,
  );

  /** Primary ChoiceList: snapshot `gates.choice_allowed` is authoritative (binding + GET session). */
  const primaryChoiceInteractive =
    arenaPlaySurfaceAllowed &&
    step === 2 &&
    phase === "CHOOSING" &&
    (effectiveArenaSnapshot == null || effectiveArenaSnapshot.gates.choice_allowed);

  const { canRenderScenarioProgressionUi, playUiSegment } = React.useMemo(() => {
    const can = Boolean(current?.eliteSetup && arenaPlaySurfaceAllowed);
    if (!can) {
      return {
        canRenderScenarioProgressionUi: false,
        playUiSegment: "none" as ArenaPlayUiSegment,
      };
    }
    /** Snapshot outranks local step/phase: tradeoff tier after primary binding. */
    if (effectiveArenaSnapshot?.runtime_state === "TRADEOFF_ACTIVE") {
      if (step === 4 && phase === "FORCED_TRADEOFF") {
        return { canRenderScenarioProgressionUi: true, playUiSegment: "forced_tradeoff" as const };
      }
    }
    /** Snapshot outranks local step/phase: mid-run commitment step after tradeoff binding. */
    if (effectiveArenaSnapshot?.runtime_state === "ACTION_DECISION_ACTIVE") {
const branchKey =
  selectedChoiceId && selectedChoiceId !== OTHER_CHOICE_ID
    ? selectedChoiceId
    : current?.escalationBranches
      ? Object.keys(current.escalationBranches)[0] ?? null
      : null;
const eb =
  branchKey && current?.escalationBranches
    ? current.escalationBranches[branchKey]
    : undefined;
      const rawAd = eb && typeof eb === "object" ? eb.action_decision : undefined;
      const ad =
        rawAd && typeof rawAd === "object" && rawAd !== null && "choices" in rawAd ? rawAd : undefined;
      if (ad?.choices && ad.choices.length > 0) {
        return { canRenderScenarioProgressionUi: true, playUiSegment: "action_decision" as const };
      }
    }
    let segment: ArenaPlayUiSegment = "none";
    if (step === 2 && phase === "CHOOSING") segment = "primary_choice";
    else if (step === 4 && phase === "FORCED_TRADEOFF") segment = "forced_tradeoff";
    else if (step === 5 && phase === "ACTION_DECISION") segment = "action_decision";
    else if (step === 6 && phase === "DONE") segment = "run_complete";
    /** Legacy elite save: DONE at step 5 */
    else if (step === 5 && phase === "DONE") segment = "run_complete";
    else if (step === 3 && phase === "ESCALATION") segment = "legacy_escalation";
    return { canRenderScenarioProgressionUi: true, playUiSegment: segment };
  }, [
    current?.eliteSetup,
    arenaPlaySurfaceAllowed,
    step,
    phase,
    effectiveArenaSnapshot,
    selectedChoiceId,
    current?.escalationBranches,
  ]);

  const followUpOptionsEn = normalizeFollowUpOptions(choice);
  const followUpOptions =
    locale === "ko" && choice?.followUp?.optionsKo?.length
      ? choice.followUp.optionsKo
      : followUpOptionsEn;
  const hasFollowUp = Boolean(choice?.followUp?.enabled && followUpOptions.length);
  const followUpPrompt =
    locale === "ko" && choice?.followUp?.promptKo
      ? choice.followUp.promptKo
      : choice?.followUp?.prompt ?? "";

  // ── persist helper ──────────────────────────────────────────
  function persist(next: Partial<SavedArenaState>) {
    if (!current) return;
    saveState({
      version: 1,
      scenarioId: current.scenarioId,
      phase,
      step,
      reflectionIndex: reflectionIndex ?? undefined,
      reflectionText: reflectionText || undefined,
      reflectionBonusXp: reflectionBonusXp || undefined,
      selectedChoiceId: selectedChoiceId ?? undefined,
      secondChoiceId: selectedSecondChoiceId ?? undefined,
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
    if (pendingActionContractRef.current != null) return null;
    if (reexposureGateSnapshotRef.current != null) return null;
    if (runId) return runId;
    if (!current) return null;
    const result = await createRun(current.scenarioId, locale ?? undefined, {
      scenario: current,
      timeLimitSeconds: ARENA_TIME_LIMIT_SECONDS,
    });
    if (!result) return null;
    setRunId(result.run_id);
    runMetaRef.current =
      result.timeLimitSeconds != null && result.timeLimitSeconds > 0
        ? {
            runId: result.run_id,
            startedAt: result.started_at,
            timeLimitSeconds: result.timeLimitSeconds,
          }
        : null;
    persist({ runId: result.run_id });
    return result.run_id;
  }

  // ── reset helpers (shared by resetRun & continueNextScenario) ──
  function resetAllLocal() {
    setReflectionIndex(null);
    setReflectionText("");
    setReflectionBonusXp(0);
    setReflectResult(null);
    setSelectedChoiceId(null);
    setSelectedSecondChoiceId(null);
    setFollowUpIndex(null);
    setLastXp(0);
    setRunId(null);
    runMetaRef.current = null;
    setOtherOpen(false);
    setOtherText("");
    setOtherSubmitting(false);
    setOtherSubmitted(false);
    setFreeResponseFeedback(null);
    setRecallPrompt(null);
  }

  /** HARD STOP: server entry shell (re-exposure, forced reset, ACTION_*, NEXT ready w/o scenario) — no `applyCanonicalLobby`. */
  function applyReexposureHardStop(snapshot: ArenaSessionRouterSnapshot, ctx: "init" | "continue-next" | "reset-run") {
    reexposureGateSnapshotRef.current = snapshot;
    setPendingActionContract(null);
    setArenaServerSnapshot(snapshot);
    setBindingRuntimeSnapshot(null);
    setRecallPrompt(null);
    resetAllLocal();
    setScenario(null);
    setPhase("CHOOSING");
    setStep(2);
    setScenarioInitError(null);
    if (ctx === "continue-next") {
      setCompleteError(null);
    }
    console.info("[arena][reexposure-hard-stop]", { context: ctx });
  }

  // ── actions ─────────────────────────────────────────────────
  /** Confirms a primary choice by id (Elite one-tap or legacy Confirm after select). */
  async function confirmChoiceWithId(choiceIdRaw: string) {
    if (!choiceIdRaw || choiceIdRaw === OTHER_CHOICE_ID || !current) return;
    if (!arenaPlaySurfaceAllowed) return;
    const c = current.choices.find((x) => x.choiceId === choiceIdRaw);
    if (!c) return;

    setSelectedChoiceId(choiceIdRaw);
    setConfirmingChoice(true);
    try {
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
      if (!rid) {
        setConfirmingChoice(false);
        return;
      }

      const useBinding =
        Boolean(current.eliteSetup) &&
        typeof current.dbScenarioId === "string" &&
        current.dbScenarioId.trim() !== "" &&
        typeof c.dbChoiceId === "string" &&
        c.dbChoiceId.trim() !== "";

      if (current.eliteSetup && isEliteChainScenarioId(current.scenarioId) && !useBinding) {
        setToast(t.eliteBindingIntegrityError);
        setSelectedChoiceId(null);
        return;
      }

      if (useBinding) {
        try {
          const snap = await postArenaChoice({
            run_id: rid,
            json_scenario_id: current.scenarioId,
            db_scenario_id: current.dbScenarioId!,
            json_choice_id: c.choiceId,
            db_choice_id: c.dbChoiceId!,
          });
          setBindingRuntimeSnapshot(snap);
          if (!snap.gates.choice_allowed || isArenaActionBlockingRuntimeState(snap.runtime_state)) {
            return;
          }
        } catch (e) {
          console.warn("[arena] binding primary choice failed", e);
          setToast(t.eliteRunStepAdvanceError);
          setSelectedChoiceId(null);
          setBindingRuntimeSnapshot(null);
          return;
        }
      } else {
        await postArenaEvent({
          runId: rid,
          scenarioId: current.scenarioId,
          step: 2,
          eventType: "CHOICE_CONFIRMED",
          choiceId: c.choiceId,
          xp,
          deltas: c.hiddenDelta ?? null,
          meta: { intent: c.intent },
        });
      }

      setLastXp(xp);
      setSystemMessage(msg);
      /** Canonical JSON runtime must not call legacy `/api/arena/run/step`. */
      const useLegacyRunStepApi = current.eliteSetup && !isCanonicalJsonRuntimeScenario(current);
      /** Elite/legacy: POST step 3 immediately, then step 4 UI (no separate escalation screen). */
      if (current.eliteSetup) {
        try {
          if (useLegacyRunStepApi) {
            await arenaFetch("/api/arena/run/step", {
              json: {
                runId: rid,
                step: 3,
                primaryChoiceId: choiceIdRaw,
              },
            });
          }
          setBindingRuntimeSnapshot(null);
          setStep(4);
          setPhase("FORCED_TRADEOFF");
          persist({
            phase: "FORCED_TRADEOFF",
            step: 4,
            lastXp: xp,
            lastSystemMessage: msg.id,
          });
          console.info("[arena][elite-forced-tradeoff-enter]", {
            source: "primary-confirm",
            scenarioId: current.scenarioId,
            step: 4,
            phase: "FORCED_TRADEOFF",
            primaryChoiceId: choiceIdRaw,
          });
          const br =
            choiceIdRaw && current.escalationBranches
              ? current.escalationBranches[choiceIdRaw]
              : undefined;
          console.debug("[arena][elite-confirm]", {
            scenarioId: current.scenarioId,
            primaryChoiceId: choiceIdRaw,
            escalationBranchKey: choiceIdRaw,
            secondChoicesCount: br?.second_choices?.length ?? 0,
          });
        } catch (e) {
          console.warn("[arena] elite auto step 3 failed", e);
          setToast(t.eliteRunStepAdvanceError);
          setSelectedChoiceId(null);
          setBindingRuntimeSnapshot(null);
          return;
        }
      } else {
        const nextPhase: ArenaPhase =
          hasEscalationBranchForChoice(current, choiceIdRaw) ? "ESCALATION" : "SHOW_RESULT";
        setPhase(nextPhase);
        setStep(3);
        persist({
          phase: nextPhase,
          step: 3,
          lastXp: xp,
          lastSystemMessage: msg.id,
        });
        setToast(t.scenarioCompletedToast);
      }
    } finally {
      setConfirmingChoice(false);
    }
  }

  async function onConfirmChoice() {
    if (!selectedChoiceId || selectedChoiceId === OTHER_CHOICE_ID) return;
    await confirmChoiceWithId(selectedChoiceId);
  }

  /** Elite step 2: one tap — no separate Confirm control. */
  async function commitElitePrimaryChoice(choiceId: string) {
    await confirmChoiceWithId(choiceId);
  }

  async function submitOther() {
    if (!current) return;
    if (!arenaPlaySurfaceAllowed) return;
    setOtherError(null);
    setOtherSubmitting(true);
    try {
      const trimmed = otherText.trim();
      if (trimmed.length > 0) {
        const rid = await ensureRunId();
        if (!rid) { setOtherError(t.errorStartRun); setOtherSubmitting(false); return; }
        try {
          const res = await arenaFetch<{ ok?: boolean; xp?: number; feedback?: { praise: string; suggestion: string } }>(
            "/api/arena/free-response",
            { json: { runId: rid, scenarioId: current.scenarioId, responseText: trimmed, locale } },
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
              phase: "SHOW_RESULT", step: 3, lastXp: res.xp,
              lastSystemMessage: "other_recorded", selectedChoiceId: OTHER_CHOICE_ID,
              otherSubmitted: true, freeResponseFeedback: res.feedback,
            });
            setToast(t.scenarioCompletedToast);
            setOtherOpen(false);
            setOtherText("");
            setOtherSubmitting(false);
            return;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg === "UNAUTHENTICATED" || msg.includes("401")) { setOtherError(t.errorSignIn); }
          else if (msg === "FREE_RESPONSE_ALREADY_SUBMITTED" || msg === "RUN_NOT_FOUND") { setOtherError(t.errorAlreadySubmitted); }
          else { setOtherError(t.errorSubmitFailed); }
          setOtherSubmitting(false);
          return;
        }
      }

      const rid = await ensureRunId();
      await postArenaEvent({
        runId: rid, scenarioId: current.scenarioId, step: 2,
        eventType: "OTHER_SELECTED", xp: 0,
      });
      const otherMsg = SYSTEM_MESSAGES.find((m) => m.id === "other_recorded") ?? SYSTEM_MESSAGES[0];
      setLastXp(0);
      setSystemMessage(otherMsg);
      setFreeResponseFeedback(null);
      setPhase("SHOW_RESULT");
      setStep(3);
      setSelectedChoiceId(OTHER_CHOICE_ID);
      persist({
        phase: "SHOW_RESULT", step: 3, lastXp: 0,
        lastSystemMessage: "other_recorded", selectedChoiceId: OTHER_CHOICE_ID, otherSubmitted: true,
      });
      setToast(t.scenarioCompletedToast);
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

  async function acknowledgeEscalation() {
    if (!arenaPlaySurfaceAllowed) {
      setToast(t.errorStartRun);
      throw new Error("surface_blocked");
    }
    if (!current?.eliteSetup || !runId) {
      setToast(t.errorStartRun);
      throw new Error("run_missing");
    }
    setEscalationAckSubmitting(true);
    try {
      if (!isCanonicalJsonRuntimeScenario(current)) {
        await arenaFetch("/api/arena/run/step", {
          json: {
            runId,
            step: 3,
            ...(selectedChoiceId && selectedChoiceId !== OTHER_CHOICE_ID
              ? { primaryChoiceId: selectedChoiceId }
              : {}),
          },
        });
      }
      setStep(4);
      setPhase("FORCED_TRADEOFF");
      persist({ step: 4, phase: "FORCED_TRADEOFF" });
    } catch (e) {
      console.warn("[arena] escalation acknowledge failed", e);
      setToast(t.eliteRunStepAdvanceError);
      throw e;
    } finally {
      setEscalationAckSubmitting(false);
    }
  }

  async function submitSecondChoice(secondChoiceId: string) {
    if (!arenaPlaySurfaceAllowed) {
      setToast(t.errorStartRun);
      throw new Error("surface_blocked");
    }
    if (!current?.eliteSetup || !runId) {
      setToast(t.errorStartRun);
      throw new Error("run_missing");
    }
    const branch =
      selectedChoiceId && selectedChoiceId !== OTHER_CHOICE_ID && current.escalationBranches
        ? current.escalationBranches[selectedChoiceId]
        : undefined;
    const picked = branch?.second_choices.find((x) => x.id === secondChoiceId);
    const mappedSecondDbChoiceId =
      selectedChoiceId != null && selectedChoiceId !== OTHER_CHOICE_ID
        ? resolveTradeoffDbChoiceIdFromBase({
            scenarioId: current.scenarioId,
            primaryChoiceId: selectedChoiceId,
            secondChoiceId,
          })
        : null;
    const secondDbChoiceId =
      mappedSecondDbChoiceId ??
      (typeof picked?.dbChoiceId === "string" && picked.dbChoiceId.trim() !== ""
        ? picked.dbChoiceId.trim()
        : null);
    const useSecondBinding =
      typeof current.dbScenarioId === "string" &&
      current.dbScenarioId.trim() !== "" &&
      secondDbChoiceId != null &&
      secondDbChoiceId !== "";

    if (isEliteChainScenarioId(current.scenarioId) && picked && !useSecondBinding) {
      setToast(t.eliteBindingIntegrityError);
      throw new Error("binding_integrity");
    }

    setSecondChoiceSubmitting(true);
    try {
      if (useSecondBinding && secondDbChoiceId) {
        try {
          const snap = await postArenaChoice({
            run_id: runId,
            json_scenario_id: current.scenarioId,
            db_scenario_id: current.dbScenarioId!,
            primary_choice_id: selectedChoiceId ?? undefined,
            parent_choice_id: selectedChoiceId ?? undefined,
            json_choice_id: secondChoiceId,
            db_choice_id: secondDbChoiceId,
            binding_phase: "tradeoff",
          });
          setBindingRuntimeSnapshot(snap);
          if (!snap.gates.choice_allowed || isArenaActionBlockingRuntimeState(snap.runtime_state)) {
            return;
          }
          setBindingRuntimeSnapshot(null);
        } catch (e) {
          console.warn("[arena] binding second choice failed", e);
          setToast(t.eliteRunStepAdvanceError);
          throw e;
        }
      }

      if (!isCanonicalJsonRuntimeScenario(current)) {
        await arenaFetch("/api/arena/run/step", {
          json: { runId, step: 4, secondChoiceId },
        });
      }

      const pendingReexposureOutcomeId = reexposurePendingOutcomeIdRef.current;
      if (pendingReexposureOutcomeId && runId && current?.scenarioId) {
        reexposurePendingOutcomeIdRef.current = null;
        try {
          console.info("[arena][reexposure-validate][client] request", {
            pendingOutcomeId: pendingReexposureOutcomeId,
            runId,
            scenarioId: current.scenarioId,
          });
          const vr = await fetch("/api/arena/re-exposure/validate", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pendingOutcomeId: pendingReexposureOutcomeId,
              runId,
              scenarioId: current.scenarioId,
            }),
          });
          const j = (await vr.json().catch(() => ({}))) as {
            ok?: boolean;
            validation_result?: string;
            next_runtime_state?: unknown;
            re_exposure_clear_candidate?: unknown;
            intervention_sensitivity_up?: unknown;
          };
          console.info("[arena][reexposure-validate][client] response", {
            ok: vr.ok,
            status: vr.status,
            validation_result: j.validation_result,
          });
          if (vr.ok && typeof j.validation_result === "string" && j.validation_result !== "") {
            setLastReexposureValidation(j.validation_result);
            const nextRuntimeStateRaw =
              typeof j.next_runtime_state === "string" ? j.next_runtime_state : null;
            const nextRuntimeState: ArenaRuntimeStateId | null =
              nextRuntimeStateRaw === "NEXT_SCENARIO_READY" || nextRuntimeStateRaw === "REEXPOSURE_DUE"
                ? nextRuntimeStateRaw
                : null;
            const clearCandidate = j.re_exposure_clear_candidate === true;
            const sensitivityUp = j.intervention_sensitivity_up === true;
            setLastReexposureTransition({
              next_runtime_state: nextRuntimeState,
              re_exposure_clear_candidate: clearCandidate,
              intervention_sensitivity_up: sensitivityUp,
            });
            const assist = deriveReexposureValidateLocalAssist({
              arenaServerSnapshot,
              nextRuntimeState,
              currentScenarioId: current?.scenarioId ?? null,
              clearCandidate,
            });
            if (assist.localAssistSnapshot) {
              setBindingRuntimeSnapshot(assist.localAssistSnapshot);
            }
            const validationToast =
              j.validation_result === "changed"
                ? t.arenaReexposureValidationChanged
                : j.validation_result === "unstable"
                  ? t.arenaReexposureValidationUnstable
                  : j.validation_result === "no_change"
                    ? t.arenaReexposureValidationNoChange
                    : null;
            if (validationToast) {
              setToast(validationToast);
            }
          } else if (!vr.ok) {
            console.warn("[arena] re-exposure validate failed", j);
          }
        } catch (e) {
          console.warn("[arena] re-exposure validate error", e);
        }
      }

      const branchAfter =
        selectedChoiceId && selectedChoiceId !== OTHER_CHOICE_ID && current.escalationBranches
          ? current.escalationBranches[selectedChoiceId]
          : undefined;
      const hasActionDecision = Boolean(
        branchAfter?.action_decision?.choices && branchAfter.action_decision.choices.length > 0,
      );
      if (hasActionDecision) {
        setSelectedSecondChoiceId(secondChoiceId);
        setStep(5);
        setPhase("ACTION_DECISION");
        persist({ step: 5, phase: "ACTION_DECISION", secondChoiceId });
      } else {
        setSelectedSecondChoiceId(secondChoiceId);
        setStep(6);
        setPhase("DONE");
        persist({ step: 6, phase: "DONE", secondChoiceId });
      }
    } catch (e) {
      console.warn("[arena] second choice step failed", e);
      setToast(t.eliteRunStepAdvanceError);
      throw e;
    } finally {
      setSecondChoiceSubmitting(false);
    }
  }

  async function submitActionDecision(actionChoiceId: string) {
    if (!arenaPlaySurfaceAllowed) {
      setToast(t.errorStartRun);
      throw new Error("surface_blocked");
    }
    if (!current?.eliteSetup || !runId) {
      setToast(t.errorStartRun);
      throw new Error("run_missing");
    }
    const branch =
      selectedChoiceId && selectedChoiceId !== OTHER_CHOICE_ID && current.escalationBranches
        ? current.escalationBranches[selectedChoiceId]
        : undefined;
    const picked = branch?.action_decision?.choices.find((x) => x.id === actionChoiceId);
    const mappedActionDbChoiceId =
      selectedChoiceId != null &&
      selectedChoiceId !== OTHER_CHOICE_ID &&
      selectedSecondChoiceId != null &&
      selectedSecondChoiceId !== ""
        ? resolveActionDecisionDbChoiceIdFromBase({
            scenarioId: current.scenarioId,
            primaryChoiceId: selectedChoiceId,
            secondChoiceId: selectedSecondChoiceId,
            actionChoiceId,
          })
        : null;
    const actionDbChoiceId =
      mappedActionDbChoiceId ??
      (typeof picked?.dbChoiceId === "string" && picked.dbChoiceId.trim() !== ""
        ? picked.dbChoiceId.trim()
        : null);
    const useAdBinding =
      typeof current.dbScenarioId === "string" &&
      current.dbScenarioId.trim() !== "" &&
      actionDbChoiceId != null &&
      actionDbChoiceId !== "";

    if (isEliteChainScenarioId(current.scenarioId) && picked && !useAdBinding) {
      setToast(t.eliteBindingIntegrityError);
      throw new Error("binding_integrity");
    }

    setActionDecisionSubmitting(true);
    let signalFired = false;
    const fireArenaSignal = () => {
      if (signalFired) return;
      signalFired = true;
      try {
        const runtimeForSignal = getScenarioById(current.scenarioId, "en");
        const isExit =
          runtimeForSignal?.content.choices.find((c) => c.id === (selectedChoiceId ?? ""))
            ?.direction === "exit";
        const primaryChoice = selectedChoiceId ?? "";
        const reinforcementChoice = selectedSecondChoiceId ?? "X";
        const traits = {
          Insight: isExit ? 0.7 : 0.35,
          Communication: 0.5,
          Integrity: isExit ? 0.65 : 0.35,
        };
        const meta = {
          relationalBias: isExit ? 0.35 : 0.65,
          operationalBias: 0.5,
          emotionalRegulation: isExit ? 0.65 : 0.4,
        };
        // Save to localStorage immediately so the local fallback has data.
        const dedupeKey = `${current.scenarioId}:${primaryChoice}:${reinforcementChoice}`;
        pushSignalIfNew(
          { scenarioId: current.scenarioId, primary: primaryChoice, reinforcement: reinforcementChoice, traits, meta, timestamp: Date.now() },
          dedupeKey,
        );
        // Persist to DB (fire-and-forget — log HTTP errors for debugging).
        fetch("/api/bty/arena/signals", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenarioId: current.scenarioId, primaryChoice, reinforcementChoice, traits, meta }),
        })
          .then(async (res) => {
            if (!res.ok) {
              const body = await res.text().catch(() => "");
              console.warn("[arena] signal save API error", res.status, body);
            }
          })
          .catch((e) => console.warn("[arena] signal save failed", e));
      } catch (e) {
        console.warn("[arena] signal save setup failed", e);
      }
    };

    try {
      if (useAdBinding && actionDbChoiceId) {
        try {
          const snap = await postArenaChoice({
            run_id: runId,
            json_scenario_id: current.scenarioId,
            db_scenario_id: current.dbScenarioId!,
            primary_choice_id: selectedChoiceId ?? undefined,
            parent_choice_id: selectedChoiceId ?? undefined,
            second_choice_id: selectedSecondChoiceId ?? undefined,
            json_choice_id: actionChoiceId,
            db_choice_id: actionDbChoiceId,
            binding_phase: "action_decision",
          });
          setBindingRuntimeSnapshot(snap);
          // Signal fires here for both blocking (AD1/contract) and non-blocking (AD2) paths.
          fireArenaSignal();
          if (!snap.gates.choice_allowed || isArenaActionBlockingRuntimeState(snap.runtime_state)) {
            /** Keep local step; next render uses `arenaActionBlocking` + contract gate — not run-complete. */
            return;
          }
          setBindingRuntimeSnapshot(null);
        } catch (e) {
          if (e instanceof ArenaChoiceHttpError && e.snapshot) {
            setBindingRuntimeSnapshot(e.snapshot);
            fireArenaSignal();
            if (
              !e.snapshot.gates.choice_allowed ||
              isArenaActionBlockingRuntimeState(e.snapshot.runtime_state)
            ) {
              return;
            }
          }
          console.warn("[arena] binding action decision failed", e);
          setToast(t.eliteRunStepAdvanceError);
          throw e;
        }
      }

      // Non-binding path (or binding succeeded non-blocking): fire if not already fired.
      fireArenaSignal();

      setStep(6);
      setPhase("DONE");
      persist({ step: 6, phase: "DONE" });
    } catch (e) {
      console.warn("[arena] action decision failed", e);
      setToast(t.eliteRunStepAdvanceError);
      throw e;
    } finally {
      setActionDecisionSubmitting(false);
    }
  }

  async function submitReflection(idx: number, text?: string) {
    if (!current) return;
    if (!arenaPlaySurfaceAllowed) return;
    const trimmed = typeof text === "string" ? text.trim() : "";
    const meaningful = trimmed.length >= MIN_REFLECTION_LENGTH;
    const bonus = meaningful ? REFLECTION_BONUS_XP : 0;

    setReflectionSubmitting(true);
    setReflectDeepeningNotice(null);
    try {
      const rid = await ensureRunId();
      await postArenaEvent({
        runId: rid, scenarioId: current.scenarioId, step: 4,
        eventType: "REFLECTION_SELECTED", reflectionIndex: idx,
        reflectionText: trimmed || undefined, reflectionBonusXp: bonus,
      });

      setReflectionIndex(idx);
      setReflectionText(trimmed);
      setReflectionBonusXp(bonus);
      setReflectResult(null);

      if (trimmed.length >= MIN_REFLECTION_LENGTH) {
        try {
          const res = await arenaFetch<{
            ok?: boolean; summary?: string; questions?: string[];
            next_action?: string; detected?: { tags: string[]; topTag?: string };
          }>("/api/arena/reflect", {
            json: {
              userText: trimmed,
              locale: locale ?? undefined,
              scenario: {
                situation: [displayTitle, displayContext].filter(Boolean).join(" — ").slice(0, 280),
                userChoice: trimmed,
              },
            },
          });
          if (res?.summary != null) {
            setReflectResult({
              summary: res.summary,
              questions: Array.isArray(res.questions) ? res.questions : [],
              next_action: res.next_action ?? "",
              detected: res.detected,
            });
          } else {
            setReflectDeepeningNotice(t.reflectDeepeningUnavailable);
          }
        } catch (e) {
          console.warn("[arena] reflect API failed", e);
          setReflectDeepeningNotice(t.reflectDeepeningUnavailable);
        }
      }

      if (current?.eliteSetup) {
        setStep(6);
        setPhase("DONE");
        persist({
          step: 6,
          phase: "DONE",
          reflectionIndex: idx,
          reflectionText: trimmed || undefined,
          reflectionBonusXp: bonus,
        });
      } else if (hasFollowUp) {
        setStep(5);
        setPhase("FOLLOW_UP");
        persist({ step: 5, phase: "FOLLOW_UP", reflectionIndex: idx, reflectionText: trimmed || undefined, reflectionBonusXp: bonus });
      } else {
        setStep(6);
        persist({ step: 6, reflectionIndex: idx, reflectionText: trimmed || undefined, reflectionBonusXp: bonus });
      }
    } finally {
      setReflectionSubmitting(false);
    }
  }

  async function submitFollowUp(idx: number) {
    if (!choice || !current) return;
    setFollowUpSubmitting(true);
    try {
      const fu = evaluateFollowUp({
        scenarioId: current.scenarioId,
        choiceId: choice.choiceId,
        followUpIndex: idx,
      });
      const rid = await ensureRunId();
      await postArenaEvent({
        runId: rid, scenarioId: current.scenarioId, step: 5,
        eventType: "FOLLOW_UP_SELECTED", followUpIndex: idx, xp: fu.xp,
      });
      setFollowUpIndex(idx);
      setStep(6);
      persist({ step: 6, followUpIndex: idx });
    } finally {
      setFollowUpSubmitting(false);
    }
  }

  async function continueNextScenario() {
    if (!current) return;
    if (pendingActionContractRef.current != null || reexposureGateSnapshotRef.current != null) {
      setNextScenarioLoading(false);
      return;
    }
    setCompleteError(null);
    setNextScenarioLoading(true);
    const currentRunId = runId;
    let core: CoreXpGetResponse | null = null;
    try {
      if (currentRunId) {
        try {
          const meta = runMetaRef.current?.runId === currentRunId ? runMetaRef.current : null;
          const timeRemaining =
            meta != null
              ? Math.max(
                  0,
                  meta.timeLimitSeconds -
                    (Date.now() / 1000 - new Date(meta.startedAt).getTime() / 1000)
                )
              : undefined;
          const completeJson = await arenaFetch<Record<string, unknown>>("/api/arena/run/complete", {
            json: {
              runId: currentRunId,
              ...(typeof timeRemaining === "number" && { time_remaining: Math.round(timeRemaining) }),
            },
          });
          const fromComplete = parseArenaSessionRouterSnapshotFromJson(completeJson);
          if (fromComplete) setArenaServerSnapshot(fromComplete);
          clearState();
          setScenario(null);
          resetAllLocal();
          runMetaRef.current = null;
          core = await arenaFetch<CoreXpGetResponse>("/api/arena/core-xp").catch(() => null);
          if (core && typeof core.coreXpTotal === "number") {
            // Milestone uses lib (tier computed in lib); UI does not derive tier from coreXpTotal.
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
          setCompleteError(t.completeErrorPrefix + msg + t.completeErrorSuffix);
        }
      } else {
        clearState();
        resetAllLocal();
      }

      const nextPack = await fetchArenaSessionRouterPackWithRetry(
        locale === "ko" ? "ko" : "en",
        pipelineDefault,
      );
      if (nextPack.outcome === "blocked") {
        reexposureGateSnapshotRef.current = nextPack.snapshot;
        setPendingActionContract(nextPack.contract);
        setArenaServerSnapshot(nextPack.snapshot);
        setScenario(null);
        setRunId(null);
        resetAllLocal();
        setCompleteError(null);
        console.info("[arena][session-router-blocked]", { context: "continue-next" });
        return;
      }
      const reexposureContinue = reexposureSnapshotFromSessionPack(nextPack);
      if (reexposureContinue) {
        applyReexposureHardStop(reexposureContinue, "continue-next");
        return;
      }
      if (nextPack.outcome === "session_shell") {
        applyReexposureHardStop(nextPack.snapshot, "continue-next");
        return;
      }
      const next = nextPack.outcome === "scenario" ? nextPack.scenario : null;
      if (!next) {
        setArenaServerSnapshot(null);
        setCompleteError(t.completeErrorPrefix + "no_scenario_available" + t.completeErrorSuffix);
        return;
      }
      reexposureGateSnapshotRef.current = null;
      setPendingActionContract(null);
      setBindingRuntimeSnapshot(null);
      setArenaServerSnapshot(nextPack.outcome === "scenario" ? nextPack.snapshot : null);
      if (current.eliteSetup) {
        console.info("[arena][elite-continue-next]", {
          fromScenarioId: current.scenarioId,
          toScenarioId: next.scenarioId,
        });
      }
      setScenario(next);
      setPlayContext("next_scenario");
      setPhase("CHOOSING");
      setStep(2);
      resetAllLocal();
      setRecallPrompt(nextPack.outcome === "scenario" ? (nextPack.recallPrompt ?? null) : null);

      createRun(next.scenarioId, locale ?? undefined, {
        scenario: next,
        timeLimitSeconds: ARENA_TIME_LIMIT_SECONDS,
      })
        .then(async (result) => {
          if (result) {
            setRunId(result.run_id);
            runMetaRef.current =
              result.timeLimitSeconds != null && result.timeLimitSeconds > 0
                ? {
                    runId: result.run_id,
                    startedAt: result.started_at,
                    timeLimitSeconds: result.timeLimitSeconds,
                  }
                : null;
            try {
              await postArenaEvent({
                runId: result.run_id,
                scenarioId: next.scenarioId,
                step: 1,
                eventType: "SCENARIO_STARTED",
              });
            } catch (e) {
              console.warn("Arena SCENARIO_STARTED event failed (continue)", e);
            }
            saveState({
              version: 1,
              scenarioId: next.scenarioId,
              phase: "CHOOSING",
              step: 2,
              runId: result.run_id,
              updatedAtISO: safeNowISO(),
            });
          }
        })
        .catch((e) => console.warn("Arena run create (continue) failed", e));
    } finally {
      setNextScenarioLoading(false);
    }
  }

  function pause() {
    persist({});
    setSystemMessage({
      id: "arch_init",
      en: "Session preserved. You can resume anytime.",
      ko: "세션이 저장됐어요. 언제든 이어할 수 있어요.",
    });
  }

  function retryArenaSession(opts?: { force?: boolean }) {
    setScenarioLoading(true);
    setPendingActionContract(null);
    const force = opts?.force === true;
    const preserveGetReexposure =
      !force &&
      (reexposureGateSnapshotRef.current?.runtime_state === "REEXPOSURE_DUE" ||
        (arenaServerSnapshot != null &&
          arenaServerSnapshot.runtime_state === "REEXPOSURE_DUE" &&
          snapshotQualifiesAsReexposureGate(arenaServerSnapshot)));
    if (!preserveGetReexposure) {
      setArenaServerSnapshot(null);
    }
    if (force) {
      reexposureGateSnapshotRef.current = null;
    }
    setBindingRuntimeSnapshot(null);
    setSessionLoadNonce((n) => n + 1);
  }

  /** Clears stale re-exposure gate refs so GET session can return catalog / next-ready (no pending outcome id). */
  function recoverStaleReexposureShell() {
    reexposureGateSnapshotRef.current = null;
    retryArenaSession({ force: true });
  }

  async function startPendingContractQrFlow() {
    const contract = pendingActionContractRef.current;
    if (!contract) {
      setToast(t.eliteRunStepAdvanceError);
      return;
    }
    setPendingContractQrLoading(true);
    try {
      console.info("[BTY QR] startPendingContractQrFlow", {
        contractId: contract.id,
        runId: runId ?? null,
      });
      const res = await fetch("/api/arena/leadership-engine/qr/action-loop-token", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(runId ? { runId } : {}),
          contractId: contract.id,
          locale,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || typeof json.url !== "string" || json.url.trim() === "") {
        console.warn("[arena][pending-contract-qr] token request failed", {
          status: res.status,
          error: json.error ?? null,
          runId: runId ?? null,
          contractId: contract.id,
        });
        setToast(t.eliteRunStepAdvanceError);
        return;
      }
      window.location.assign(json.url);
    } catch (e) {
      console.warn("[arena][pending-contract-qr] token request failed", e);
      setToast(t.eliteRunStepAdvanceError);
    } finally {
      setPendingContractQrLoading(false);
    }
  }

  /**
   * Re-exposure: load canonical scenario via GET `/api/arena/re-exposure/[scenarioId]`, bootstrap a new run,
   * and keep `pending_outcome_id` until tradeoff (step 4) completes → POST `/api/arena/re-exposure/validate`.
   * Transitions snapshot to {@link arenaSessionRouterSnapshotScenarioReady} locally until next GET.
   */
  async function beginReexposurePlay(override?: { pendingOutcomeId?: string | null; scenarioId?: string | null }) {
    console.info("[BTY REEXPOSURE] enter", {
      snapshot: reexposureGateSnapshotRef.current?.runtime_state ?? arenaServerSnapshot?.runtime_state ?? null,
      pendingOutcomeId:
        reexposureGateSnapshotRef.current?.re_exposure?.pending_outcome_id ??
        arenaServerSnapshot?.re_exposure?.pending_outcome_id ??
        null,
      incidentId:
        reexposureGateSnapshotRef.current?.re_exposure?.incident_id ??
        arenaServerSnapshot?.re_exposure?.incident_id ??
        null,
      axisGroup:
        reexposureGateSnapshotRef.current?.re_exposure?.axis_group ??
        arenaServerSnapshot?.re_exposure?.axis_group ??
        null,
    });
    if (pendingActionContractRef.current != null) {
      setToast(t.eliteRunStepAdvanceError);
      return;
    }
    const shellRef = reexposureGateSnapshotRef.current;
    if (
      shellRef != null &&
      shellRef.runtime_state !== "REEXPOSURE_DUE" &&
      isArenaExclusiveGateRuntimeState(shellRef.runtime_state)
    ) {
      setToast(t.eliteRunStepAdvanceError);
      return;
    }
    /** Ref wins over React state — snapshot may be replaced by local `ARENA_SCENARIO_READY` before tap. */
    const gateSnap =
      reexposureGateSnapshotRef.current?.runtime_state === "REEXPOSURE_DUE"
        ? reexposureGateSnapshotRef.current
        : reexposureGateSnapshotRef.current?.runtime_state === "NEXT_SCENARIO_READY" &&
            reexposureGateSnapshotRef.current?.re_exposure?.due === true
          ? reexposureGateSnapshotRef.current
        : arenaServerSnapshot?.runtime_state === "REEXPOSURE_DUE"
          ? arenaServerSnapshot
          : arenaServerSnapshot?.runtime_state === "NEXT_SCENARIO_READY" && arenaServerSnapshot?.re_exposure?.due === true
            ? arenaServerSnapshot
          : null;
    const sid = gateSnap?.re_exposure?.scenario_id;
    const pendingId = gateSnap?.re_exposure?.pending_outcome_id;
    const incidentId = gateSnap?.re_exposure?.incident_id;
    const axisGroup = gateSnap?.re_exposure?.axis_group;
    const axisIndex = gateSnap?.re_exposure?.axis_index;
    const patternFamily = gateSnap?.re_exposure?.pattern_family;
    const sidResolved =
      typeof sid === "string" && sid.trim() !== ""
        ? sid.trim()
        : typeof override?.scenarioId === "string" && override.scenarioId.trim() !== ""
          ? override.scenarioId.trim()
          : null;
    const pendingResolved =
      typeof pendingId === "string" && pendingId.trim() !== ""
        ? pendingId.trim()
        : typeof override?.pendingOutcomeId === "string" && override.pendingOutcomeId.trim() !== ""
          ? override.pendingOutcomeId.trim()
          : null;
    if (!sidResolved) {
      setToast(t.arenaSnapshotReexposurePlaceholder);
      return;
    }
    if (!pendingResolved) {
      setToast(t.arenaSnapshotReexposurePlaceholder);
      return;
    }
    if (
      !incidentId ||
      typeof incidentId !== "string" ||
      incidentId.trim() === "" ||
      !axisGroup ||
      typeof axisGroup !== "string" ||
      axisGroup.trim() === "" ||
      typeof axisIndex !== "number" ||
      !patternFamily ||
      typeof patternFamily !== "string" ||
      patternFamily.trim() === ""
    ) {
      console.warn("[BTY REEXPOSURE] context-partial", {
        incident_id: typeof incidentId === "string" ? incidentId.trim() : null,
        axis_group: typeof axisGroup === "string" ? axisGroup.trim() : null,
        axis_index: typeof axisIndex === "number" ? axisIndex : null,
        pattern_family: typeof patternFamily === "string" ? patternFamily.trim() : null,
      });
    }
    console.info("[arena][beginReexposurePlay]", {
      scenario_id: sidResolved,
      pending_outcome_id: pendingResolved,
      incident_id: typeof incidentId === "string" ? incidentId.trim() : null,
      axis_group: typeof axisGroup === "string" ? axisGroup.trim() : null,
      axis_index: typeof axisIndex === "number" ? axisIndex : null,
      pattern_family: typeof patternFamily === "string" ? patternFamily.trim() : null,
    });
    setReexposureEnterLoading(true);
    try {
      const res = await fetch(`/api/arena/re-exposure/${encodeURIComponent(sidResolved)}?locale=${locale}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; scenario?: Scenario; error?: string };
      if (!res.ok || json.ok !== true || !json.scenario) {
        if (json.error === "no_pending_reexposure_for_scenario") {
          setToast(t.arenaSnapshotReexposurePlaceholder);
          return;
        }
        setToast(t.eliteRunStepAdvanceError);
        return;
      }
      const next = json.scenario;
      clearState();
      resetAllLocal();
      setRecallPrompt(null);
      setBindingRuntimeSnapshot(null);
      setScenario(next);
      setPlayContext("re_exposure");
      setPhase("CHOOSING");
      setStep(2);
      setArenaServerSnapshot(arenaSessionRouterSnapshotScenarioReady());
      setScenarioInitError(null);
      const streakInfo = updateStreak();
      if (streakInfo.message) setSystemMessage(streakInfo.message);
      const result = await createRun(next.scenarioId, locale ?? undefined, {
        scenario: next,
        timeLimitSeconds: ARENA_TIME_LIMIT_SECONDS,
      });
      if (result) {
        setRunId(result.run_id);
        runMetaRef.current =
          result.timeLimitSeconds != null && result.timeLimitSeconds > 0
            ? {
                runId: result.run_id,
                startedAt: result.started_at,
                timeLimitSeconds: result.timeLimitSeconds,
              }
            : null;
        try {
          await postArenaEvent({
            runId: result.run_id,
            scenarioId: next.scenarioId,
            step: 1,
            eventType: "SCENARIO_STARTED",
          });
        } catch (e) {
          console.warn("Arena SCENARIO_STARTED event failed (re-exposure)", e);
        }
        saveState({
          version: 1,
          scenarioId: next.scenarioId,
          phase: "CHOOSING",
          step: 2,
          runId: result.run_id,
          updatedAtISO: safeNowISO(),
        });
        reexposurePendingOutcomeIdRef.current = pendingResolved;
        reexposureGateSnapshotRef.current = null;
      }
    } finally {
      setReexposureEnterLoading(false);
    }
  }

  async function resetRun() {
    reexposurePendingOutcomeIdRef.current = null;
    setLastReexposureValidation(null);
    setLastReexposureTransition(null);
    setResetRunLoading(true);
    clearState();
    try {
      const nextPack = await fetchArenaSessionRouterPackWithRetry(
        locale === "ko" ? "ko" : "en",
        pipelineDefault,
      );
      if (nextPack.outcome === "blocked") {
        reexposureGateSnapshotRef.current = nextPack.snapshot;
        setPendingActionContract(nextPack.contract);
        setArenaServerSnapshot(nextPack.snapshot);
        console.info("[arena][session-router-blocked]", { context: "reset-run" });
        return;
      }
      const reexposureReset = reexposureSnapshotFromSessionPack(nextPack);
      if (reexposureReset) {
        applyReexposureHardStop(reexposureReset, "reset-run");
        return;
      }
      if (nextPack.outcome === "session_shell") {
        applyReexposureHardStop(nextPack.snapshot, "reset-run");
        return;
      }
      const next = nextPack.outcome === "scenario" ? nextPack.scenario : null;
      if (!next) {
        setPendingActionContract(null);
        setArenaServerSnapshot(null);
        setScenario(null);
        setRecallPrompt(null);
        setScenarioInitError(t.scenarioNotFound);
        return;
      }
      reexposureGateSnapshotRef.current = null;
      setPendingActionContract(null);
      setArenaServerSnapshot(nextPack.outcome === "scenario" ? nextPack.snapshot : null);
      setScenario(next);
      setPlayContext("normal");
      setPhase("CHOOSING");
      setStep(2);
      resetAllLocal();
      setRecallPrompt(nextPack.outcome === "scenario" ? (nextPack.recallPrompt ?? null) : null);
      setSystemMessage(SYSTEM_MESSAGES.find((m) => m.id === "arch_init") ?? null);

      const result = await createRun(next.scenarioId, locale ?? undefined, {
        scenario: next,
        timeLimitSeconds: ARENA_TIME_LIMIT_SECONDS,
      }).catch((e) => {
        console.warn("Arena run create (reset) failed", e);
        return null;
      });
      if (result) {
        setRunId(result.run_id);
        runMetaRef.current =
          result.timeLimitSeconds != null && result.timeLimitSeconds > 0
            ? {
                runId: result.run_id,
                startedAt: result.started_at,
                timeLimitSeconds: result.timeLimitSeconds,
              }
            : null;
        try {
          await postArenaEvent({
            runId: result.run_id,
            scenarioId: next.scenarioId,
            step: 1,
            eventType: "SCENARIO_STARTED",
          });
        } catch (e) {
          console.warn("Arena SCENARIO_STARTED event failed (reset)", e);
        }
        saveState({
          version: 1,
          scenarioId: next.scenarioId,
          phase: "CHOOSING",
          step: 2,
          runId: result.run_id,
          updatedAtISO: safeNowISO(),
        });
      }
    } finally {
      setResetRunLoading(false);
    }
  }

  function selectChoice(id: string) {
    setSelectedChoiceId(id);
    setOtherOpen(false);
    setOtherText("");
  }

  function selectOther() {
    setSelectedChoiceId(OTHER_CHOICE_ID);
    setOtherOpen(true);
  }

  function closeOtherModal() {
    setOtherOpen(false);
    setOtherText("");
    setOtherError(null);
  }

  function closeMilestoneModal() {
    setMilestoneModal(null);
  }

  async function onRenameSubName(name: string) {
    await arenaFetch("/api/arena/sub-name", { json: { subName: name } });
  }

  React.useEffect(() => {
    if (!arenaPlaySurfaceAllowed) return;
    if (!scenario?.eliteSetup || step !== 3 || phase !== "ESCALATION" || !runId) return;
    if (isCanonicalJsonRuntimeScenario(scenario)) return;
    if (!selectedChoiceId || selectedChoiceId === OTHER_CHOICE_ID) return;
    const key = `${runId}:${selectedChoiceId}:resume-step3`;
    if (eliteResumeEscalationRef.current === key) return;
    eliteResumeEscalationRef.current = key;
    let cancelled = false;
    setEscalationAckSubmitting(true);
    arenaFetch("/api/arena/run/step", {
      json: { runId, step: 3, primaryChoiceId: selectedChoiceId },
    })
      .then(() => {
        if (cancelled) return;
        setStep(4);
        setPhase("FORCED_TRADEOFF");
        persist({ step: 4, phase: "FORCED_TRADEOFF" });
        console.info("[arena][elite-forced-tradeoff-enter]", {
          source: "resume-auto-step3",
          scenarioId: scenario?.scenarioId,
          step: 4,
          phase: "FORCED_TRADEOFF",
          primaryChoiceId: selectedChoiceId,
        });
      })
      .catch(() => {
        eliteResumeEscalationRef.current = null;
      })
      .finally(() => {
        if (!cancelled) setEscalationAckSubmitting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [arenaPlaySurfaceAllowed, scenario?.eliteSetup, scenario?.scenarioId, step, phase, runId, selectedChoiceId]);

  /** Subtle banner copy — GET session `runtime_state` + human gate reason (render-only). */
  const arenaRuntimeBanner = React.useMemo(() => {
    const rs = effectiveArenaSnapshot?.runtime_state;
    if (rs == null) return null;
    let gateLabel = t.arenaGateLabelAligning;
    if (isArenaActionBlockingRuntimeState(rs)) gateLabel = t.arenaGateLabelContract;
    else if (rs === "REEXPOSURE_DUE") gateLabel = t.arenaGateLabelReexposure;
    else if (rs === "FORCED_RESET_PENDING") gateLabel = t.arenaGateLabelReset;
    else if (rs === "NEXT_SCENARIO_READY") gateLabel = t.arenaGateLabelNext;
    else if (rs === "ARENA_SCENARIO_READY" || rs === "TRADEOFF_ACTIVE" || rs === "ACTION_DECISION_ACTIVE") {
      gateLabel = t.arenaGateLabelPlay;
    }
    return { runtimeState: rs, gateLabel };
  }, [effectiveArenaSnapshot?.runtime_state, t]);

  return {
    locale, t,
    levelChecked, coreXpTotal, tier, requiresBeginnerPath, arenaIdentity,
    scenario, scenarioLoading, scenarioInitError, displayTitle, contextForUser,
    recallPrompt,
    phase, step,
    selectedChoiceId, choice,
    selectChoice, selectOther,
    lastXp, systemMessage,
    followUpIndex, followUpOptions, hasFollowUp, followUpPrompt, followUpSubmitting,
    reflectionBonusXp, reflectResult, reflectDeepeningNotice, reflectionSubmitting,
    otherOpen, otherText, setOtherText,
    otherSubmitting, otherSubmitted, otherError,
    freeResponseFeedback, closeOtherModal,
    nextScenarioLoading, confirmingChoice, resetRunLoading,
    completeError, toast,
    milestoneModal, closeMilestoneModal,
    runId,
    onConfirmChoice, commitElitePrimaryChoice, submitOther, goToReflection,
    acknowledgeEscalation, submitSecondChoice, submitActionDecision,
    escalationAckSubmitting, secondChoiceSubmitting, actionDecisionSubmitting,
    submitReflection, submitFollowUp,
    continueNextScenario, pause, resetRun,
    onRenameSubName,
    pendingActionContract,
    arenaServerSnapshot,
    bindingRuntimeSnapshot,
    effectiveArenaSnapshot,
    arenaActionBlocking,
    arenaPlaySurfaceAllowed,
    primaryChoiceInteractive,
    canRenderScenarioProgressionUi,
    playUiSegment,
    retryArenaSession,
    recoverStaleReexposureShell,
    startPendingContractQrFlow,
    pendingContractQrLoading,
    beginReexposurePlay,
    reexposureEnterLoading,
    lastReexposureValidation,
    lastReexposureTransition,
    arenaRuntimeBanner,
    playContext,
  };
}
