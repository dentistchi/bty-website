import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { generateLivingReflection } from "@/lib/bty/foundry/events/livingReflectionService";
import { jsonNoStore, readParticipantSession, PUBLIC_REASON_STATUS } from "@/lib/bty/foundry/events/publicRoute";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/public/[token]/reflection — the AI Living Reflection.
 *
 * A SIBLING of the completion flow: it never awards XP, never mutates the
 * response/completion state, and only reads the caller's OWN completed progress
 * row. Body (optional): `{ completion_state?: "pass"|"review"|"incomplete",
 * locale?: "ko"|"en" }` — `completion_state` is the client-computed watch meaning
 * (ephemeral telemetry already reduced to a state); it is trusted only as one of
 * the three enum values. Idempotent: once generated, the stored reflection (the
 * user's history) is returned unchanged.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonNoStore({ ok: false, error: "unavailable" }, 503);

  const { token } = await ctx.params;
  const session = readParticipantSession(req, token);

  const body = (await req.json().catch(() => ({}))) as { completion_state?: unknown; locale?: unknown };

  const r = await generateLivingReflection(admin, token, session, body?.completion_state, body?.locale);
  if (!r.ok) return jsonNoStore({ ok: false, error: r.reason }, PUBLIC_REASON_STATUS[r.reason] ?? 400);

  return jsonNoStore({ ok: true, reflection: r.reflection, completion_state: r.completion_state });
}
