import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export const runtime = "edge";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    console.log("[auth/session] No token provided");
    return NextResponse.json({ user: null }, { status: 200 });
  }

  try {
    const payload = await verifyToken(token);
    if (!payload) {
      console.log("[auth/session] Token verification failed");
      return NextResponse.json({ user: null }, { status: 200 });
    }

    console.log("[auth/session] Valid session:", { id: payload.sub, email: payload.email });
    return NextResponse.json({
      user: { id: payload.sub, email: payload.email },
    });
  } catch (err) {
    console.error("[auth/session] Error:", err);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
