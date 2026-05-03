#!/usr/bin/env node
/**
 * AL-1.5 Staging Soak — Hour-1 Gate Check
 * Spec: docs/specs/ARCHETYPE_DETERMINISM_LOCK_V1.md §4.2
 *
 * Responsibility: detect silent graceful degrade at T+1h before it hides for 24h.
 *
 * Usage:
 *   cd bty-app
 *   node scripts/staging-soak-hour1-check.mjs         # normal
 *   STAGING_DRY_RUN=true node scripts/...             # mock data, no real calls
 *   STAGING_TEST_FORBIDDEN_WRITE=true node scripts/... # read-only guard self-test
 *
 * Required env vars (not needed for dry run):
 *   SUPABASE_STAGING_URL
 *   SUPABASE_STAGING_SERVICE_ROLE_KEY
 *   STAGING_API_BASE_URL
 *   STAGING_TEST_USER_TOKEN
 */
import { createClient } from "@supabase/supabase-js";

// ── Mode flags ────────────────────────────────────────────────────────────────

const DRY_RUN = process.env.STAGING_DRY_RUN === "true";
const TEST_GUARD = process.env.STAGING_TEST_FORBIDDEN_WRITE === "true";

// In dry run, all waits collapse to 0.
const PROBE_INTERVAL_MS = DRY_RUN ? 0 : 60_000;
const CONTRACT_PROBE_N = 5;
const ONE_HOUR_MS = 60 * 60 * 1000;

// §7.1 — internal fields that must never appear in API responses.
const FORBIDDEN_FIELDS = [
  "inputHash", "input_hash",
  "input_snapshot", "inputSnapshot",
  "selectedBy", "selected_by",
  "selectionReason", "selection_reason",
  "candidatePool", "candidate_pool",
  "lockId", "lock_id",
];

// ── Utilities ─────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ts = () => new Date().toISOString().replace("T", " ").slice(0, 19);
const log = (...a) => console.log(`[${ts()}]`, ...a);

// ── Read-only audit client ────────────────────────────────────────────────────

function createReadOnlyAuditClient(url, key) {
  const client = createClient(url, key, { auth: { persistSession: false } });
  const originalFrom = client.from.bind(client);
  client.from = (table) => {
    const builder = originalFrom(table);
    for (const m of ["insert", "update", "upsert", "delete"]) {
      builder[m] = () => {
        throw new Error(
          `READONLY GUARD: "${m}" is forbidden in audit scripts (SELECT-only). ` +
            `File a bug if you see this in production.`,
        );
      };
    }
    return builder;
  };
  return client;
}

// ── ENV check ─────────────────────────────────────────────────────────────────

function requireEnv() {
  const required = [
    "SUPABASE_STAGING_URL",
    "SUPABASE_STAGING_SERVICE_ROLE_KEY",
    "STAGING_API_BASE_URL",
    "STAGING_TEST_USER_TOKEN",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length === 0) return;
  console.error("ERROR: required env vars missing:");
  for (const k of missing) console.error(`  ${k}`);
  console.error(
    "\nSet these in your shell or .env.staging before running this script.",
  );
  process.exit(1);
}

// ── Mock data (DRY_RUN) ───────────────────────────────────────────────────────

const MOCK_API = {
  ok: true,
  status: "pattern_forming",
  progress: { scenariosCompleted: 5, contractsCompleted: 1 },
  threshold: { scenariosCompleted: 12, contractsCompleted: 3 },
};

// ── API probe ─────────────────────────────────────────────────────────────────

async function fetchArchetypeApi(apiBase, token) {
  if (DRY_RUN) return { httpStatus: 200, body: MOCK_API };
  const res = await fetch(`${apiBase}/api/bty/archetype`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => null);
  return { httpStatus: res.status, body };
}

