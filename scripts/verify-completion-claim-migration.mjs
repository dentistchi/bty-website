#!/usr/bin/env node
/**
 * DEFERRED COMPLETION CLAIM V1-R1 — post-apply verification for `20260827000000`.
 *
 * READ-ONLY. Every request is a GET or a deliberately-refused probe; this script holds no
 * INSERT/UPDATE/DELETE path and cannot backfill anything. Run it immediately after the migration
 * is applied and BEFORE the application deploy.
 *
 *   node scripts/verify-completion-claim-migration.mjs
 *
 * Proves: the three columns exist, the atomic RPC exists with its new signature, the superseded
 * two-argument form is gone, and every historical row is untouched — no hash, no expiry, no
 * consumption, and the same counts as before the migration.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/** Census taken before the migration, on 2026-08-26. Any drift here is a failure. */
const EXPECTED = { rows: 54, completed: 45, unclaimed: 30 };

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
  if (!ok) failures++;
};

// A — columns exist
const { data: cols, error: colErr } = await db
  .from("foundry_event_training_progress")
  .select("id, claim_secret_hash, claim_secret_expires_at, claim_consumed_at")
  .limit(1);
check("A  three claim columns exist", !colErr, colErr?.message ?? "");

// C — the atomic RPC exists with the new signature (a null hash matches nothing: no write).
const { error: rpcErr } = await db.rpc("bty_foundry_redeem_completion_claim", {
  p_claim_hash: "verification-probe-not-a-real-hash",
  p_user_id: "00000000-0000-0000-0000-000000000000",
  p_timezone: "UTC",
  p_source_training_title: "probe",
  p_assignment_id: null,
  p_organization_id: null,
  p_follow_up_days: null,
  p_fu_completion_bty_day: null,
  p_fu_due_bty_day: null,
  p_fu_due_at: null,
  p_apply_days: null,
  p_ap_completion_bty_day: null,
  p_ap_due_bty_day: null,
  p_ap_due_at: null,
  p_xp: 10,
  p_xp_eligible: false,
  p_day_start: new Date().toISOString(),
  p_day_end: new Date().toISOString(),
});
check("C  atomic RPC exists with the 18-argument signature", !rpcErr, rpcErr?.message ?? "matched nothing, wrote nothing");

// The superseded two-argument form must be gone.
const { error: oldErr } = await db.rpc("bty_foundry_redeem_completion_claim", {
  p_claim_hash: "probe", p_user_id: "00000000-0000-0000-0000-000000000000",
});
check("C  superseded two-argument form is dropped", !!oldErr, oldErr ? "refused as expected" : "STILL CALLABLE");

// D/E/F — historical rows untouched
const { data: all } = await db
  .from("foundry_event_training_progress")
  .select("id, completed_at, linked_user_id, claim_secret_hash, claim_secret_expires_at, claim_consumed_at");
const rows = all ?? [];
const completed = rows.filter((r) => r.completed_at);
const unclaimed = completed.filter((r) => !r.linked_user_id);
check("F  row count unchanged", rows.length === EXPECTED.rows, `${rows.length} (expected ${EXPECTED.rows})`);
check("F  completed count unchanged", completed.length === EXPECTED.completed, `${completed.length} (expected ${EXPECTED.completed})`);
check("F  unclaimed count unchanged", unclaimed.length === EXPECTED.unclaimed, `${unclaimed.length} (expected ${EXPECTED.unclaimed})`);
check("D  no historical row has a claim hash", rows.every((r) => r.claim_secret_hash === null));
check("D  no historical row has an expiry", rows.every((r) => r.claim_secret_expires_at === null));
check("D  no historical row is consumed", rows.every((r) => r.claim_consumed_at === null));
check("E  no backfill occurred", rows.every((r) => !r.claim_secret_hash && !r.claim_secret_expires_at && !r.claim_consumed_at));

console.log(failures === 0 ? "\nALL CHECKS PASSED — safe to deploy." : `\n${failures} CHECK(S) FAILED — do not deploy.`);
process.exit(failures === 0 ? 0 : 1);
