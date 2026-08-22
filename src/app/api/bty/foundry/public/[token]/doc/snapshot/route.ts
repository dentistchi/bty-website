import { NextRequest } from "next/server";
import { resolveSuggestedTrainingName } from "@/domain/foundry/events/suggested-training-name";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getPublicDocumentSnapshot } from "@/lib/bty/foundry/events/foundryDocumentService";
import { jsonNoStore, readParticipantSession } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/public/[token]/doc/snapshot — the anonymous snapshot for a
 * PDF Study Room. Serves pre-join AND every stage (read/response/completed/
 * claimable). No auth. Never exposes owner id, internal event id, roster, storage
 * path, signed url, or another participant's response/reading. A returning visitor
 * is recognised via their per-event HttpOnly session cookie. The reflection prompt
 * is included only once the reading requirement is server-marked met (unlocked).
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

  const snapshot = await getPublicDocumentSnapshot(admin, token, session, authUserId, suggestedName);
  return jsonNoStore(snapshot);
}
