"use client";

/**
 * Foundry — micro Dojo assessment: GET `/api/bty/foundry/dojo/assign` → one question at a time (no route change) → POST submit `answers[]` → overlay.
 * On pass: `dojo_assessment_complete` + `markRecoveryComplete` when `slip_recovery_tasks` `dojo_assessment` is pending.
 */

import Link from "next/link";
import React from "react";
import type { DojoSkillArea } from "@/engine/foundry/dojo-assessment.service";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export const DOJO_ASSESSMENT_COMPLETE_EVENT = "dojo_assessment_complete" as const;

export type DojoAssessmentCompleteDetail = {
  passed: boolean;
  skill_area: DojoSkillArea;
  score: number;
  attemptId: string;
  pendingRecoveryTaskId: string | null;
};

type DojoQuestion = {
  id: string;
  textKo: string;
  textEn: string;
  weight?: number;
};

type DojoAssessment = {
  id: string;
  titleKo: string;
  titleEn: string;
  skill_area: DojoSkillArea;
  questions: readonly DojoQuestion[];
  passing_score: number;
};

type AssignOk = {
  ok: true;
  attemptId: string;
  assessment: DojoAssessment;
  pendingRecoveryTaskId: string | null;
};

type SubmitResult = {
  attemptId: string;
  assessmentId: string;
  skill_area: DojoSkillArea;
  passed: boolean;
  score: number;
  passing_score: number;
  submitted_at: string;
};

const HINT_KO: Record<DojoSkillArea, string> = {
  communication: "한 문장 더 듣고, 내가 이해한 바를 짧게 되물어 보세요.",
  decision: "되돌릴 수 있는지 먼저 적고, 마감 시점만 정해 보세요.",
  resilience: "감정 이름을 한 단어로 붙인 뒤, 다음 한 걸음만 정하세요.",
  integrity: "지금 상황에서 지키려는 원칙을 말로 한 번만 밝혀 보세요.",
  leadership: "권한 위임할 일 하나와 확인 시점만 합의해 보세요.",
  empathy: "상대 감정을 그대로 반복해 준 뒤, 필요한 것을 한 가지만 물어 보세요.",
};

/** Result overlay always shows Korean copy for the improvement line (product rule). */
function improvementHintKo(area: DojoSkillArea): string {
  return HINT_KO[area];
}

function dispatchDojoAssessmentComplete(detail: DojoAssessmentCompleteDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DOJO_ASSESSMENT_COMPLETE_EVENT, { detail }));
}

async function postRecoveryComplete(taskId: string): Promise<void> {
  await fetch("/api/bty/foundry/dojo/recovery-complete", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId }),
  });
}

export type DojoAssessmentShellProps = {
  locale: Locale | string;
  /** Route locale segment e.g. `ko` */
  routeLocale: string;
  /** When set, assigns this skill pack; otherwise server picks weakest area. */
  skillArea?: DojoSkillArea;
};

