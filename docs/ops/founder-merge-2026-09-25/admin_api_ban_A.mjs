// BTY FOUNDER MERGE — Admin API step between T1 and T2 (ban A, neutralize A's email).
// REVIEW ONLY. Dry-run by default; nothing is sent unless `--execute` is passed.
//
// ESM resolves @supabase/supabase-js next to THIS file, so copy it into bty-app/ first:
//   cp ../docs/ops/founder-merge-2026-09-25/admin_api_ban_A.mjs ./.admin_api_ban_A.mjs
//   node .admin_api_ban_A.mjs             → prints current A state + the planned change
//   node .admin_api_ban_A.mjs --execute  → performs it (bty-app/ holds .env.local)
//   node .admin_api_ban_A.mjs --undo     → unban A and restore ddshanbit@gmail.com (T1 rollback prerequisite)
//
// Supported GoTrue admin endpoint (PUT /auth/v1/admin/users/{id}); live GoTrue measured v2.197.0.
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const A = "81f08aa1-44a2-40b1-9190-7866151461a7";
const RETIRED_EMAIL = "retired+81f08aa1@bty-dso.invalid"; // RFC 2606 .invalid: can never route
const ORIGINAL_EMAIL = "ddshanbit@gmail.com";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const mode = process.argv.includes("--execute") ? "execute" : process.argv.includes("--undo") ? "undo" : "dry-run";

const show = async (label) => {
  const { data, error } = await admin.auth.admin.getUserById(A);
  if (error) throw error;
  const u = data.user;
  console.log(label, { id: u.id, email: u.email, banned_until: u.banned_until ?? null, identities: (u.identities ?? []).length });
  return u;
};

const before = await show("BEFORE");

if (mode === "dry-run") {
  console.log("DRY RUN — would set ban_duration=876000h and email=", RETIRED_EMAIL, "(email_confirm: true)");
  process.exit(0);
}

if (mode === "execute") {
  if ((before.identities ?? []).length !== 0) throw new Error("REFUSED: A still has identities — T1 has not committed");
  const ban = await admin.auth.admin.updateUserById(A, { ban_duration: "876000h" });
  if (ban.error) throw ban.error;
  // email_confirm: true skips the confirm-your-new-address flow. It does NOT guarantee silence:
  // if the project has email-change security notifications enabled, GoTrue may still notify the
  // OLD address (ddshanbit@gmail.com). The new .invalid address can never receive mail.
  const mail = await admin.auth.admin.updateUserById(A, { email: RETIRED_EMAIL, email_confirm: true });
  if (mail.error) throw mail.error;
}

if (mode === "undo") {
  const mail = await admin.auth.admin.updateUserById(A, { email: ORIGINAL_EMAIL, email_confirm: true });
  if (mail.error) throw mail.error;
  const unban = await admin.auth.admin.updateUserById(A, { ban_duration: "none" });
  if (unban.error) throw unban.error;
}

const after = await show("AFTER");
if (mode === "execute" && (after.email !== RETIRED_EMAIL || !after.banned_until || Date.parse(after.banned_until) < Date.now() + 50 * 365 * 864e5)) {
  throw new Error("POSTCONDITION FAILED: A is not banned with the retired email");
}
