import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { completeTraining } from "@/lib/bty/foundry/events/foundryTrainingService";
import { jsonNoStore, readParticipantSession, PUBLIC_REASON_STATUS } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/public/[token]/progress/complete — submit the completion
 * response. Server-gated: requires the video to be server-marked complete and the
 * event open (idempotent if already complete). If the caller ALSO holds an
 * authenticated BTY session, 10 Core XP is awarded immediately (Case A); if
 * anonymous, completion is recorded and XP is returned as claimable (Case B).
 * Completion never requires login.
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
  /*
    Three distinct answers, three distinct meanings (Slice 3.2R-R8B), identical to the document
    route:
      response_text       the completion check — what the learner will say. Private.
      shared_response     Host-visible Shared Understanding (3.1B-3G), when configured.
      reflection_response the journey's REFLECT question — what already happens. Private.
    Which of them are REQUIRED is decided by the service from the frozen event, never here and
    never by the client.
  */
  const r = await completeTraining(admin, token, session, body?.response_text, authUserId, body?.shared_response, body?.tz, body?.decision_response, body?.reflection_response);
  if (!r.ok) return jsonNoStore({ ok: false, error: r.reason }, PUBLIC_REASON_STATUS[r.reason] ?? 400);
    // R4-R5C9A — the server's own materialization outcome; absent unless a Reality step is live.
/*
    THE CODE HAS TO REACH THE PERSON WHO EARNED IT (Deferred Completion Claim V1-R2).

    This spread the snapshot and then hand-picked ONE extra field. `claimCode` lives on the result,
    not the snapshot, so it was minted, hashed, stored — and dropped here. Measured on the first
    controlled completion: `claim_secret_hash` NON-NULL, terminal blank, raw code gone for good.
    It is returned exactly once, to the learner who just completed anonymously, and to nobody else.
  */
  return jsonNoStore({
    ok: true,
    ...r.snapshot,
    applyWindow: r.applyWindow,
    claimCode: r.claimCode,
    claimExpiresAt: r.claimExpiresAt,
  });
}
