"use client";

/**
 * DECISION6 C2 — Train Day Reflection Set (replaces Unit1 TrainDayCapture, 형태 A).
 *
 * UX lock: each Train Day has ONE Dear Me Reflection — zero or more guided
 * questions, always ending with one integrated final reflection. Universal:
 * days with no authored question set render open-only (final reflection box only).
 *
 * Rendered BELOW the lesson <article> (renderer raw unchanged, additive slot).
 * 🔴 기록 ≠ 완료: independent upsert POST → /api/dear-me/day-reflection. Never
 * touches markTodayComplete / completion gate. A save failure does not block
 * completion; completion never triggers a save.
 */

import * as React from "react";
import REFLECTION_QUESTIONS from "@/content/reflection-questions.json";

type LocStr = { en?: string; ko?: string };
type QuestionSet = {
  title?: LocStr;
  questions?: LocStr[];
  finalPrompt?: LocStr;
};

export default function TrainDayReflectionSet({
  day,
  locale,
}: {
  day: number;
  locale: "ko" | "en";
}) {
  const isKo = locale === "ko";
  const pick = (x?: LocStr): string => x?.[locale] ?? x?.en ?? x?.ko ?? "";

  const set = (REFLECTION_QUESTIONS as Record<string, QuestionSet>)[String(day)];
  const questionPrompts: string[] = (set?.questions ?? []).map(pick);
  const title = pick(set?.title) || (isKo ? `Day ${day} 성찰` : `Day ${day} Reflection`);
  const finalPrompt =
    pick(set?.finalPrompt) ||
    (isKo ? "오늘 나에게 남기고 싶은 말은 무엇인가요?" : "What do you want to leave for yourself today?");

  const [open, setOpen] = React.useState(false);
  const [answers, setAnswers] = React.useState<string[]>(() => questionPrompts.map(() => ""));
  const [finalReflection, setFinalReflection] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Prefill from the existing saved reflection when the form opens, so a partial
  // re-edit does not overwrite prior answers (responses is upserted whole).
  // Match saved answers to the current asset questions by question text; saved
  // questions no longer in the asset are dropped (will not be re-saved).
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/dear-me/day-reflection?day=${day}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { responses?: { questions?: { q: string; a: string }[]; finalReflection?: string } | null } | null) => {
        if (cancelled) return;
        const resp = data?.responses;
        if (resp) {
          const answerMap: Record<string, string> = {};
          (resp.questions ?? []).forEach((qa) => {
            if (qa && typeof qa.q === "string") answerMap[qa.q] = typeof qa.a === "string" ? qa.a : "";
          });
          setAnswers(questionPrompts.map((q) => answerMap[q] ?? ""));
          setFinalReflection(resp.finalReflection ?? "");
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // questionPrompts is stable per `day`; excluded to avoid a refetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, day]);

  const hasContent =
    finalReflection.trim().length > 0 || answers.some((a) => a.trim().length > 0);
  const canSave = hasContent && !saving && !loading;

  const setAnswer = (i: number, v: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
    if (saved) setSaved(false);
  };

  const save = React.useCallback(async () => {
    if (!hasContent || saving) return;
    setSaving(true);
    setErr(null);
    setSaved(false);
    try {
      const responses = {
        title,
        questions: questionPrompts.map((q, i) => ({ q, a: answers[i] ?? "" })),
        finalReflection: finalReflection.trim(),
      };
      const r = await fetch("/api/dear-me/day-reflection", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, locale, responses }),
      });
      const data: { letterId?: string; error?: string } = await r.json().catch(() => ({}));
      if (!r.ok || data.error) {
        setErr(isKo ? "저장에 실패했어요. 잠시 후 다시 시도해 주세요." : "Save failed. Please retry in a moment.");
        return;
      }
      setSaved(true);
    } catch {
      setErr(isKo ? "연결에 실패했어요." : "Connection failed.");
    } finally {
      setSaving(false);
    }
  }, [hasContent, saving, title, questionPrompts, answers, finalReflection, day, locale, isKo]);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    padding: "10px 12px",
    fontSize: 15,
    lineHeight: 1.5,
    resize: "vertical",
  };

  return (
    <section
      aria-label={isKo ? "Dear Me 성찰" : "Dear Me reflection"}
      style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid #eee" }}
    >
      {!open ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid #0d9488",
              background: "white",
              color: "#0f766e",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {isKo ? "✎ 오늘의 Dear Me 성찰" : "✎ Today's Dear Me reflection"}
          </button>
          {/* DECISION6 C2-5 + B-2: relocated from LEFT sidebar; ?day deep-links History. */}
          <a
            href={`/${locale}/center/letters?day=${day}`}
            style={{ fontSize: 12, color: "#0f766e", textDecoration: "none" }}
            aria-label={isKo ? "지난 Dear Me 기록 복습" : "Review past Dear Me entries"}
          >
            {isKo ? "지난 reflection 복습 →" : "Review past reflections →"}
          </a>
        </div>
      ) : (
        <div style={{ borderRadius: 16, border: "1px solid #e2e8f0", padding: 16, maxWidth: 560 }}>
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 16 }}>{title}</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 14 }}>
            {loading
              ? isKo ? "이전 기록을 불러오는 중…" : "Loading your previous entry…"
              : isKo ? "하나의 성찰로 마무리해요. 빈 칸은 비워둬도 괜찮아요." : "End with one reflection. Blank fields are fine."}
          </div>

          {questionPrompts.map((q, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <label
                htmlFor={`dr-q-${day}-${i}`}
                style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 600, color: "#334155" }}
              >
                {q}
              </label>
              <textarea
                id={`dr-q-${day}-${i}`}
                value={answers[i] ?? ""}
                onChange={(e) => setAnswer(i, e.target.value)}
                disabled={loading}
                rows={2}
                style={{ ...inputStyle, minHeight: 56 }}
              />
            </div>
          ))}

          <div style={{ marginBottom: 8 }}>
            <label
              htmlFor={`dr-final-${day}`}
              style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 700, color: "#0f172a" }}
            >
              {finalPrompt}
            </label>
            <textarea
              id={`dr-final-${day}`}
              value={finalReflection}
              onChange={(e) => {
                setFinalReflection(e.target.value);
                if (saved) setSaved(false);
              }}
              disabled={loading}
              rows={5}
              placeholder={isKo ? "여기에 통합 성찰을 적어보세요…" : "Write your integrated reflection here…"}
              style={{ ...inputStyle, minHeight: 110 }}
            />
          </div>

          {err ? (
            <p role="alert" style={{ margin: "10px 0 0", color: "#b91c1c", fontSize: 13 }}>
              {err}
            </p>
          ) : null}
          {saved ? (
            <p role="status" style={{ margin: "10px 0 0", color: "#0f766e", fontSize: 13, fontWeight: 600 }}>
              {isKo ? "Dear Me에 저장했어요." : "Saved to Dear Me."}
            </p>
          ) : null}

          <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer", fontSize: 14 }}
            >
              {isKo ? "닫기" : "Close"}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!canSave}
              style={{
                padding: "8px 18px",
                borderRadius: 10,
                border: "none",
                background: canSave ? "#0d9488" : "#94a3b8",
                color: "white",
                fontWeight: 700,
                cursor: canSave ? "pointer" : "not-allowed",
                fontSize: 14,
              }}
            >
              {saving ? (isKo ? "저장 중…" : "Saving…") : isKo ? `Day ${day} 성찰 저장` : `Save Day ${day} reflection`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
