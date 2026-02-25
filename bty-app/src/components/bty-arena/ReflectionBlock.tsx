"use client";

import React from "react";

export type ReflectionBlockProps = {
  title?: string;
  /** When set, show single takeaway prompt + optional input + Next. Meaningful input can grant bonus XP. */
  reflectionPrompt?: string;
  options: string[];
  locale?: string;
  /** index and optional reflection text (for bonus XP when meaningful). */
  onSubmit: (index: number, reflectionText?: string) => void;
};

const NEXT_LABEL = { en: "Next", ko: "다음" };
const OPTIONAL_LABEL = { en: "Optional", ko: "옵션" };
const PLACEHOLDER_EN = "e.g. I'll pause before reacting next time.";
const PLACEHOLDER_KO = "예: 다음엔 반응하기 전에 한 번 멈춰 보겠다.";

export function ReflectionBlock({
  title = "Reflection",
  reflectionPrompt,
  options,
  locale = "en",
  onSubmit,
}: ReflectionBlockProps) {
  const [inputValue, setInputValue] = React.useState("");
  const nextLabel = locale === "ko" ? NEXT_LABEL.ko : NEXT_LABEL.en;
  const optionalLabel = locale === "ko" ? OPTIONAL_LABEL.ko : OPTIONAL_LABEL.en;
  const placeholder = locale === "ko" ? PLACEHOLDER_KO : PLACEHOLDER_EN;

  if (reflectionPrompt) {
    return (
      <div style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
        <p style={{ margin: "0 0 12px", lineHeight: 1.5, opacity: 0.9 }}>{reflectionPrompt}</p>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
            {optionalLabel}
          </label>
          <input
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
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gap: 10 }}>
        {options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => onSubmit(idx)}
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
