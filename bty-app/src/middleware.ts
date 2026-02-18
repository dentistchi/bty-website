// bty-app/src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  // ✅ 임시: 모든 요청을 그대로 통과 (redirect/guard 전부 끔)
  return NextResponse.next();
}

// ✅ 정적 리소스/아이콘 등은 미들웨어 제외 (성능/오작동 방지)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