export function DojoAssessmentShell({ locale, routeLocale, skillArea }: DojoAssessmentShellProps) {
  const loc = locale === "ko" ? "ko" : "en";
  const b = getMessages(loc).bty;

  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [assignment, setAssignment] = React.useState<AssignOk | null>(null);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [submitErr, setSubmitErr] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<SubmitResult | null>(null);

  const foundryHref = `/${routeLocale}/bty/foundry`;

  React.useEffect(() => {
    let cancelled = false;
    setLoadErr(null);
    const q = new URLSearchParams();
    q.set("lang", loc);
    if (skillArea) q.set("skill_area", skillArea);
    fetch(`/api/bty/foundry/dojo/assign?${q.toString()}`, { credentials: "include" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as AssignOk & { ok?: boolean; error?: string };
        if (cancelled) return;
        if (!r.ok || !j.ok) {
          setLoadErr(j.error ?? b.dojoAssessmentShellError);
          return;
        }
        setAssignment({
          ok: true,
          attemptId: j.attemptId,
          assessment: j.assessment,
          pendingRecoveryTaskId: j.pendingRecoveryTaskId ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) setLoadErr(b.dojoAssessmentShellError);
      });
    return () => {
      cancelled = true;
    };
  }, [loc, skillArea, b.dojoAssessmentShellError]);

  const assessment = assignment?.assessment;
  const questions = assessment?.questions ?? [];
  const total = questions.length;
  const current = questions[stepIndex];
  const pendingRecoveryTaskId = assignment?.pendingRecoveryTaskId ?? null;

  const likertOptions = React.useMemo(
    () =>
      [
        { value: 1 as const, label: b.dojoAssessmentShellLikert1 },
        { value: 2 as const, label: b.dojoAssessmentShellLikert2 },
        { value: 3 as const, label: b.dojoAssessmentShellLikert3 },
        { value: 4 as const, label: b.dojoAssessmentShellLikert4 },
      ] as const,
    [
      b.dojoAssessmentShellLikert1,
      b.dojoAssessmentShellLikert2,
      b.dojoAssessmentShellLikert3,
      b.dojoAssessmentShellLikert4,
    ],
  );

  const canAdvance = current != null && typeof answers[current.id] === "number";
  const isLast = total > 0 && stepIndex >= total - 1;

  const onPick = (questionId: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const goNext = () => {
    if (!canAdvance || isLast) return;
    setStepIndex((i) => i + 1);
  };

  const onSubmit = async () => {
    if (!assessment || !isLast) return;
    for (const q of assessment.questions) {
      if (typeof answers[q.id] !== "number") {
        setSubmitErr(b.dojoAssessmentShellError);
        return;
      }
    }
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const res = await fetch("/api/bty/foundry/dojo/submit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId: assessment.id,
          answers: assessment.questions.map((q) => answers[q.id] as number),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as
        | { ok: true; result: SubmitResult }
        | { ok?: false; error?: string };
      if (!res.ok || !data || !("ok" in data) || !data.ok || !("result" in data)) {
        setSubmitErr(
          typeof data === "object" && data && "error" in data && typeof data.error === "string"
            ? data.error
            : b.dojoAssessmentShellError,
        );
        return;
      }
      const r = data.result;
      setResult(r);

      if (r.passed) {
        dispatchDojoAssessmentComplete({
          passed: true,
          skill_area: r.skill_area,
          score: r.score,
          attemptId: r.attemptId,
          pendingRecoveryTaskId,
        });
        if (pendingRecoveryTaskId) {
          void postRecoveryComplete(pendingRecoveryTaskId);
        }
      }
    } catch {
      setSubmitErr(b.dojoAssessmentShellError);
    } finally {
      setSubmitting(false);
    }
  };

  if (!assignment && !loadErr) {
    return (
      <section role="status" aria-busy="true" aria-label={b.dojoAssessmentShellLoading}>
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>{b.dojoAssessmentShellLoading}</p>
      </section>
    );
  }

  if (loadErr || !assessment || total === 0) {
    return (
      <section role="alert" aria-label={b.dojoAssessmentShellRegionAria}>
        <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{loadErr ?? b.dojoAssessmentShellError}</p>
      </section>
    );
  }

  const title = loc === "ko" ? assessment.titleKo : assessment.titleEn;
  const qText = loc === "ko" ? current.textKo : current.textEn;
  const progressLabel = b.dojoAssessmentShellProgress
    .replace("{current}", String(stepIndex + 1))
    .replace("{total}", String(total));
  const progressPct = total > 0 ? Math.round(((stepIndex + 1) / total) * 100) : 0;

  return (
    <section role="region" aria-label={b.dojoAssessmentShellRegionAria}>
      <div
        style={{
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          background: "var(--arena-card, #fff)",
          padding: "20px 20px 24px",
          maxWidth: 560,
        }}
      >
        <header style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#64748b" }}>{progressLabel}</p>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8" }}>{progressPct}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={stepIndex + 1}
            aria-valuemin={1}
            aria-valuemax={total}
            aria-label={progressLabel}
            style={{
              height: 8,
              borderRadius: 999,
              background: "#e2e8f0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: "100%",
                background: "#0d9488",
                transition: "width 0.2s ease",
              }}
            />
          </div>
          <h2 style={{ margin: "14px 0 0", fontSize: 18, fontWeight: 800, color: "#0f172a", minHeight: "1.35em" }}>{title}</h2>
        </header>

        <fieldset style={{ margin: 0, padding: 0, border: "none", minHeight: 280 }}>
          <legend
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: "hidden",
              clip: "rect(0,0,0,0)",
              whiteSpace: "nowrap",
              border: 0,
            }}
          >
            {qText}
          </legend>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 15,
              lineHeight: 1.55,
              color: "#334155",
              minHeight: "5.5em",
            }}
          >
            {qText}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {likertOptions.map((opt) => (
              <label
                key={opt.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  fontSize: 14,
                  color: "#0f172a",
                }}
              >
                <input
                  type="radio"
                  name={`dojo-q-${current.id}`}
                  checked={answers[current.id] === opt.value}
                  onChange={() => onPick(current.id, opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {submitErr ? (
          <p role="alert" style={{ margin: "14px 0 0", color: "#b91c1c", fontSize: 13 }}>
            {submitErr}
          </p>
        ) : null}

        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          {!isLast ? (
            <button
              type="button"
              disabled={!canAdvance}
              onClick={goNext}
              style={{
                fontSize: 14,
                fontWeight: 700,
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                cursor: canAdvance ? "pointer" : "not-allowed",
                background: canAdvance ? "#0d9488" : "#94a3b8",
                color: "#fff",
              }}
            >
              {b.dojoAssessmentShellNext}
            </button>
          ) : (
            <button
              type="button"
              disabled={!canAdvance || submitting}
              onClick={() => void onSubmit()}
              style={{
                fontSize: 14,
                fontWeight: 700,
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                cursor: canAdvance && !submitting ? "pointer" : "not-allowed",
                background: canAdvance && !submitting ? "#0d9488" : "#94a3b8",
                color: "#fff",
              }}
            >
              {submitting ? "…" : b.dojoAssessmentShellSubmit}
            </button>
          )}
        </div>
      </div>

      {result ? (
        <DojoResultOverlay
          loc={loc}
          result={result}
          hintKo={improvementHintKo(result.skill_area)}
          passLabel={b.dojoAssessmentShellPass}
          failLabel={b.dojoAssessmentShellFail}
          scoreLabel={b.dojoAssessmentShellScoreLabel}
          hintLabel={b.dojoAssessmentShellHintLabel}
          ctaLabel={b.dojoAssessmentShellReturnToFoundry}
          foundryHref={foundryHref}
        />
      ) : null}
    </section>
  );
}

function DojoResultOverlay({
  loc,
  result,
  hintKo,
  passLabel,
  failLabel,
  scoreLabel,
  hintLabel,
  ctaLabel,
  foundryHref,
}: {
  loc: "ko" | "en";
  result: SubmitResult;
  hintKo: string;
  passLabel: string;
  failLabel: string;
  scoreLabel: string;
  hintLabel: string;
  ctaLabel: string;
  foundryHref: string;
}) {
  const pass = result.passed;
  const scoreLine =
    loc === "ko"
      ? `${result.score}점 / 100 (합격 기준 ${result.passing_score}점)`
      : `${result.score} / 100 (pass at ${result.passing_score})`;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dojo-result-heading"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(15, 23, 42, 0.45)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 16,
          background: "#fff",
          padding: "24px 22px 22px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
        }}
      >
        <h2 id="dojo-result-heading" style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
          {pass ? passLabel : failLabel}
        </h2>
        <p style={{ margin: "0 0 8px", fontSize: 15, color: "#334155" }}>
          <strong>{scoreLabel}:</strong> {scoreLine}
        </p>
        <p lang="ko" style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.5, color: "#475569" }}>
          <strong>{hintLabel}:</strong> {hintKo}
        </p>
        <Link
          href={foundryHref}
          style={{
            display: "inline-block",
            fontSize: 14,
            fontWeight: 800,
            padding: "12px 16px",
            borderRadius: 10,
            background: "#0d9488",
            color: "#fff",
            textDecoration: "none",
            textAlign: "center",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
