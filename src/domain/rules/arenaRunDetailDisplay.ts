/**
 * Arena 런 상세 UI — 로딩·빈 상태 라벨 키(render-only). skeleton/empty 소비.
 */

export const ARENA_RUN_DETAIL_LOADING_DISPLAY_KEY = "arena.run_detail.loading" as const;
export const ARENA_RUN_DETAIL_EMPTY_DISPLAY_KEY = "arena.run_detail.empty" as const;

export type ArenaRunDetailSkeletonDisplayKey =
  | typeof ARENA_RUN_DETAIL_LOADING_DISPLAY_KEY
  | typeof ARENA_RUN_DETAIL_EMPTY_DISPLAY_KEY;

export function arenaRunDetailSkeletonDisplayKey(
  phase: "loading" | "empty"
): ArenaRunDetailSkeletonDisplayKey {
  return phase === "loading"
    ? ARENA_RUN_DETAIL_LOADING_DISPLAY_KEY
    : ARENA_RUN_DETAIL_EMPTY_DISPLAY_KEY;
}
