"use client";

import { useCallback, useRef, useState } from "react";
import type { Locale, EventRoomsCopy } from "./copy";
import { EVENT_ROOMS_COPY } from "./copy";
import type { ManagerSnapshot } from "./types";

/**
 * Create form — THREE inputs (event name, YouTube link, completion question),
 * one button (spec §8). No date/place/category/goal/headcount/AI, no XP input
 * (system-fixed award). Field-level errors. On success the parent routes straight
 * into the control room so the QR is visible immediately.
 */
type FieldError = null | "title" | "youtube" | "prompt";

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
  const [youtube, setYoutube] = useState("");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<FieldError>(null);
  const submittingRef = useRef(false);

  const onSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    if (title.trim().length < 1) return setError("title");
    if (youtube.trim().length < 1) return setError("youtube");
    if (prompt.trim().length < 1) return setError("prompt");

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bty/foundry/events", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          youtube_url: youtube.trim(),
          completion_prompt: prompt.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.event) {
        onCreated(data as ManagerSnapshot);
      } else if (data?.error === "youtube_url_invalid") {
        setError("youtube");
      } else if (data?.error === "prompt_required" || data?.error === "prompt_too_long") {
        setError("prompt");
      } else {
        setError("title");
      }
    } catch {
      setError("title");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [title, youtube, prompt, onCreated]);

  const field = (
    label: string,
    value: string,
    setValue: (v: string) => void,
    placeholder: string,
    key: Exclude<FieldError, null>,
    max: number,
    errorMsg: string,
    autoFocus = false,
  ) => (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-white/70">{label}</span>
      <input
        type="text"
        autoFocus={autoFocus}
        maxLength={max}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error === key) setError(null);
        }}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={error === key}
        className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-base text-white placeholder:text-white/30 outline-none focus:border-[#C9A66B]/60"
      />
      {error === key ? <span className="text-xs text-white/50">{errorMsg}</span> : null}
    </label>
  );

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
        {field(t.nameLabel, title, setTitle, t.namePlaceholder, "title", 80, t.titleError, true)}
        {field(t.youtubeLabel, youtube, setYoutube, t.youtubePlaceholder, "youtube", 400, t.youtubeError)}
        {field(t.promptLabel, prompt, setPrompt, t.promptPlaceholder, "prompt", 300, t.promptError)}
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
