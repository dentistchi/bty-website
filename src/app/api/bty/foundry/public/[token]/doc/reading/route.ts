import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { recordReadingProgress } from "@/lib/bty/foundry/events/foundryDocumentService";
import { rateLimitKV, getCfClientIp } from "@/lib/rate-limit";
import { jsonNoStore, readParticipantSession, PUBLIC_REASON_STATUS } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/public/[token]/doc/reading — a throttled reading-progress
 * heartbeat. Body: { last_page, viewed_pages:number[], active_ms_delta }. The
 * server is canonical: distinct viewed pages are set-unioned (repeat views never
 * inflate), active time accumulates from a per-beat CLAMPED delta, and the reading
 * gate flips server-side. The client reports; it can never award completion or XP.
 * Rate-limited to bound write volume even though the client already batches (~10s).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonNoStore({ ok: false, error: "unavailable" }, 503);

  const rl = await rateLimitKV({
    endpoint: "foundry_doc_reading",
    identifier: getCfClientIp(req),
    limit: 30,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    const res = jsonNoStore({ ok: false, error: "rate_limited" }, 429);
    res.headers.set("Retry-After", String(rl.retryAfterSeconds));
    return res;
  }

  const { token } = await ctx.params;
  const session = readParticipantSession(req, token);
  const body = await req.json().catch(() => ({}));

  const r = await recordReadingProgress(admin, token, session, {
    last_page: body?.last_page,
    viewed_pages: body?.viewed_pages,
    active_ms_delta: body?.active_ms_delta,
  });
  if (!r.ok) return jsonNoStore({ ok: false, error: r.reason }, PUBLIC_REASON_STATUS[r.reason] ?? 400);
  return jsonNoStore({ ok: true, ...r.snapshot });
}
