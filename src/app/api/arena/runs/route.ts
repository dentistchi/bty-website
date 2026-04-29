import { NextRequest, NextResponse } from "next/server";
import { requireUser, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import {
  decodeRunsCursor,
  encodeRunsCursor,
  postgrestOrRunsAfterCursor,
} from "@/lib/bty/arena/runsCursor";
import { clampArenaRunsListLimit } from "@/domain/rules/arenaRunsListLimit";
import { isArenaRunsCursorOverMax } from "@/domain/rules/arenaRunsCursorMaxLength";

/**
 * GET /api/arena/runs — 사용자 **런 목록**(최근순, 페이지네이션 `limit`·`cursor`).
 *
 * @contract
 * - **Query:** `limit` 1–50(기본 10). **`cursor`** 선택 — 직전 응답 **`nextCursor`**(opaque URL-safe, **최대 512자**). 무세션 시 `cursor` 무시.
 * - **400 (로그인):** `{ error: "INVALID_CURSOR" }` — 디코드 실패·길이 초과·타인 런 앵커·본인 `arena_runs`에 없는 `run_id`.
 * - **249:** `cursor`는 클라이언트가 변조·재사용하지 말 것(서버가 앵커 검증).
 * - **200 (로그인):** `{ runs: { run_id, scenario_id, locale, started_at, status }[], nextCursor: string | null }` — 다음 페이지 없으면 **`nextCursor: null`**.
 * - **200 (무세션):** `{ runs: [], viewerAnonymous: true, message }` — **401 아님**; `nextCursor: null`.
 * - **401:** 본 라우트 미발행.
 * - **500:** `{ error: "DB_ERROR", detail }` — 로그인 상태에서 DB 조회 실패.
 * - **캐시:** 인증 응답 `private, no-store`.
 *
 * @see docs/spec/ARENA_DOMAIN_SPEC.md §4-1
 */
export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) {
    const out = NextResponse.json(
      {
        runs: [] as unknown[],
        nextCursor: null,
        viewerAnonymous: true,
        message:
          "Session not detected on this request. Past runs are hidden; refresh or sign in again.",
      },
      { status: 200 },
    );
    copyCookiesAndDebug(base, out, req, false);
    return out;
  }

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = clampArenaRunsListLimit(
    limitRaw !== null ? Number(limitRaw) : 10,
  );
  const fetchSize = limit + 1;

  const cursorParam = url.searchParams.get("cursor");
  const trimmedCursor = cursorParam?.trim() ?? "";

  if (trimmedCursor.length > 0) {
    if (isArenaRunsCursorOverMax(trimmedCursor)) {
      const out = NextResponse.json({ error: "INVALID_CURSOR" }, { status: 400 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    const decoded = decodeRunsCursor(trimmedCursor);
    if (!decoded.ok) {
      const out = NextResponse.json({ error: "INVALID_CURSOR" }, { status: 400 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }

    const { data: anchor, error: anchorErr } = await supabase
      .from("arena_runs")
      .select("started_at, run_id")
      .eq("user_id", user.id)
      .eq("run_id", decoded.rid)
      .maybeSingle();

    if (anchorErr || !anchor) {
      const out = NextResponse.json({ error: "INVALID_CURSOR" }, { status: 400 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }

    const row = anchor as { started_at: string; run_id: string };
    const { data, error } = await supabase
      .from("arena_runs")
      .select("run_id, scenario_id, locale, started_at, status")
      .eq("user_id", user.id)
      .or(postgrestOrRunsAfterCursor(row.started_at, row.run_id))
      .order("started_at", { ascending: false })
      .order("run_id", { ascending: false })
      .limit(fetchSize);

    if (error) {
      const out = NextResponse.json({ error: "DB_ERROR", detail: error.message }, { status: 500 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }

    const slice = (data ?? []).slice(0, limit);
    const nextCursor =
      (data ?? []).length > limit && slice.length > 0
        ? encodeRunsCursor(slice[slice.length - 1] as { started_at: string; run_id: string })
        : null;

    const out = NextResponse.json({ runs: slice, nextCursor });
    out.headers.set("Cache-Control", "private, no-store, max-age=0");
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const { data, error } = await supabase
    .from("arena_runs")
    .select("run_id, scenario_id, locale, started_at, status")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .order("run_id", { ascending: false })
    .limit(fetchSize);

  if (error) {
    const out = NextResponse.json({ error: "DB_ERROR", detail: error.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const slice = (data ?? []).slice(0, limit);
  const nextCursor =
    (data ?? []).length > limit && slice.length > 0
      ? encodeRunsCursor(slice[slice.length - 1] as { started_at: string; run_id: string })
      : null;

  const out = NextResponse.json({ runs: slice, nextCursor });
  out.headers.set("Cache-Control", "private, no-store, max-age=0");
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
