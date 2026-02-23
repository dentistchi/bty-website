import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";

export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

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
