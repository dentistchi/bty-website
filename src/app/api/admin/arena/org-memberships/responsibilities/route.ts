/**
 * Leadership responsibility assignments — admin write surface (Slice 3.1B-1).
 *
 *   GET  ?membershipId= → the membership's ACTIVE responsibilities + the canonical
 *                         vocabulary with localized labels. No PII, no user id.
 *   POST                → assign | revise_date | remove ONE responsibility.
 *
 * Identity curation only: this route grants no access, assigns no Learning Path or
 * Module, and never touches XP/AIR/readiness/evaluation.
 *
 * The browser addresses a MEMBERSHIP and never a user; the audit actor is taken from the
 * authenticated admin session and can never be supplied in the request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminEmail } from "@/lib/authz";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  listMembershipResponsibilities,
  curateMembershipResponsibility,
  type CurateResponsibilityFailReason,
} from "@/lib/bty/arena/organizationResponsibilityService";
import { RESPONSIBILITY_KEYS } from "@/domain/arena/orgResponsibilities";
import {
  RESPONSIBILITY_LABELS,
  RESPONSIBILITY_LABELS_KO,
} from "@/lib/bty/arena/orgResponsibilityLabels";

export const runtime = "nodejs";

const REASON_STATUS: Record<CurateResponsibilityFailReason, number> = {
  invalid_responsibility: 400,
  invalid_action: 400,
  start_date_not_a_date: 400,
  start_date_in_future: 400,
  member_out_of_scope: 403,
  membership_not_found: 404,
  organization_membership_missing: 409,
  organization_membership_inactive: 409,
  responsibility_already_active: 409,
  responsibility_not_active: 409,
  write_failed: 500,
};

export async function GET(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "ADMIN_CLIENT_UNAVAILABLE" }, { status: 503 });

  const membershipId = req.nextUrl.searchParams.get("membershipId");
  const locale = req.nextUrl.searchParams.get("locale") === "ko" ? "ko" : "en";
  const labels = locale === "ko" ? RESPONSIBILITY_LABELS_KO : RESPONSIBILITY_LABELS;

  const vocabulary = RESPONSIBILITY_KEYS.map((key) => ({ key, label: labels[key] }));

  if (!membershipId) {
    // Vocabulary-only request (editor bootstrap).
    return NextResponse.json({ ok: true, vocabulary, responsibilities: [] });
  }

  try {
    const responsibilities = await listMembershipResponsibilities(admin, membershipId);
    return NextResponse.json({ ok: true, vocabulary, responsibilities });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load responsibilities" },
      { status: 500 },
    );
  }
}

/**
 * Wire schema — deliberately minimal. There is no user id, no organization id, and no
 * actor field: the membership resolves the organization server-side and the actor comes
 * from the session, so neither can be forged from the request body.
 */
const BodySchema = z.object({
  membershipId: z.string().uuid(),
  responsibilityKey: z.string().min(1),
  action: z.enum(["assign", "revise_date", "remove"]),
  // Unknown stays unknown: null is a first-class value, never inferred.
  startedOn: z.string().min(1).nullable().optional().transform((v) => v ?? null),
});

export async function POST(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "ADMIN_CLIENT_UNAVAILABLE" }, { status: 503 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_BODY", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // `today` is computed at the API boundary and injected into the pure domain rule.
  const todayISO = new Date().toISOString().slice(0, 10);

  try {
    const result = await curateMembershipResponsibility(admin, {
      membershipId: parsed.data.membershipId,
      responsibilityKey: parsed.data.responsibilityKey,
      action: parsed.data.action,
      startedOn: parsed.data.startedOn,
      changedBy: auth.user.id,
      todayISO,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason, detail: result.detail },
        { status: REASON_STATUS[result.reason] ?? 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      responsibilityKey: result.responsibilityKey,
      action: result.action,
      before: result.before,
      after: result.after,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Responsibility curation failed" },
      { status: 500 },
    );
  }
}
