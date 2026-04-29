import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

/**
 * GET /api/me/region — orgId·regionId에 대한 멤버십 허용 여부.
 * Query: orgId, regionId (required). Response 200/403: { ok, allowed, userId, email, orgId, regionId, membership? }. Error: 400 missing params, 401 no session, 500.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  const regionId = url.searchParams.get("regionId");

  if (!orgId || !regionId) {
    return NextResponse.json(
      { ok: false, error: "missing orgId or regionId" },
      { status: 400 }
    );
  }

  const supabase = await getSupabaseServer();

  const { data: { user }, error: userErr } = await supabase.auth.getUser();

  if (userErr) {
    return NextResponse.json(
      { ok: false, error: "auth.getUser failed", detail: userErr.message },
      { status: 401 }
    );
  }

  if (!user) {
    return NextResponse.json(
      { ok: false, hasSession: false, error: "no session" },
      { status: 401 }
    );
  }

  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("id, user_id, org_id, region_id, status")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .eq("region_id", regionId)
    .eq("status", "active")
    .maybeSingle();

  if (memErr) {
    return NextResponse.json(
      { ok: false, error: "membership lookup failed", detail: memErr.message },
      { status: 500 }
    );
  }

  const allowed = !!membership;

  return NextResponse.json(
    {
      ok: true,
      allowed,
      userId: user.id,
      email: user.email ?? null,
      orgId,
      regionId,
      membership: allowed ? membership : null,
    },
    { status: allowed ? 200 : 403 }
  );
}
