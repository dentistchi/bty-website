import type { ReflectionSeed } from "@/features/growth/logic/buildReflectionSeed";

/**
 * Latest Arena-sourced reflection seed from Supabase (authenticated).
 */
export async function getLatestReflectionSeed(): Promise<ReflectionSeed | null> {
  const res = await fetch("/api/bty/growth/seeds/latest", {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    const error = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(error?.error ?? "Failed to fetch latest reflection seed");
  }

  const data = (await res.json()) as { seed: ReflectionSeed | null };
  return data.seed;
}
