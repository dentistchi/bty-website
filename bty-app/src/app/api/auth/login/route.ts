import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text().catch(() => "");
    // ✅ 여기서는 supabase 호출도 안 함. "요청이 진짜 도착했는지"만 확인.
    return NextResponse.json(
      {
        ok: false,
        where: "/api/auth/login POST (diag)",
        gotHere: true,
        method: req.method,
        url: req.url,
        contentType: req.headers.get("content-type"),
        hasCookieHeader: !!req.headers.get("cookie"),
        cookieHeaderFirst80: (req.headers.get("cookie") ?? "").slice(0, 80),
        bodyFirst200: bodyText.slice(0, 200),
      },
      { status: 418 } // 일부러 눈에 띄게
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        where: "/api/auth/login POST (diag catch)",
        error: e?.message ?? String(e),
        stack: e?.stack ?? null,
      },
      { status: 500 }
    );
  }
}
