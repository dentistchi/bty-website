"use client";

/**
 * Five-step onboarding (client page shell).
 * - **Load:** `GET /api/bty/onboarding/step` → {@link getOnboardingStep}.
 * - **Steps:** top dots — **filled teal** = completed step, **outline** = pending (current = teal ring, future = gray ring). (1) KO/EN · (2) four role cards + level 1–5 · (3) {@link ScenarioCard} + `BEGINNER_SCENARIOS[0]` · (4) AIR SVG arc 0→score **1s ease** · (5) {@link LearningPathWidget} `inlineFourPathPicker` + **시작하기** / Get started.
 * - **Advance:** `POST /api/bty/onboarding/step` `{ step, payload }`.
 * - **Back:** browser back suppressed from step 3+ (`popstate`).
 * - **Done:** {@link ONBOARDING_COMPLETE_EVENT} → `/{locale}/bty-arena`.
 * - **Middleware:** no session → login; authenticated + `step_completed < 5` on `/bty-arena` · `/bty/foundry` · `/center` → `/{locale}/onboarding` (`src/middleware.ts`).
 */

import { useRouter } from "next/navigation";
import React from "react";
import { ScenarioCard } from "@/components/arena/ScenarioCard";
import { LearningPathWidget } from "@/components/foundry/LearningPathWidget";
import { ONBOARDING_COMPLETE_EVENT } from "@/engine/integration/onboarding-flow.service";
import { BEGINNER_SCENARIOS } from "@/lib/bty/scenario/beginnerScenarios";
import type { BeginnerScenario } from "@/lib/bty/scenario/beginnerTypes";
import type { Scenario as CatalogScenario, ScenarioChoice } from "@/lib/bty/scenario/types";
import { ARENA_SHELL_LOCALE_KEY } from "@/components/arena/ScenarioSessionShell";

export type OnboardingRole = "Individual Contributor" | "Team Lead" | "Manager" | "Executive";

type OnboardingStateApi = {
  ok: true;
  userId: string;
  nextStep: number | null;
  highestCompleted: number;
  isComplete: boolean;
  completedAt: string | null;
};

export type OnboardingStepPayload =
  | { locale: "ko" | "en" }
  | { role: OnboardingRole; level: number }
  | { scenarioId: string }
  | { airScore: number; airMeterPct: number }
  | { confirmed: true };

function beginnerFirstToCatalog(b: BeginnerScenario): CatalogScenario {
  const choices: ScenarioChoice[] = b.decisionOptions.map((d, i) => {
    const id = (["A", "B", "C"][i] ?? "A") as "A" | "B" | "C";
    const ko = b.decisionOptionsKo?.[i];
    return {
      choiceId: id,
      label: d.label,
      labelKo: ko?.label,
      intent: d.label,
      xpBase: 30,
      difficulty: 0.45,
      hiddenDelta: { integrity: 1, communication: 1 },
      result: "",
      microInsight: "",
    };
  });
  return {
    scenarioId: b.scenarioId,
    title: b.title,
    context: b.context,
    titleKo: b.titleKo,
    contextKo: b.contextKo,
    choices,
    coachNotes: { whatThisTrains: ["integrity"], whyItMatters: "Onboarding first scenario." },
  };
}

const ROLES: OnboardingRole[] = ["Individual Contributor", "Team Lead", "Manager", "Executive"];

function roleLabel(r: OnboardingRole, loc: "ko" | "en"): string {
  if (loc === "en") return r;
  switch (r) {
    case "Individual Contributor":
      return "개인 기여자";
    case "Team Lead":
      return "팀 리드";
    case "Manager":
      return "매니저";
    case "Executive":
      return "임원";
    default:
      return r;
  }
}

export type OnboardingShellProps = {
  userId: string;
  locale: string;
};

const AIR_FILL_MS = 1000 as const;

