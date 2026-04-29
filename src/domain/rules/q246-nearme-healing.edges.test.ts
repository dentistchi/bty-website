/**
 * C6 246 — nearMe 슬라이스 연속성(리더보드 정렬 전제)·Healing 액트 순서 가드.
 */
import { describe, it, expect } from "vitest";
import {
  canCompleteHealingAwakeningAct,
  isHealingAwakeningCompletionHistoryValid,
} from "../healing";

/** API `leaderboard/route` 와 동일: myRank 1-based, 정렬된 배열의 연속 구간. */
function nearMeSlice<T>(sortedLeaderboard: T[], myRank1Based: number): T[] {
  return sortedLeaderboard.slice(
    Math.max(0, myRank1Based - 6),
    Math.min(sortedLeaderboard.length, myRank1Based + 6),
  );
}

describe("246 nearMe · Healing act order", () => {
  it("nearMe는 정렬 리더보드의 연속 구간이며 해당 순위 사용자를 포함", () => {
    const lb = Array.from({ length: 25 }, (_, i) => ({ user_id: `u${i}`, rank: i + 1 }));
    const myRank = 12;
    const me = lb[myRank - 1];
    const near = nearMeSlice(lb, myRank);
    expect(near).toContainEqual(me);
    const start = lb.findIndex((r) => r.user_id === near[0].user_id);
    expect(near).toEqual(lb.slice(start, start + near.length));
    expect(near.length).toBeLessThanOrEqual(13);
  });

  it("nearMe: 상위 N명 연속 — 경계에서도 단일 연속 slice", () => {
    const lb = ["a", "b", "c", "d", "e"];
    expect(nearMeSlice(lb, 1)).toEqual(lb.slice(0, Math.min(7, 5)));
    expect(nearMeSlice(lb, 5)).toEqual(lb.slice(0, 5));
  });

  it("Healing: act 2·3는 선행 완료 없이 완료 불가(스킵 방지)", () => {
    expect(canCompleteHealingAwakeningAct(2, [])).toBe(false);
    expect(canCompleteHealingAwakeningAct(3, [])).toBe(false);
    expect(canCompleteHealingAwakeningAct(3, [1])).toBe(false);
    expect(canCompleteHealingAwakeningAct(2, [1])).toBe(true);
    expect(canCompleteHealingAwakeningAct(3, [1, 2])).toBe(true);
  });

  it("Healing: 완료 이력은 반드시 1→2→3 순서(역순·건너뛰기 무효)", () => {
    expect(isHealingAwakeningCompletionHistoryValid([2, 1])).toBe(false);
    expect(isHealingAwakeningCompletionHistoryValid([1, 3])).toBe(false);
    expect(isHealingAwakeningCompletionHistoryValid([1, 2, 3])).toBe(true);
  });
});
