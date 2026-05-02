#!/usr/bin/env node
/**
 * ARCHETYPE-SPEC-DRIFT-CHECK (Layer 2)
 * Spec: docs/specs/ARCHETYPE_DETERMINISM_LOCK_V1.md §4.2
 *
 * Validates that critical spec invariants are encoded in source — not just tested.
 * Catches threshold tuning, STILLWATER condition drift, Method Y scope creep,
 * and A0 gate displacement without requiring a full test run.
 *
 * Invariants checked:
 *   V1  ENTRY_THRESHOLD: scenariosCompleted=12, contractsCompleted=3
 *   V2  EXIT_THRESHOLD:  scenariosCompleted=8,  contractsCompleted=2
 *   V3  No AL-1.7 dimensions in earnedNaming (daysInSystem, distinctAxesActivated)
 *   V4  STILLWATER present in RULE_REGISTRY with specificity=70
 *   V5  STILLWATER axis conditions: conflict≤0.40, repair≤0.40, integrity∈[0.40,0.70]
 *   V6  No Method Y (AL-2) code in rules.ts (patternRequires, airBands, volatility)
 *   V7  A0 gate (isEarnedNamingEligible) placed before retry loop in lockService.ts
 *   V8  selector.ts has no silent fallback (selectedBy:'fallback' / no_match_fallback) — AL-1.5.1
 *   V9  fetchUserPatternSignatures filters by current_state active/unstable — AL-1.5.1
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "../src/lib/bty/archetype");

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

/** Strip lines that are purely comment content (single-line // and block * lines). */
function codeOnly(src) {
  return src
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join("\n");
}

const failures = [];

function fail(invariant, detail) {
  failures.push({ invariant, detail });
}

// ── V1 + V2 + V3 — earnedNaming.ts ───────────────────────────────────────────

const earned = read("earnedNaming.ts");

if (!/scenariosCompleted:\s*12[,\s]/.test(earned)) {
  fail("V1", "ENTRY_THRESHOLD.scenariosCompleted must be 12");
}
if (!/contractsCompleted:\s*3[,\s]/.test(earned)) {
  fail("V1", "ENTRY_THRESHOLD.contractsCompleted must be 3");
}
if (!/scenariosCompleted:\s*8[,\s]/.test(earned)) {
  fail("V2", "EXIT_THRESHOLD.scenariosCompleted must be 8");
}
if (!/contractsCompleted:\s*2[,\s]/.test(earned)) {
  fail("V2", "EXIT_THRESHOLD.contractsCompleted must be 2");
}
const earnedCode = codeOnly(earned);
if (/daysInSystem/.test(earnedCode)) {
  fail("V3", "daysInSystem is AL-1.7 scope — not yet in v1 earnedNaming");
}
if (/distinctAxesActivated/.test(earnedCode)) {
  fail("V3", "distinctAxesActivated is AL-1.7 scope — not yet in v1 earnedNaming");
}

// ── V4 + V5 + V6 — rules.ts ──────────────────────────────────────────────────

const rules = read("rules.ts");

if (!/"STILLWATER"/.test(rules)) {
  fail("V4", 'STILLWATER entry missing from RULE_REGISTRY (name: "STILLWATER")');
}
if (!/specificity:\s*70/.test(rules)) {
  fail("V4", "STILLWATER specificity must be 70 (explicit override, lower than any default)");
}

// Check STILLWATER axis conditions (values match spec §5.1)
if (!/axis:\s*["']conflict["'][^}]*max:\s*0\.4/.test(rules)) {
  fail("V5", "STILLWATER conflict condition: max 0.40 missing or changed");
}
if (!/axis:\s*["']repair["'][^}]*max:\s*0\.4/.test(rules)) {
  fail("V5", "STILLWATER repair condition: max 0.40 missing or changed");
}
if (!/axis:\s*["']integrity["'][^}]*min:\s*0\.4/.test(rules)) {
  fail("V5", "STILLWATER integrity condition: min 0.40 missing or changed");
}
if (!/axis:\s*["']integrity["'][^}]*max:\s*0\.7/.test(rules)) {
  fail("V5", "STILLWATER integrity condition: max 0.70 missing or changed");
}

if (/patternRequires/.test(rules)) {
  fail("V6", "patternRequires is Method Y (AL-2 scope) — not in v1 rules.ts");
}
if (/airBands/.test(rules)) {
  fail("V6", "airBands is Method Y (AL-2 scope) — not in v1 rules.ts");
}
if (/\bvolatility\b/.test(rules)) {
  fail("V6", "volatility is Method Y (AL-2 scope) — not in v1 rules.ts");
}

// ── V7 — lockService.ts: A0 gate precedes retry loop ─────────────────────────

const lock = read("lockService.ts");

const gatePos = lock.indexOf("isEarnedNamingEligible");
const loopPos = lock.indexOf("for (let attempt");

if (gatePos === -1) {
  fail("V7", "isEarnedNamingEligible (A0 gate) missing from lockService.ts");
} else if (loopPos === -1) {
  fail("V7", 'retry loop "for (let attempt" missing from lockService.ts');
} else if (gatePos > loopPos) {
  fail("V7", "A0 gate (isEarnedNamingEligible) must appear BEFORE the retry loop — gate displaced");
}

// ── V8 — selector.ts: no silent fallback (AL-1.5.1) ─────────────────────────

const selector = read("selector.ts");
const selectorCode = codeOnly(selector);

if (/selectedBy:\s*["']fallback["']/.test(selectorCode)) {
  fail("V8", "selector.ts must not have selectedBy:'fallback' — silent fallback removed in AL-1.5.1");
}
if (/no_match_fallback/.test(selectorCode)) {
  fail("V8", "selector.ts must not have no_match_fallback selectionReason — silent fallback removed in AL-1.5.1");
}
if (!/SelectorInvariantError/.test(selector)) {
  fail("V8", "SelectorInvariantError must be defined in selector.ts — replaces silent fallback");
}

// ── V9 — fetchUserPatternSignatures: current_state filter (AL-1.5.1) ─────────

const FETCH_PATH = join(__dirname, "../src/lib/bty/arena/fetchUserPatternSignatures.server.ts");
const { readFileSync: readFS } = await import("node:fs");
const fetchSig = readFS(FETCH_PATH, "utf8");

if (!/"active"/.test(fetchSig) || !/"unstable"/.test(fetchSig)) {
  fail("V9", 'fetchUserPatternSignatures.server.ts must filter current_state to ["active","unstable"] — AL-1.5.1');
}
if (!/\.in\(["']current_state["']/.test(fetchSig)) {
  fail("V9", 'fetchUserPatternSignatures.server.ts must use .in("current_state", ...) filter — AL-1.5.1');
}

// ── Report ────────────────────────────────────────────────────────────────────

if (failures.length === 0) {
  console.log(`archetype-spec-drift-check: PASS — all ${9} invariants verified`);
  process.exit(0);
} else {
  console.error("archetype-spec-drift-check: FAIL");
  console.error(
    "Spec drift detected. These invariants protect determinism lock correctness.\n",
  );
  for (const f of failures) {
    console.error(`  [${f.invariant}] ${f.detail}`);
  }
  console.error(
    "\nRef: docs/specs/ARCHETYPE_DETERMINISM_LOCK_V1.md §4.2 (enforcement layer)"
  );
  process.exit(1);
}
