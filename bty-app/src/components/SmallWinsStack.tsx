"use client";

import { useState, useCallback } from "react";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";

interface WinRecord {
  id: string;
  label: string;
  at: number;
}

function FlowerBloom({ onComplete, theme = "sanctuary" }: { onComplete: () => void; theme?: "dear" | "sanctuary" }) {
  const isDear = theme === "dear";
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
      <div
        className={cn(
          "w-16 h-16 rounded-full animate-bloom",
          isDear ? "bg-dear-terracotta/90" : "bg-sanctuary-flower/90"
        )}
        style={{ boxShadow: isDear ? "0 0 24px rgba(226, 114, 91, 0.5)" : "0 0 24px rgba(232, 180, 184, 0.6)" }}
        onAnimationEnd={onComplete}
      />
      <div
        className={cn(
          "absolute w-20 h-20 rounded-full animate-bloom [animation-delay:0.1s]",
          isDear ? "bg-dear-sage/30" : "bg-sanctuary-peach/40"
        )}
      />
    </div>
  );
}

export function SmallWinsStack({
  locale = "ko",
  theme = "sanctuary",
}: {
  locale?: Locale;
  theme?: "dear" | "sanctuary";
}) {
  const t = getMessages(locale).smallWins;
  const [wins, setWins] = useState<WinRecord[]>([]);
  const [bloomId, setBloomId] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const isDear = theme === "dear";

  const addWin = useCallback((label: string) => {
    setWins((prev) => [{ id: `win-${Date.now()}`, label, at: Date.now() }, ...prev]);
    setBloomId(`win-${Date.now()}`);
  }, []);

  const handleCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customText.trim();
    if (!trimmed) return;
    addWin(trimmed);
    setCustomText("");
  };

  return (
    <section
      className={cn(
        "relative overflow-hidden",
        !isDear && "rounded-2xl p-6 sm:p-8 bg-sanctuary-mint/50 border border-sanctuary-sage/50 shadow-sm"
      )}
      aria-labelledby="small-wins-heading"
    >
      <h2
        id="small-wins-heading"
        className={cn("text-xl font-medium mb-1", isDear ? "font-serif text-dear-charcoal" : "text-sanctuary-text")}
      >
        {t.title}
      </h2>
      <p className={cn("text-sm mb-6", isDear ? "text-dear-charcoal-soft" : "text-sanctuary-text-soft")}>
        {t.subtitle}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {t.suggested.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => addWin(label)}
            className={cn(
              "relative rounded-xl py-3 px-3 text-sm font-medium transition-colors overflow-hidden",
              isDear
                ? "bg-dear-bg border border-dear-charcoal/10 text-dear-charcoal hover:bg-dear-sage/15 hover:border-dear-sage/30"
                : "bg-white/80 border border-sanctuary-sage/40 text-sanctuary-text hover:bg-sanctuary-sage/30 hover:border-sanctuary-sage/60"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={handleCustom} className="flex gap-2 mb-6">
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder={t.customPlaceholder}
          className={cn(
            "flex-1 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition-colors",
            isDear
              ? "bg-dear-bg border border-dear-charcoal/12 placeholder:text-dear-charcoal-soft/80 text-dear-charcoal focus:ring-dear-sage/50"
              : "bg-white/80 border border-sanctuary-sage/40 placeholder:text-sanctuary-text-soft/70 text-sanctuary-text focus:ring-sanctuary-sage/50"
          )}
        />
        <button
          type="submit"
          disabled={!customText.trim()}
          className={cn(
            "px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
            isDear
              ? "bg-dear-sage text-white hover:bg-dear-sage-soft"
              : "bg-sanctuary-sage/80 text-sanctuary-text hover:bg-sanctuary-sage"
          )}
        >
          {t.add}
        </button>
      </form>
      {bloomId && <FlowerBloom onComplete={() => setBloomId(null)} theme={theme} />}
      {wins.length > 0 && (
        <div className="space-y-2">
          <p className={cn("text-sm", isDear ? "text-dear-charcoal-soft" : "text-sanctuary-text-soft")}>
            {t.count} {wins.length}
          </p>
          <ul className="space-y-1">
            {wins.slice(0, 10).map((w) => (
              <li
                key={w.id}
                className={cn(
                  "flex items-center gap-2 py-2 px-3 rounded-lg",
                  isDear
                    ? "bg-dear-bg border border-dear-charcoal/10"
                    : "bg-white/60 border border-sanctuary-sage/30"
                )}
              >
                <span
                  className={cn("w-2 h-2 rounded-full flex-shrink-0", isDear ? "bg-dear-terracotta" : "bg-sanctuary-flower")}
                  aria-hidden
                />
                <span className={isDear ? "text-dear-charcoal" : "text-sanctuary-text"}>{w.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
