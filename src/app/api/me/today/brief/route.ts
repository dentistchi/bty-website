/**
 * /api/me/today/brief — the Today Personal Brief (Slice 3.1B-3J).
 *
 * OWNER-SCOPED. Composes, server-side: (1) a deterministic reminder projection over canonical
 * system truth, and (2) an OPTIONAL consent-gated assistive AI sentence pair (observation +
 * suggestion) derived only from yesterday's private reflections. The raw Reflection body NEVER
 * leaves the server — the client receives only the generated sentences + reminder DTOs + the
 * consent flag needed to render. private, no-store. AI can never add/remove/reprioritize a reminder.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveUserTzContext } from "@/lib/bty/daily/userDay";
import { buildTodayReminders } from "@/lib/bty/daily/todayReminders.server";
import { composeTodayBrief } from "@/lib/bty/daily/todayBrief.server";

export const dynamic = "force-dynamic";

const noStore = (res: NextResponse) => {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
};

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return noStore(NextResponse.json({ ok: false, code: "UNAUTHENTICATED", brief: null, reminders: [] }, { status: 401 }));

    const admin = getSupabaseAdmin();
    if (!admin) return noStore(NextResponse.json({ ok: true, consent: false, brief: null, reminders: [] }, { status: 200 }));

    const locale = req.nextUrl.searchParams.get("locale") === "ko" ? "ko" : "en";
    const deviceTz = req.nextUrl.searchParams.get("tz");
    const { timezone } = await resolveUserTzContext(admin, user.id, deviceTz || null);
    const now = new Date();

    // Consent (default OFF). Read directly so turning it off stops personalization on the next request.
    let consent = false;
    try {
      const { data: pref } = await admin
        .from("user_conversation_preferences")
        .select("personalize_today_from_reflections")
        .eq("user_id", user.id)
        .maybeSingle();
      consent = pref?.personalize_today_from_reflections === true;
    } catch {
      consent = false;
    }

    // Slice 3.1B-3J.1: the old primary Today card (the relationship/commitment surface that rendered
    // the open action contract as "PROMISE TO CARRY") was removed. That card was the ONLY reason to
    // suppress the blocking action contract from the reminder list — with it gone, suppression would
    // hide a real, canonical Action Contract entirely. So NO reminder is suppressed here now; the open
    // action contract is discoverable exactly once in DON'T MISS TODAY when it meets the reminder
    // contract. (The dedup mechanism itself is retained in the reminder builder for future use.)
    const [reminders, brief] = await Promise.all([
      buildTodayReminders(admin, user.id, now, timezone, locale),
      composeTodayBrief(admin, user.id, now, timezone, locale, consent),
    ]);

    // Explicit allow-list: only sentences + reminder DTOs + consent state reach the client.
    return noStore(
      NextResponse.json(
        {
          ok: true,
          consent,
          brief: brief ? { yesterdayObservation: brief.yesterdayObservation, todaySuggestion: brief.todaySuggestion } : null,
          reminders: reminders.map((r) => ({
            stableId: r.stableId,
            category: r.category,
            title: r.title,
            state: r.state,
            sourceTimestamp: r.sourceTimestamp,
            roleContext: r.roleContext,
            canonicalDeepLink: r.canonicalDeepLink,
          })),
        },
        { status: 200 },
      ),
    );
  } catch {
    return noStore(NextResponse.json({ ok: true, consent: false, brief: null, reminders: [] }, { status: 200 }));
  }
}
