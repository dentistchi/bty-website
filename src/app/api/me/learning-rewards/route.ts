import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isConsentCurrent } from "@/lib/legal/activeConsent";
import { acknowledgeLearningAchievements, featureLearningBadge, getLearningRewards, learningRewardsEnabled, syncLearningRewards } from "@/lib/bty/learning-rewards/service.server";

export const dynamic = "force-dynamic";
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const input = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("sync") }).strict(),
  z.object({ operation: z.literal("feature"), badgeId: z.enum(["first", "circle", "second", "weeks", "patient", "clinical", "follow", "insight", "together", "return", "level10", "level50"]) }).strict(),
  z.object({ operation: z.literal("acknowledge"), achievementIds: z.array(z.string().min(1).max(80)).min(1).max(16) }).strict(),
]);

async function access(request: NextRequest) {
  const user = await requireUser(request);
  if (!user.ok) return { ok: false as const, response: reply({ ok: false, error: "ACCESS_REQUIRED" }, user.status) };
  const session = await getSupabaseServer();
  if (!(await isConsentCurrent(session, user.user.id))) return { ok: false as const, response: reply({ ok: false, error: "consent_required" }, 403) };
  return { ok: true as const, userId: user.user.id };
}

/** Read-only: no enrollment, historical reconciliation, timezone capture, or achievement receipts. */
export async function GET(request: NextRequest) {
  try {
    const auth = await access(request);
    if (!auth.ok) return auth.response;
    if (!learningRewardsEnabled()) return reply({ ok: true, enabled: false });
    const db = getSupabaseAdmin();
    if (!db) return reply({ ok: false, error: "UNAVAILABLE" }, 503);
    return reply({ ok: true, enabled: true, summary: await getLearningRewards(db, auth.userId) });
  } catch { return reply({ ok: false, error: "UNAVAILABLE" }, 503); }
}

/** Clients may ask for reconciliation or a cosmetic choice, never supply XP or completion facts. */
export async function POST(request: NextRequest) {
  try {
    const auth = await access(request);
    if (!auth.ok) return auth.response;
    if (!learningRewardsEnabled()) return reply({ ok: true, enabled: false });
    let action: z.infer<typeof input>;
    try {
      const body = await request.text();
      if (body.length > 4096) return reply({ ok: false, error: "TOO_LARGE" }, 413);
      action = input.parse(JSON.parse(body));
    } catch { return reply({ ok: false, error: "INVALID_INPUT" }, 400); }
    const db = getSupabaseAdmin();
    if (!db) return reply({ ok: false, error: "UNAVAILABLE" }, 503);
    if (action.operation === "feature") return reply({ ok: true, enabled: true, summary: await featureLearningBadge(db, auth.userId, action.badgeId) });
    if (action.operation === "acknowledge") return reply({ ok: true, enabled: true, summary: await acknowledgeLearningAchievements(db, auth.userId, action.achievementIds) });
    return reply({ ok: true, enabled: true, ...await syncLearningRewards(db, auth.userId) });
  } catch (error) {
    return error instanceof Error && ["BADGE_NOT_EARNED", "ACHIEVEMENT_NOT_EARNED"].includes(error.message)
      ? reply({ ok: false, error: error.message }, 409)
      : reply({ ok: false, error: "UNAVAILABLE" }, 503);
  }
}
