#!/usr/bin/env node
/**
 * GOVERNED GENERATION WINDOW — the only way engineering may spend a paid generation.
 * Slice 3.2P-W1-R1.
 *
 * WHY THIS FILE EXISTS. W1 was executed by importing `generateProgram` and calling it directly
 * with a hand-built `submission_intent_id`. That bypassed the route, which validates the field,
 * so the ledger insert failed on the uuid column and the paid call ran with nothing recorded.
 * The service now fails closed, but the deeper habit was the problem: an ad-hoc harness is not
 * a governed path. This runner calls the REAL staging endpoint under real Host authorization
 * and never imports the generation service.
 *
 * WHAT IT WILL NOT DO:
 *   - it never imports or calls `generateProgram`;
 *   - it never invents an identifier — both come from `crypto.randomUUID()`;
 *   - it never recomputes a context fingerprint, and never hashes one. It reads the value the
 *     PRODUCT returns. Two published "fingerprints" for one unchanged context is what happens
 *     when a harness decides that for itself;
 *   - it never retries. One invocation is one window. A second window needs a new dispatch.
 *
 * USAGE (staging only):
 *   BTY_SESSION_COOKIE='<the Host session cookie header>' \
 *   node scripts/program-generation-window.mjs <draftId>
 *
 * The cookie is the operator's own authenticated Host session, copied from a signed-in
 * browser. Nothing here mints, stores or logs credentials.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const BASE = process.env.BTY_STAGING_BASE_URL ?? "https://bty-arena-staging.ywamer2022.workers.dev";
const draftId = process.argv[2];
const cookie = process.env.BTY_SESSION_COOKIE;

if (!draftId) {
  console.error("usage: node scripts/program-generation-window.mjs <draftId>");
  process.exit(2);
}
if (!cookie) {
  console.error(
    "REFUSED: BTY_SESSION_COOKIE is not set.\n" +
      "A paid window runs under a real Host session through the real route. This runner will not\n" +
      "fall back to calling the generation service directly — that is the failure this file exists\n" +
      "to prevent.",
  );
  process.exit(2);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const before = await db.from("foundry_program_generation_attempts").select("id").eq("draft_id", draftId);
console.log(`parent attempts BEFORE: ${(before.data ?? []).length}`);

// Both identifiers are generated here and nowhere else. The route validates them again.
const submissionIntentId = crypto.randomUUID();
const correlationId = crypto.randomUUID();
console.log(`submission_intent_id: ${submissionIntentId}`);
console.log(`correlation_id      : ${correlationId}`);

const version = await fetch(`${BASE}/api/version?cb=${Date.now()}`).then((r) => r.json());
console.log(`live source         : ${version.version}`);

console.log("\n· invoking the canonical route (ONE window) …");
const started = Date.now();
const res = await fetch(`${BASE}/api/bty/foundry/modules/${draftId}/program-draft`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ locale: "en", submission_intent_id: submissionIntentId, correlation_id: correlationId }),
});
const body = await res.text();
console.log(`HTTP ${res.status} in ${Date.now() - started}ms`);
console.log(body.slice(0, 4000));

// Whatever happened, report the ledger. A window that recorded nothing is now impossible on the
// service path, and this makes that visible rather than assumed.
const after = await db
  .from("foundry_program_generation_attempts")
  .select("*")
  .eq("draft_id", draftId)
  .order("started_at", { ascending: true });
console.log(`\nparent attempts AFTER: ${(after.data ?? []).length}`);
for (const p of after.data ?? []) {
  console.log(`\n── ${p.id}`);
  for (const [k, v] of Object.entries(p)) {
    if (v === null || k === "id") continue;
    console.log(`   ${k}: ${typeof v === "string" && v.length > 100 ? `${v.slice(0, 100)}…` : v}`);
  }
  const { data: calls } = await db
    .from("foundry_program_generation_attempt_calls")
    .select("*")
    .eq("attempt_id", p.id)
    .order("call_sequence");
  for (const c of calls ?? []) {
    console.log(`   ├─ seq${c.call_sequence} ${c.call_kind} → ${c.outcome}`);
    for (const [k, v] of Object.entries(c)) {
      if (v === null || ["id", "attempt_id", "call_sequence", "call_kind", "outcome"].includes(k)) continue;
      console.log(`   │    ${k}: ${v}`);
    }
  }
}
console.log("\nThis runner does not retry. A second window requires a new dispatch.");
