/**
 * Public quality health check (no auth).
 * Returns latest_event_at for end-to-end verification.
 */
import { NextResponse } from "next/server";

export const runtime = "edge";

const BTY_AI_URL = process.env.NEXT_PUBLIC_BTY_AI_URL || "http://localhost:4000";
const FETCH_TIMEOUT_MS = 5_000;

export async function GET() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(`${BTY_AI_URL}/api/quality/health`, {
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      {
        db_ok: false,
        total_events_30d: 0,
        latest_event_at: null,
        error: err instanceof Error ? err.message : "Backend unreachable",
      },
      { status: 503 }
    );
  }
}
