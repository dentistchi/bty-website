"use client";

import React from "react";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { CardSkeleton } from "@/components/bty-arena";

export type ReflectionBlockProps = {
  title?: string;
  /** When set, show single takeaway prompt + optional input + Next. Meaningful input can grant bonus XP. */
  reflectionPrompt?: string;
  options: string[];
  locale?: Locale | string;
  /** index and optional reflection text (for bonus XP when meaningful). */
  onSubmit: (index: number, reflectionText?: string) => void;
  /** When true, show loading skeleton (e.g. reflection/reflect API in flight). */
  submitting?: boolean;
};

export function ReflectionBlock({
  title,
  reflectionPrompt,
  options,
  locale = "en",
  onSubmit,
  submitting = false,
}: ReflectionBlockProps) {
  const [inputValue, setInputValue] = React.useState("");
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;
  const displayTitle = title ?? t.reflectionTitle;
  const nextLabel = t.reflectionNext;
  const optionalLabel = t.reflectionOptional;
  const placeholder = t.reflectionPlaceholder;

  if (submitting) {
    return (
      <div style={{ marginTop: 14 }} aria-busy="true" aria-label={lang === "ko" ? "반영 중…" : "Submitting…"}>
        <CardSkeleton showLabel={false} lines={2} style={{ padding: "16px 20px" }} />
      </div>
    );
  }

  if (reflectionPrompt) {
    return (
      <div style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{displayTitle}</div>
        <p style={{ margin: "0 0 12px", lineHeight: 1.5, opacity: 0.9 }}>{reflectionPrompt}</p>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="reflection-optional-input" style={{ display: "block", fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
            {optionalLabel}
          </label>
          <input
            id="reflection-optional-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={placeholder}
            maxLength={120}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e5e5",
              fontSize: 14,
              boxSizing: "border-box",
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => onSubmit(0, inputValue.trim())}
          aria-label={nextLabel}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #111",
            background: "white",
            cursor: "pointer",
          }}
        >
          {nextLabel}
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 14 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{displayTitle}</div>
      <div style={{ display: "grid", gap: 10 }}>
        {options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => onSubmit(idx)}
            aria-label={opt}
            style={{
              textAlign: "left",
              padding: 12,
              borderRadius: 12,
              border: "1px solid #e5e5e5",
              background: "white",
              cursor: "pointer",
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
