/**
 * 로드맵·다음 연도 백로그 — 공통 타입.
 * Pure types only. C1·문서에서 참조.
 */

export type RoadmapItemStatus = "planned" | "in_progress" | "done" | "backlog";

/** 로드맵/백로그 항목 1개. */
export interface RoadmapItem {
  id?: string;
  title: string;
  quarter?: string | null;
  status?: RoadmapItemStatus | null;
}
