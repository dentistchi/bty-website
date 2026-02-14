import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth-server";

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json({
    user: { id: user.id, email: user.email ?? undefined },
  });
}
