/**
 * C6 241 — 주간 week_id(ISO) 정렬·Elite 멘토 큐 pending 정렬 엣지 (표시 순서는 API/서비스 단일 소스).
 */
import { describe, it, expect } from "vitest";

describe("241 weekly id + elite queue sort edges", () => {
  it("week_id ISO date strings sort chronologically under lexicographic order", () => {
    const ids = ["2026-03-17", "2026-03-10", "2026-03-24"];
    const sorted = [...ids].sort((a, b) => a.localeCompare(b));
    expect(sorted).toEqual(["2026-03-10", "2026-03-17", "2026-03-24"]);
  });

  it("elite mentor pending queue: ascending createdAt matches admin list expectation", () => {
    type Row = { id: string; createdAt: string; status: "pending" | "approved" };
    const rows: Row[] = [
      { id: "b", createdAt: "2026-02-02T10:00:00Z", status: "pending" },
      { id: "a", createdAt: "2026-02-01T08:00:00Z", status: "pending" },
      { id: "c", createdAt: "2026-02-03T12:00:00Z", status: "pending" },
    ];
    const sorted = [...rows].sort((x, y) => x.createdAt.localeCompare(y.createdAt));
    expect(sorted.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});
