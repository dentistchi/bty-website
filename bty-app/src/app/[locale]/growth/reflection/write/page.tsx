"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getLatestReflectionSeed as getLatestReflectionSeedFromApi } from "@/features/growth/api/getLatestReflectionSeed";
import { saveReflectionEntry } from "@/features/growth/api/saveReflectionEntry";
import {
  getLatestReflectionSeed as getLatestReflectionSeedLocal,
  pushReflection,
} from "@/features/growth/logic";
import type { ReflectionSeed } from "@/features/growth/logic/buildReflectionSeed";
import type { ReflectionEntry } from "@/features/growth/logic/types";
import ReflectionWritingScreen from "@/features/growth/reflection/ReflectionWritingScreen";

/** Structured reflection writing — persists via API (guests: local storage). */
export default function GrowthReflectionWritePage() {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale === "ko" ? "ko" : "en";
  const base = `/${locale}`;

  const [mounted, setMounted] = useState(false);
  const [seed, setSeed] = useState<ReflectionSeed | null>(null);

  useEffect(() => {
    setMounted(true);
    void getLatestReflectionSeedFromApi()
      .then((s) => setSeed(s))
      .catch(() => setSeed(getLatestReflectionSeedLocal()));
  }, []);

  const handleSave = async (entry: ReflectionEntry) => {
    try {
      await saveReflectionEntry({
        seedId: seed?.id,
        scenarioId: entry.scenarioId,
        focus: entry.focus,
        promptTitle: entry.promptTitle,
        promptBody: entry.promptBody,
        cue: entry.cue,
        answer1: entry.answer1,
        answer2: entry.answer2,
        answer3: entry.answer3,
        commitment: entry.commitment,
      });
    } catch {
      pushReflection(entry);
    }
    router.push(`${base}/growth/history`);
  };

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-500">
        …
      </div>
    );
  }

  return (
    <ReflectionWritingScreen
      locale={locale}
      seed={seed}
      onSave={handleSave}
      onReturnToArena={() => router.push(`${base}/bty-arena`)}
      onViewLeadershipState={() => router.push(`${base}/my-page`)}
    />
  );
}
