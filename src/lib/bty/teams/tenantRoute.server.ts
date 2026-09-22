import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * VERIFIED TEAMS ROUTING — where a tenant's bot traffic must be sent.
 * SERVER ONLY. Slice Teams Chat-Native Text Training + Quiz V1.
 *
 * A Bot Framework `serviceUrl` is per-tenant and regional, and Microsoft's own guidance is that a
 * bot OBSERVES it on an authenticated activity and caches it — never that a bot knows it in
 * advance. So there is no constant in this file, no regional endpoint anywhere in the code, and no
 * default: a tenant BTY has never received a verified activity from simply has no route, and a
 * send to that tenant does not happen.
 *
 * THE ONLY WRITER IS A VERIFIED ACTIVITY. `rememberTenantRoute` is called from the invoke route
 * AFTER `verifyBotFrameworkToken()` has succeeded and after the existing strict `resolveServiceUrl`
 * rules have accepted the value against the token's own claim. Nothing else may write here, and in
 * particular nothing a client sends ever reaches it.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Record (or refresh) the route for a tenant, from an activity whose token has already been
 * verified.
 *
 * FAIL-SOFT BY DESIGN. This is bookkeeping on the side of whatever the activity was actually for —
 * a message action, an installation update — and a failure to record routing must never turn a
 * working command into an error for the person who ran it. It returns a boolean for tests and logs
 * a code-free line otherwise.
 */
export async function rememberTenantRoute(
  admin: SupabaseClient,
  input: { tenantId: string; serviceUrl: string },
): Promise<boolean> {
  const tenantId = (input.tenantId ?? "").trim().toLowerCase();
  const serviceUrl = (input.serviceUrl ?? "").trim();
  if (!UUID.test(tenantId) || !serviceUrl) return false;
  try {
    const now = new Date().toISOString();
    const { error } = await admin
      .from("bty_teams_tenant_routes")
      .upsert(
        { tenant_id: tenantId, service_url: serviceUrl, observed_at: now, updated_at: now },
        { onConflict: "tenant_id" },
      );
    if (error) {
      console.error("[teams-route] upsert failed", { code: error.code ?? "unknown" });
      return false;
    }
    return true;
  } catch {
    console.error("[teams-route] upsert threw");
    return false;
  }
}

/**
 * The route for a tenant, or null when BTY has never verified one.
 *
 * NULL IS A REFUSAL, not a prompt to guess. Every caller treats it as "this tenant cannot be
 * messaged yet", which is truthful: without an observed serviceUrl there is nowhere to send that
 * Microsoft would accept.
 */
export async function readTenantRoute(admin: SupabaseClient, tenantId: string): Promise<string | null> {
  const id = (tenantId ?? "").trim().toLowerCase();
  if (!UUID.test(id)) return null;
  try {
    const { data } = await admin
      .from("bty_teams_tenant_routes")
      .select("service_url")
      .eq("tenant_id", id)
      .maybeSingle<{ service_url: string }>();
    return data?.service_url ?? null;
  } catch {
    console.error("[teams-route] read threw");
    return null;
  }
}
