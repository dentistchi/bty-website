import { NextRequest, NextResponse } from "next/server";
import { runArenaSessionNextCore } from "@/lib/bty/arena/arenaSessionNextCore";
import { getArenaPipelineDefault } from "@/lib/bty/arena/arenaPipelineConfig";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

/**
 * Pipeline N scenario acquisition (`ENGINE_ARCHITECTURE_V1.md` §6.3).
 * Same selection semantics as legacy `session/next`, without calling the deprecated route from clients.
 */
export async function GET(req: NextRequest) {
  if (getArenaPipelineDefault() !== "new") {
    return NextResponse.json(
      {
        error: "arena_n_session_requires_new_pipeline",
        message: "Set ARENA_PIPELINE_DEFAULT=new to use this endpoint.",
      },
      { status: 403 },
    );
  }

  const { user, base, supabase } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const raw = req.nextUrl.searchParams.get("locale");
  const locale = raw === "ko" ? "ko" : "en";

  const runIdParam = req.nextUrl.searchParams.get("runId");
  const runId =
    typeof runIdParam === "string" && runIdParam.trim() !== "" ? runIdParam.trim() : null;

  const out = await runArenaSessionNextCore({
    userId: user.id,
    locale,
    supabase,
    runIdParam: runId,
    logHandlerLabel: "GET /api/arena/n/session",
  });

  const res = NextResponse.json(out.body, { status: out.status });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
