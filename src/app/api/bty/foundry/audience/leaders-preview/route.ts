/**
 * Leaders ELIGIBILITY PREVIEW — Slice 3.1B-2 (read-only).
 *
 * Answers one question for a Foundry Host composing a module: "if I describe this module's
 * audience as Leaders, who in my organization currently holds a canonical leadership
 * responsibility?"
 *
 * THIS IS A PREVIEW, NOT ROUTING. It assigns nobody, restricts nothing, grants no access,
 * and writes nothing. Foundry participation remains anonymous and link-based — selecting
 * "Leaders" does not target, invite, or admit anyone. Identity-bound participation,
 * targeting snapshots, assignment records, and access enforcement are deferred to
 * Slice 3.1B-3 (Identity-Bound Foundry Targeting Foundation).
 *
 * Authorization reuses the existing Foundry Host capability (an ACTIVE `foundry_host_grants`
 * row). Leader eligibility is NOT authorization: no responsibility key grants admin access,
 * office scope, Host rights, member-curation rights, or cross-organization reach.
 *
 * Organization isolation: the caller NEVER supplies an organization id. It is resolved
 * server-side from the caller's own active primary membership, so a client cannot widen the
 * audience or read another organization's members.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isActiveFoundryHost } from "@/lib/bty/foundry/events/foundryHostService";
import {
  resolveLeaderEligibility,
  resolveOwnOrganizationId,
} from "@/lib/bty/arena/organizationResponsibilityService";
import { fetchFullNameMap } from "@/lib/bty/arena/fullNameMap.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "ADMIN_CLIENT_UNAVAILABLE" }, { status: 503 });

  // Foundry Host capability — authentication alone is not enough.
  const isHost = await isActiveFoundryHost(admin, auth.user.id);
  if (!isHost) {
    return NextResponse.json({ error: "Forbidden: Foundry Host required" }, { status: 403 });
  }

  try {
    // Server-derived scope. No client-supplied organization id is accepted.
    const organizationId = await resolveOwnOrganizationId(admin, auth.user.id);
    if (!organizationId) {
      return NextResponse.json({
        ok: true,
        eligibleCount: 0,
        members: [],
        preview: true,
        assigns: false,
      });
    }

    const eligibility = await resolveLeaderEligibility(admin, organizationId);

    // Resolve names through the SAME server-side seam the admin identity surface uses; raw
    // user UUIDs never reach the browser.
    const { data: rows } = await admin
      .from("bty_org_memberships")
      .select("id, user_id")
      .in(
        "id",
        eligibility.members.map((m) => m.membershipId),
      );
    const userByMembership = new Map(
      ((rows ?? []) as Array<{ id: string; user_id: string }>).map((r) => [r.id, r.user_id]),
    );
    const nameMap = await fetchFullNameMap(
      admin,
      Array.from(userByMembership.values()),
    );

    const members = eligibility.members.map((m) => ({
      membershipId: m.membershipId,
      displayName: nameMap.get(userByMembership.get(m.membershipId) ?? "") ?? null,
    }));

    return NextResponse.json({
      ok: true,
      eligibleCount: eligibility.eligibleCount,
      members,
      // Explicit contract flags so no consumer can mistake this for targeting.
      preview: true,
      assigns: false,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to resolve Leaders eligibility" },
      { status: 500 },
    );
  }
}
