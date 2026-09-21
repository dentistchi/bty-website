import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { FOUNDRY_AUTHOR_ERROR, hasFoundryAuthorCapability } from "@/lib/bty/authority/foundryAuthor.server";

/**
 * Shared manager-route gate for Foundry Training Rooms.
 *
 * Order: authenticated (401) → service-role client (503) → Foundry author
 * capability (403 foundry_author_required) → [service proves Event ownership]. Every
 * manager operation is additionally owner-scoped inside the service (queries
 * filter by owner_user_id). Authentication alone is NOT authority. The author
 * capability opens only the caller's own content.
 * The `foundry_author_required` code lets the native UI render a quiet non-author
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
    Foundry AUTHOR CAPABILITY — required for every manager operation. It admits
    platform admins, explicit Host grants, and eligible doctor/manager identities.
    Every operation behind this gate is still scoped to the caller's own rows.
  */
  const isAuthor = await hasFoundryAuthorCapability(admin, user.id);
  if (!isAuthor) {
    const res = NextResponse.json({ error: FOUNDRY_AUTHOR_ERROR }, { status: 403 });
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
