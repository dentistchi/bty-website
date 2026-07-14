#!/usr/bin/env node
/**
 * Manage Foundry Host grants (out-of-band operational tool; NOT part of the app).
 *
 * "Foundry Host" = permission to create and operate Foundry Training Events. No
 * pilot Host is seeded in the migration — grant the first one here AFTER apply.
 *
 *   node scripts/manage-foundry-host.mjs grant  <email>
 *   node scripts/manage-foundry-host.mjs revoke <email>
 *   node scripts/manage-foundry-host.mjs status <email>
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * grant/revoke are production-touching → require FOUNDRY_HOST_CONFIRM=1 (or --yes).
 * status is read-only. The service-role key value is never printed. Mirrors the
 * idempotent semantics of src/lib/bty/foundry/events/foundryHostService.ts.
 */
import { createClient } from "@supabase/supabase-js";

const [action, email] = process.argv.slice(2);
const confirmed = process.env.FOUNDRY_HOST_CONFIRM === "1" || process.argv.includes("--yes");

const ACTIONS = new Set(["grant", "revoke", "status"]);
if (!ACTIONS.has(action) || !email) {
  console.error("Usage: node scripts/manage-foundry-host.mjs <grant|revoke|status> <email> [--yes]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) {
  console.error("[foundry-host] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Show which project this will touch (ref only — never the key).
const projectRef = url.replace(/^https?:\/\//, "").split(".")[0];
console.error(`[foundry-host] project=${projectRef} action=${action} email=${email}`);
if ((action === "grant" || action === "revoke") && !confirmed) {
  console.error("[foundry-host] Refusing to mutate without confirmation. Set FOUNDRY_HOST_CONFIRM=1 or pass --yes.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Resolve the EXACT auth user by email (paginated; zero → fail; >1 → fail).
const target = email.toLowerCase();
let matches = [];
for (let page = 1; page <= 50; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error("[foundry-host] listUsers:", error.message);
    process.exit(1);
  }
  matches.push(...data.users.filter((u) => (u.email || "").toLowerCase() === target));
  if (data.users.length < 200) break;
}
if (matches.length === 0) {
  console.error(`[foundry-host] No auth user with email: ${email}`);
  process.exit(1);
}
if (matches.length > 1) {
  console.error(`[foundry-host] Refusing: ${matches.length} users match ${email}. Resolve manually.`);
  process.exit(1);
}
const userId = matches[0].id;

if (action === "status") {
  const { data, error } = await supabase
    .from("foundry_host_grants")
    .select("status, granted_at, revoked_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[foundry-host] status:", error.message);
    process.exit(1);
  }
  console.log(JSON.stringify({ email, user_id: userId, status: data?.status ?? "none", granted_at: data?.granted_at ?? null, revoked_at: data?.revoked_at ?? null }));
  process.exit(0);
}

if (action === "grant") {
  // Idempotent: upsert an ACTIVE grant, clearing any prior revocation.
  const { error } = await supabase.from("foundry_host_grants").upsert(
    { user_id: userId, status: "active", granted_at: new Date().toISOString(), revoked_at: null },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("[foundry-host] grant:", error.message);
    process.exit(1);
  }
  console.log(`[foundry-host] GRANTED host to ${email} (user_id=${userId})`);
  process.exit(0);
}

// revoke — idempotent: mark revoked; never deletes history.
const { error } = await supabase
  .from("foundry_host_grants")
  .update({ status: "revoked", revoked_at: new Date().toISOString() })
  .eq("user_id", userId)
  .eq("status", "active");
if (error) {
  console.error("[foundry-host] revoke:", error.message);
  process.exit(1);
}
console.log(`[foundry-host] REVOKED host from ${email} (user_id=${userId})`);
process.exit(0);
