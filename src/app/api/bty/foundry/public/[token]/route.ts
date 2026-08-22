import { NextRequest } from "next/server";
import { resolveSuggestedTrainingName } from "@/domain/foundry/events/suggested-training-name";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getPublicTrainingSnapshot } from "@/lib/bty/foundry/events/foundryTrainingService";
import { jsonNoStore, readParticipantSession } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/public/[token] — the anonymous training snapshot for the
 * QR landing page. Serves pre-join AND every training stage (watch/response/
 * completed/claimable). No auth. Never exposes owner id, internal event id,
 * roster, or another employee's response. A returning visitor is recognised via
 * their per-event HttpOnly session cookie. The completion prompt is included
 * only once the video is server-marked complete (unlocked).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonNoStore({ error: "unavailable" }, 503);

  const { token } = await ctx.params;
  const session = readParticipantSession(req, token);
  /*
    OPTIONAL AUTH — the same read the three completion routes already ship (R4-R5C3A1).
    This route stays PUBLIC: no 401 gate, an anonymous caller resolves to null, and any failure
    degrades to null. It exists so the server can tell whether this browser's participant belongs
    to the account that is actually signed in (account-switch containment).
  */
  /*
    R4-R5C7A — the PREFILL suggestion, derived here and only here. The same optional-auth read
    already in place; we now also look at the metadata it returns. Nothing is sent by the browser
    to obtain it, and it authorises nothing.
  */
  let suggestedName: string | null = null;
  let authUserId: string | null = null;
  try {
    const supa = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    authUserId = user?.id ?? null;
    suggestedName = resolveSuggestedTrainingName(user?.user_metadata as Record<string, unknown> | null | undefined);
  } catch {
    authUserId = null;
    suggestedName = null;
  }

  const snapshot = await getPublicTrainingSnapshot(admin, token, session, authUserId, suggestedName);
  return jsonNoStore(snapshot);
}
