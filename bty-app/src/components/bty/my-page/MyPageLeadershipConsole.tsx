"use client";

import { useEffect, useMemo, useState } from "react";
import { computeMetrics, loadSignals } from "@/features/arena/logic";
import { loadReflections } from "@/features/growth/logic/reflectionStorage";
import type { ReflectionEntry } from "@/features/growth/logic/types";
import { getMyPageState } from "@/features/my-page/api/getMyPageState";
import { computeLeadershipState, mergeLeadershipReflectionLayer } from "@/features/my-page/logic";
import type { ArenaSignal, LeadershipMetrics, LeadershipState } from "@/features/my-page/logic/types";
import { MyPageLeadershipScreen } from "@/features/my-page/MyPageLeadershipScreen";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { locale: string };

/**
 * Signed-in: GET /api/bty/my-page/state. Guests: local `bty-signals` / `bty-reflections` + domain compute.
 */
export function MyPageLeadershipConsole({ locale }: Props) {
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).myPageStub;

  const [localSignals, setLocalSignals] = useState<ArenaSignal[]>([]);
  const [localReflections, setLocalReflections] = useState<ReflectionEntry[]>([]);
  const [mounted, setMounted] = useState(false);
  const [serverPack, setServerPack] = useState<{
    metrics: LeadershipMetrics;
    state: LeadershipState;
    reflections: ReflectionEntry[];
  } | null>(null);

  const loadLocal = () => {
    setServerPack(null);
    setLocalSignals(loadSignals());
    setLocalReflections(loadReflections());
  };

  const load = () => {
    void getMyPageState(locale)
      .then((data) => {
        setServerPack({
          metrics: data.metrics,
          state: data.leadershipState,
          reflections: data.reflections,
        });
      })
      .catch(loadLocal)
      .finally(() => setMounted(true));
  };

  useEffect(() => {
    load();
    const fallback = setTimeout(() => setMounted(true), 5_000);
    return () => clearTimeout(fallback);
  }, [locale]);

  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [locale]);

  const metrics = useMemo(() => {
    if (serverPack) return serverPack.metrics;
    return computeMetrics(localSignals);
  }, [serverPack, localSignals]);

  const state = useMemo(() => {
    if (serverPack) return serverPack.state;
    return mergeLeadershipReflectionLayer(
      computeLeadershipState(metrics, loc, localReflections),
      metrics,
      localSignals,
      loc,
      localReflections,
    );
  }, [serverPack, metrics, loc, localSignals, localReflections]);

  const reflectionsForUi = serverPack?.reflections ?? localReflections;

  return (
    <section
      data-testid="my-page-overview"
      role="region"
      aria-label={t.leadershipRegionAria}
      className="space-y-4"
    >
      <MyPageLeadershipScreen
        locale={locale}
        metrics={metrics}
        state={state}
        mounted={mounted}
        reflections={reflectionsForUi}
      />
    </section>
  );
}
