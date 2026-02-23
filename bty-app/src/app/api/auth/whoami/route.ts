import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const cookies = req.cookies.getAll();
  const res = NextResponse.json({
    ok: true,
    cookieCount: cookies.length,
    cookieNames: cookies.map((c) => c.name),
  });
  res.headers.set("x-auth-cookie-count", String(cookies.length));
  return res;
}