function checkContract(probe) {
  const issues = [];
  if (probe.httpStatus !== 200) {
    issues.push(`HTTP ${probe.httpStatus} — expected 200`);
    return issues;
  }
  const b = probe.body;
  if (!b || b.ok === false) {
    issues.push(`body.ok false — possible INTERNAL_ERROR/DB_ERROR: ${JSON.stringify(b)}`);
    return issues;
  }
  if (!["pattern_forming", "archetype_assigned"].includes(b.status)) {
    issues.push(`unexpected status: "${b.status}"`);
  }
  for (const f of FORBIDDEN_FIELDS) {
    if (b && f in b) issues.push(`forbidden field in response: "${f}"`);
  }
  if (b?.status === "pattern_forming") {
    if (!b.progress) issues.push("pattern_forming: missing progress");
    if (!b.threshold) issues.push("pattern_forming: missing threshold");
  } else if (b?.status === "archetype_assigned") {
    if (!b.archetypeName) issues.push("archetype_assigned: missing archetypeName");
    if (!b.archetypeClass) issues.push("archetype_assigned: missing archetypeClass");
  }
  return issues;
}

// ── DB probe ──────────────────────────────────────────────────────────────────

async function queryDbCounts(client, since) {
  const [total, newLocks, cacheHitsDb, fallback] = await Promise.all([
    client
      .from("bty_archetype_naming_locks")
      .select("*", { count: "exact", head: true })
      .gte("locked_at", since),
    client
      .from("bty_archetype_naming_locks")
      .select("*", { count: "exact", head: true })
      .gte("locked_at", since)
      .eq("selected_by", "rule_engine"),
    // Note: cached_match is never written to DB in v1 (cache hits return without inserting).
    // This metric is reserved for future use; expected to be 0.
    client
      .from("bty_archetype_naming_locks")
      .select("*", { count: "exact", head: true })
      .gte("locked_at", since)
      .eq("selected_by", "cached_match"),
    client
      .from("bty_archetype_naming_locks")
      .select("*", { count: "exact", head: true })
      .gte("locked_at", since)
      .eq("selected_by", "fallback"),
  ]);
  for (const r of [total, newLocks, cacheHitsDb, fallback]) {
    if (r.error) throw new Error(`DB probe error: ${r.error.message}`);
  }
  return {
    total: total.count ?? 0,
    new_locks: newLocks.count ?? 0,
    cache_hits_db: cacheHitsDb.count ?? 0,
    fallback_count: fallback.count ?? 0,
  };
}

// ── PII probe ─────────────────────────────────────────────────────────────────

const PII_REGEX = /air_raw|airRaw|airScore|lri_raw|lriRaw|lriScore/i;
const PII_KEYS = new Set(["email", "user_email", "userId", "user_id"]);

async function piiScan(client, since) {
  if (DRY_RUN) return 0;
  const { data, error } = await client
    .from("bty_archetype_naming_locks")
    .select("input_snapshot")
    .gte("locked_at", since);
  if (error) throw new Error(`PII scan error: ${error.message}`);
  let violations = 0;
  for (const row of data ?? []) {
    const snap = row.input_snapshot ?? {};
    const text = JSON.stringify(snap);
    if (PII_REGEX.test(text) || [...PII_KEYS].some((k) => k in snap)) violations++;
  }
  return violations;
}

// ── Guard self-test mode ──────────────────────────────────────────────────────

