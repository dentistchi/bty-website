#!/usr/bin/env node
/**
 * STAGE 2 — NEVER-ACTIVATED RECIPIENT FIRST-DOOR PROOF. READ-ONLY LEDGER + GATES.
 *
 * There is NO insert/update/delete path in this file. It creates no user, binds nothing,
 * backfills nothing and never touches the historical announcement 6cfccb92.
 *
 *   node tmp/stage2-gate.mjs <checkpoint-label>
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const TENANT = "10110d5c-bd30-467e-9912-e44e67777647";
const OID = "757722d3-4ab3-4c57-a976-4b7cae5f57a3";
const HISTORICAL = "6cfccb92-fac6-43d1-b6e9-deeb0d5437b5";
const label = process.argv[2] ?? "unlabelled";

const gates = [];
const gate = (name, ok, detail = "") => { gates.push({ name, ok }); console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

console.log(`\n════ STAGE 2 LEDGER [${label}] ${new Date().toISOString()} ════`);

// ---- the identity's recipient rows -----------------------------------------
const { data: recips, error: rErr } = await db
  .from("bty_tracked_announcement_recipients")
  .select("id, announcement_id, tenant_id, aad_object_id, user_id, bound_at, notified_at, notification_send_started_at, notification_claim_token, notification_claim_expires_at, response, responded_at, question_text, handled_at, created_at")
  .eq("tenant_id", TENANT).eq("aad_object_id", OID)
  .order("created_at", { ascending: true });
if (rErr) { console.log("QUERY FAILED:", rErr.message); process.exit(1); }

const fresh = recips.filter((r) => r.announcement_id !== HISTORICAL);
const historical = recips.filter((r) => r.announcement_id === HISTORICAL);

console.log(`\n── recipient rows for this identity: ${recips.length} (historical ${historical.length}, new ${fresh.length})`);
for (const r of recips) console.log("   " + JSON.stringify({
  recipient_id: r.id, announcement_id: r.announcement_id,
  which: r.announcement_id === HISTORICAL ? "HISTORICAL (excluded)" : "STAGE 2",
  user_id: r.user_id, bound_at: r.bound_at, notified_at: r.notified_at,
  send_started: r.notification_send_started_at, lease_held: r.notification_claim_token != null,
  response: r.response, responded_at: r.responded_at,
  question_text_len: r.question_text ? r.question_text.length : null, handled_at: r.handled_at,
}));

// ---- the announcements ------------------------------------------------------
const ids = [...new Set(recips.map((r) => r.announcement_id))];
const { data: anns } = ids.length ? await db.from("bty_tracked_announcements")
  .select("id, owner_user_id, service_url, tenant_id, conversation_id, resolved_count, status, host_framing, created_at")
  .in("id", ids) : { data: [] };
console.log(`\n── announcements`);
for (const a of anns ?? []) console.log("   " + JSON.stringify({
  id: a.id, which: a.id === HISTORICAL ? "HISTORICAL" : "STAGE 2",
  owner_user_id: a.owner_user_id, service_url: a.service_url,
  resolved_count: a.resolved_count, status: a.status, framing_len: (a.host_framing ?? "").length,
  created_at: a.created_at,
}));

// ---- canonical identity ------------------------------------------------------
const { data: res } = await db.rpc("bty_resolve_user_from_microsoft_identity", { p_tenant_id: TENANT, p_aad_object_id: OID });
const resolution = (Array.isArray(res) ? res[0] : res) ?? {};
console.log(`\n── canonical identity resolver: ${JSON.stringify(resolution)}`);

// ---- Teams thread ------------------------------------------------------------
const { data: refs } = await db.from("bty_teams_conversation_refs").select("*").eq("tenant_id", TENANT).eq("aad_object_id", OID);
console.log(`── teams conversation refs for this person: ${(refs ?? []).length}`);
for (const r of refs ?? []) console.log("   " + JSON.stringify({ service_url: r.service_url, conversation_id: r.conversation_id.slice(0, 24) + "…", created_at: r.created_at }));

const { data: claims } = await db.from("bty_teams_conversation_creation_claims").select("*").eq("aad_object_id", OID);
console.log(`── conversation creation claims outstanding: ${(claims ?? []).length}`);

// ---- the derived-identity binder ----------------------------------------------
const { error: fnErr } = await db.rpc("bty_bind_announcement_recipients_for_user", { p_user_id: "00000000-0000-0000-0000-000000000000" });
console.log(`── bty_bind_announcement_recipients_for_user: ${fnErr ? "ABSENT (" + (fnErr.code ?? "?") + ") — migration 20260911 NOT applied" : "PRESENT (probe bound 0 rows, as a nonexistent user must)"}`);

// ---- GATES ---------------------------------------------------------------------
const r = fresh[0] ?? null;
console.log(`\n── GATES`);
gate("A1 a NEW announcement exists (historical 6cfccb92 untouched)", fresh.length === 1, fresh.length === 0 ? "no Stage 2 Track yet" : fresh.length > 1 ? `${fresh.length} new rows — expected exactly 1` : "");
const ann = (anns ?? []).find((a) => a.id === r?.announcement_id);
gate("A2 the new announcement has a routing coordinate", ann?.service_url != null, ann ? `service_url=${ann.service_url ?? "NULL"}` : "n/a");
gate("A3 the new recipient is the target aad_object_id", r?.aad_object_id === OID, r ? "" : "n/a");
gate("HISTORICAL 6cfccb92 untouched (still unbound, unnotified, no response)",
  historical.every((h) => h.user_id === null && h.notified_at === null && h.response === null), "");
gate("B  exactly one proactive send, marked once", r?.notified_at != null && fresh.filter((x) => x.notified_at).length === 1, r?.notified_at ?? "not notified yet");
gate("B2 the send left the delivery lease clear", r != null && r.notification_claim_token == null, "");
gate("C  PRE-OPEN: the recipient is STILL unactivated after the send",
  r?.notified_at != null && r?.user_id === null && resolution.status === "NOT_LINKED",
  r?.notified_at == null ? "nothing sent yet" : `user_id=${r?.user_id ?? "NULL"} resolver=${resolution.status}`);
gate("D1 activation happened through the Microsoft identity flow", resolution.status === "RESOLVED", `resolver=${resolution.status}`);
gate("D2 the recipient row bound to that canonical user", r?.user_id != null && r.user_id === resolution.user_id, r ? `row=${r.user_id ?? "NULL"} resolver=${resolution.user_id ?? "NULL"}` : "n/a");
gate("D3 bound_at populated", r?.bound_at != null, r?.bound_at ?? "");
gate("D4 aad_object_id unchanged by activation", r?.aad_object_id === OID, "");
gate("D5 no duplicate user for this identity", resolution.status !== "AMBIGUOUS_IDENTITY", `resolver=${resolution.status}`);
gate("E  the recipient answered through the existing response contract", r?.response != null, r?.response ?? "no response yet");

const failed = gates.filter((g) => !g.ok);
console.log(`\n════ ${failed.length === 0 ? "ALL GATES PASS" : `${failed.length} GATE(S) NOT YET SATISFIED`} ════`);
for (const f of failed) console.log(`   pending/failed: ${f.name}`);
