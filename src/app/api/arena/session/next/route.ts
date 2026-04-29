import { NextRequest, NextResponse } from "next/server";
import { runArenaSessionNextCore } from "@/lib/bty/arena/arenaSessionNextCore";
import { getArenaPipelineDefault } from "@/lib/bty/arena/arenaPipelineConfig";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  /** `ENGINE_ARCHITECTURE_V1.md` §6.6 — deprecated under Pipeline N; fail loud for legacy clients. */
  if (getArenaPipelineDefault() === "new") {
    return NextResponse.json(
      {
        error: "arena_session_next_deprecated",
        message: "Use Pipeline N run/start and run/step APIs.",
      },
      { status: 410 },
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
    logHandlerLabel: "GET /api/arena/session/next",
  });

  const res = NextResponse.json(out.body, { status: out.status });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
