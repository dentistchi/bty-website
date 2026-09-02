import type { SupabaseClient } from "@supabase/supabase-js";
import {
  planManagerSync,
  isMicrosoftManager,
  type ManagerProbe,
  type ManagerSyncPlan,
} from "@/domain/foundry/hostAuthority";
import {
  getGraphAppToken,
  graphConfigFromEnv,
  probeDirectReports,
  type GraphConfig,
} from "@/lib/bty/microsoft/graphDirectory.server";
import { listHostGrantStates, readHostGrantState, setMicrosoftManagerGrant } from "./foundryHostService";

/**
 * Microsoft manager -> BTY Host entitlement sync. SERVER ONLY.
 *
 * Microsoft Entra is the upstream source of truth for who manages someone. `foundry_host_grants`
 * remains the runtime authorization source of truth — every gate in the app still reads it, and
 * nothing in the request path ever calls Graph.
 *
 * WHO GETS ASKED ABOUT. Only people who already hold a BTY account with a linked Microsoft
 * identity. A manager who has never opened BTY has no `auth.users` row, and this sync will not
 * invent one: their entitlement is simply evaluated the first time they sign in
 * (`evaluateMicrosoftManagerEntitlement`, called from the Teams bootstrap). Upstream truth is not
 * recorded for a person who does not exist here, because there is nothing safe to key it to —
 * a table of pending oids would be a shadow identity store, which the identity model forbids.
 *
 * IDENTITY IS (tenant_id, aad_object_id) AND NOTHING ELSE. No email, no UPN, no displayName, no
 * jobTitle, no department, no Teams team ownership appears in this file, and the Graph probe is
 * `$select=id` so no other attribute is even fetched.
 */

export type ManagerSyncResult = {
  ok: boolean;
  /** false ⇒ nothing was revoked, by construction. */
  complete: boolean;
  reason?: "no_graph_config" | "no_token" | "directory_unavailable";
  examined: number;
  managers: number;
  granted: string[];
  revoked: string[];
  unchanged: number;
  indeterminate: number;
  failures: number;
};

const EMPTY = {
  examined: 0,
  managers: 0,
  granted: [] as string[],
  revoked: [] as string[],
  unchanged: 0,
  indeterminate: 0,
  failures: 0,
};

type LinkedUser = { user_id: string; tenant_id: string; aad_object_id: string };

async function listMicrosoftLinkedUsers(admin: SupabaseClient): Promise<LinkedUser[] | null> {
  const { data, error } = await admin.rpc("bty_list_microsoft_linked_users");
  if (error) {
    console.error("[manager-sync] linked-user lookup failed", { code: error.code ?? "unknown" });
    return null;
  }
  return Array.isArray(data) ? (data as LinkedUser[]) : [];
}

/**
 * Probe one person. A tenant mismatch never reaches Graph.
 *
 * A guest or cross-tenant identity is `not_manager` rather than `indeterminate`: the app-only token
 * is scoped to one tenant, so a foreign identity has no manager relationship BTY can read, and
 * calling it indeterminate would let a single guest account block revocation for everyone forever.
 */
async function probeOne(
  config: GraphConfig,
  token: string,
  user: LinkedUser,
): Promise<ManagerProbe> {
  if ((user.tenant_id ?? "").toLowerCase() !== config.tenantId) {
    return { userId: user.user_id, outcome: "not_manager" };
  }
  const probe = await probeDirectReports(token, user.aad_object_id);
  if (!probe.ok) return { userId: user.user_id, outcome: "indeterminate" };
  return {
    userId: user.user_id,
    outcome: isMicrosoftManager(probe.hasDirectReports ? 1 : 0) ? "manager" : "not_manager",
  };
}

/** Apply a plan. Grants first: an incomplete run still grants, and never revokes. */
async function applyPlan(admin: SupabaseClient, plan: ManagerSyncPlan) {
  const granted: string[] = [];
  const revoked: string[] = [];
  let failures = 0;

  for (const userId of plan.toGrant) {
    const r = await setMicrosoftManagerGrant(admin, userId, true);
    if (r.ok) granted.push(userId);
    else failures += 1;
  }
  for (const userId of plan.toRevoke) {
    const r = await setMicrosoftManagerGrant(admin, userId, false);
    if (r.ok) revoked.push(userId);
    else failures += 1;
  }
  return { granted, revoked, failures };
}

