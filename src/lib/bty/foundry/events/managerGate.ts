import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { ManagerEventSnapshot } from "./foundryEventService";

/**
 * Shared manager-route gate for Foundry Event Rooms.
 *
 * Order: authenticated user (401) → service-role client available (503). Every
 * manager operation is owner-scoped INSIDE the service (queries filter by
 * owner_user_id), so this gate proves identity; the service proves ownership.
 * Foundry Events are open to any authenticated user (no Arena membership /
 * leader-track coupling — Foundry owns its own boundary).
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
 * Compose the canonical manager event response: replace the internal join_token
 * with the absolute public join URL the QR encodes. Uses the request origin so
 * the QR points at the host that served the manager (staging vs prod), never
 * localhost. The join_token stays inside the URL — the owner already holds it.
 */
export function attachJoinUrl(req: NextRequest, snapshot: ManagerEventSnapshot) {
  const origin = req.headers.get("origin") ?? req.nextUrl.origin;
  const { join_token, ...eventRest } = snapshot.event;
  return {
    event: { ...eventRest, join_url: `${origin}/f/${join_token}` },
    participants: snapshot.participants,
  };
}
