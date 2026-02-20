import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get("next") || "/bty";
  const url = new URL(next, req.url);

  // 303: POST 이후에도 안전하게 GET으로 전환되도록
  return NextResponse.redirect(url, 303);
}
