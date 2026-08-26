import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { completeGuidanceTraining, resolveGuidanceType } from "@/lib/bty/foundry/events/foundryGuidanceService";
import { jsonNoStore, readParticipantSession, PUBLIC_REASON_STATUS } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/public/[token]/guidance/complete — complete a guidance room
 * (Slice R4-R2G). Server-gated on the learner's own exposure declaration having been recorded,
 * and on the event being open; idempotent once complete. If the caller also holds an
 * authenticated BTY session, 10 Core XP is awarded through the SAME canonical path as YouTube
 * and PDF; if anonymous, completion is recorded and XP returned as claimable.
 *
 * Founder decision D1: the XP belongs to THIS full completion, never to the declaration alone.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonNoStore({ ok: false, error: "unavailable" }, 503);

  const { token } = await ctx.params;
  const contentType = await resolveGuidanceType(admin, token);
  if (!contentType) return jsonNoStore({ ok: false, error: "guidance_unavailable" }, 404);

  const session = readParticipantSession(req, token);

  // Optional auth detection (read-only) — anonymous completion is fully supported.
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
  const r = await completeGuidanceTraining(
    admin,
    token,
    session,
    contentType,
    body?.response_text,
    authUserId,
    body?.shared_response,
    body?.tz,
    body?.decision_response,
    body?.reflection_response,
  );
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
