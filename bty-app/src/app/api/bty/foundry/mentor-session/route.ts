/**
 * GET /api/bty/foundry/mentor-session — Dr. Chi shell: healing phase, last Arena flag_type, recommendation presence.
 * Runs {@link buildMentorContext} + {@link injectExamplesIntoContext} server-side (same pipeline as POST /api/chat).
 */
import { NextRequest, NextResponse } from "next/server";
import { getRecommendations } from "@/engine/foundry/program-recommender.service";
import { injectExamplesIntoContext } from "@/engine/mentor/mentor-example-bank.service";
import { buildMentorContext, mentorContextToSystemPromptPrefix } from "@/engine/rag/mentor-context.service";
import { getLastChoiceFlagType } from "@/engine/scenario/scenario-stats.service";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  try {
    const lang = req.nextUrl.searchParams.get("lang") === "en" ? "en" : "ko";
    const mentorCtx = await injectExamplesIntoContext(await buildMentorContext(user.id, supabase), {
      locale: lang,
      supabase,
    });
    const preamble = mentorContextToSystemPromptPrefix(mentorCtx);
    const [lastFlagType, recs] = await Promise.all([
      getLastChoiceFlagType(user.id, supabase),
      getRecommendations(user.id, supabase),
    ]);

    const res = NextResponse.json({
      ok: true,
      phase: mentorCtx.phase,
      /** Non-zero when RAG preamble is non-empty (client may treat as session-ready). */
      contextReady: preamble.trim().length > 0,
      lastFlagType,
      unviewedRecommendationCount: recs.length,
      hasRecommendations: recs.length > 0,
    });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const res = NextResponse.json({ ok: false, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
