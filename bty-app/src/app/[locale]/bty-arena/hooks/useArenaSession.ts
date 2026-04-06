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
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { difficultyFromScenarioChoices } from "@/lib/bty/arena/arenaLabXp";
import { BTY_ARENA_STATE_STORAGE_KEY } from "@/lib/bty/arena/arenaLocalState";
import type { ArenaRecallPrompt } from "@/lib/bty/arena/memoryRecallPrompt.types";
import {
  getArenaSessionRouterPath,
  type ArenaPipelineDefault,
} from "@/lib/bty/arena/arenaPipelineConfig";
import { isBtyE2eStep6TraceEnabled } from "@/lib/bty/arena/e2eStep6BrowserTrace";

// ── exported types ──────────────────────────────────────────────
export type ArenaPhase =
  | "CHOOSING"
  | "ESCALATION"
  | "FORCED_TRADEOFF"
  | "SHOW_RESULT"
  | "FOLLOW_UP"
  | "DONE";
/**
 * Client step index for the BTY Arena UI. Elite debrief: 3 = escalation or legacy stance, 4 = forced
 * trade-off or reflection text, 5–7 = mirror / contract / gate. `POST /api/arena/run/step` uses the same
 * step numbers (3 = escalation acknowledged, 4 = second choice) and persists `arena_runs.meta`.
 * Phases `ESCALATION` / `FORCED_TRADEOFF` align with steps 3–4 when `scenario.escalationBranches` is present.
 */
export type ArenaStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

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

// ── internal types ──────────────────────────────────────────────
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
  step?: ArenaStep;
  reflectionIndex?: number;
  reflectionText?: string;
  reflectionBonusXp?: number;
  otherSubmitted?: boolean;
  freeResponseFeedback?: { praise: string; suggestion: string } | null;
};

// ── constants ───────────────────────────────────────────────────
const STORAGE_KEY = BTY_ARENA_STATE_STORAGE_KEY;
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

type SessionNextResponse = {
  ok: boolean;
  scenario?: Scenario;
  scenarioRoute?: string;
  delayedOutcomePending?: boolean;
  mirrors?: unknown;
  recallPrompt?: ArenaRecallPrompt;
  error?: string;
  code?: string;
};

type SessionNextFetchResult = { scenario: Scenario | null; recallPrompt: ArenaRecallPrompt | null };

/** Next scenario from server session router (DB history, mirror / perspective rotation, catalog). */
async function fetchSessionNextScenario(
  locale: Locale,
  pipelineDefault: ArenaPipelineDefault,
): Promise<SessionNextFetchResult> {
  const loc = locale === "ko" ? "ko" : "en";
  const path = `${getArenaSessionRouterPath(pipelineDefault)}?locale=${loc}`;
  try {
    const data = await arenaFetch<SessionNextResponse>(path, {
      cache: "no-store",
    });
    if (data.ok && data.scenario) {
      return { scenario: data.scenario, recallPrompt: data.recallPrompt ?? null };
    }
    return { scenario: null, recallPrompt: null };
  } catch (e) {
    console.warn("[arena] session router fetch failed", e);
    return { scenario: null, recallPrompt: null };
  }
}

/**
 * True when `arena_runs` still has this run for the user and it matches the expected scenario
 * (stale localStorage after DB deletes / rotation).
 */
async function validateRunForResume(runId: string | null | undefined, expectedScenarioId: string): Promise<boolean> {
  if (runId == null || String(runId).trim() === "") return false;
  try {
    const data = await arenaFetch<{ run?: { scenario_id?: string } }>(
      `/api/arena/run/${encodeURIComponent(String(runId))}`,
    );
    const sid = data.run?.scenario_id;
    return typeof sid === "string" && sid === expectedScenarioId;
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
    case "SHOW_RESULT": return 3;
    case "FOLLOW_UP": return 5;
    case "DONE": return 7;
    default: return 2;
  }
}

function hasEscalationBranchForChoice(scenario: Scenario | null | undefined, choiceId: string | null): boolean {
  if (!scenario?.escalationBranches || choiceId == null || choiceId === "") return false;
  const b = scenario.escalationBranches[choiceId];
  return Boolean(b?.escalation_text && Array.isArray(b.second_choices) && b.second_choices.length > 0);
}

