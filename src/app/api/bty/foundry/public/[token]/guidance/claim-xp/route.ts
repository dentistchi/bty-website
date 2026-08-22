import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { claimGuidanceXp, resolveGuidanceType } from "@/lib/bty/foundry/events/foundryGuidanceService";
import { jsonNoStore, readParticipantSession, PUBLIC_REASON_STATUS } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/public/[token]/guidance/claim-xp — claim Core XP after an anonymous
 * guidance completion, once the participant has authenticated (Slice R4-R2G). Same shape and
 * same canonical XP path as the YouTube and PDF claims.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonNoStore({ ok: false, error: "unavailable" }, 503);

  const { token } = await ctx.params;
  const contentType = await resolveGuidanceType(admin, token);
  if (!contentType) return jsonNoStore({ ok: false, error: "guidance_unavailable" }, 404);

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
  if (!authUserId) return jsonNoStore({ ok: false, error: "no_session" }, 401);

  const session = readParticipantSession(req, token);
  const body = await req.json().catch(() => ({}));
  const r = await claimGuidanceXp(admin, token, session, contentType, authUserId, body?.tz);
  if (!r.ok) return jsonNoStore({ ok: false, error: r.reason }, PUBLIC_REASON_STATUS[r.reason] ?? 400);
  /*
    R4-R5C9A — the server's own materialization outcome; absent unless a Reality step is live.
    NOTE: this route serializes `assignment_claim` (snake) where its five siblings use
    `assignmentClaim` (camel). Pre-existing, out of scope, and deliberately left alone — the new
    field follows the SIBLINGS so the three clients can read one name.
  */
  return jsonNoStore({ ok: true, ...r.snapshot, assignment_claim: r.assignmentClaim ?? null, applyWindow: r.applyWindow });
}
