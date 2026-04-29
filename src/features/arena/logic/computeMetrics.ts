import type { HiddenStat } from "@/domain/arena/scenarios";
import type { ArenaSignal, LeadershipMetrics } from "@/features/my-page/logic/types";

/** Read trait with legacy lowercase keys from older persisted signals. */
function trait(signal: ArenaSignal, stat: HiddenStat): number {
  const t = signal.traits;
  const direct = t[stat];
  if (direct !== undefined) return direct;
  const alt = (stat.charAt(0).toLowerCase() + stat.slice(1)) as string;
  const bag = signal.traits as Record<string, number | undefined>;
  return bag[alt] ?? 0;
}

/**
 * Cumulative metrics from Arena signals — used by My Page (interpreted, not shown as raw dumps in Arena).
 */
export function computeMetrics(signals: ArenaSignal[]): LeadershipMetrics {
  if (!signals.length) {
    return {
      xp: 0,
      AIR: 0,
      TII: 0,
      relationalBias: 0,
      operationalBias: 0,
      emotionalRegulation: 0,
      signalCount: 0,
    };
  }

  let xp = 0;
  let insightSum = 0;
  let communicationSum = 0;
  let integritySum = 0;
  let relationalSum = 0;
  let operationalSum = 0;
  let emotionalSum = 0;

  for (const signal of signals) {
    xp += 10 + signal.meta.emotionalRegulation * 5;

    insightSum += trait(signal, "Insight");
    communicationSum += trait(signal, "Communication");
    integritySum += trait(signal, "Integrity");

    relationalSum += signal.meta.relationalBias;
    operationalSum += signal.meta.operationalBias;
    emotionalSum += signal.meta.emotionalRegulation;
  }

  const count = signals.length;

  const AIR = (insightSum + communicationSum) / (2 * count);
  const TII = (integritySum + relationalSum) / (2 * count);

  return {
    xp,
    AIR,
    TII,
    relationalBias: relationalSum / count,
    operationalBias: operationalSum / count,
    emotionalRegulation: emotionalSum / count,
    signalCount: count,
  };
}
