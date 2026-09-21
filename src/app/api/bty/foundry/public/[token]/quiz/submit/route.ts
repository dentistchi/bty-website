import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { submitPublicQuiz } from "@/lib/bty/foundry/events/quickTrainingQuizService";
import { jsonNoStore, readParticipantSession, PUBLIC_REASON_STATUS } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonNoStore({ ok: false, error: "unavailable" }, 503);
  const { token } = await ctx.params;
  let authUserId: string | null = null;
  try { const supa = await getSupabaseServerClient(); authUserId = (await supa.auth.getUser()).data.user?.id ?? null; } catch { /* anonymous is supported */ }
  const body = await req.json().catch(() => ({}));
  const result = await submitPublicQuiz(admin, token, readParticipantSession(req, token), authUserId, Array.isArray(body?.answers) ? body.answers : [], typeof body?.tz === "string" ? body.tz : null);
  if (!result.ok) return jsonNoStore({ ok: false, error: result.reason }, PUBLIC_REASON_STATUS[result.reason] ?? 400);
  return jsonNoStore(result);
}
