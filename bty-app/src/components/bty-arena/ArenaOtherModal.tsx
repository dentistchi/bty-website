"use client";

import React from "react";
import type { Locale } from "@/lib/i18n";
import { CardSkeleton } from "./CardSkeleton";

export type ArenaOtherModalProps = {
  locale: Locale | string;
  otherLabel: string;
  placeholder: string;
  cancelLabel: string;
  submitLabel: string;
  text: string;
  onChangeText: (value: string) => void;
  error: string | null;
  submitting: boolean;
  onSubmit: () => void;
  onClose: () => void;
};

export function ArenaOtherModal({
  locale, otherLabel, placeholder, cancelLabel, submitLabel,
  text, onChangeText, error, submitting, onSubmit, onClose,
}: ArenaOtherModalProps) {
  const isKo = locale === "ko";
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        role="presentation"
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }}
      />
      <div
        role="dialog"
        aria-label={otherLabel}
        style={{
          position: "relative", width: "min(640px, 92vw)",
          background: "white", borderRadius: 16, padding: 16,
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{otherLabel}</div>
        <textarea
          value={text}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          rows={3}
          style={{ width: "100%", padding: 10, borderRadius: 8, resize: "vertical", boxSizing: "border-box" }}
        />
        {error && (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#c00" }}>{error}</p>
        )}
        {submitting && (
          <div style={{ marginTop: 10 }} aria-busy="true" aria-label={isKo ? "제출 중…" : "Submitting…"}>
            <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
          <button
            type="button"
            onClick={onClose}
            aria-label={cancelLabel}
            style={{
              padding: "8px 16px", borderRadius: 8,
              border: "1px solid #e5e5e5", background: "white",
              cursor: "pointer", fontSize: 14,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onSubmit}
            aria-label={submitLabel}
            style={{
              padding: "8px 16px", borderRadius: 8,
              border: "none", background: "#111", color: "white",
              cursor: submitting ? "not-allowed" : "pointer",
              fontSize: 14, opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
