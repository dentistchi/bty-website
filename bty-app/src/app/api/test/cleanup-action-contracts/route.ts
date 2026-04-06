import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { resolveE2EAuthUserIdByEmail } from "@/engine/integration/e2e-test-fixtures.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/**
 * Target user resolution order (E2E sends explicit body — must not be overridden by env):
 * 1) JSON `userId` (UUID)
 * 2) JSON `email` → Admin list lookup
 * 3) `E2E_ACTION_CONTRACT_CLEANUP_USER_ID` (ops / single-user scripts only)
 */
async function resolveCleanupTargetUserId(
  bodyUserId: string | undefined,
  bodyEmail: string | undefined,
): Promise<
  | { userId: string; email?: string; resolution: string }
  | { error: string; status: number }
> {
  if (bodyUserId && isValidUuid(bodyUserId)) {
    return { userId: bodyUserId.trim(), resolution: "body_userId" };
  }

  const emailRaw = bodyEmail?.trim();
  if (emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    try {
      const uid = await resolveE2EAuthUserIdByEmail(emailRaw);
      if (!uid) {
        return { error: "email_not_found", status: 404 };
      }
      return {
        userId: uid,
        email: emailRaw.toLowerCase(),
        resolution: "email_lookup",
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[cleanup-action-contracts] email resolve failed", { email: emailRaw, msg });
      return { error: "email_resolve_failed", status: 500 };
    }
  }

  const fromEnv = process.env.E2E_ACTION_CONTRACT_CLEANUP_USER_ID?.trim();
  if (fromEnv) {
    return { userId: fromEnv, resolution: "env_E2E_ACTION_CONTRACT_CLEANUP_USER_ID" };
  }

  return {
    error: "missing_cleanup_target",
    status: 400,
  };
}

function isE2eCleanupEnvironment(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV === "development") return true;
  if (process.env.E2E_ALLOW_TEST_CLEANUP === "1") return true;
  return false;
}

function resolveCleanupBearerSecret(): string | null {
  const s =
    process.env.E2E_TEST_CLEANUP_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  return s || null;
}

function bearerMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * E2E-only: delete all `bty_action_contracts` for the configured test user via service role.
 * Prevents stale open-contract rows from causing `blocked_by_open_contract` / `action_contract_pending` on Arena entry.
 *
 * POST /api/test/cleanup-action-contracts
 * Header: Authorization: Bearer <E2E_TEST_CLEANUP_SECRET or CRON_SECRET>
 */
export async function POST(req: NextRequest) {
  if (!isE2eCleanupEnvironment()) {
    return NextResponse.json({ ok: false, error: "forbidden_environment" }, { status: 403 });
  }

  const expectedSecret = resolveCleanupBearerSecret();
  if (!expectedSecret) {
    return NextResponse.json({ ok: false, error: "cleanup_secret_not_configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization")?.trim() ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  const token = m?.[1]?.trim() ?? "";
  if (!token || !bearerMatches(token, expectedSecret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "admin_unavailable" }, { status: 503 });
  }

  let bodyUserId: string | undefined;
  let bodyEmail: string | undefined;
  try {
    const text = await req.text();
    if (text.trim()) {
      const parsed = JSON.parse(text) as { userId?: unknown; email?: unknown };
      if (typeof parsed.userId === "string") bodyUserId = parsed.userId;
      if (typeof parsed.email === "string") bodyEmail = parsed.email;
    }
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json_body" }, { status: 400 });
  }

  const resolved = await resolveCleanupTargetUserId(bodyUserId, bodyEmail);
  if ("error" in resolved) {
    return NextResponse.json(
      {
        ok: false,
        error: resolved.error,
        hint: "Send JSON { userId: <uuid> } or { email: <string> }, or set E2E_ACTION_CONTRACT_CLEANUP_USER_ID",
      },
      { status: resolved.status },
    );
  }

  const { userId, email: resolvedEmail, resolution } = resolved;
  console.log("[cleanup-action-contracts] target", {
    inputUserId: bodyUserId ?? null,
    inputEmail: bodyEmail ?? null,
    resolvedUserId: userId,
    resolvedEmail: resolvedEmail ?? null,
    resolution,
  });

  const { data: deletedRows, error } = await admin
    .from("bty_action_contracts")
    .delete()
    .eq("user_id", userId)
    .select("id");

  if (error) {
    console.error("[cleanup-action-contracts] delete failed", { userId, message: error.message });
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 500 });
  }

  const deletedCount = Array.isArray(deletedRows) ? deletedRows.length : 0;
  return NextResponse.json({
    ok: true,
    userId,
    resolution,
    ...(resolvedEmail ? { email: resolvedEmail } : {}),
    deletedCount,
  });
}
