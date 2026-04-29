/**
 * `ENGINE_ARCHITECTURE_V1.md` §6.2 — `ARENA_PIPELINE_DEFAULT`.
 * Fail-safe: unset / invalid / empty → **legacy** (Pipeline L).
 */
export type ArenaPipelineDefault = "legacy" | "new";

export function getArenaPipelineDefault(): ArenaPipelineDefault {
  const raw = process.env.ARENA_PIPELINE_DEFAULT?.trim().toLowerCase();
  if (raw === "new") return "new";
  return "legacy";
}

/** Session scenario acquisition: Pipeline N must not call deprecated `session/next` (§6.3, §6.6). */
export function getArenaSessionRouterPath(pipeline: ArenaPipelineDefault): string {
  return pipeline === "new" ? "/api/arena/n/session" : "/api/arena/session/next";
}

/**
 * Client components: when `NEXT_PUBLIC_ARENA_PIPELINE_DEFAULT` matches server `ARENA_PIPELINE_DEFAULT`
 * (e.g. `new`), session fetches use `/api/arena/n/session`. If unset, **legacy** (safe default).
 */
export function getArenaPipelineDefaultForClient(): ArenaPipelineDefault {
  if (typeof process.env.NEXT_PUBLIC_ARENA_PIPELINE_DEFAULT === "string") {
    const v = process.env.NEXT_PUBLIC_ARENA_PIPELINE_DEFAULT.trim().toLowerCase();
    if (v === "new") return "new";
  }
  return "legacy";
}
