/**
 * GET /api/arena/runs 페이지네이션 커서 (started_at + run_id 튜플, base64url JSON).
 * 디코드 검증 단일 소스: @/domain/rules/runsCursorValidation.
 */

import {
  parseRunsListCursorOrNull,
  type RunsListCursorPayload,
} from "@/domain/rules/runsCursorValidation";

export type RunsListCursor = RunsListCursorPayload;

export function encodeRunsCursor(row: { started_at: string; run_id: string }): string {
  const payload = JSON.stringify({ sa: row.started_at, rid: row.run_id });
  return Buffer.from(payload, "utf8").toString("base64url");
}

export function decodeRunsCursor(raw: string): { ok: true } & RunsListCursor | { ok: false } {
  const p = parseRunsListCursorOrNull(raw);
  if (!p) return { ok: false };
  return { ok: true, sa: p.sa, rid: p.rid };
}

/** PostgREST `.or()` 안전 이스케이프. */
export function postgrestOrRunsAfterCursor(sa: string, rid: string): string {
  const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `started_at.lt."${esc(sa)}",and(started_at.eq."${esc(sa)}",run_id.lt."${esc(rid)}")`;
}
