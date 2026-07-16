import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { claimDocumentXp } from "@/lib/bty/foundry/events/foundryDocumentService";
import { jsonNoStore, readParticipantSession, PUBLIC_REASON_STATUS } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/public/[token]/doc/claim-xp — a participant who completed
 * a PDF Study Room anonymously claims their Core XP after signing in. Auth is
 * REQUIRED (unlike completion). Verifies the same participant session + a completed
 * progress row + XP-not-yet-awarded; awards via the canonical path; idempotent.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonNoStore({ ok: false, error: "unavailable" }, 503);

  const supa = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return jsonNoStore({ ok: false, error: "unauthenticated" }, 401);

  const { token } = await ctx.params;
  const session = readParticipantSession(req, token);
  const r = await claimDocumentXp(admin, token, session, user.id);
  if (!r.ok) return jsonNoStore({ ok: false, error: r.reason }, PUBLIC_REASON_STATUS[r.reason] ?? 400);
  return jsonNoStore({ ok: true, ...r.snapshot });
}
