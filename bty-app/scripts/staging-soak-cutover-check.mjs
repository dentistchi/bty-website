#!/usr/bin/env node
/**
 * AL-1.5 Staging Soak — T+24h Cutover Gate Check
 * Spec: docs/specs/ARCHETYPE_DETERMINISM_LOCK_V1.md §4.2
 *
 * Responsibility: validate production readiness after 24h soak.
 * Output drives the go/no_go cutover decision.
 *
 * Usage:
 *   cd bty-app
 *   node scripts/staging-soak-cutover-check.mjs         # normal
 *   STAGING_DRY_RUN=true node scripts/...               # mock data, no real calls
 *   STAGING_TEST_FORBIDDEN_WRITE=true node scripts/...   # read-only guard self-test
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

const PROBE_INTERVAL_MS = DRY_RUN ? 0 : 3 * 60_000; // 3 minutes in real mode
const CONTRACT_PROBE_N = 10;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const SNAPSHOT_SIZE_WARN_BYTES = 1024;

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
  process.exit(1);
}

// ── Mock data (DRY_RUN) ───────────────────────────────────────────────────────

const MOCK_API = {
  ok: true,
  status: "pattern_forming",
  progress: { scenariosCompleted: 7, contractsCompleted: 2 },
  threshold: { scenariosCompleted: 12, contractsCompleted: 3 },
};

const MOCK_LOCK_ROWS = [
  { archetype_name: "NIGHTFORGE", input_snapshot: { axis: {}, patterns: [], s: 15, c: 4, v: 1 } },
  { archetype_name: "IRONROOT", input_snapshot: { axis: {}, patterns: [], s: 14, c: 3, v: 1 } },
  { archetype_name: "NIGHTFORGE", input_snapshot: { axis: {}, patterns: [], s: 13, c: 3, v: 1 } },
];

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
    if (b && f in b) issues.push(`forbidden field: "${f}"`);
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

// ── DB probes ─────────────────────────────────────────────────────────────────

async function queryCounts(client, since) {
  const [total, newLocks, cacheHitsDb, fallback, uniqueUsers] = await Promise.all([
    client
      .from("bty_archetype_naming_locks")
      .select("*", { count: "exact", head: true })
      .gte("locked_at", since),
    client
      .from("bty_archetype_naming_locks")
      .select("*", { count: "exact", head: true })
      .gte("locked_at", since)
      .eq("selected_by", "rule_engine"),
    // cached_match is never written to DB in v1; reserved for future use.
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
    client
      .from("bty_archetype_naming_locks")
      .select("user_id", { count: "exact", head: true })
      .gte("locked_at", since),
  ]);
  for (const r of [total, newLocks, cacheHitsDb, fallback, uniqueUsers]) {
    if (r.error) throw new Error(`DB count query error: ${r.error.message}`);
  }
  return {
    total: total.count ?? 0,
    new_locks: newLocks.count ?? 0,
    cache_hits_db: cacheHitsDb.count ?? 0,
    fallback_count: fallback.count ?? 0,
    unique_users: uniqueUsers.count ?? 0,
  };
}

async function queryArchetypeDistribution(client, since) {
  if (DRY_RUN) {
    return { NIGHTFORGE: 2, IRONROOT: 1 };
  }
  const { data, error } = await client
    .from("bty_archetype_naming_locks")
    .select("archetype_name")
    .gte("locked_at", since)
    .is("superseded_at", null);
  if (error) throw new Error(`distribution query error: ${error.message}`);
  const dist = {};
  for (const row of data ?? []) {
    const n = row.archetype_name ?? "UNKNOWN";
    dist[n] = (dist[n] ?? 0) + 1;
  }
  return dist;
}

async function querySnapshotSizes(client, since) {
  if (DRY_RUN) {
    return MOCK_LOCK_ROWS.map((r) => ({
      size: JSON.stringify(r.input_snapshot).length,
    }));
  }
  const { data, error } = await client
    .from("bty_archetype_naming_locks")
    .select("id, input_snapshot")
    .gte("locked_at", since);
  if (error) throw new Error(`snapshot size query error: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    size: JSON.stringify(r.input_snapshot ?? {}).length,
  }));
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
    if (PII_REGEX.test(JSON.stringify(snap)) || [...PII_KEYS].some((k) => k in snap)) {
      violations++;
    }
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
    try {
      client.from("bty_archetype_naming_locks")[method]({ x: 1 });
    } catch (e) {
      threw = e.message.includes("READONLY GUARD");
    }
    log(`  ${method}() → ${threw ? "threw correctly ✓" : "DID NOT THROW ✗"}`);
    if (!threw) allPass = false;
  }

  if (allPass) {
    console.log("\nVERDICT_LINE: READONLY_GUARD_TEST PASS all_write_methods_blocked=true");
    process.exit(0);
  } else {
    console.error("\nVERDICT_LINE: READONLY_GUARD_TEST FAIL all_write_methods_blocked=false");
    process.exit(1);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (TEST_GUARD) return runGuardTest();

  if (!DRY_RUN) requireEnv();

  log(DRY_RUN ? "[DRY_RUN] T+24h Cutover Gate — mock data mode" : "T+24h Cutover Gate starting");

  const apiBase = process.env.STAGING_API_BASE_URL ?? "";
  const token = process.env.STAGING_TEST_USER_TOKEN ?? "";
  const client = DRY_RUN
    ? null
    : createReadOnlyAuditClient(
        process.env.SUPABASE_STAGING_URL,
        process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY,
      );

  const since = new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString();

  const r = {
    lockCounts: "unknown",
    distribution: "pass_info",
    contractSampling: "unknown",
    snapshotSize: "pass",
    piiCheck: "unknown",
  };
  let fallbackViolations = 0;
  let piiViolations = 0;
  let snapshotSizeWarnCount = 0;
  let totalLocks = 0;
  let patternFormingCount = 0;

  // ── 2.1: 24h DB lock counts ────────────────────────────────────────────────
  log("2.1: DB lock counts (24h window)...");
  try {
    const counts = DRY_RUN
      ? { total: 8, new_locks: 7, cache_hits_db: 0, fallback_count: 0, unique_users: 5 }
      : await queryCounts(client, since);

    totalLocks = counts.total;
    fallbackViolations = counts.fallback_count;
    log(
      `2.1: total=${counts.total} unique_users=${counts.unique_users} ` +
        `rule_engine=${counts.new_locks} cache_hits_db=${counts.cache_hits_db} ` +
        `fallback=${counts.fallback_count}`,
    );

    if (counts.fallback_count > 0) {
      r.lockCounts = "fail";
      log(
        `2.1 FAIL — fallback_count=${counts.fallback_count}. ` +
          "Method X invariant violated. Do NOT cutover.",
      );
    } else if (counts.total === 0) {
      r.lockCounts = "manual_required";
      log(
        "2.1 MANUAL_REQUIRED — 0 lock rows in 24h window. " +
          "Soak may have had no earned users. Manual traffic assessment required " +
          "before cutover decision.",
      );
    } else {
      r.lockCounts = "pass";
      log(`2.1 PASS — fallback=0, ${counts.total} row(s), ${counts.unique_users} unique user(s)`);
    }
  } catch (e) {
    r.lockCounts = "fail";
    log(`2.1 FAIL (error): ${e.message}`);
  }

  // ── 2.2: Archetype distribution (informational) ───────────────────────────
  log("2.2: Archetype distribution (24h, informational)...");
  try {
    const dist = await queryArchetypeDistribution(client, since);
    const sorted = Object.entries(dist).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
      log("2.2 INFO — no active locks in 24h window (distribution empty)");
    } else {
      log("2.2 Distribution (active locks, 24h):");
      for (const [name, count] of sorted) {
        log(`  ${name}: ${count}`);
      }
    }
    // Distribution is informational — not a gate blocker in v1.
    r.distribution = "pass_info";
  } catch (e) {
    log(`2.2 WARN (error): ${e.message} — distribution skipped`);
    r.distribution = "warn";
  }

  // ── 2.3: PATTERN_FORMING rate — 10 probes × 3 min ────────────────────────
  log(
    `2.3: Contract + pattern_forming rate sampling (${CONTRACT_PROBE_N} probes, ` +
      `interval=${PROBE_INTERVAL_MS / 1000}s)...`,
  );
  const contractIssues = [];
  for (let i = 0; i < CONTRACT_PROBE_N; i++) {
    if (i > 0 && PROBE_INTERVAL_MS > 0) {
      log(`2.3: waiting ${PROBE_INTERVAL_MS / 1000}s before probe ${i + 1}/${CONTRACT_PROBE_N}...`);
      await sleep(PROBE_INTERVAL_MS);
    }
    try {
      const probe = await fetchArchetypeApi(apiBase, token);
      const issues = checkContract(probe);
      if (probe.body?.status === "pattern_forming") patternFormingCount++;
      if (issues.length > 0) {
        contractIssues.push(...issues.map((v) => `probe${i + 1}: ${v}`));
        log(`2.3 probe ${i + 1}/${CONTRACT_PROBE_N}: FAIL — ${issues.join("; ")}`);
      } else {
        log(
          `2.3 probe ${i + 1}/${CONTRACT_PROBE_N}: PASS — ` +
            `status="${probe.body?.status}"`,
        );
      }
    } catch (e) {
      contractIssues.push(`probe${i + 1}: error — ${e.message}`);
      log(`2.3 probe ${i + 1}/${CONTRACT_PROBE_N}: FAIL (error) — ${e.message}`);
    }
  }

  const patternFormingRate = CONTRACT_PROBE_N > 0
    ? ((patternFormingCount / CONTRACT_PROBE_N) * 100).toFixed(1)
    : "N/A";
  r.contractSampling = contractIssues.length === 0 ? "pass" : "fail";

  if (contractIssues.length === 0) {
    log(`2.3 PASS — ${CONTRACT_PROBE_N}/${CONTRACT_PROBE_N} probes contract-compliant`);
  } else {
    log(`2.3 FAIL — ${contractIssues.length} violation(s)`);
    contractIssues.forEach((i) => log(`  ✗ ${i}`));
  }

  log(`2.3 pattern_forming_rate=${patternFormingRate}% (${patternFormingCount}/${CONTRACT_PROBE_N} probes)`);
  if (Number(patternFormingRate) > 90) {
    log(
      "2.3 SIGNAL — pattern_forming_rate > 90%. ENTRY_THRESHOLD may be too high for staging traffic. " +
        "Review for AL-1.7 threshold tuning. Not a cutover blocker.",
    );
  } else if (Number(patternFormingRate) < 5 && CONTRACT_PROBE_N > 0) {
    log(
      "2.3 SIGNAL — pattern_forming_rate < 5%. " +
        "Possible: staging test user is earned (normal), or very low new-user traffic. " +
        "Not a cutover blocker.",
    );
  }

  // ── 2.4: Snapshot size distribution ───────────────────────────────────────
  log("2.4: Snapshot size check (24h window)...");
  try {
    const sizes = await querySnapshotSizes(client, since);
    if (sizes.length === 0) {
      log("2.4 INFO — no snapshots in 24h window");
    } else {
      const max = Math.max(...sizes.map((s) => s.size));
      const avg = Math.round(sizes.reduce((a, s) => a + s.size, 0) / sizes.length);
      const oversized = sizes.filter((s) => s.size > SNAPSHOT_SIZE_WARN_BYTES);
      snapshotSizeWarnCount = oversized.length;
      log(
        `2.4: rows=${sizes.length} avg_bytes=${avg} max_bytes=${max} ` +
          `oversized(>${SNAPSHOT_SIZE_WARN_BYTES}b)=${oversized.length}`,
      );
      if (oversized.length > 0) {
        r.snapshotSize = "warn";
        log(
          `2.4 WARN — ${oversized.length} snapshot(s) exceed ${SNAPSHOT_SIZE_WARN_BYTES} bytes. ` +
            "Possible raw data leakage in input_snapshot. Commander review required.",
        );
      } else {
        log(`2.4 PASS — all snapshots within normal size range (max=${max}b)`);
      }
    }
  } catch (e) {
    r.snapshotSize = "warn";
    log(`2.4 WARN (error): ${e.message} — size check skipped`);
  }

  // ── 2.5: PII check — 24h window ───────────────────────────────────────────
  log("PII: scanning input_snapshot (24h window)...");
  try {
    piiViolations = await piiScan(client, since);
    if (piiViolations > 0) {
      r.piiCheck = "critical_fail";
      log(
        `PII CRITICAL FAIL — ${piiViolations} snapshot(s) contain forbidden fields. ` +
          "DO NOT CUTOVER. Investigate before any further traffic.",
      );
    } else {
      r.piiCheck = "pass";
      log("PII PASS — 0 violations in 24h window");
    }
  } catch (e) {
    r.piiCheck = "fail";
    log(`PII FAIL (error): ${e.message}`);
  }

  // ── Manual guidance ────────────────────────────────────────────────────────
  console.log(`
=== MANUAL CHECK COMMANDS (2.6 — race retry rate) ===
If you captured a 24h wrangler tail log at /tmp/soak-24h.log:

  echo "Total archetype requests: $(grep -c 'resolveArchetypeForUser' /tmp/soak-24h.log)"
  echo "23P01 retries:            $(grep -c '23P01' /tmp/soak-24h.log)"

Pass criteria: retry_rate < 1% of total requests.
If no full 24h log, run a 1-minute spot check instead:

  wrangler tail bty-arena-staging --format pretty | tee /tmp/soak-spot.log &
  TAIL_PID=$!; sleep 60; kill $TAIL_PID 2>/dev/null
  echo "23P01 in spot: $(grep -c '23P01' /tmp/soak-spot.log)"
======================================================
`);

  // ── Final verdict ───────────────────────────────────────────────────────────
  const isCritical = r.piiCheck === "critical_fail";
  const isFail =
    r.lockCounts === "fail" ||
    r.contractSampling === "fail" ||
    r.piiCheck === "fail";
  const isManual = r.lockCounts === "manual_required";
  const isWarn = r.snapshotSize === "warn";

  let verdict;
  if (isCritical) {
    verdict = "CRITICAL_FAIL";
  } else if (isFail) {
    verdict = "FAIL";
  } else if (isManual) {
    verdict = "MANUAL_REQUIRED";
  } else if (isWarn) {
    verdict = "WARN";
  } else {
    verdict = "PASS";
  }

  const line = [
    `T24_GATE ${verdict}`,
    `total_locks=${totalLocks}`,
    `fallback_violations=${fallbackViolations}`,
    `pii_violations=${piiViolations}`,
    `pattern_forming_rate=${patternFormingRate}%`,
    `snapshot_size_warn=${snapshotSizeWarnCount}`,
    `contract_sampling=${r.contractSampling}`,
    `pii_check=${r.piiCheck}`,
    `manual_required=${isManual}`,
    DRY_RUN ? "dry_run=true" : null,
  ]
    .filter(Boolean)
    .join(" ");

  console.log(`\nVERDICT_LINE: ${line}`);

  switch (verdict) {
    case "PASS":
      log("ALL GATES PASS. Proceed with production cutover.");
      log("Next: apply migrations to production DB → deploy Worker → monitor first 1h.");
      break;
    case "WARN":
      log("WARN: cutover is possible but requires Commander review of snapshot size anomaly.");
      log("If snapshot sizes are explained by legitimate data, proceed. Otherwise investigate.");
      break;
    case "MANUAL_REQUIRED":
      log("MANUAL_REQUIRED: 0 lock rows in 24h — manual traffic assessment required.");
      log("If staging had no earned users, consider extending soak or accepting risk.");
      break;
    case "FAIL":
    case "CRITICAL_FAIL":
      log("CUTOVER BLOCKED. Fix failures before proceeding to production.");
      break;
  }

  process.exit(isCritical || isFail ? 1 : 0);
}

main().catch((e) => {
  console.error("Unexpected error:", e.message ?? e);
  process.exit(1);
});
