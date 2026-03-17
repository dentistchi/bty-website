import { NextRequest, NextResponse } from "next/server";
import { requireUser, copyCookiesAndDebug } from "@/lib/supabase/route-client";

/**
 * GET /api/arena/runs
 * Query: limit (optional, 1–50, default 10).
 * Response (200) signed-in: { runs: { run_id, scenario_id, locale, started_at, status }[] }.
 * Response (200) no session: { runs: [], viewerAnonymous: true, message } (not 401 — empty state for Edge/cookie miss).
 * Error: 500 { error: "DB_ERROR", detail } when authenticated select fails.
 */
export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) {
    const out = NextResponse.json(
      {
        runs: [] as unknown[],
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
  const limit = Math.max(1, Math.min(50, Number(limitRaw ?? 10) || 10));

  const { data, error } = await supabase
    .from("arena_runs")
    .select("run_id, scenario_id, locale, started_at, status")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    const out = NextResponse.json({ error: "DB_ERROR", detail: error.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const out = NextResponse.json({ runs: data ?? [] });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
