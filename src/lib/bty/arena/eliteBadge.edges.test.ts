/**
 * Edge-case tests for eliteBadge (Arena 5차 — 미커버 1모듈).
 * 상수·반환 shape만 검증. 기존 동작만 검증, 비즈니스/XP 로직 변경 금지.
 */
import { describe, it, expect } from "vitest";
import {
  ELITE_BADGE_KINDS,
  getEliteBadgeGrants,
  type EliteBadgeGrant,
} from "./eliteBadge";

describe("eliteBadge (edges)", () => {
  it("ELITE_BADGE_KINDS is readonly and has weekly_elite only", () => {
    expect(ELITE_BADGE_KINDS).toHaveLength(1);
    expect(ELITE_BADGE_KINDS[0]).toBe("weekly_elite");
  });

  it("getEliteBadgeGrants(true) returns array with EliteBadgeGrant shape", () => {
    const grants = getEliteBadgeGrants(true);
    expect(grants).toHaveLength(1);
    const g = grants[0] as EliteBadgeGrant;
    expect(g).toHaveProperty("kind", "weekly_elite");
    expect(g).toHaveProperty("labelKey", "weekly_elite");
    expect(typeof g.kind).toBe("string");
    expect(typeof g.labelKey).toBe("string");
  });

  it("getEliteBadgeGrants(false) returns empty array reference consistency", () => {
    const a = getEliteBadgeGrants(false);
    const b = getEliteBadgeGrants(false);
    expect(a).toEqual([]);
    expect(b).toEqual([]);
    expect(a).toHaveLength(0);
  });

  it("getEliteBadgeGrants(true) returns new array each call", () => {
    const a = getEliteBadgeGrants(true);
    const b = getEliteBadgeGrants(true);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
