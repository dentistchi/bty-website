import type { ReflectionEntry } from "@/features/growth/logic/types";

export type GrowthHistoryResponse = {
  reflections: ReflectionEntry[];
  recoveryTriggered: boolean;
};

export async function getGrowthHistory(): Promise<GrowthHistoryResponse> {
  const res = await fetch("/api/bty/growth/history", {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    const error = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(error?.error ?? "Failed to fetch growth history");
  }

  return res.json() as Promise<GrowthHistoryResponse>;
}