/** Elite debrief reuses steps 3–7 but never `FOLLOW_UP` phase; normalize stale saves from pre-fix runs. */
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
    const data = await arenaFetch<{
      run?: { run_id: string; started_at?: string };
    }>("/api/arena/run", {
      json: {
        scenarioId,
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
export function useArenaSession(pipelineDefault: ArenaPipelineDefault = "legacy") {
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

  const [reflectResult, setReflectResult] = React.useState<ReflectResult | null>(null);
  const [reflectDeepeningNotice, setReflectDeepeningNotice] = React.useState<string | null>(null);
  const [reflectionSubmitting, setReflectionSubmitting] = React.useState(false);
  const [milestoneModal, setMilestoneModal] = React.useState<MilestoneModalState | null>(null);
  const [resetRunLoading, setResetRunLoading] = React.useState(false);
  const [recallPrompt, setRecallPrompt] = React.useState<ArenaRecallPrompt | null>(null);
  /** Step 6: user continued past action contract because `gated: "pattern_threshold"` (no draft yet). Step 7 may proceed without verification. */
  const [patternContractDeferred, setPatternContractDeferred] = React.useState(false);

  const runMetaRef = React.useRef<{
    runId: string;
    startedAt: string;
    timeLimitSeconds: number;
  } | null>(null);

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

      try {
        const serverPack = await fetchSessionNextScenario(locale, pipelineDefault);
        if (cancelled) return;

        const streakInfo = updateStreak();
        const saved = loadState();

        const serverNext = serverPack.scenario;

        if (!serverNext) {
          clearState();
          resetAllLocal();
          setScenario(null);
          setPhase("CHOOSING");
          setStep(2);
          setScenarioInitError(t.scenarioNotFound);
          return;
        }

        setRecallPrompt(serverPack.recallPrompt ?? null);

        /** Canonical lobby: fresh scenario from session router + new `arena_runs` row. */
        const applyCanonicalLobby = async (next: Scenario) => {
          clearState();
          resetAllLocal();
          setRecallPrompt(serverPack.recallPrompt ?? null);
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
          setScenario(serverNext);
          setPhase(resumePhase);
          setStep(resumeStep as ArenaStep);
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
        setScenario(serverNext);
        setPhase(resumePhase);
        setStep(resumeStep as ArenaStep);
        setReflectionIndex(typeof saved.reflectionIndex === "number" ? saved.reflectionIndex : null);
        setReflectionText(typeof saved.reflectionText === "string" ? saved.reflectionText : "");
        setReflectionBonusXp(typeof saved.reflectionBonusXp === "number" ? saved.reflectionBonusXp : 0);
        setSelectedChoiceId(noSelection && saved.otherSubmitted ? OTHER_CHOICE_ID : (saved.selectedChoiceId ?? null));
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
          saveState({
            version: 1,
            scenarioId: saved.scenarioId,
            phase: resumePhase,
            step: resumeStep as ArenaStep,
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
  }, [levelChecked, requiresBeginnerPath, locale, pipelineDefault, t.scenarioNotFound]);

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
    setPatternContractDeferred(false);
  }

  // ── actions ─────────────────────────────────────────────────
  async function onConfirmChoice() {
    if (!selectedChoiceId || selectedChoiceId === OTHER_CHOICE_ID || !current) return;
    const c = current.choices.find((x) => x.choiceId === selectedChoiceId);
    if (!c) return;

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
      await postArenaEvent({
        runId: rid, scenarioId: current.scenarioId, step: 2,
        eventType: "CHOICE_CONFIRMED", choiceId: c.choiceId, xp,
        deltas: c.hiddenDelta ?? null, meta: { intent: c.intent },
      });

      setLastXp(xp);
      setSystemMessage(msg);
      /** Elite (v2): always enter step 3 under ESCALATION — UI resolves `escalationBranches[primaryChoiceId]` only; no legacy stance path. */
      const nextPhase: ArenaPhase =
        current.eliteSetup ? "ESCALATION" : hasEscalationBranchForChoice(current, selectedChoiceId) ? "ESCALATION" : "SHOW_RESULT";
      setPhase(nextPhase);
      setStep(3);
      persist({
        phase: nextPhase,
        step: 3,
        lastXp: xp,
        lastSystemMessage: msg.id,
      });
      if (current.eliteSetup) {
        const br =
          selectedChoiceId && current.escalationBranches
            ? current.escalationBranches[selectedChoiceId]
            : undefined;
        console.debug("[arena][elite-confirm]", {
          scenarioId: current.scenarioId,
          primaryChoiceId: selectedChoiceId,
          escalationBranchKey: selectedChoiceId,
          secondChoicesCount: br?.second_choices?.length ?? 0,
        });
      }
      setToast(t.scenarioCompletedToast);
    } finally {
      setConfirmingChoice(false);
    }
  }

  async function submitOther() {
    if (!current) return;
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
    if (!current?.eliteSetup || !runId) {
      setToast(t.errorStartRun);
      throw new Error("run_missing");
    }
    setEscalationAckSubmitting(true);
    try {
      await arenaFetch("/api/arena/run/step", { json: { runId, step: 3 } });
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
    if (!current?.eliteSetup || !runId) {
      setToast(t.errorStartRun);
      throw new Error("run_missing");
    }
    setSecondChoiceSubmitting(true);
    try {
      await arenaFetch("/api/arena/run/step", {
        json: { runId, step: 4, secondChoiceId },
      });
      setStep(5);
      setPhase("SHOW_RESULT");
      persist({ step: 5, phase: "SHOW_RESULT" });
    } catch (e) {
      console.warn("[arena] second choice step failed", e);
      setToast(t.eliteRunStepAdvanceError);
      throw e;
    } finally {
      setSecondChoiceSubmitting(false);
    }
  }

  async function submitReflection(idx: number, text?: string) {
    if (!current) return;
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
        setStep(5);
        setPhase("SHOW_RESULT");
        persist({
          step: 5,
          phase: "SHOW_RESULT",
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
    setCompleteError(null);
    setNextScenarioLoading(true);
    clearState();
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
          await arenaFetch("/api/arena/run/complete", {
            json: {
              runId: currentRunId,
              ...(typeof timeRemaining === "number" && { time_remaining: Math.round(timeRemaining) }),
            },
          });
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
      }

      const nextPack = await fetchSessionNextScenario(locale, pipelineDefault);
      const next = nextPack.scenario;
      if (!next) {
        setCompleteError(t.completeErrorPrefix + "no_scenario_available" + t.completeErrorSuffix);
        return;
      }
      setScenario(next);
      setPhase("CHOOSING");
      setStep(2);
      resetAllLocal();
      setRecallPrompt(nextPack.recallPrompt);

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

  async function resetRun() {
    setResetRunLoading(true);
    clearState();
    try {
      const nextPack = await fetchSessionNextScenario(locale, pipelineDefault);
      const next = nextPack.scenario;
      if (!next) {
        setScenario(null);
        setRecallPrompt(null);
        setScenarioInitError(t.scenarioNotFound);
        return;
      }
      setScenario(next);
      setPhase("CHOOSING");
      setStep(2);
      resetAllLocal();
      setRecallPrompt(nextPack.recallPrompt);
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

  function handleComplete() {
    if (isBtyE2eStep6TraceEnabled()) {
      console.log("[BTY_E2E_STEP6] handleComplete: setStep(7) + setPhase(DONE)", {
        runId,
        phaseBefore: phase,
        stepBefore: step,
      });
    } else if (
      typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_DEBUG_ELITE_STEP7_TRANSITION === "1"
    ) {
      console.log("[useArenaSession] handleComplete", { runId, phaseBefore: phase, stepBefore: step });
    }
    setStep(7);
    setPhase("DONE");
    persist({ step: 7, phase: "DONE" });
  }

  /** Stable identity for `EliteActionContractStep` — avoids `onSubmit` useCallback churn from parent re-renders. */
  const contractSubmitAdvanceToGateRef = React.useRef<() => void>(() => {});
  React.useEffect(() => {
    contractSubmitAdvanceToGateRef.current = () => {
      setPatternContractDeferred(false);
      handleComplete();
    };
  });

  const contractSubmitAdvanceToGate = React.useCallback(() => {
    if (isBtyE2eStep6TraceEnabled()) {
      console.log("[BTY_E2E_STEP6] contractSubmitAdvanceToGate() invoked");
    } else if (
      typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_DEBUG_ELITE_STEP7_TRANSITION === "1"
    ) {
      console.log("[useArenaSession] contractSubmitAdvanceToGate()");
    }
    contractSubmitAdvanceToGateRef.current();
  }, []);

  React.useEffect(() => {
    if (step !== 7) return;
    if (isBtyE2eStep6TraceEnabled()) {
      console.log("[BTY_E2E_STEP6] parent committed step===7", { runId, phase });
      return;
    }
    if (
      typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_DEBUG_ELITE_STEP7_TRANSITION === "1"
    ) {
      console.log("[useArenaSession] render with step===7", { runId, phase });
    }
  }, [step, runId, phase]);

  function handleSkipFollowUp() {
    setStep(6);
    persist({ step: 6 });
  }

  /** UX_FLOW_LOCK Step 5 → 6 after mirror Continue + acknowledgment_timestamp */
  function mirrorContinueToContract() {
    setPatternContractDeferred(false);
    setStep(6);
    persist({ step: 6, phase: "SHOW_RESULT" });
  }

  /** Step 6: POST /api/action-contracts returned `gated: "pattern_threshold"` — continue to gate without a draft contract */
  function patternThresholdSkippedToGate() {
    setPatternContractDeferred(true);
    handleComplete();
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
    onConfirmChoice, submitOther, goToReflection,
    acknowledgeEscalation, submitSecondChoice,
    escalationAckSubmitting, secondChoiceSubmitting,
    submitReflection, submitFollowUp,
    continueNextScenario, pause, resetRun,
    handleComplete, handleSkipFollowUp,
    mirrorContinueToContract,
    contractSubmitAdvanceToGate,
    patternThresholdSkippedToGate,
    patternContractDeferred,
    onRenameSubName,
  };
}
