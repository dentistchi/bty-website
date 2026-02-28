"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/bty-arena";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

/**
 * Fetches GET /api/emotional-stats/display and renders phrases only (no numbers).
 * SYSTEM_UPGRADE_PLAN_EMOTIONAL_STATS Phase F — UI는 문구만 표시.
 * PROJECT_BACKLOG §8: 빈 상태 시 일러/아이콘 + 한 줄 문구.
 */

type DisplayRes = { phrases?: string[] };

export function EmotionalStatsPhrases() {
  const [phrases, setPhrases] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const locale = (typeof params?.locale === "string" && params.locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(locale).emotionalStats;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/emotional-stats/display", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: DisplayRes | null) => {
        if (cancelled) return;
        setPhrases(Array.isArray(data?.phrases) ? data.phrases : []);
      })
      .catch(() => {
        if (!cancelled) setPhrases([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;

  if (phrases.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--arena-text-soft)]/20 bg-[var(--arena-bg-soft)]/50 p-4">
        <p className="text-sm font-medium text-[var(--arena-text-soft)] mb-2">
          {locale === "ko" ? "오늘의 성장" : "Today&apos;s growth"}
        </p>
        <EmptyState icon="🌱" message={t.emptyMessage} style={{ padding: "20px 16px" }} />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--arena-text-soft)]/20 bg-[var(--arena-bg-soft)]/50 p-4">
      <p className="text-sm font-medium text-[var(--arena-text-soft)] mb-2">
        {locale === "ko" ? "오늘의 성장" : "Today's growth"}
      </p>
      <ul className="space-y-1 text-sm text-[var(--arena-text)]">
        {phrases.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </div>
  );
}
