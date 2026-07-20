/**
 * Professional Identity Curation (Slice 3.1A-3) — admin write surface.
 *
 *   GET  → reference data for the editor: the manageable organizations + the canonical
 *          job-family / primary-role taxonomy (with labels + role→family map). No member
 *          rows, no PII.
 *   POST → curate ONE member's canonical professional identity (organization, job family,
 *          primary role, role start date). Server-authoritative: every value is
 *          re-validated in the service + the atomic RPC regardless of what the UI filtered.
 *
 * This is identity curation for future learning routing — NOT evaluation, scoring,
 * access-role inference, or Learning Path assignment. It never reads or writes XP / AIR /
 * Arena / Reflection / readiness, and triggers no assignment or privilege change.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminEmail } from "@/lib/authz";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  resolveManageableOrganizations,
  curateMembershipIdentity,
  type CurateIdentityFailReason,
} from "@/lib/bty/arena/organizationMembershipService";
import {
  JOB_FAMILY_KEYS,
  PRIMARY_ROLE_KEYS,
  ROLE_TO_FAMILY,
} from "@/domain/arena/orgIdentity";
import { JOB_FAMILY_LABELS, PRIMARY_ROLE_LABELS } from "@/lib/bty/arena/orgIdentityLabels";

export const runtime = "nodejs";

const REASON_STATUS: Record<CurateIdentityFailReason, number> = {
  invalid_family: 400,
  invalid_role: 400,
  role_requires_family: 400,
  incompatible: 400,
  role_date_not_a_date: 400,
  role_date_in_future: 400,
  organization_not_manageable: 403,
  member_out_of_scope: 403,
  membership_not_found: 404,
  organization_membership_missing: 409,
  organization_membership_inactive: 409,
  primary_membership_conflict: 409,
  write_failed: 500,
};

export async function GET(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "ADMIN_CLIENT_UNAVAILABLE" }, { status: 503 });

  try {
    const organizations = await resolveManageableOrganizations(admin, auth.user.id);
    const taxonomy = {
      jobFamilies: JOB_FAMILY_KEYS.map((key) => ({ key, label: JOB_FAMILY_LABELS[key] })),
      primaryRoles: PRIMARY_ROLE_KEYS.map((key) => ({
        key,
        label: PRIMARY_ROLE_LABELS[key],
        familyKey: ROLE_TO_FAMILY[key],
      })),
    };
    return NextResponse.json({ ok: true, organizations, taxonomy });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load curation options" },
      { status: 500 },
    );
  }
}

const BodySchema = z.object({
  membershipId: z.string().uuid(),
  organizationId: z.string().uuid(),
  // Unknown identity stays unknown: null is a first-class value, never inferred.
  jobFamilyKey: z.string().min(1).nullable().optional().transform((v) => v ?? null),
  primaryRoleKey: z.string().min(1).nullable().optional().transform((v) => v ?? null),
  roleStartedOn: z.string().min(1).nullable().optional().transform((v) => v ?? null),
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
    return NextResponse.json({ error: "INVALID_BODY", detail: parsed.error.flatten() }, { status: 400 });
  }

  // `today` is computed at the API boundary and injected into the pure domain rule.
  const todayISO = new Date().toISOString().slice(0, 10);

  try {
    const result = await curateMembershipIdentity(admin, {
      membershipId: parsed.data.membershipId,
      organizationId: parsed.data.organizationId,
      jobFamilyKey: parsed.data.jobFamilyKey,
      primaryRoleKey: parsed.data.primaryRoleKey,
      roleStartedOn: parsed.data.roleStartedOn,
      changedBy: auth.user.id,
      todayISO,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason, detail: result.detail },
        { status: REASON_STATUS[result.reason] ?? 400 },
      );
    }

    // before/after are echoed for the client to confirm persistence; no PII, no user id.
    return NextResponse.json({ ok: true, before: result.before, after: result.after });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Curation failed" },
      { status: 500 },
    );
  }
}
