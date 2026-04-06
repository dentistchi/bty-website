import type { APIRequestContext } from "@playwright/test";

/**
 * Explicit cleanup target — no implicit “current E2E fixture user” on the client.
 * Prefer `userId` when known; otherwise `email` (server resolves via Admin API).
 */
export type CleanupStaleE2EActionContractsTarget =
  | { userId: string; email?: string; label?: string }
  | { email: string; label?: string };

/**
 * Calls the E2E-only API that wipes `bty_action_contracts` for the target user so prior runs do not leave
 * stale open contracts that block Arena (`blocked_by_open_contract`, `action_contract_pending`).
 *
 * Always pass a **explicit** `userId` or `email` for this test user (no shared “current user” inference).
 *
 * Server: `NODE_ENV=development` or `E2E_ALLOW_TEST_CLEANUP=1`, plus `SUPABASE_SERVICE_ROLE_KEY`, and
 * `E2E_TEST_CLEANUP_SECRET` or `CRON_SECRET` (same value in Playwright env as on the app).
 */
export async function cleanupStaleE2EActionContractsBeforeTest(
  request: APIRequestContext,
  target: CleanupStaleE2EActionContractsTarget,
): Promise<void> {
  const secret =
    process.env.E2E_TEST_CLEANUP_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  if (!secret) {
    const msg =
      "[e2e] action-contract cleanup requires E2E_TEST_CLEANUP_SECRET or CRON_SECRET (must match the Next server)";
    if (process.env.CI === "true") {
      throw new Error(msg);
    }
    console.error(`${msg} — skipping cleanup (local only)`);
    return;
  }

  const label = target.label?.trim() || "cleanup";
  const scopeLog =
    "userId" in target
      ? `userId=${target.userId.trim()}${target.email ? ` email=${target.email}` : ""}`
      : `email=${target.email.trim()}`;

  const body: { userId?: string; email?: string } = {};
  if ("userId" in target && target.userId.trim()) body.userId = target.userId.trim();
  else if ("email" in target && target.email.trim()) body.email = target.email.trim();
  else {
    throw new Error(
      `[e2e-cleanup:${label}] invalid target (need userId or email) | ${scopeLog}`,
    );
  }

  const res = await request.post("/api/test/cleanup-action-contracts", {
    headers: { Authorization: `Bearer ${secret}` },
    data: body,
    failOnStatusCode: false,
  });

  if (!res.ok()) {
    const text = await res.text().catch(() => "");
    console.warn(
      `[e2e-cleanup:${label}] FAIL ${scopeLog} | HTTP ${res.status()}${text ? `: ${text.slice(0, 200)}` : ""}`,
    );
    return;
  }

  let deletedCount = 0;
  let responseUserId = "";
  let responseEmail = "";
  let resolution = "";
  try {
    const json = (await res.json()) as {
      ok?: boolean;
      userId?: string;
      email?: string;
      deletedCount?: number;
      resolution?: string;
    };
    if (typeof json.deletedCount === "number") deletedCount = json.deletedCount;
    if (typeof json.userId === "string") responseUserId = json.userId;
    if (typeof json.email === "string") responseEmail = json.email;
    if (typeof json.resolution === "string") resolution = json.resolution;
  } catch {
    // ignore parse errors; still ran cleanup
  }

  console.log(
    `[e2e-cleanup:${label}] ok | scope=${scopeLog} | resolvedUserId=${responseUserId || "(n/a)"}` +
      `${responseEmail ? ` resolvedEmail=${responseEmail}` : ""}` +
      `${resolution ? ` resolution=${resolution}` : ""} | deleted=${deletedCount}`,
  );
}
