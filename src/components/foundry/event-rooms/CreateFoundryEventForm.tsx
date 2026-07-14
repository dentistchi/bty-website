"use client";

import { useCallback, useRef, useState } from "react";
import type { Locale, EventRoomsCopy } from "./copy";
import { EVENT_ROOMS_COPY } from "./copy";
import type { ManagerSnapshot } from "./types";

/**
 * Create form — ONE input, one button (spec §5B). No date/place/category/goal/
 * headcount/AI. On success the parent routes straight into the control room so
 * the QR is visible immediately.
 */
export function CreateFoundryEventForm({
  locale,
  onCreated,
  onCancel,
}: {
  locale: Locale;
  onCreated: (snapshot: ManagerSnapshot) => void;
  onCancel: () => void;
}) {
  const t: EventRoomsCopy = EVENT_ROOMS_COPY[locale];
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const submittingRef = useRef(false);

  const onSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    if (title.trim().length < 1) {
      setError(true);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError(false);
    try {
      const res = await fetch("/api/bty/foundry/events", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.event) {
        onCreated(data as ManagerSnapshot);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [title, onCreated]);

  return (
    <div className="btyFadeIn flex flex-col gap-6">
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">
        {t.createEyebrow}
      </span>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit();
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-2">
          <span className="text-sm text-white/70">{t.nameLabel}</span>
          <input
            type="text"
            autoFocus
            enterKeyHint="done"
            maxLength={80}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError(false);
            }}
            placeholder={t.namePlaceholder}
            aria-label={t.nameLabel}
            aria-invalid={error}
            className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-base text-white placeholder:text-white/30 outline-none focus:border-[#C9A66B]/60"
          />
        </label>
        {error ? <p className="text-xs text-white/50">{t.titleError}</p> : null}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/12 px-4 py-3.5 text-sm font-medium text-white/60 transition-colors hover:text-white/90"
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-xl bg-[#C9A66B] px-4 py-3.5 text-base font-semibold text-[#0B1F3A] transition-opacity disabled:opacity-60"
          >
            {submitting ? t.creating : t.create}
          </button>
        </div>
      </form>
    </div>
  );
}
