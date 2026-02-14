import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";

const BTY_AI_URL = process.env.NEXT_PUBLIC_BTY_AI_URL || "http://localhost:4000";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const FETCH_TIMEOUT_MS = 10_000;

const patchStub = { reports: [] };

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    clearTimeout(t);
    return res;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

async function proxy(
  req: NextRequest,
  method: string,
  params: { path?: string[] }
): Promise<NextResponse> {
  const admin = await requireAdminSession(req);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }
  const path = params.path?.join("/") || "";

  if (!ADMIN_API_KEY) {
    if (path.startsWith("recent")) return NextResponse.json(patchStub);
    if (method === "POST" && path.startsWith("generate")) {
      return NextResponse.json({ created: false, message: "Admin not configured" });
    }
    if (method === "POST" && path.startsWith("apply")) {
      return NextResponse.json({ error: "Admin not configured" }, { status: 500 });
    }
    return NextResponse.json(patchStub);
  }

  const url = `${BTY_AI_URL}/api/patch/${path}${req.nextUrl.search}`;
  try {
    const init: RequestInit = {
      method,
      headers: { "x-admin-api-key": ADMIN_API_KEY },
    };
    if (method === "POST") {
      (init.headers as Record<string, string>)["Content-Type"] = "application/json";
      init.body = JSON.stringify({});
    }
    const res = await fetchWithTimeout(url, init, FETCH_TIMEOUT_MS);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    if (path.startsWith("recent")) return NextResponse.json(patchStub);
    if (method === "POST") return NextResponse.json({ created: false });
    return NextResponse.json(patchStub);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { path?: string[] } }
) {
  return proxy(req, "GET", params);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { path?: string[] } }
) {
  return proxy(req, "POST", params);
}
