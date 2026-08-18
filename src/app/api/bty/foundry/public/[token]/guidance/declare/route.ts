import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { declareGuidanceExposure, resolveGuidanceType } from "@/lib/bty/foundry/events/foundryGuidanceService";
import { jsonNoStore, readParticipantSession, PUBLIC_REASON_STATUS } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/public/[token]/guidance/declare — record the learner's own exposure
 * declaration (Slice R4-R2G): "I've read this guidance", or "I participated in this discussion".
 *
 * WHAT THIS IS NOT. It is not attendance, not verification, not observation, and not completion.
 * It awards no XP, materializes no follow-up obligation, and opens no apply window. It unlocks
 * the ordinary completion step and does nothing else.
 *
 * WHICH STAMP is decided by the room's own stored content type, resolved here from the signed
 * token — the request body carries nothing the server acts on.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonNoStore({ ok: false, error: "unavailable" }, 503);

  const { token } = await ctx.params;
  const contentType = await resolveGuidanceType(admin, token);
  if (!contentType) return jsonNoStore({ ok: false, error: "guidance_unavailable" }, 404);

  const session = readParticipantSession(req, token);
  const r = await declareGuidanceExposure(admin, token, session, contentType);
  if (!r.ok) return jsonNoStore({ ok: false, error: r.reason }, PUBLIC_REASON_STATUS[r.reason] ?? 400);
  return jsonNoStore({ ok: true, ...r.snapshot });
}
