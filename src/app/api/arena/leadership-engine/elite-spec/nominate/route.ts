import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { handleEliteSpecNomination } from "@/engine/integration/elite-spec-flow";

export const runtime = "nodejs";

/**
 * POST /api/arena/leadership-engine/elite-spec/nominate — runs {@link handleEliteSpecNomination} for the session user.
 */
export async function POST(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const result = await handleEliteSpecNomination(user.id);
  const status = result.ok ? 200 : 500;
  const res = NextResponse.json(result, { status });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
