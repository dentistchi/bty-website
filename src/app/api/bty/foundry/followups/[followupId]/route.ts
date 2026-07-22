import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getMyFollowupView } from "@/lib/bty/foundry/events/foundryFollowupService";
import { resolveUserTzContext } from "@/lib/bty/daily/userDay";
import { jsonNoStore } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/** Private learner data: `private, no-store` (mirrors the Today brief route), never shared-cacheable. */
function priv(body: unknown, status = 200) {
  const res = jsonNoStore(body, status);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

/**
 * GET /api/bty/foundry/followups/[followupId] — the authenticated learner reads THEIR OWN follow-up
 * obligation for the focused response surface (Slice 3.1B-3K). Auth REQUIRED (401). Owner-scoped via
 * the SECURITY DEFINER RPC — a foreign / not-owned id resolves to 404 (no disclosure). Carries no
 * private text (the obligation table has none). private, no-store.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ followupId: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return priv({ ok: false, error: "unavailable" }, 503);

  const supa = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return priv({ ok: false, error: "unauthenticated" }, 401);

  const { followupId } = await ctx.params;
  const { timezone } = await resolveUserTzContext(admin, user.id, req.nextUrl.searchParams.get("tz"));
  const view = await getMyFollowupView(admin, user.id, followupId, new Date(), timezone);
  if (!view) return priv({ ok: false, error: "not_found" }, 404);
  return priv({ ok: true, followup: view });
}
