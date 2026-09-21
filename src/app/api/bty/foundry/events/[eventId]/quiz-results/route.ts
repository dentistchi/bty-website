import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";

export const runtime = "nodejs";

/** Owner-only factual quiz projection. It intentionally excludes raw answers. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  const gate = await requireManager(req); if (!gate.ok) return gate.response;
  const { eventId } = await ctx.params; const { admin, user, base } = gate.ctx;
  const { data: event } = await admin.from("foundry_events").select("id").eq("id", eventId).eq("owner_user_id", user.id).maybeSingle();
  if (!event) return managerJson(base, req, { error: "not_found" }, 404);
  const { data: attempts } = await admin.from("foundry_event_quiz_attempts").select("participant_id,correct_count,total_count,submitted_at").eq("event_id", eventId);
  const rows = attempts ?? [];
  const averageScore = rows.length ? Math.round(rows.reduce((sum, row) => sum + (row.correct_count * 100) / row.total_count, 0) / rows.length) : null;
  return managerJson(base, req, { submitted: rows.length, averageScore, byParticipant: Object.fromEntries(rows.map((row) => [row.participant_id, { correctCount: row.correct_count, totalCount: row.total_count, submittedAt: row.submitted_at }])) });
}