/** AIR baseline: circular progress using `stroke-dasharray` 0 → score over 1s. */
function AirSvgMeter({
  airScore,
  airMeterPct,
}: {
  airScore: number;
  airMeterPct: number;
}) {
  const size = 168;
  const stroke = 10;
  const r = (size - stroke) / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;
  const dash = (airMeterPct / 100) * c;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto block"
      role="img"
      aria-label={`AIR ${airScore.toFixed(3)}`}
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} className="dark:stroke-slate-700" />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#14b8a6"
        strokeWidth={stroke}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        strokeDasharray={`${dash} ${c}`}
        style={{ transition: `stroke-dasharray ${AIR_FILL_MS}ms ease` }}
      />
    </svg>
  );
}

export function OnboardingShell({ userId, locale }: OnboardingShellProps) {
  const loc = locale === "ko" ? "ko" : "en";
  const router = useRouter();

  const [state, setState] = React.useState<OnboardingStateApi | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const [localeChoice, setLocaleChoice] = React.useState<"ko" | "en">(loc === "ko" ? "ko" : "en");
  const [role, setRole] = React.useState<OnboardingRole>("Individual Contributor");
  const [level, setLevel] = React.useState(3);

  const [airScore, setAirScore] = React.useState(0.72);
  const [airMeterPct, setAirMeterPct] = React.useState(0);

  const beginner = React.useMemo(() => beginnerFirstToCatalog(BEGINNER_SCENARIOS[0]!), []);

  /** `GET /api/bty/onboarding/step` — server {@link getOnboardingStep}. */
  const load = React.useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/bty/onboarding/step", { credentials: "include" });
      const json = (await res.json()) as OnboardingStateApi | { ok: false; error?: string };
      if (!res.ok || !("ok" in json) || json.ok !== true) {
        throw new Error((json as { error?: string }).error ?? "LOAD_FAILED");
      }
      setState(json);
      if (json.isComplete || json.nextStep == null) {
        router.replace(`/${loc}/bty-arena`);
      }
    } catch {
      setErr(loc === "ko" ? "온보딩 상태를 불러오지 못했습니다." : "Failed to load onboarding.");
    } finally {
      setLoading(false);
    }
  }, [loc, router]);

  React.useEffect(() => {
    void load();
  }, [load]);

  /** Step 3+: block browser back (middleware still enforces `step_completed` for gated routes). */
  const step = state?.nextStep ?? 1;
  React.useEffect(() => {
    if (step < 3) return;
    const trapBack = () => {
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", trapBack);
    return () => window.removeEventListener("popstate", trapBack);
  }, [step]);

  /** On {@link ONBOARDING_COMPLETE_EVENT}, navigate to Arena. */
  React.useEffect(() => {
    const go = () => {
      router.replace(`/${localeChoice}/bty-arena`);
    };
    window.addEventListener(ONBOARDING_COMPLETE_EVENT, go);
    return () => window.removeEventListener(ONBOARDING_COMPLETE_EVENT, go);
  }, [localeChoice, router]);

  const markStep = React.useCallback(
    async (s: 1 | 2 | 3 | 4 | 5, payload: OnboardingStepPayload) => {
      setPending(true);
      setErr(null);
      try {
        const res = await fetch("/api/bty/onboarding/step", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: s, payload }),
        });
        const json = (await res.json()) as OnboardingStateApi & { ok?: boolean; error?: string };
        if (!res.ok || json.ok !== true) {
          throw new Error(json.error ?? "STEP_FAILED");
        }
        setState(json as OnboardingStateApi);
        if (s === 5 && (json as OnboardingStateApi).isComplete) {
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent(ONBOARDING_COMPLETE_EVENT, {
                detail: { userId },
              }),
            );
          }
        }
        return json as OnboardingStateApi;
      } catch {
        setErr(loc === "ko" ? "단계를 저장하지 못했습니다." : "Could not save step.");
        return null;
      } finally {
        setPending(false);
      }
    },
    [loc, userId],
  );

  React.useEffect(() => {
    if (state?.nextStep !== 4) return;
    let alive = true;
    setAirMeterPct(0);
    fetch("/api/bty/dashboard/integrity", { credentials: "include" })
      .then(async (r) => {
        const j = (await r.json()) as {
          airTrend?: { last7DayWindowAvg?: number };
          error?: string;
        };
        if (!r.ok || "error" in j) return;
        const v = Number(j.airTrend?.last7DayWindowAvg);
        const x = Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.72;
        if (!alive) return;
        setAirScore(x);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (alive) setAirMeterPct(Math.round(x * 100));
          });
        });
      })
      .catch(() => {
        if (!alive) return;
        setAirScore(0.72);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (alive) setAirMeterPct(72);
          });
        });
      });
    return () => {
      alive = false;
    };
  }, [state?.nextStep]);

  const onStep1 = async () => {
    try {
      localStorage.setItem(ARENA_SHELL_LOCALE_KEY, localeChoice);
    } catch {
      /* ignore */
    }
    await markStep(1, { locale: localeChoice });
  };

  const onStep2 = async () => {
    try {
      localStorage.setItem("bty_onboarding_role_v1", role);
      localStorage.setItem("bty_onboarding_level_v1", String(level));
    } catch {
      /* ignore */
    }
    await markStep(2, { role, level });
  };

  const onStep3Choice = async () => {
    await markStep(3, { scenarioId: beginner.scenarioId });
  };

  const onStep4 = async () => {
    await markStep(4, { airScore, airMeterPct });
  };

  const onStep5 = async () => {
    await markStep(5, { confirmed: true });
  };

  if (loading || !state) {
    return (
      <div className="fixed inset-0 z-40 flex min-h-[100dvh] items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-500">{loc === "ko" ? "불러오는 중…" : "Loading…"}</p>
      </div>
    );
  }

  if (err && !state.nextStep) {
    return (
      <div className="fixed inset-0 z-40 flex min-h-[100dvh] items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <p className="text-red-600">{err}</p>
      </div>
    );
  }

  const currentStep = state.nextStep ?? 1;
  const steps = [1, 2, 3, 4, 5] as const;
  const uiLoc = localeChoice;

  return (
    <div className="fixed inset-0 z-40 flex min-h-0 flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="shrink-0 border-b border-slate-200/80 bg-white/90 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
            {uiLoc === "ko" ? "온보딩" : "Onboarding"}
          </p>
          <div className="flex justify-center gap-2.5" role="tablist" aria-label={uiLoc === "ko" ? "단계" : "Steps"}>
            {steps.map((s) => {
              const complete = s < currentStep;
              const current = s === currentStep;
              const label =
                uiLoc === "ko"
                  ? complete
                    ? `단계 ${s} 완료`
                    : current
                      ? `단계 ${s} 진행 중`
                      : `단계 ${s} 대기`
                  : complete
                    ? `Step ${s} done`
                    : current
                      ? `Step ${s} current`
                      : `Step ${s} pending`;
              return (
                <span
                  key={s}
                  role="presentation"
                  title={label}
                  aria-label={label}
                  className={`h-2.5 w-2.5 rounded-full transition-all ${
                    complete
                      ? "border-2 border-teal-500 bg-teal-500"
                      : current
                        ? "border-2 border-teal-500 bg-transparent shadow-sm"
                        : "border-2 border-slate-300 bg-transparent dark:border-slate-600"
                  } ${current ? "scale-125" : ""}`}
                />
              );
            })}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-4 py-8">
          {err ? <p className="mb-4 text-center text-sm text-red-600">{err}</p> : null}

          {currentStep === 1 ? (
            <section className="space-y-8">
              <h1 className="text-center text-2xl font-semibold tracking-tight">
                {uiLoc === "ko" ? "언어 선택" : "Choose language"}
              </h1>
              <div className="flex justify-center gap-4">
                {(["ko", "en"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    className={`rounded-2xl border-2 px-10 py-4 text-sm font-bold shadow-sm transition ${
                      localeChoice === l
                        ? "border-teal-500 bg-teal-50 text-teal-900 shadow-teal-500/20 dark:bg-teal-950/40"
                        : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                    }`}
                    onClick={() => setLocaleChoice(l)}
                  >
                    {l === "ko" ? "한국어" : "English"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={pending}
                className="w-full rounded-2xl bg-teal-600 py-4 text-sm font-semibold text-white shadow-lg shadow-teal-600/25 disabled:opacity-50"
                onClick={() => void onStep1()}
              >
                {uiLoc === "ko" ? "계속" : "Continue"}
              </button>
            </section>
          ) : null}

          {currentStep === 2 ? (
            <section className="space-y-8">
              <h1 className="text-center text-2xl font-semibold tracking-tight">
                {uiLoc === "ko" ? "역할과 숙련도" : "Role & level"}
              </h1>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`rounded-2xl border-2 px-4 py-4 text-left text-sm font-semibold shadow-sm transition ${
                      role === r
                        ? "border-teal-500 bg-teal-50 shadow-md shadow-teal-500/15 dark:bg-teal-950/30"
                        : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                    }`}
                    onClick={() => setRole(r)}
                  >
                    {roleLabel(r, uiLoc)}
                  </button>
                ))}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
                <label className="mb-3 block text-xs font-semibold uppercase text-slate-500">
                  {uiLoc === "ko" ? "레벨 1–5" : "Level 1–5"}
                </label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={level}
                  onChange={(e) => setLevel(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
                <p className="mt-2 text-center text-lg font-bold tabular-nums text-teal-700 dark:text-teal-300">
                  {level}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                className="w-full rounded-2xl bg-teal-600 py-4 text-sm font-semibold text-white shadow-lg shadow-teal-600/25 disabled:opacity-50"
                onClick={() => void onStep2()}
              >
                {uiLoc === "ko" ? "계속" : "Continue"}
              </button>
            </section>
          ) : null}

          {currentStep === 3 ? (
            <section className="space-y-6">
              <h1 className="text-center text-2xl font-semibold tracking-tight">
                {uiLoc === "ko" ? "첫 시나리오" : "Your first scenario"}
              </h1>
              <ScenarioCard
                scenarioId={beginner.scenarioId}
                catalogScenario={beginner}
                showLocaleToggle
                contentLocale={localeChoice}
                patternNarrative=""
                scenarioType={null}
                previousFlagType={null}
                onChoiceConfirmed={() => void onStep3Choice()}
              />
            </section>
          ) : null}

          {currentStep === 4 ? (
            <section className="space-y-8">
              <h1 className="text-center text-2xl font-semibold tracking-tight">AIR</h1>
              <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                {uiLoc === "ko" ? "기준 AIR 점수 (최근 7일 평균)" : "Baseline AIR (7-day average)"}
              </p>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <AirSvgMeter airScore={airScore} airMeterPct={airMeterPct} />
                <p className="mt-2 text-center text-3xl font-bold tabular-nums text-teal-700 dark:text-teal-300">
                  {airScore.toFixed(3)}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                className="w-full rounded-2xl bg-teal-600 py-4 text-sm font-semibold text-white shadow-lg shadow-teal-600/25 disabled:opacity-50"
                onClick={() => void onStep4()}
              >
                {uiLoc === "ko" ? "계속" : "Continue"}
              </button>
            </section>
          ) : null}

          {currentStep === 5 ? (
            <section className="space-y-8">
              <h1 className="text-center text-2xl font-semibold tracking-tight">
                {uiLoc === "ko" ? "학습 경로" : "Learning path"}
              </h1>
              <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                {uiLoc === "ko"
                  ? "네 가지 경로 중 하나를 선택한 뒤 시작하기를 눌러 주세요."
                  : "Pick one of four paths, then tap Get started."}
              </p>
              <LearningPathWidget userId={userId} locale={localeChoice} inlineFourPathPicker />
              <button
                type="button"
                disabled={pending}
                className="w-full rounded-2xl bg-teal-600 py-4 text-sm font-semibold text-white shadow-lg shadow-teal-600/25 disabled:opacity-50"
                onClick={() => void onStep5()}
              >
                {uiLoc === "ko" ? "시작하기" : "Get started"}
              </button>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default OnboardingShell;
