// ✅ 이걸로 바꿔
export const runtime = "edge"; // 또는 이 줄 자체를 제거(기본값 사용)

import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  const regionId = searchParams.get("regionId");

  return NextResponse.json({
    ok: true,
    orgId,
    regionId,
    note: "me/region route is alive",
  });
}
