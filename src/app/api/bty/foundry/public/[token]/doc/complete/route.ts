import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { completeDocumentTraining } from "@/lib/bty/foundry/events/foundryDocumentService";
import { jsonNoStore, readParticipantSession, PUBLIC_REASON_STATUS } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/public/[token]/doc/complete — submit the reflection and
 * complete the PDF Study Room. Server-gated: requires the reading requirement to
 * be server-marked met and the event open (idempotent if already complete). If
 * the caller ALSO holds an authenticated BTY session, 10 Core XP is awarded
 * immediately (Case A); if anonymous, completion is recorded and XP returned as
 * claimable (Case B). Completion never requires login. Same XP path as YouTube.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonNoStore({ ok: false, error: "unavailable" }, 503);

  const { token } = await ctx.params;
  const session = readParticipantSession(req, token);

  // Optional auth detection (read-only) — anonymous is fully supported.
  let authUserId: string | null = null;
  try {
    const supa = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    authUserId = user?.id ?? null;
  } catch {
    authUserId = null;
  }

  const body = await req.json().catch(() => ({}));
  const r = await completeDocumentTraining(admin, token, session, body?.response_text, authUserId);
  if (!r.ok) return jsonNoStore({ ok: false, error: r.reason }, PUBLIC_REASON_STATUS[r.reason] ?? 400);
  return jsonNoStore({ ok: true, ...r.snapshot });
}
