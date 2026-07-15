import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { listUserFoundryHistory, toThreadRecords } from "@/lib/bty/foundry/events/foundryHistoryService";
import { getOrGenerateLivingThread } from "@/lib/bty/foundry/events/livingThreadService";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/history/thread — generate (or restore) the caller's Living
 * Thread. A SIBLING of the history read: it never awards XP, never mutates
 * completion, and reads only the caller's own completed history (server-derived
 * user id). Idempotent per evidence fingerprint; provider failure yields the
 * deterministic fallback thread. Called by the client AFTER history has rendered,
 * only when the thread is eligible-but-not-yet-generated.
 */
export async function POST(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const admin = getSupabaseAdmin();
  if (!admin) {
    const res = NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  const items = await listUserFoundryHistory(admin, user.id);
  const result = await getOrGenerateLivingThread(admin, user.id, toThreadRecords(items));

  const res = NextResponse.json({
    ok: true,
    threadStatus: result.status,
    thread: result.status === "eligible" ? result.thread : null,
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
