import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { syncMicrosoftManagers } from "@/lib/bty/foundry/events/microsoftManagerSync.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/bty/admin/microsoft-manager-sync — run the Microsoft manager entitlement sync.
 *
 * DEFAULT DENY. Without `MICROSOFT_MANAGER_SYNC_SECRET` configured, this route refuses everything;
 * an unset secret is never an open door. The comparison is timing-safe and length-checked, and the
 * secret is never logged or echoed.
 *
 * This is an operator/scheduler entry point, not a user surface. It changes Host authority, so it
 * is deliberately NOT reachable with an ordinary session — being a Host must not be enough to
 * re-run the thing that decides who is a Host.
 *
 * The response carries counts and user ids, never an oid, an email or a display name.
 */

function authorized(req: NextRequest): boolean {
  const expected = (process.env.MICROSOFT_MANAGER_SYNC_SECRET ?? "").trim();
  if (expected.length < 16) return false;
  const got = (req.headers.get("x-bty-sync-secret") ?? "").trim();
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(got, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  const result = await syncMicrosoftManagers(admin);
  // A run that could not reach Microsoft is a 503, not a 200 with zeros: a scheduler must be able
  // to tell "nothing needed changing" from "we never found out".
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
