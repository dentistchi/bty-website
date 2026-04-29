"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadSignals } from "@/features/arena/logic";
import { saveRecoveryEntry } from "@/features/growth/api/saveRecoveryEntry";
import { getMyPageState } from "@/features/my-page/api/getMyPageState";
import {
  buildRecoveryEntry,
  buildRecoveryPrompt,
  loadReflections,
  pushRecoveryEntry,
} from "@/features/growth/logic";
import type { RecoveryPrompt } from "@/features/growth/logic/recoveryTypes";
import RecoveryEntryScreen from "@/features/growth/recovery/RecoveryEntryScreen";
import { useArenaEntryResolution } from "@/lib/bty/arena/useArenaEntryResolution";

/** Recovery entry — API-backed save when signed in; local fallback for guests. */
export default function GrowthRecoveryPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale === "ko" ? "ko" : "en";
  const loc = locale === "ko" ? "ko" : "en";
  const base = `/${locale}`;
  const { contract: arenaEntry } = useArenaEntryResolution(loc);

  const [mounted, setMounted] = useState(false);
  const [prompt, setPrompt] = useState<RecoveryPrompt | null>(null);

  useEffect(() => {
    setMounted(true);
    void getMyPageState(locale)
      .then((data) => {
        setPrompt(buildRecoveryPrompt(data.signals, data.reflections, loc));
      })
      .catch(() => {
        setPrompt(buildRecoveryPrompt(loadSignals(), loadReflections(), loc));
      });
  }, [locale, loc]);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-500">
        …
      </div>
    );
  }

  return (
    <RecoveryEntryScreen
      locale={locale}
      prompt={prompt}
      onSave={async (payload) => {
        if (!prompt) return;
        try {
          await saveRecoveryEntry({
            source: prompt.source,
            reason: prompt.reason,
            promptTitle: prompt.title,
            promptBody: prompt.body,
            cue: prompt.cue,
            patternNote: payload.patternNote,
            resetAction: payload.resetAction,
            reentryCommitment: payload.reentryCommitment,
          });
        } catch {
          pushRecoveryEntry(buildRecoveryEntry(prompt, payload));
        }
        router.push(`${base}/growth/history`);
      }}
      onReturnToGrowth={() => router.push(`${base}/growth`)}
      onReturnToArena={() => router.push(arenaEntry.href)}
    />
  );
}
