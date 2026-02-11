import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export const runtime = "edge";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  return NextResponse.json({
    user: { id: payload.sub, email: payload.email },
  });
}
