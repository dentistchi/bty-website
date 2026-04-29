import { NextRequest, NextResponse } from "next/server";
import {
  getProgramProgress,
  markProgramComplete,
  recordProgramSelected,
  setProgramCompletionPct,
  updateProgramProgress,
  PROGRAM_COMPLETED_EVENT,
  type ProgramCompletedDetail,
} from "@/engine/foundry/program-completion.service";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

/**
 * GET ?programId= — current row for the session user.
 * POST `{ action: 'select' | 'set_pct' | 'complete', programId, completionPct? }`.
 */
export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const programId = req.nextUrl.searchParams.get("programId")?.trim() ?? "";
  if (!programId) {
    const res = NextResponse.json({ ok: false, error: "MISSING_PROGRAM_ID" }, { status: 400 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  try {
    const supabase = await getSupabaseServerClient();
    const progress = await getProgramProgress(user.id, programId, supabase);
    const res = NextResponse.json({ ok: true, progress });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    const res = NextResponse.json({ ok: false, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}

export async function POST(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: {
    action?: unknown;
    programId?: unknown;
    completionPct?: unknown;
    /** Delta for `action: 'update'` (increment). */
    pct?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    const res = NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  const action = typeof body.action === "string" ? body.action.trim() : "";
  const programId = typeof body.programId === "string" ? body.programId.trim() : "";
  if (!programId) {
    const res = NextResponse.json({ ok: false, error: "MISSING_PROGRAM_ID" }, { status: 400 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  try {
    const supabase = await getSupabaseServerClient();
    if (action === "select") {
      const progress = await recordProgramSelected(user.id, programId, supabase);
      const res = NextResponse.json({ ok: true, progress });
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }

    if (action === "set_pct") {
      const raw = body.completionPct;
      const completionPct = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(completionPct)) {
        const res = NextResponse.json({ ok: false, error: "INVALID_COMPLETION_PCT" }, { status: 400 });
        copyCookiesAndDebug(base, res, req, true);
        return res;
      }
      const out = await setProgramCompletionPct(user.id, programId, completionPct, supabase);
      if ("foundry" in out) {
        const detail: ProgramCompletedDetail = {
          userId: user.id,
          programId,
          completedAt: out.progress.completed_at ?? new Date().toISOString(),
        };
        const res = NextResponse.json({
          ok: true,
          ...out,
          programCompletedEvent: PROGRAM_COMPLETED_EVENT,
          programCompletedDetail: detail,
        });
        copyCookiesAndDebug(base, res, req, true);
        return res;
      }
      const res = NextResponse.json({ ok: true, ...out });
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }

    if (action === "update") {
      const raw = body.pct ?? body.completionPct;
      const delta = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(delta)) {
        const res = NextResponse.json({ ok: false, error: "INVALID_PCT_DELTA" }, { status: 400 });
        copyCookiesAndDebug(base, res, req, true);
        return res;
      }
      const completed = await updateProgramProgress(user.id, programId, delta, { supabase });
      if (completed) {
        const detail: ProgramCompletedDetail = {
          userId: user.id,
          programId,
          completedAt: completed.progress.completed_at ?? new Date().toISOString(),
        };
        const res = NextResponse.json({
          ok: true,
          ...completed,
          programCompletedEvent: PROGRAM_COMPLETED_EVENT,
          programCompletedDetail: detail,
        });
        copyCookiesAndDebug(base, res, req, true);
        return res;
      }
      const progress = await getProgramProgress(user.id, programId, supabase);
      const res = NextResponse.json({ ok: true, progress });
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }

    if (action === "complete") {
      const out = await markProgramComplete(user.id, programId, { supabase });
      const detail: ProgramCompletedDetail = {
        userId: user.id,
        programId,
        completedAt: out.progress.completed_at ?? new Date().toISOString(),
      };
      const res = NextResponse.json({
        ok: true,
        ...out,
        programCompletedEvent: PROGRAM_COMPLETED_EVENT,
        programCompletedDetail: detail,
      });
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }

    const res = NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    const res = NextResponse.json({ ok: false, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