/**
 * Run one full sync. Idempotent: a second run with the same directory changes nothing.
 *
 * ★ EVERY EARLY RETURN REVOKES NOTHING. Missing config, no token and an unreadable user list all
 * exit before a plan exists, so there is no path on which a failure to reach Microsoft can be
 * mistaken for "this organisation has no managers".
 */
export async function syncMicrosoftManagers(admin: SupabaseClient): Promise<ManagerSyncResult> {
  const config = graphConfigFromEnv();
  if (!config) return { ok: false, complete: false, reason: "no_graph_config", ...EMPTY };

  const token = await getGraphAppToken(config);
  if (!token) return { ok: false, complete: false, reason: "no_token", ...EMPTY };

  const users = await listMicrosoftLinkedUsers(admin);
  if (users === null) return { ok: false, complete: false, reason: "directory_unavailable", ...EMPTY };

  const probes: ManagerProbe[] = [];
  for (const user of users) probes.push(await probeOne(config, token, user));

  const plan = planManagerSync(probes, await listHostGrantStates(admin));
  const applied = await applyPlan(admin, plan);

  const result: ManagerSyncResult = {
    ok: true,
    complete: plan.complete,
    examined: probes.length,
    managers: probes.filter((p) => p.outcome === "manager").length,
    granted: applied.granted,
    revoked: applied.revoked,
    unchanged: plan.unchanged.length,
    indeterminate: plan.indeterminate.length,
    failures: applied.failures,
  };

  // Counts and nothing else — never an oid, an email or a name.
  console.error("[manager-sync] run", {
    complete: result.complete,
    examined: result.examined,
    managers: result.managers,
    granted: result.granted.length,
    revoked: result.revoked.length,
    indeterminate: result.indeterminate,
    failures: result.failures,
  });
  return result;
}

/** Re-probing on every app open would put Graph in the sign-in path. Twelve hours is enough. */
const ENTITLEMENT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * Evaluate ONE person's manager entitlement at activation time.
 *
 * This is the answer to "a Microsoft manager who has never opened BTY". Nothing is stored upstream
 * and no user is fabricated; the moment they genuinely sign in, their canonical user id exists and
 * their entitlement is settled here, on the identity the bootstrap already verified.
 *
 * NEVER THROWS AND NEVER REVOKES. A single-user probe is not an authoritative directory read, so a
 * "no" from it only clears entitlement the caller can be sure about — and a failure clears
 * nothing at all. Sign-in must never fail, or slow noticeably, because of this.
 */
export async function evaluateMicrosoftManagerEntitlement(
  admin: SupabaseClient,
  userId: string,
  tenantId: string,
  aadObjectId: string,
): Promise<{ evaluated: boolean; isManager: boolean }> {
  try {
    const state = await readHostGrantState(admin, userId);
    const syncedAt = state.microsoftSyncedAt ? Date.parse(state.microsoftSyncedAt) : NaN;
    if (Number.isFinite(syncedAt) && Date.now() - syncedAt < ENTITLEMENT_MAX_AGE_MS) {
      return { evaluated: false, isManager: state.microsoftManagerGranted };
    }

    const config = graphConfigFromEnv();
    if (!config || (tenantId ?? "").toLowerCase() !== config.tenantId) {
      return { evaluated: false, isManager: state.microsoftManagerGranted };
    }

    const token = await getGraphAppToken(config);
    if (!token) return { evaluated: false, isManager: state.microsoftManagerGranted };

    const probe = await probeDirectReports(token, aadObjectId);
    if (!probe.ok) return { evaluated: false, isManager: state.microsoftManagerGranted };

    const isManager = isMicrosoftManager(probe.hasDirectReports ? 1 : 0);
    await setMicrosoftManagerGrant(admin, userId, isManager);
    return { evaluated: true, isManager };
  } catch {
    console.error("[manager-sync] activation evaluation threw");
    return { evaluated: false, isManager: false };
  }
}
