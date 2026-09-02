import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { hasHostCapability } from "@/lib/bty/authority/platformAdmin.server";

/**
 * Shared manager-route gate for Foundry Training Rooms.
 *
 * Order: authenticated (401) → service-role client (503) → ACTIVE Foundry Host
 * grant (403 foundry_host_required) → [service proves Event ownership]. Every
 * manager operation is additionally owner-scoped inside the service (queries
 * filter by owner_user_id). Authentication alone is NOT authority — a Host grant
 * is required to create/operate events (a Host operates only events they own).
 * The `foundry_host_required` code lets the native UI render a quiet non-host
 * state instead of a raw 403 — no separate access API needed.
 */
export type ManagerContext = {
  user: { id: string };
  admin: SupabaseClient;
  base: NextResponse;
};

export async function requireManager(
  req: NextRequest,
): Promise<{ ok: true; ctx: ManagerContext } | { ok: false; response: NextResponse }> {
  const { user, base } = await requireUser(req);
  if (!user) return { ok: false, response: unauthenticated(req, base) };

  const admin = getSupabaseAdmin();
  if (!admin) {
    const res = NextResponse.json({ error: "ADMIN_CLIENT_UNAVAILABLE" }, { status: 503 });
    copyCookiesAndDebug(base, res, req, true);
    return { ok: false, response: res };
  }

  /*
    Foundry Host CAPABILITY — required for every manager operation.

    `hasHostCapability` is the shared rule: an active platform admin OR an active Foundry Host
    grant. An admin inherits the capability without holding a grant, which is the whole point of
    the inheritance contract — but inherits ONLY the capability. Every operation behind this gate
    is still scoped to the caller's own rows, so an admin who owns no events still sees none.
  */
  const isHost = await hasHostCapability(admin, user.id);
  if (!isHost) {
    const res = NextResponse.json({ error: "foundry_host_required" }, { status: 403 });
    copyCookiesAndDebug(base, res, req, true);
    return { ok: false, response: res };
  }

  return { ok: true, ctx: { user: { id: user.id }, admin, base } };
}

/** JSON response that carries forward any refreshed auth cookies + no-store. */
export function managerJson(
  base: NextResponse,
  req: NextRequest,
  body: unknown,
  status = 200,
): NextResponse {
  const res = NextResponse.json(body, { status });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}

/**
 * Compose the canonical manager response: replace the internal join_token with
 * the absolute public join URL the QR encodes. Uses the request origin so the QR
 * points at the host that served the manager (staging vs prod), never localhost.
 * The join_token stays inside the URL — the owner already holds it. Generic over
 * the snapshot shape: any extra top-level fields (participants, counts) and any
 * extra event fields (training) pass through untouched.
 */
export function attachJoinUrl<
  S extends { event: { join_token: string } & Record<string, unknown> } & Record<string, unknown>,
>(req: NextRequest, snapshot: S) {
  const origin = req.headers.get("origin") ?? req.nextUrl.origin;
  const { join_token, ...eventRest } = snapshot.event;
  return { ...snapshot, event: { ...eventRest, join_url: `${origin}/f/${join_token}` } };
}
