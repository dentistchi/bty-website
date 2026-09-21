import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { publicQuiz } from "@/lib/bty/foundry/events/quickTrainingQuizService";
import { jsonNoStore, readParticipantSession, PUBLIC_REASON_STATUS } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonNoStore({ ok: false, error: "unavailable" }, 503);
  const { token } = await ctx.params;
  const result = await publicQuiz(admin, token, readParticipantSession(req, token));
  if (!result.ok) return jsonNoStore({ ok: false, error: result.reason }, PUBLIC_REASON_STATUS[result.reason] ?? 404);
  return jsonNoStore(result);
}
