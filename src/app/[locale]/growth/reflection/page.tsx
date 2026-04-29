"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getGrowthHistory } from "@/features/growth/api/getGrowthHistory";
import { getLatestReflectionSeed as getLatestReflectionSeedFromApi } from "@/features/growth/api/getLatestReflectionSeed";
import { loadSignals } from "@/features/arena/logic";
import {
  getLatestReflectionSeed as getLatestReflectionSeedLocal,
  loadReflections,
  shouldShowCompoundRecovery,
} from "@/features/growth/logic";
import type { ReflectionSeed } from "@/features/growth/logic/buildReflectionSeed";
import ReflectionEntryScreen from "@/features/growth/reflection/ReflectionEntryScreen";
import { useArenaEntryResolution } from "@/lib/bty/arena/useArenaEntryResolution";

/** Arena → Growth reflection airlock — latest seed + recovery signal (API; guests fall back to local). */
export default function GrowthReflectionPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale === "ko" ? "ko" : "en";
  const base = `/${locale}`;
  const { contract: arenaEntry } = useArenaEntryResolution(locale);

  const [mounted, setMounted] = useState(false);
  const [seed, setSeed] = useState<ReflectionSeed | null>(null);
  const [recoveryTriggered, setRecoveryTriggered] = useState(false);

  useEffect(() => {
    setMounted(true);

    void (async () => {
      try {
        const [s, hist] = await Promise.all([getLatestReflectionSeedFromApi(), getGrowthHistory()]);
        setSeed(s);
        setRecoveryTriggered(hist.recoveryTriggered);
      } catch {
        setSeed(getLatestReflectionSeedLocal());
        setRecoveryTriggered(shouldShowCompoundRecovery(loadSignals(), loadReflections()));
      }
    })();
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-500">
        …
      </div>
    );
  }

  return (
    <ReflectionEntryScreen
      locale={locale}
      seed={seed}
      recoveryTriggered={recoveryTriggered}
      onOpenReflection={() => router.push(`${base}/growth/reflection/write`)}
      onOpenRecovery={() => router.push(`${base}/growth/recovery`)}
      onReturnToArena={() => router.push(arenaEntry.href)}
    />
  );
}
