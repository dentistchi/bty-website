import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getLatestQuickIntent } from "@/lib/bty/arena/quickModeService";

export const runtime = "nodejs";

/** GET /api/arena/quick/state — return the most recent unfinished quick intent, if any. */
export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const intent = await getLatestQuickIntent(supabase, user.id);

  const out = NextResponse.json({
    ok: true,
    intentId: intent?.intentId ?? null,
    scenarioId: intent?.scenarioId ?? null,
  });
  copyCookiesAndDebug(base, out, req, false);
  return out;
}
