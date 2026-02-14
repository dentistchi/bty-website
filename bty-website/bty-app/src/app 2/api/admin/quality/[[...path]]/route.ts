import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";

const BTY_AI_URL = process.env.NEXT_PUBLIC_BTY_AI_URL || "http://localhost:4000";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

async function guardAndProxy(
  req: NextRequest,
  params: { path?: string[] }
): Promise<NextResponse> {
  const admin = await requireAdminSession(req);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }
  if (!ADMIN_API_KEY) {
    return NextResponse.json({ error: "Admin not configured" }, { status: 500 });
  }
  const path = params.path?.join("/") || "";
  const url = `${BTY_AI_URL}/api/quality/${path}${req.nextUrl.search}`;
  try {
    const res = await fetch(url, {
      headers: { "x-admin-api-key": ADMIN_API_KEY },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Proxy failed" },
      { status: 502 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { path?: string[] } }
) {
  return guardAndProxy(req, params);
}
