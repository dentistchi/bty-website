import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const runtime = "edge";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  const regionId = url.searchParams.get("regionId");

  // 0) 입력값 체크
  if (!orgId || !regionId) {
    return NextResponse.json(
      { ok: false, error: "missing orgId or regionId" },
      { status: 400 }
    );
  }

  // 1) 세션에서 user 가져오기 (쿠키 기반)
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

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

  // 2) memberships로 권한 판단 (active 멤버십 존재 여부)
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

  // 3) 프론트가 바로 쓸 수 있게 응답
  // allowed=false면 403으로 내려주는 게 디버깅/보안 모두 깔끔함
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
