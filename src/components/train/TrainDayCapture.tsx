"use client";

/**
 * DECISION6 (Unit1, 형태 A) — Train Day → Dear Me capture.
 *
 * Lightweight, self-contained composer rendered BELOW the lesson <article>.
 * Independent record-only path: POST /api/dear-me/letter with
 * { type:'reflection', source:'train', day, prompt }.
 *
 * 🔴 기록 ≠ 완료: this composer is fully decoupled from markTodayComplete /
 * the completion gate. Its own Save button, its own POST. A save failure never
 * blocks completion, and completion never triggers a save. No train-progression
 * code is touched here.
 */

import * as React from "react";

export default function TrainDayCapture({
  day,
  locale,
  prompt,
}: {
  day: number;
  locale: "ko" | "en";
  /** Optional seed/prompt text. DECISION6 STEP1: may be empty (auto-injection later). */
  prompt?: string;
}) {
  const isKo = locale === "ko";
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const canSave = text.trim().length > 0 && !saving;

  const save = React.useCallback(async () => {
    const body = text.trim();
    if (!body || saving) return;
    setSaving(true);
    setErr(null);
    setSaved(false);
    try {
      const r = await fetch("/api/dear-me/letter", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          letterText: body,
          lang: locale,
          type: "reflection",
          source: "train",
          day,
          prompt: prompt ?? "",
        }),
      });
      const data: { letterId?: string; error?: string } = await r.json().catch(() => ({}));
      if (!r.ok || data.error) {
        setErr(isKo ? "저장에 실패했어요. 잠시 후 다시 시도해 주세요." : "Save failed. Please retry in a moment.");
        return;
      }
      setText("");
      setSaved(true);
    } catch {
      setErr(isKo ? "연결에 실패했어요." : "Connection failed.");
    } finally {
      setSaving(false);
    }
  }, [text, saving, locale, day, prompt, isKo]);

  return (
    <section
      aria-label={isKo ? "Dear Me에 기록" : "Write to Dear Me"}
      style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid #eee" }}
    >
      {!open ? (
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
          {isKo ? "✎ Dear Me에 기록하기" : "✎ Write to Dear Me"}
        </button>
      ) : (
        <div style={{ borderRadius: 16, border: "1px solid #e2e8f0", padding: 16, maxWidth: 560 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            {isKo ? "오늘 나에게 한 줄" : "A note to myself today"}
          </div>
          {prompt ? (
            <p style={{ margin: "0 0 10px", fontSize: 14, color: "#475569", whiteSpace: "pre-wrap" }}>
              {prompt}
            </p>
          ) : null}
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (saved) setSaved(false);
            }}
            rows={6}
            placeholder={isKo ? "지금 떠오르는 것을 적어보세요…" : "Write whatever comes to mind…"}
            aria-label={isKo ? "Dear Me 기록 입력" : "Dear Me entry"}
            style={{
              width: "100%",
              boxSizing: "border-box",
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              padding: "12px 14px",
              fontSize: 15,
              lineHeight: 1.5,
              resize: "vertical",
              minHeight: 120,
            }}
          />

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
              {saving ? (isKo ? "저장 중…" : "Saving…") : isKo ? "저장" : "Save"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
