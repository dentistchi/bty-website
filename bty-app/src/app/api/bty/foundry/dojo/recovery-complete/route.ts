/**
 * POST /api/bty/foundry/dojo/recovery-complete — mark `slip_recovery_tasks` complete when artifact verified (e.g. passed micro Dojo).
 */
import { NextRequest, NextResponse } from "next/server";
import { markRecoveryComplete } from "@/engine/integrity/slip-recovery.service";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  try {
    const body = (await req.json().catch(() => ({}))) as { taskId?: unknown };
    const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
    if (!taskId) {
      const res = NextResponse.json({ ok: false as const, error: "task_id_required" }, { status: 400 });
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }

    const out = await markRecoveryComplete(user.id, taskId);
    const status = out.ok ? 200 : out.error === "completion_not_verified" ? 409 : 400;
    const res = NextResponse.json(out, { status });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const res = NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
