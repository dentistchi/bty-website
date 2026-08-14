/**
 * /api/me/today/commit — the durable Today relationship commitment (V1).
 *
 * POST: authenticate → validate the relationship → resolve the canonical BTY day server-side →
 *   insert-only, first-commit-wins:
 *     A. no commitment today                       → 201 { ok:true,  created:true,  commitment }
 *     B. commitment today, SAME relationship        → 200 { ok:true,  created:false, commitment }
 *     C. commitment today, DIFFERENT relationship    → 409 { ok:false, code:"COMMITMENT_LOCKED", commitment }
 *   The row is immutable after the first insert (no update of relationship/suggested/locale/tz/time).
 *
 * GET: authenticate → resolve today's canonical BTY day → 200 { ok:true, commitment: <row>|null }.
 *
 * Security: user is ALWAYS the authenticated `getUser()` id — never a client-supplied user_id.
 * Auth failures are 401. Real persistence failures are non-2xx (503) so the client keeps the CTA
 * retryable and NEVER fabricates a confirmation. No LLM / no generation is reachable from here.
 */
import { NextRequest, NextResponse } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  commitTodayRelationship,
  getTodayCommitment,
} from "@/lib/bty/daily/todayRelationshipCommitment.server";
import { isRelationshipValue } from "@/domain/daily/todayRelationshipCommitment";

export const dynamic = "force-dynamic";

const noStore = (res: NextResponse) => {
  res.headers.set("Cache-Control", "no-store");
  return res;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return noStore(NextResponse.json({ ok: false, code: "UNAUTHENTICATED" }, { status: 401 }));
    if (!(await isConsentCurrent(supabase, user.id))) return consentRequiredResponse();

    const body = (await req.json().catch(() => null)) as {
      relationship?: unknown;
      suggestedRelationship?: unknown;
      locale?: unknown;
      timeZone?: unknown;
    } | null;

    if (!isRelationshipValue(body?.relationship)) {
      return noStore(NextResponse.json({ ok: false, code: "INVALID_RELATIONSHIP" }, { status: 400 }));
    }
    const relationship = body.relationship;
    const suggestedRelationship = isRelationshipValue(body?.suggestedRelationship)
      ? body.suggestedRelationship
      : null;
    const locale = typeof body?.locale === "string" ? body.locale : null;
    const deviceTz = typeof body?.timeZone === "string" ? body.timeZone : null;

    const admin = getSupabaseAdmin();
    if (!admin) return noStore(NextResponse.json({ ok: false, code: "UNAVAILABLE" }, { status: 503 }));

    const result = await commitTodayRelationship(admin, user.id, new Date(), relationship, {
      suggestedRelationship,
      locale,
      deviceTz,
    });

    if (result.status === "locked") {
      return noStore(
        NextResponse.json(
          { ok: false, code: "COMMITMENT_LOCKED", commitment: result.commitment },
          { status: 409 },
        ),
      );
    }
    return noStore(
      NextResponse.json(
        { ok: true, created: result.status === "created", commitment: result.commitment },
        { status: result.status === "created" ? 201 : 200 },
      ),
    );
  } catch {
    // Real failure → retryable; never fabricate a confirmation.
    return noStore(NextResponse.json({ ok: false, code: "UNAVAILABLE" }, { status: 503 }));
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return noStore(NextResponse.json({ ok: false, code: "UNAUTHENTICATED" }, { status: 401 }));
    if (!(await isConsentCurrent(supabase, user.id))) return consentRequiredResponse();

    const admin = getSupabaseAdmin();
    if (!admin) return noStore(NextResponse.json({ ok: false, code: "UNAVAILABLE" }, { status: 503 }));

    const tzParam = req.nextUrl.searchParams.get("tz");
    const deviceTz = typeof tzParam === "string" && tzParam.length > 0 ? tzParam : null;

    const commitment = await getTodayCommitment(admin, user.id, new Date(), deviceTz);
    return noStore(NextResponse.json({ ok: true, commitment }, { status: 200 }));
  } catch {
    return noStore(NextResponse.json({ ok: false, code: "UNAVAILABLE" }, { status: 503 }));
  }
}
