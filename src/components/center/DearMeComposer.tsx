"use client";

/**
 * Center — Dear Me composer: GET `/api/bty/center/dear-me` (prompt + history), POST submit (100–1000자),
 * `dear_me_submitted` → {@link HealingPhaseTracker} reload; slip recovery on server when applicable.
 */

import { motion } from "framer-motion";
import React from "react";
import { DEAR_ME_SUBMITTED_EVENT } from "@/lib/bty/center/dearMeEvents";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type DearMeSubmittedDetail = {
  letterId?: string | null;
};

type PromptPayload = {
  prompt_type: string;
  healingPhase: string | null;
  letterCount: number;
  lastWrittenAt: string | null;
  recommendedAt: string;
};

type LetterRow = { id: string; title: string; written_at: string };

type GetJson =
  | {
      ok: true;
      prompt: PromptPayload;
      promptTextKo: string;
      letters: LetterRow[];
    }
  | { ok: false; error?: string };

type PostJson =
  | { ok: true; letterId?: string | null; reply?: string; prompt_type?: string }
  | { ok: false; error?: string };

function dispatchDearMeSubmitted(detail: DearMeSubmittedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DEAR_ME_SUBMITTED_EVENT, { detail }));
}

const MIN = 100;
const MAX = 1000;

export type DearMeComposerProps = {
  locale: Locale | string;
};

export function DearMeComposer({ locale }: DearMeComposerProps) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = getMessages(loc).center;

  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [promptTextKo, setPromptTextKo] = React.useState<string>("");
  const [promptType, setPromptType] = React.useState<string>("none");
  const [letters, setLetters] = React.useState<LetterRow[]>([]);
  const [body, setBody] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitErr, setSubmitErr] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [initialLoad, setInitialLoad] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoadErr(null);
    try {
      const r = await fetch("/api/bty/center/dear-me", { credentials: "include" });
      const j = (await r.json().catch(() => ({}))) as GetJson;
      if (!r.ok || !j.ok) {
        setLoadErr((j as { error?: string }).error ?? t.dearMeComposerLoadError);
        return;
      }
      setPromptTextKo(j.promptTextKo);
      setPromptType(j.prompt.prompt_type);
      setLetters(j.letters);
    } catch {
      setLoadErr(t.dearMeComposerLoadError);
    } finally {
      setInitialLoad(false);
    }
  }, [t.dearMeComposerLoadError]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const n = body.length;
  const canSubmit = n >= MIN && n <= MAX && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitErr(null);
    setSaved(false);
    try {
      const r = await fetch("/api/bty/center/dear-me", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, prompt_type: promptType }),
      });
      const j = (await r.json().catch(() => ({}))) as PostJson;
      if (!r.ok || !j.ok) {
        setSubmitErr(
          typeof j === "object" && j && "error" in j && typeof j.error === "string"
            ? j.error
            : t.dearMeComposerSubmitError,
        );
        return;
      }
      setBody("");
      setSaved(true);
      dispatchDearMeSubmitted({ letterId: j.letterId ?? null });
      await load();
    } catch {
      setSubmitErr(t.dearMeComposerSubmitError);
    } finally {
      setSubmitting(false);
    }
  };

  const charLabel = t.dearMeComposerCharCount.replace("{n}", String(n));

  if (initialLoad && !loadErr) {
    return (
      <section role="status" aria-busy="true" aria-label={t.dearMeComposerRegionAria}>
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>{t.letterHistoryLoading}</p>
      </section>
    );
  }

  return (
    <section role="region" aria-label={t.dearMeComposerRegionAria}>
      {loadErr ? (
        <p role="alert" style={{ margin: "0 0 12px", color: "#b91c1c", fontSize: 14 }}>
          {loadErr}
        </p>
      ) : null}

      <div
        style={{
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          background: "#fff",
          padding: "18px 18px 20px",
          maxWidth: 560,
        }}
      >
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 15,
            lineHeight: 1.55,
            color: "#0f172a",
            whiteSpace: "pre-wrap",
          }}
        >
          {promptTextKo || "…"}
        </p>

        <label htmlFor="dear-me-composer-body" style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 600, color: "#64748b" }}>
          {charLabel}
        </label>
        <textarea
          id="dear-me-composer-body"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (saved) setSaved(false);
          }}
          rows={8}
          style={{
            width: "100%",
            boxSizing: "border-box",
            borderRadius: 12,
            border: "1px solid #cbd5e1",
            padding: "12px 14px",
            fontSize: 15,
            lineHeight: 1.5,
            color: "#0f172a",
            resize: "vertical",
            minHeight: 160,
          }}
          aria-describedby="dear-me-composer-hint"
        />
        <p id="dear-me-composer-hint" style={{ margin: "8px 0 0", fontSize: 12, color: "#64748b" }}>
          {loc === "ko" ? `최소 ${MIN}자, 최대 ${MAX}자입니다.` : `Minimum ${MIN} and maximum ${MAX} characters.`}
        </p>

        {submitErr ? (
          <p role="alert" style={{ margin: "12px 0 0", color: "#b91c1c", fontSize: 13 }}>
            {submitErr}
          </p>
        ) : null}

        {saved ? (
          <div
            role="status"
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgba(13, 148, 136, 0.08)",
              border: "1px solid rgba(13, 148, 136, 0.25)",
            }}
          >
            <motion.svg
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              width={26}
              height={26}
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M5 13l4 4L19 7"
                stroke="#0d9488"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.svg>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#0f766e" }}>{t.dearMeComposerSaved}</span>
          </div>
        ) : null}

        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void onSubmit()}
            style={{
              fontSize: 14,
              fontWeight: 700,
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              cursor: canSubmit ? "pointer" : "not-allowed",
              background: canSubmit ? "#0d9488" : "#94a3b8",
              color: "#fff",
            }}
          >
            {submitting ? t.dearMeComposerSubmitting : t.dearMeComposerSubmit}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 28, maxWidth: 560 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
          {t.dearMeComposerPreviousTitle}
        </h2>
        {letters.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>{t.letterHistoryEmpty}</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {letters.map((row) => {
              const d = new Date(row.written_at);
              const dateStr = d.toLocaleDateString(loc === "ko" ? "ko-KR" : "en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <li
                  key={row.id}
                  style={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    padding: "12px 14px",
                    background: "#f8fafc",
                  }}
                >
                  <time dateTime={row.written_at} style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>
                    {dateStr}
                  </time>
                  <p style={{ margin: 0, fontSize: 14, color: "#334155", lineHeight: 1.45 }}>{row.title}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

export { DEAR_ME_SUBMITTED_EVENT };
