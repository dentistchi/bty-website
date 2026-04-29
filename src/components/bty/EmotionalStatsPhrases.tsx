"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { EmptyState, CardSkeleton } from "@/components/bty-arena";
import { PhaseIIRing } from "@/components/bty/PhaseIIRing";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

/**
 * 감정 스탯 v3 표시 UI — render-only.
 * GET /api/emotional-stats/display 응답(phrases, phase)만 표시. API/도메인에서 계산된 값만 사용.
 * HEALING_COACHING_SPEC_V3 §9: Phase II일 때 PhaseIIRing(no numbers), 문구만.
 */

export type EmotionalStatsDisplayRes = { phrases?: string[]; phase?: "II" | null };

export function EmotionalStatsPhrases() {
  const [data, setData] = useState<EmotionalStatsDisplayRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const params = useParams();
  const locale = (typeof params?.locale === "string" && params.locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(locale).emotionalStats;

  useEffect(() => {
    let cancelled = false;
    setError(false);
    fetch("/api/emotional-stats/display", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((res: EmotionalStatsDisplayRes | null) => {
        if (cancelled) return;
        setData(res ?? { phrases: [], phase: null });
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <CardSkeleton lines={2} showLabel={true} />;
  }

  const phrases = Array.isArray(data?.phrases) ? data.phrases : [];
  const phase = data?.phase ?? null;

  return (
    <div className="rounded-xl border border-[var(--arena-text-soft)]/20 bg-[var(--arena-bg-soft)]/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-sm font-medium text-[var(--arena-text-soft)]">
          {t.sectionTitle}
        </p>
        {phase === "II" && <PhaseIIRing />}
      </div>
      {error && (
        <p className="text-xs text-[var(--arena-text-soft)] opacity-80">
          {t.errorLoad}
        </p>
      )}
      {!error && phrases.length === 0 && (
        <EmptyState icon="🌱" message={t.emptyMessage} style={{ padding: "20px 16px" }} />
      )}
      {!error && phrases.length > 0 && (
        <ul className="space-y-1 text-sm text-[var(--arena-text)]">
          {phrases.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
