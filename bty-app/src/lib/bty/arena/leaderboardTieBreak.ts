/**
 * 리더보드 동점 시 결정적 정렬 규칙. 단일 소스.
 * Order: xp_total desc, 2차 updated_at asc, 3차 user_id asc.
 * 규칙 정의는 domain/rules/leaderboardTieBreak; 여기서는 DB 행 형태에 맞춰 도메인 호출.
 */

import {
  compareWeeklyXpTieBreak,
  LEADERBOARD_TIE_BREAK_ORDER,
} from "@/domain/rules/leaderboardTieBreak";

export const LEADERBOARD_ORDER_RULE = LEADERBOARD_TIE_BREAK_ORDER;

export interface LeaderboardRowForSort {
  user_id: string;
  xp_total?: number;
  updated_at?: string | null;
}

/**
 * Compare two leaderboard rows for deterministic sort.
 * Returns negative if a should come before b, positive if after, 0 if equal.
 * Delegates to domain compareWeeklyXpTieBreak (xp_total desc, updated_at asc, user_id asc).
 */
export function compareLeaderboardRows(
  a: LeaderboardRowForSort,
  b: LeaderboardRowForSort
): number {
  return compareWeeklyXpTieBreak(
    {
      weeklyXp: Number(a.xp_total ?? 0),
      updatedAt: a.updated_at ?? null,
      userId: a.user_id ?? "",
    },
    {
      weeklyXp: Number(b.xp_total ?? 0),
      updatedAt: b.updated_at ?? null,
      userId: b.user_id ?? "",
    }
  );
}
