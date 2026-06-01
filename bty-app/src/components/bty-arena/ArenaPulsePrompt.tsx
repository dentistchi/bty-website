"use client";

import { useState } from "react";
import { getMessages } from "@/lib/i18n";

interface ArenaPulsePromptProps {
  locale: string;
  onSubmit: (value: number) => void;
  onSkip: () => void;
  submitted?: boolean;
}

const SCALE = [1, 2, 3, 4, 5] as const;

export default function ArenaPulsePrompt({
  locale,
  onSubmit,
  onSkip,
  submitted = false,
}: ArenaPulsePromptProps) {
  const lang = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;
  const [selected, setSelected] = useState<number | null>(null);

  if (submitted) {
    return (
      <div data-testid="arena-pulse-thanks" className="mt-4 text-sm opacity-80">
        {t.arenaPulseThanks}
      </div>
    );
  }

  return (
    <div data-testid="arena-pulse-prompt" className="mt-4 flex flex-col gap-2">
      <p data-testid="arena-pulse-question" className="text-sm font-medium">
        {t.arenaPulseQuestion}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-xs opacity-60">{t.arenaPulseLow}</span>
        {SCALE.map((v) => (
          <button
            key={v}
            type="button"
            data-testid={`arena-pulse-${v}`}
            aria-pressed={selected === v}
            onClick={() => setSelected(v)}
            className={
              "h-9 w-9 rounded-full border text-sm " +
              (selected === v ? "border-2 font-semibold" : "opacity-70")
            }
          >
            {v}
          </button>
        ))}
        <span className="text-xs opacity-60">{t.arenaPulseHigh}</span>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          data-testid="arena-pulse-submit"
          disabled={selected === null}
          onClick={() => selected !== null && onSubmit(selected)}
          className="rounded px-3 py-1 text-sm disabled:opacity-40"
        >
          {t.submit}
        </button>
        <button
          type="button"
          data-testid="arena-pulse-skip"
          onClick={onSkip}
          className="rounded px-3 py-1 text-sm opacity-70"
        >
          {t.arenaPulseSkipCta}
        </button>
      </div>
    </div>
  );
}
