"use client";

import type { LeadershipMetrics, LeadershipState } from "@/features/my-page/logic/types";
import type { ReflectionEntry } from "@/features/growth/logic/types";
import { PremiumMyPageIdentityScreen } from "@/features/my-page/PremiumMyPageIdentityScreen";

export type MyPageLeadershipScreenProps = {
  locale: string;
  metrics: LeadershipMetrics;
  state: LeadershipState;
  mounted: boolean;
  reflections: ReflectionEntry[];
};

/**
 * Premium BTY identity console — thin wrapper around {@link PremiumMyPageIdentityScreen}.
 */
export function MyPageLeadershipScreen({
  locale,
  metrics,
  state,
  mounted,
  reflections,
}: MyPageLeadershipScreenProps) {
  return (
    <PremiumMyPageIdentityScreen
      locale={locale}
      metrics={metrics}
      state={state}
      mounted={mounted}
      reflections={reflections}
    />
  );
}
