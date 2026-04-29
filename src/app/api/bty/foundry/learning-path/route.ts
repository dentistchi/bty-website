/**
 * GET /api/bty/foundry/learning-path — active path + program titles + completion (session user).
 * POST /api/bty/foundry/learning-path — {@link setLearningPath} `{ pathName }` (session user).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getActiveLearningPathWithPrograms,
  LEARNING_PATH_MAP,
  setLearningPath,
  type LearningPathName,
} from "@/engine/foundry/learning-path.service";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

function isPathName(x: string): x is LearningPathName {
  return Object.prototype.hasOwnProperty.call(LEARNING_PATH_MAP, x);
}

export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const requested = req.nextUrl.searchParams.get("userId")?.trim();
  if (requested && requested !== user.id) {
    const res = NextResponse.json({ ok: false as const, error: "FORBIDDEN" }, { status: 403 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  try {
    const supabase = await getSupabaseServerClient();
    const data = await getActiveLearningPathWithPrograms(user.id, { supabase });
    const res = NextResponse.json({ ok: true as const, ...data });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "learning_path_failed";
    const res = NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}

export async function POST(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const res = NextResponse.json({ ok: false as const, error: "INVALID_JSON" }, { status: 400 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  const raw = typeof body === "object" && body && "pathName" in body ? (body as { pathName?: unknown }).pathName : null;
  const pathName = typeof raw === "string" ? raw.trim() : "";
  if (!pathName || !isPathName(pathName)) {
    const res = NextResponse.json({ ok: false as const, error: "INVALID_PATH_NAME" }, { status: 400 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  try {
    const supabase = await getSupabaseServerClient();
    await setLearningPath(user.id, pathName, { supabase });
    const res = NextResponse.json({ ok: true as const });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "set_learning_path_failed";
    const res = NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
