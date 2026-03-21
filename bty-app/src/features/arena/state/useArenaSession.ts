"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ArenaScenario, ResolveOutcome } from "@/domain/arena/scenarios";
import { getArenaOutcomeKey, getScenarioById, patientComplaintScenario } from "@/domain/arena/scenarios";
import type { ArenaMissionSession } from "./arena-session.types";

export const ARENA_MISSION_SESSION_KEY = "bty-arena-session-v1";

export type { ArenaMissionPhase, ArenaMissionSession } from "./arena-session.types";

function isMissionPhase(v: unknown): v is ArenaMissionSession["phase"] {
  return v === "lobby" || v === "play" || v === "result";
}

export function parseArenaMissionSession(raw: string): ArenaMissionSession | null {
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    const r = o as Record<string, unknown>;
    if (typeof r.scenarioId !== "string" || !r.scenarioId) return null;
    if (!isMissionPhase(r.phase)) return null;
    const sp = r.selectedPrimary;
    const sr = r.selectedReinforcement;
    if (sp != null && typeof sp !== "string") return null;
    if (sr != null && typeof sr !== "string") return null;
    const updatedAt = typeof r.updatedAt === "number" ? r.updatedAt : Date.now();
    return {
      scenarioId: r.scenarioId,
      selectedPrimary: sp === null || sp === undefined ? null : sp,
      selectedReinforcement: sr === null || sr === undefined ? null : sr,
      phase: r.phase,
      updatedAt,
    };
  } catch {
    return null;
  }
}

export function createDefaultMissionSession(): ArenaMissionSession {
  return {
    scenarioId: patientComplaintScenario.id,
    selectedPrimary: null,
    selectedReinforcement: null,
    phase: "lobby",
    updatedAt: Date.now(),
  };
}

function persistToStorage(s: ArenaMissionSession) {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(ARENA_MISSION_SESSION_KEY, JSON.stringify(s));
    }
  } catch {
    // ignore
  }
}

export function useArenaSession() {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale === "ko" ? "ko" : "en";
  const base = `/${locale}`;

  const [session, setSession] = useState<ArenaMissionSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const applySession = useCallback((next: ArenaMissionSession) => {
    setSession(next);
    persistToStorage(next);
  }, []);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(ARENA_MISSION_SESSION_KEY) : null;
      if (raw) {
        const parsed = parseArenaMissionSession(raw);
        if (parsed) setSession(parsed);
        else window.sessionStorage.removeItem(ARENA_MISSION_SESSION_KEY);
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const scenario: ArenaScenario = useMemo(() => {
    const id = session?.scenarioId ?? patientComplaintScenario.id;
    const contentLocale = locale === "ko" ? "ko" : "en";
    const fallback = getScenarioById(patientComplaintScenario.id, contentLocale)!;
    return getScenarioById(id, contentLocale) ?? fallback;
  }, [session?.scenarioId, locale]);

  const outcomeKey = useMemo(() => {
    if (!session?.selectedPrimary || !session?.selectedReinforcement) return null;
    return getArenaOutcomeKey(session.selectedPrimary, session.selectedReinforcement);
  }, [session?.selectedPrimary, session?.selectedReinforcement]);

  const outcome: ResolveOutcome | null = useMemo(() => {
    if (!outcomeKey) return null;
    return scenario.outcomes[outcomeKey] ?? null;
  }, [outcomeKey, scenario]);

  const canRevealReinforcement = session?.selectedPrimary != null;
  const canResolve =
    session != null && session.selectedPrimary != null && session.selectedReinforcement != null;

  const enterArena = useCallback(() => {
    const next: ArenaMissionSession = {
      ...createDefaultMissionSession(),
      phase: "play",
      selectedPrimary: null,
      selectedReinforcement: null,
      updatedAt: Date.now(),
    };
    applySession(next);
  }, [applySession]);

  const resumeScenario = useCallback(() => {
    setSession((prev) => {
      const cur = prev ?? createDefaultMissionSession();
      const next: ArenaMissionSession = { ...cur, phase: "play", updatedAt: Date.now() };
      persistToStorage(next);
      return next;
    });
  }, []);

  const selectPrimary = useCallback(
    (choiceId: string) => {
      setSession((prev) => {
        const s = prev ?? createDefaultMissionSession();
        if (s.selectedPrimary) return s;
        const next: ArenaMissionSession = { ...s, selectedPrimary: choiceId, updatedAt: Date.now() };
        persistToStorage(next);
        return next;
      });
    },
    [],
  );

  const selectReinforcement = useCallback((choiceId: string) => {
    setSession((prev) => {
      const s = prev ?? createDefaultMissionSession();
      if (!s.selectedPrimary || s.selectedReinforcement) return s;
      const next: ArenaMissionSession = { ...s, selectedReinforcement: choiceId, updatedAt: Date.now() };
      persistToStorage(next);
      return next;
    });
  }, []);

  const commitDecision = useCallback(() => {
    setSession((prev) => {
      const s = prev ?? createDefaultMissionSession();
      if (!s.selectedPrimary || !s.selectedReinforcement) return s;
      const next: ArenaMissionSession = { ...s, phase: "result", updatedAt: Date.now() };
      persistToStorage(next);
      return next;
    });
  }, []);

  const continueArena = useCallback(() => {
    setSession((prev) => {
      const s = prev ?? createDefaultMissionSession();
      const next: ArenaMissionSession = {
        ...s,
        phase: "play",
        selectedPrimary: null,
        selectedReinforcement: null,
        updatedAt: Date.now(),
      };
      persistToStorage(next);
      return next;
    });
  }, []);

  const returnToLobby = useCallback(() => {
    setSession((prev) => {
      const s = prev ?? createDefaultMissionSession();
      const next: ArenaMissionSession = {
        ...s,
        phase: "lobby",
        selectedPrimary: null,
        selectedReinforcement: null,
        updatedAt: Date.now(),
      };
      persistToStorage(next);
      return next;
    });
  }, []);

  const resetSession = useCallback(() => {
    const fresh = createDefaultMissionSession();
    applySession(fresh);
  }, [applySession]);

  const reviewReflection = useCallback(() => {
    router.push(`${base}/growth/reflection`);
  }, [router, base]);

  return {
    hydrated,
    session,
    scenario,
    outcome,
    outcomeKey,
    canRevealReinforcement,
    canResolve,
    enterArena,
    resumeScenario,
    selectPrimary,
    selectReinforcement,
    commitDecision,
    continueArena,
    returnToLobby,
    resetSession,
    reviewReflection,
  };
}
