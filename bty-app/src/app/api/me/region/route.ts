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
