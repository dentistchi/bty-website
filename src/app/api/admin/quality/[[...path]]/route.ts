import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/authz";

export const runtime = "nodejs";

const BTY_AI_URL = process.env.NEXT_PUBLIC_BTY_AI_URL || "http://localhost:4000";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const FETCH_TIMEOUT_MS = 10_000;

const qualityStub: Record<string, unknown> = {
  summary: {
    window: "7d",
    top_signatures: [],
    issue_frequencies: [],
    severity: { low: 0, medium: 0, high: 0 },
    avg_css: null,
    total_events: 0,
    breakdown: { role: [], route: [], intent: [] },
  },
  trends: { trends: [] },
};

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

async function guardAndProxy(
  req: NextRequest,
  params: { path?: string[] }
): Promise<NextResponse> {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const path = params.path?.join("/") || "";
  const pathKey = path.split("?")[0] || "summary";

  if (!ADMIN_API_KEY) {
    if (path.startsWith("summary") || !path) return NextResponse.json(qualityStub.summary);
    if (path.startsWith("trends")) return NextResponse.json(qualityStub.trends);
    if (path.startsWith("sample") || path.startsWith("seed"))
      return NextResponse.json({ error: "Backend not configured" }, { status: 500 });
    if (path.startsWith("health")) {
      return NextResponse.json({
        db_ok: false,
        total_events_30d: 0,
        latest_event_at: null,
        error: "Backend not configured",
      });
    }
    return NextResponse.json(qualityStub.summary);
  }

  const url = `${BTY_AI_URL}/api/quality/${path}${req.nextUrl.search}`;
  try {
    const init: RequestInit = {
      method: req.method,
      headers: { "x-admin-api-key": ADMIN_API_KEY },
    };
    if (req.method === "POST") {
      (init.headers as Record<string, string>)["Content-Type"] = "application/json";
      init.body = req.body ? await req.text() : "{}";
    }
    const res = await fetchWithTimeout(url, init, FETCH_TIMEOUT_MS);
    const data = await res.json();

    if (res.status === 401) {
      const msg =
        "ADMIN_API_KEY가 bty-ai-core .env와 일치하는지 확인하세요. (bty-app ↔ bty-ai-core 동일 값)";
      return NextResponse.json(
        { ...data, error: data.error || msg },
        { status: 401 }
      );
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Proxy failed";
    const isConnectionRefused =
      errMsg.includes("ECONNREFUSED") || errMsg.includes("fetch failed");
    const hint = isConnectionRefused
      ? `bty-ai-core 실행 확인: cd bty-ai-core && npm run dev (${BTY_AI_URL})`
      : errMsg;

    if (pathKey.includes("health")) {
      return NextResponse.json({
        db_ok: false,
        total_events_30d: 0,
        latest_event_at: null,
        error: hint,
      });
    }
    if (pathKey.includes("summary") || !pathKey) {
      return NextResponse.json(
        { error: hint, ...(qualityStub.summary as Record<string, unknown>) },
        { status: 502 }
      );
    }
    if (pathKey.includes("trends")) return NextResponse.json(qualityStub.trends);
    return NextResponse.json({ error: hint }, { status: 502 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const resolved = await params;
  return guardAndProxy(req, resolved);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const resolved = await params;
  return guardAndProxy(req, resolved);
}
