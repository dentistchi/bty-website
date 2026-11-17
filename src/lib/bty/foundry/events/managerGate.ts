import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { FOUNDRY_AUTHOR_ERROR, hasFoundryAuthorCapability } from "@/lib/bty/authority/foundryAuthor.server";

/**
 * Foundry routes require a BTY account. Training routes opt in when their services
 * scope each operation to the caller's own training, draft or staged upload.
 * Other routes require the established Foundry author capability as well.
 */
export type ManagerContext = {
  user: { id: string };
  admin: SupabaseClient;
  base: NextResponse;
  canManageOrganization: boolean;
};

type ManagerScope = "privileged" | "training" | "training-with-capability";

export async function requireManager(
  req: NextRequest,
  scope: ManagerScope = "privileged",
): Promise<{ ok: true; ctx: ManagerContext } | { ok: false; response: NextResponse }> {
  const { user, base } = await requireUser(req);
  if (!user || user.is_anonymous) return { ok: false, response: unauthenticated(req, base) };

  const admin = getSupabaseAdmin();
  if (!admin) {
    const res = NextResponse.json({ error: "ADMIN_CLIENT_UNAVAILABLE" }, { status: 503 });
    copyCookiesAndDebug(base, res, req, true);
    return { ok: false, response: res };
  }

  const canManageOrganization =
    scope !== "training" && await hasFoundryAuthorCapability(admin, user.id);
  if (scope === "privileged" && !canManageOrganization) {
    return { ok: false, response: managerJson(base, req, { error: FOUNDRY_AUTHOR_ERROR }, 403) };
  }

  return { ok: true, ctx: { user: { id: user.id }, admin, base, canManageOrganization } };
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
