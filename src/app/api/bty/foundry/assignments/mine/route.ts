import { NextRequest } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { listMyAssignments } from "@/lib/bty/foundry/events/foundryLearnerAssignmentService";
import { jsonNoStore } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/assignments/mine — Slice 3.1B-3E.
 *
 * The authenticated learner reads THEIR OWN required-learning assignments for the
 * installed-app surface. Auth is REQUIRED (401 if absent). Identity is server-derived
 * from auth.getUser() and passed as the ONLY key to the service-role RPC — the client
 * submits no user id. The response carries only fields justified by the learner view;
 * the Room URL is composed from the minted join token + request origin (staging vs
 * prod, never localhost), so opening it stays same-origin inside the app WebView.
 *
 * Static top-level segment (not nested under a dynamic sibling) so an unauthenticated
 * hit resolves to 401, never a runtime 404 under the opennext-cloudflare router.
 */
export async function GET(req: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonNoStore({ ok: false, error: "unavailable" }, 503);

  const supa = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return jsonNoStore({ ok: false, error: "unauthenticated" }, 401);
  if (!(await isConsentCurrent(supa, user.id))) return consentRequiredResponse();

  const items = await listMyAssignments(admin, user.id);
  const origin = req.headers.get("origin") ?? req.nextUrl.origin;

  const assignments = items.map((a) => ({
    assignmentId: a.assignmentId,
    eventId: a.eventId,
    status: a.status,
    title: a.title,
    assignedAt: a.assignedAt,
    completedAt: a.completedAt,
    roomUrl: `${origin}/f/${a.joinToken}`,
    participationMode: a.participationMode,
  }));

  return jsonNoStore({ ok: true, assignments });
}
