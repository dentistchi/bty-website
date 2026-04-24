"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getGrowthHistory } from "@/features/growth/api/getGrowthHistory";
import GrowthHistoryScreen from "@/features/growth/history/GrowthHistoryScreen";
import { useArenaEntryResolution } from "@/lib/bty/arena/useArenaEntryResolution";
import { loadSignals } from "@/features/arena/logic";
import { loadReflections, shouldShowCompoundRecovery } from "@/features/growth/logic";
import type { ReflectionEntry } from "@/features/growth/logic/types";

/** Growth layer — structured reflection board (API; guests fall back to local). */
export default function GrowthHistoryPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale === "ko" ? "ko" : "en";
  const base = `/${locale}`;
  const { contract: arenaEntry } = useArenaEntryResolution(locale);

  const [mounted, setMounted] = useState(false);
  const [reflections, setReflections] = useState<ReflectionEntry[]>([]);
  const [recoveryTriggered, setRecoveryTriggered] = useState(false);

  useEffect(() => {
    setMounted(true);
    void getGrowthHistory()
      .then((data) => {
        setReflections(data.reflections);
        setRecoveryTriggered(data.recoveryTriggered);
      })
      .catch(() => {
        const list = loadReflections();
        setReflections(list);
        setRecoveryTriggered(shouldShowCompoundRecovery(loadSignals(), list));
      });
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-500">
        …
      </div>
    );
  }

  return (
    <GrowthHistoryScreen
      locale={locale}
      reflections={reflections}
      recoveryTriggered={recoveryTriggered}
      onOpenLatestReflection={() => router.push(`${base}/growth/reflection`)}
      onOpenRecovery={() => router.push(`${base}/growth/recovery`)}
      onReturnToArena={() => router.push(arenaEntry.href)}
      onBackToGrowth={() => router.push(`${base}/growth`)}
    />
  );
}
