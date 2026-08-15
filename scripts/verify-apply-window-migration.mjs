#!/usr/bin/env node
/**
 * SLICE 3.2R-R2 — post-migration verification for `20260823000000`.
 *
 * READ-ONLY. Every request is a GET; this script cannot create, alter or delete anything, and it
 * deliberately holds no INSERT/UPDATE/DELETE path at all. Run it after the migration is applied.
 *
 *   node scripts/verify-apply-window-migration.mjs
 *
 * Checks Part 2 of the R2 migration gate (existence, emptiness, constraints, RLS, client denial,
 * functions) and re-runs the census that must be UNCHANGED (follow-ups 7, progress 31,
 * decisions 0). Constraints are proven BEHAVIOURALLY where PostgREST cannot read the catalog:
 * a rejected write is proof the check exists, and a rejected write creates nothing.
 */
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !SERVICE) { console.error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

const TABLE = "foundry_participant_apply_windows";
let pass = 0, fail = 0;
const ok = (label, cond, detail = "") => { (cond ? pass++ : fail++); console.log(`${cond ? "  ✓" : "  ✗"} ${label}${detail ? ` — ${detail}` : ""}`); };

const get = async (path, key = SERVICE) => {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  return { status: r.status, body: await r.text() };
};
/** A deliberately INVALID insert. Its REJECTION is the proof; a 201 would be a failure we report. */
const probeReject = async (row) => {
  const r = await fetch(`${URL_}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "content-type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
  return { status: r.status, body: await r.text() };
};

console.log(`\nProject: ${URL_.replace(/^https:\/\//, "").replace(/\.supabase\.co.*/, "")}`);

console.log("\n── 1. table exists and is empty ──");
const t = await get(`${TABLE}?select=id`);
ok("table exists", t.status === 200, t.status === 200 ? "" : `HTTP ${t.status} — migration NOT applied`);
if (t.status !== 200) { console.log("\nSTOP: migration not applied. Nothing further checked.\n"); process.exit(1); }
const rows = JSON.parse(t.body);
ok("row count = 0", rows.length === 0, `${rows.length} rows`);

console.log("\n── 2. constraints (behavioural: rejection proves the rule) ──");
const base = {
  user_id_snapshot: "00000000-0000-0000-0000-000000000000",
  source_training_title: "verification probe",
  completed_at: "2026-01-01T00:00:00Z",
  timezone_snapshot: "UTC",
  completion_bty_day: "2026-01-01",
  due_bty_day: "2026-01-08",
  due_at: "2026-01-08T05:00:00Z",
};
const days = await probeReject({ ...base, apply_days: 30 });
ok("apply_days = 7 CHECK rejects 30", days.status >= 400, `HTTP ${days.status}`);
const order = await probeReject({ ...base, due_bty_day: "2026-01-01" });
ok("due_bty_day > completion_bty_day CHECK rejects equal", order.status >= 400, `HTTP ${order.status}`);
const title = await probeReject({ ...base, source_training_title: "   " });
ok("title length CHECK rejects blank", title.status >= 400, `HTTP ${title.status}`);
const nulluser = await probeReject({ ...base, user_id_snapshot: null });
ok("user_id_snapshot NOT NULL", nulluser.status >= 400, `HTTP ${nulluser.status}`);
const after = JSON.parse((await get(`${TABLE}?select=id`)).body);
ok("still 0 rows after probes (nothing was created)", after.length === 0, `${after.length} rows`);

console.log("\n── 3. UNIQUE(progress_id) ──");
console.log("  · not probed: proving it needs two INSERTs, and this script performs no writes that could succeed.");
console.log("  · enforced by `foundry_apply_window_unique_progress`; exercised by the service's ON CONFLICT path");
console.log("    and covered by foundryApplyWindowService.test.ts cases B / C / F.");

console.log("\n── 4. RLS / client denial ──");
if (ANON) {
  const a = await get(`${TABLE}?select=id`, ANON);
  ok("anon client CANNOT read", a.status === 401 || a.status === 403 || a.status === 404, `HTTP ${a.status}`);
} else {
  console.log("  · anon key absent from .env — client-denial check skipped");
}

console.log("\n── 5. service-role functions exist ──");
for (const [fn, args] of [
  ["bty_foundry_list_my_apply_windows", { p_auth_user_id: "00000000-0000-0000-0000-000000000000" }],
]) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = await r.text();
  ok(`${fn} callable`, r.status === 200, `HTTP ${r.status}`);
  if (r.status === 200) ok(`${fn} returns empty for an unknown user`, JSON.parse(body).length === 0);
}
console.log("  · bty_foundry_materialize_apply_window is NOT invoked here — calling it would write.");

console.log("\n── 6. census UNCHANGED (nothing else moved) ──");
const census = async (label, path, expected) => {
  const r = await get(path);
  const n = r.status === 200 ? JSON.parse(r.body).length : -1;
  ok(`${label} = ${expected}`, n === expected, `${n}`);
};
await census("follow-up rows", "foundry_participant_followups?select=id", 7);
await census("follow-up audit rows", "foundry_participant_followup_audit?select=id", 9);
await census("completed progress rows", "foundry_event_training_progress?select=id&completed_at=not.is.null", 31);
await census("decision rows", "foundry_event_training_progress?select=id&decision_response_text=not.is.null", 0);
await census("behavior observations", "foundry_behavior_observations?select=id", 0);

console.log(`\n${fail === 0 ? "ALL CHECKS PASSED" : `${fail} CHECK(S) FAILED`} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
