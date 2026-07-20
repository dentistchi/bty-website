/**
 * GET: Canonical organization memberships + reconciliation summary (admin only, READ-ONLY).
 *
 * Slice 3.1A-2 observability surface for the Member Identity admin page. Lists the
 * canonical `bty_org_memberships` (with org name + localized identity labels) and a
 * reconciliation summary. Never queries legacy `memberships`/`organizations`, never
 * writes, and never returns raw user UUIDs to the browser (server-side name resolution
 * only, via the same admin full-name seam the approval page uses).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/authz";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { fetchFullNameMap } from "@/lib/bty/arena/fullNameMap.server";
import { listCanonicalMembershipsForAdmin } from "@/lib/bty/arena/organizationMembershipService";
import { JOB_FAMILY_LABELS, PRIMARY_ROLE_LABELS } from "@/lib/bty/arena/orgIdentityLabels";
import { isJobFamilyKey, isPrimaryRoleKey } from "@/domain/arena/orgIdentity";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "ADMIN_CLIENT_UNAVAILABLE" }, { status: 503 });

  try {
    const { summary, memberships } = await listCanonicalMembershipsForAdmin(admin);

    // Resolve display names server-side; the raw user_id NEVER leaves the server.
    const nameMap = await fetchFullNameMap(admin, memberships.map((m) => m.userId));

    const rows = memberships.map((m) => ({
      membershipId: m.membershipId,
      displayName: nameMap.get(m.userId) ?? null,
      organizationKey: m.organizationKey,
      organizationName: m.organizationName,
      status: m.status,
      isPrimary: m.isPrimary,
      jobFamilyKey: m.jobFamilyKey,
      jobFamilyLabel: isJobFamilyKey(m.jobFamilyKey) ? JOB_FAMILY_LABELS[m.jobFamilyKey] : null,
      primaryRoleKey: m.primaryRoleKey,
      primaryRoleLabel: isPrimaryRoleKey(m.primaryRoleKey) ? PRIMARY_ROLE_LABELS[m.primaryRoleKey] : null,
      identitySource: m.identitySource,
      joinedAt: m.joinedAt,
      roleStartedAt: m.roleStartedAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    return NextResponse.json({ ok: true, summary, memberships: rows });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load canonical memberships" },
      { status: 500 },
    );
  }
}
