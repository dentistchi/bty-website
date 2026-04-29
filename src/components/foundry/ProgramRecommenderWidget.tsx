"use client";

/**
 * Foundry entry: top-3 program recommendations from GET /api/bty/foundry/recommendations.
 * Live: Supabase broadcast `foundry_program_assign` + postgres_changes on `foundry_recommendations`.
 * Unlock overlay: until `foundry_unlock` matches this program (see local unlock storage + scenario tokens).
 */

import React from "react";
import { useRouter } from "next/navigation";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";
import { scenarioTokensFromScenarioId } from "@/domain/foundry/program-catalog-signals";

/** Mirrors GET /api/bty/foundry/recommendations `recommendations[]` (see getRecommendationsForUi). */
type FoundryRecommendationCardDto = {
  rank: number;
  program_id: string;
  title: string;
  match_score: number;
  scenario_tags: string[];
  phase_tags: string[];
  matched_tags: string[];
  phase_label: string | null;
};

/** Must match {@link FOUNDRY_UNLOCK_EVENT} in arena-foundry-bridge. */
const FOUNDRY_UNLOCK_EVENT = "foundry_unlock";

/** Must match {@link FOUNDRY_PROGRAM_ASSIGN_EVENT} in foundry-program-assign.types. */
const FOUNDRY_PROGRAM_ASSIGN_EVENT = "foundry_program_assign";

type FoundryUnlockDetail = {
  userId: string;
  scenarioType: string;
  learningProgramId: string;
  airDelta: number;
  occurredAt: string;
  programId?: string;
};

export const PROGRAM_SELECTED_EVENT = "program_selected" as const;

/** Keep in sync with {@link PROGRAM_COMPLETED_EVENT} in `program-completion.service`. */
export const PROGRAM_COMPLETED_EVENT = "program_completed" as const;

export type ProgramSelectedDetail = {
  programId: string;
  title: string;
};

export type ProgramCompletedDetail = {
  userId: string;
  programId: string;
  completedAt: string;
};

/** POST `/api/bty/foundry/program-progress` — selection tracking and completion (detail page). */
export async function postFoundryProgramProgress(body: {
  action: "select" | "set_pct" | "update" | "complete";
  programId: string;
  completionPct?: number;
  /** Increment delta for `action: 'update'`. */
  pct?: number;
}): Promise<{
  ok: boolean;
  error?: string;
  programCompletedDetail?: ProgramCompletedDetail;
}> {
  const res = await fetch("/api/bty/foundry/program-progress", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    programCompletedDetail?: ProgramCompletedDetail;
  };
  if (!res.ok || !data.ok) {
    return { ok: false, error: typeof data.error === "string" ? data.error : "request_failed" };
  }
  return {
    ok: true,
    programCompletedDetail: data.programCompletedDetail,
  };
}

type RecommendationsApi = {
  ok?: boolean;
  recommendations?: FoundryRecommendationCardDto[];
  error?: string;
};

const REFETCH_DEBOUNCE_MS = 400;

function storageTokensKey(userId: string) {
  return `bty_foundry_unlock_tokens:${userId}`;
}

function storageProgKey(userId: string) {
  return `bty_foundry_unlock_prog:${userId}`;
}

function readStringSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function writeStringSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

/** `lp_fp_01` style → `fp_01` */
function programIdFromLearningProgramId(lp: string): string | null {
  const m = /^lp_(fp_\d{2})$/i.exec(lp.trim());
  return m ? m[1]! : null;
}

function isProgramUnlocked(
  programId: string,
  scenarioTags: string[],
  unlockTokens: Set<string>,
  unlockedProgramIds: Set<string>,
): boolean {
  if (unlockedProgramIds.has(programId)) return true;
  return scenarioTags.some((t) => unlockTokens.has(t));
}

function mergeUnlockState(
  userId: string,
  detail: FoundryUnlockDetail,
): { tokens: Set<string>; programIds: Set<string> } {
  const tokKey = storageTokensKey(userId);
  const pidKey = storageProgKey(userId);
  let tokens = readStringSet(tokKey);
  let programIds = readStringSet(pidKey);

  if (typeof detail.programId === "string" && detail.programId.trim()) {
    programIds = new Set(programIds).add(detail.programId.trim());
  }
  const fromLp = programIdFromLearningProgramId(detail.learningProgramId);
  if (fromLp) programIds = new Set(programIds).add(fromLp);

  for (const t of scenarioTokensFromScenarioId(detail.scenarioType)) {
    tokens = new Set(tokens).add(t);
  }

  writeStringSet(tokKey, tokens);
  writeStringSet(pidKey, programIds);
  return { tokens, programIds };
}

export type ProgramRecommenderWidgetProps = {
  /** Route prefix e.g. `ko` or `en` */
  locale: string;
};

