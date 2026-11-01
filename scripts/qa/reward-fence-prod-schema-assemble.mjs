#!/usr/bin/env node
/**
 * Assembles the read-only catalog export (JSON from `supabase db query`) into the
 * schema-only DDL used by the reward-fence PostgREST harness. No network access.
 *   node scripts/qa/reward-fence-prod-schema-assemble.mjs /abs/export.json /abs/out.sql "<capture note>"
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [input, output, note] = process.argv.slice(2);
assert(input && output && note && path.isAbsolute(input) && path.isAbsolute(output), "usage: export.json out.sql note");
const { rows } = JSON.parse(readFileSync(input, "utf8"));
assert(Array.isArray(rows) && rows.length > 0);
for (const row of rows) {
  assert(Number.isInteger(row.section) && typeof row.ddl === "string", "unexpected export row");
  // Schema only: the export query never selects table rows, so no INSERT/COPY may appear.
  assert(!/^\s*(insert|copy)\b/i.test(row.ddl), `data statement in export: ${row.name}`);
}
const body = rows.map(row => row.ddl).join("\n");
const text = [
  "-- Production schema subset for the reward-fence PostgREST harness. GENERATED; do not edit.",
  `-- ${note}`,
  "-- Source: scripts/qa/reward-fence-prod-schema-export.sql (pg_catalog only; no table rows).",
  `-- Statements: ${rows.length}; body sha256: ${createHash("sha256").update(body).digest("hex")}`,
  body,
  "",
].join("\n");
writeFileSync(output, text);
console.log(JSON.stringify({ output, statements: rows.length, sha256: createHash("sha256").update(text).digest("hex") }));