async function runGuardTest() {
  log("MODE: read-only guard self-test (STAGING_TEST_FORBIDDEN_WRITE=true)");
  const url = process.env.SUPABASE_STAGING_URL ?? "https://placeholder.supabase.co";
  const key = process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY ?? "placeholder-key";
  const client = createReadOnlyAuditClient(url, key);

  let allPass = true;
  for (const method of ["insert", "update", "upsert", "delete"]) {
    let threw = false;
    let msg = "";
    try {
      client.from("bty_archetype_naming_locks")[method]({ x: 1 });
    } catch (e) {
      threw = e.message.includes("READONLY GUARD");
      msg = e.message.slice(0, 60);
    }
    if (threw) {
      log(`  ${method}() → threw correctly ✓`);
    } else {
      log(`  ${method}() → DID NOT THROW ✗ — guard is broken`);
      allPass = false;
    }
  }

  if (allPass) {
    console.log(
      "\nVERDICT_LINE: READONLY_GUARD_TEST PASS all_write_methods_blocked=true",
    );
    process.exit(0);
  } else {
    console.error(
      "\nVERDICT_LINE: READONLY_GUARD_TEST FAIL all_write_methods_blocked=false",
    );
    process.exit(1);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (TEST_GUARD) return runGuardTest();

  if (!DRY_RUN) requireEnv();

  log(DRY_RUN ? "[DRY_RUN] Hour-1 Gate — mock data mode" : "Hour-1 Gate starting");

  const apiBase = process.env.STAGING_API_BASE_URL ?? "";
  const token = process.env.STAGING_TEST_USER_TOKEN ?? "";
  const client = DRY_RUN
    ? null
    : createReadOnlyAuditClient(
        process.env.SUPABASE_STAGING_URL,
        process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY,
      );

  const since = new Date(Date.now() - ONE_HOUR_MS).toISOString();

  const r = { apiProbe: "unknown", dbProbe: "unknown", contractSampling: "unknown", piiCheck: "unknown" };
  let fallbackViolations = 0;
  let piiViolations = 0;

  // ── H1-1: Single API probe ──────────────────────────────────────────────────
  log("H1-1: API probe...");
  try {
    const probe = await fetchArchetypeApi(apiBase, token);
    const issues = checkContract(probe);
    if (issues.length === 0) {
      r.apiProbe = "pass";
      log(`H1-1 PASS — status="${probe.body?.status}" forbidden_fields=0`);
    } else {
      r.apiProbe = "fail";
      log(`H1-1 FAIL — ${issues.length} issue(s):`);
      issues.forEach((i) => log(`  ✗ ${i}`));
    }
  } catch (e) {
    r.apiProbe = "fail";
    log(`H1-1 FAIL (error): ${e.message}`);
  }

  // ── H1-2: DB probe — 1-hour window ─────────────────────────────────────────
  log("H1-2: DB probe (1h window)...");
  try {
    const counts = DRY_RUN
      ? { total: 3, new_locks: 2, cache_hits_db: 0, fallback_count: 0 }
      : await queryDbCounts(client, since);

    fallbackViolations = counts.fallback_count;
    log(
      `H1-2: total=${counts.total} rule_engine=${counts.new_locks} ` +
        `cache_hits_db=${counts.cache_hits_db} fallback=${counts.fallback_count}`,
    );

    if (counts.fallback_count > 0) {
      r.dbProbe = "fail";
      log(
        `H1-2 FAIL — fallback_count=${counts.fallback_count}. ` +
          "Method X should never produce fallback for earned users. Spec §5.1 violated.",
      );
    } else if (counts.total === 0) {
      r.dbProbe = "info_only";
      log(
        "H1-2 INFO — 0 lock rows in 1h window. " +
          "Possible: (a) no earned users hit staging yet (normal if ENTRY threshold high), " +
          "OR (b) earnedNaming gate returning pattern_forming for all users (also normal). " +
          "Manual traffic verification required.",
      );
    } else {
      r.dbProbe = "pass";
      log(`H1-2 PASS — fallback=0, ${counts.total} row(s) in 1h window`);
    }
  } catch (e) {
    r.dbProbe = "fail";
    log(`H1-2 FAIL (error): ${e.message}`);
  }

  // ── H1-4: Contract sampling — 5 probes × 1 min ─────────────────────────────
  log(
    `H1-4: contract sampling (${CONTRACT_PROBE_N} probes, interval=${PROBE_INTERVAL_MS / 1000}s)...`,
  );
  const contractIssues = [];
  for (let i = 0; i < CONTRACT_PROBE_N; i++) {
    if (i > 0 && PROBE_INTERVAL_MS > 0) {
      log(
        `H1-4: waiting ${PROBE_INTERVAL_MS / 1000}s before probe ${i + 1}/${CONTRACT_PROBE_N}...`,
      );
      await sleep(PROBE_INTERVAL_MS);
    }
    try {
      const probe = await fetchArchetypeApi(apiBase, token);
      const issues = checkContract(probe);
      if (issues.length > 0) {
        contractIssues.push(...issues.map((v) => `probe${i + 1}: ${v}`));
        log(`H1-4 probe ${i + 1}/${CONTRACT_PROBE_N}: FAIL — ${issues.join("; ")}`);
      } else {
        log(
          `H1-4 probe ${i + 1}/${CONTRACT_PROBE_N}: PASS — status="${probe.body?.status}"`,
        );
      }
    } catch (e) {
      contractIssues.push(`probe${i + 1}: error — ${e.message}`);
      log(`H1-4 probe ${i + 1}/${CONTRACT_PROBE_N}: FAIL (error) — ${e.message}`);
    }
  }
  r.contractSampling = contractIssues.length === 0 ? "pass" : "fail";
  if (contractIssues.length === 0) {
    log(`H1-4 PASS — ${CONTRACT_PROBE_N}/${CONTRACT_PROBE_N} probes contract-compliant`);
  } else {
    log(`H1-4 FAIL — ${contractIssues.length} violation(s)`);
    contractIssues.forEach((i) => log(`  ✗ ${i}`));
  }

  // ── PII probe ───────────────────────────────────────────────────────────────
  log("PII: scanning input_snapshot (1h window)...");
  try {
    piiViolations = await piiScan(client, since);
    if (piiViolations > 0) {
      r.piiCheck = "critical_fail";
      log(
        `PII CRITICAL FAIL — ${piiViolations} snapshot(s) contain forbidden fields. ` +
          "STOP SOAK. Investigate immediately before any further traffic.",
      );
    } else {
      r.piiCheck = "pass";
      log("PII PASS — 0 violations in 1h window");
    }
  } catch (e) {
    r.piiCheck = "fail";
    log(`PII FAIL (error): ${e.message}`);
  }

  // ── Manual check guidance (H1-3) ───────────────────────────────────────────
  console.log(`
=== MANUAL CHECK COMMANDS (H1-3) ===
Run in a separate terminal for ~1 minute to capture a log sample:

  wrangler tail bty-arena-staging --format pretty | tee /tmp/soak-hour1.log &
  TAIL_PID=$!; sleep 60; kill $TAIL_PID 2>/dev/null

Then count keywords:
  echo "DB_ERROR:                  $(grep -c 'DB_ERROR' /tmp/soak-hour1.log)"
  echo "SelectorInvariantError:    $(grep -c 'SelectorInvariantError' /tmp/soak-hour1.log)"
  echo "ArchetypeLockExhaustedErr: $(grep -c 'ArchetypeLockExhaustedError' /tmp/soak-hour1.log)"
  echo "23P01 retries:             $(grep -c '23P01' /tmp/soak-hour1.log)"
  echo "pattern_forming responses: $(grep -c '"pattern_forming"' /tmp/soak-hour1.log)"

Pass criteria:
  DB_ERROR = 0 (any > 0 means graceful degrade is firing)
  SelectorInvariantError = 0
  ArchetypeLockExhaustedError = 0
  23P01 > 0 is OK (race retry is normal) — verify retry rate < 1% of total requests
=====================================
`);

  // ── Final verdict ───────────────────────────────────────────────────────────
  const isCritical = r.piiCheck === "critical_fail";
  const isFail =
    r.apiProbe === "fail" ||
    r.dbProbe === "fail" ||
    r.contractSampling === "fail" ||
    r.piiCheck === "fail";
  const isAutoPass =
    r.apiProbe === "pass" &&
    r.dbProbe !== "fail" && // info_only is OK
    r.contractSampling === "pass" &&
    r.piiCheck === "pass";

  const verdict = isCritical
    ? "CRITICAL_FAIL"
    : isFail
      ? "FAIL"
      : isAutoPass
        ? "MANUAL_REQUIRED"
        : "MANUAL_REQUIRED";

  const line = [
    `H1_GATE ${verdict}`,
    `api_probe=${r.apiProbe}`,
    `db_probe=${r.dbProbe}`,
    `pattern_forming_contract=${r.contractSampling}`,
    `pii_check=${r.piiCheck}`,
    `fallback_violations=${fallbackViolations}`,
    `pii_violations=${piiViolations}`,
    "manual_followup=true",
    DRY_RUN ? "dry_run=true" : null,
  ]
    .filter(Boolean)
    .join(" ");

  console.log(`\nVERDICT_LINE: ${line}`);

  if (verdict === "MANUAL_REQUIRED") {
    log("AUTO_PART complete. Run MANUAL CHECK COMMANDS above, then assess H1-3 results.");
    log("If H1-3 passes → soak continues. If H1-3 fails → stop soak, investigate.");
  }

  process.exit(isCritical || isFail ? 1 : 0);
}

main().catch((e) => {
  console.error("Unexpected error:", e.message ?? e);
  process.exit(1);
});