export function ProgramRecommenderWidget({ locale }: ProgramRecommenderWidgetProps) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = getMessages(loc as Locale).bty;
  const router = useRouter();

  const [userId, setUserId] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<FoundryRecommendationCardDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [unlockTokens, setUnlockTokens] = React.useState<Set<string>>(() => new Set());
  const [unlockedProgramIds, setUnlockedProgramIds] = React.useState<Set<string>>(() => new Set());

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/bty/foundry/recommendations", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as RecommendationsApi;
      if (!res.ok || !data.ok) {
        setError(data.error ?? t.programRecommenderWidgetError);
        setRows([]);
        return;
      }
      setRows(Array.isArray(data.recommendations) ? data.recommendations.slice(0, 3) : []);
    } catch {
      setError(t.programRecommenderWidgetError);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [t.programRecommenderWidgetError]);

  const scheduleLoad = React.useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void load();
    }, REFETCH_DEBOUNCE_MS);
  }, [load]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/arena/profile", { credentials: "include" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { profile?: { user_id?: string } };
        if (!alive) return;
        const uid = typeof j.profile?.user_id === "string" ? j.profile.user_id : null;
        setUserId(uid);
      })
      .catch(() => {
        if (alive) setUserId(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    setUnlockTokens(readStringSet(storageTokensKey(userId)));
    setUnlockedProgramIds(readStringSet(storageProgKey(userId)));
  }, [userId]);

  React.useEffect(() => {
    const onUnlock = (ev: Event) => {
      if (!userId) return;
      const ce = ev as CustomEvent<FoundryUnlockDetail>;
      const d = ce.detail;
      if (!d || typeof d !== "object") return;
      if (d.userId !== userId) return;
      const next = mergeUnlockState(userId, d);
      setUnlockTokens(next.tokens);
      setUnlockedProgramIds(next.programIds);
    };
    window.addEventListener(FOUNDRY_UNLOCK_EVENT, onUnlock);
    return () => window.removeEventListener(FOUNDRY_UNLOCK_EVENT, onUnlock);
  }, [userId]);

  React.useEffect(() => {
    let client: ReturnType<typeof getSupabase> | null = null;
    try {
      client = getSupabase();
    } catch {
      return;
    }
    if (!userId) return;

    const channel = client
      .channel(FOUNDRY_PROGRAM_ASSIGN_EVENT)
      .on(
        "broadcast",
        { event: FOUNDRY_PROGRAM_ASSIGN_EVENT },
        (msg: { payload?: { userId?: string } }) => {
          if (msg.payload?.userId === userId) scheduleLoad();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "foundry_recommendations",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          scheduleLoad();
        },
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      client?.removeChannel(channel);
    };
  }, [userId, scheduleLoad]);

  const base = `/${locale}/bty/foundry/program`;

  const onSelect = React.useCallback(
    (row: FoundryRecommendationCardDto) => {
      const detail: ProgramSelectedDetail = { programId: row.program_id, title: row.title };
      window.dispatchEvent(new CustomEvent(PROGRAM_SELECTED_EVENT, { detail }));
      void postFoundryProgramProgress({ action: "select", programId: row.program_id }).catch(() => {
        /* non-blocking */
      });
      router.push(`${base}/${encodeURIComponent(row.program_id)}`);
    },
    [router, base],
  );

  if (loading && rows.length === 0) {
    return (
      <section role="status" aria-busy="true" aria-label={t.programRecommenderWidgetLoading}>
        <p className="text-sm font-semibold text-[var(--arena-text)] m-0">{t.programRecommenderWidgetTitle}</p>
        <p className="text-xs text-[var(--arena-text-soft)] mt-1 m-0">{t.programRecommenderWidgetLoading}</p>
      </section>
    );
  }

  if (error) {
    return (
      <section role="alert" aria-label={t.programRecommenderWidgetRegionAria}>
        <p className="text-sm font-semibold text-[var(--arena-text)] m-0">{t.programRecommenderWidgetTitle}</p>
        <p className="text-xs text-red-700 mt-1 m-0">{error}</p>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section aria-label={t.programRecommenderWidgetRegionAria}>
        <p className="text-sm font-semibold text-[var(--arena-text)] m-0">{t.programRecommenderWidgetTitle}</p>
        <p className="text-xs text-[var(--arena-text-soft)] mt-1 m-0">{t.programRecommenderWidgetEmpty}</p>
      </section>
    );
  }

  return (
    <section aria-label={t.programRecommenderWidgetRegionAria}>
      <h2 className="text-sm font-semibold text-[var(--arena-text)] m-0 mb-3">{t.programRecommenderWidgetTitle}</h2>
      <ul className="list-none p-0 m-0 flex flex-col gap-3" role="list">
        {rows.map((row) => {
          const locked = !isProgramUnlocked(row.program_id, row.scenario_tags, unlockTokens, unlockedProgramIds);
          const matched = new Set(row.matched_tags);
          const displayTags = [...new Set([...row.scenario_tags, ...row.matched_tags])].slice(0, 8);

          return (
            <li key={row.program_id}>
              <button
                type="button"
                onClick={() => onSelect(row)}
                aria-label={
                  locked ? `${row.title}. ${t.programRecommenderWidgetLocked}` : row.title
                }
                className="relative w-full text-left rounded-2xl border border-[var(--arena-text-soft)]/20 bg-[var(--arena-bg,#fff)]/90 px-4 py-3 min-h-[88px] shadow-sm hover:shadow-md hover:border-[var(--arena-accent)]/40 transition-all"
              >
                {locked ? (
                  <div
                    className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-[var(--arena-bg,#0f172a)]/55 backdrop-blur-[2px] pointer-events-none"
                    aria-hidden
                  >
                    <span className="text-xs font-semibold text-white px-2 py-1 rounded-md bg-black/35">
                      {t.programRecommenderWidgetLocked}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2 items-start">
                  <div className="text-sm font-semibold text-[var(--arena-text)] pr-2">{row.title}</div>
                  {row.phase_label ? (
                    <span className="shrink-0 text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full border border-[var(--arena-accent)]/35 text-[var(--arena-accent)]">
                      {row.phase_label}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {displayTags.map((tag) => {
                    const isMatched = matched.has(tag);
                    return (
                      <span
                        key={`${row.program_id}-${tag}`}
                        className={
                          isMatched
                            ? "text-[11px] px-2 py-0.5 rounded-md bg-[var(--arena-accent)]/15 text-[var(--arena-accent)] font-medium border border-[var(--arena-accent)]/30"
                            : "text-[11px] px-2 py-0.5 rounded-md text-[var(--arena-text-soft)] border border-[var(--arena-text-soft)]/25"
                        }
                      >
                        {tag}
                      </span>
                    );
                  })}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
