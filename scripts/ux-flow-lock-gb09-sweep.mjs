#!/usr/bin/env node
/**
 * G-B09 — UX_FLOW_LOCK_V1 §5 shipped-copy sweep (forbidden pattern probe).
 * @see docs/terminology-locks/UX_FLOW_LOCK_V1.md §5
 *
 * Exits 0 when no high-risk phrases appear in scanned files; 1 when matches found.
 * Does not replace human review of Elite / validator copy.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");

/** Paths skipped entirely (parser internals, not user-visible copy). */
const EXCLUDE_SUBSTRINGS = [
  "/node_modules/",
  "/.next/",
  "/e2e/",
  "ux-flow-lock-gb09-sweep.mjs",
  "reflection-engine.ts",
  "/docs/terminology-locks/",
];

const EXT_OK = new Set([".ts", ".tsx"]);

/** High-signal phrases for §5 F1–F5 (case-insensitive). Tuned to reduce false positives in technical "failed" strings. */
const PHRASES = [
  /\btry\s+again\b/i,
  /\bshame\s+on\b/i,
  /\byou\s+('re|are)\s+(stupid|dumb|wrong|bad)\b/i,
  /\bhow\s+could\s+you\b/i,
  /\bwhat\s+('s| is)\s+wrong\s+with\s+you\b/i,
  /\b(incompetent|worthless)\b/i,
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = relative(ROOT, p).split("\\").join("/");
    if (EXCLUDE_SUBSTRINGS.some((s) => rel.includes(s))) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (st.isFile()) {
      const ext = name.slice(name.lastIndexOf("."));
      if (!EXT_OK.has(ext)) continue;
      if (name.endsWith(".test.ts") || name.endsWith(".test.tsx") || name.endsWith(".spec.ts")) continue;
      out.push(p);
    }
  }
  return out;
}

function main() {
  const srcRoot = join(ROOT, "src");
  const files = walk(srcRoot);
  const findings = [];

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const re of PHRASES) {
        if (re.test(line)) {
          findings.push({ file: relative(ROOT, file), line: i + 1, text: line.trim().slice(0, 200) });
        }
      }
    });
  }

  if (findings.length === 0) {
    console.log(`G-B09 sweep: PASS — no §5 high-risk phrase hits in ${files.length} files under src/`);
    process.exit(0);
  }

  console.error("G-B09 sweep: REVIEW REQUIRED — matches:");
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line} — ${f.text}`);
  }
  process.exit(1);
}

main();
