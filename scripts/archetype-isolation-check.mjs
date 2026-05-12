#!/usr/bin/env node
/**
 * ARCHETYPE-ISOLATION-CHECK
 * Spec: docs/specs/ARCHETYPE_DETERMINISM_LOCK_V1.md
 *
 * Invariant: AI proposes language; rule engine decides identity.
 * LLM client imports in src/lib/bty/archetype/ break determinism.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ARCHETYPE_DIR = join(__dirname, "../src/lib/bty/archetype");

const FORBIDDEN = [
  { pattern: /from\s+['"]anthropic['"]/, label: "anthropic" },
  { pattern: /from\s+['"]@anthropic-ai\//, label: "@anthropic-ai/*" },
  { pattern: /from\s+['"]openai['"]/, label: "openai" },
  { pattern: /from\s+['"]@ai-sdk\//, label: "@ai-sdk/*" },
  { pattern: /from\s+['"]cohere-ai['"]/, label: "cohere-ai" },
  { pattern: /from\s+['"]@mistralai\//, label: "@mistralai/*" },
  { pattern: /from\s+['"]@\/lib\/llm['"]/, label: "@/lib/llm" },
  { pattern: /from\s+['"]@\/lib\/llm\//, label: "@/lib/llm/*" },
];

function walk(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const e of entries) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (e.endsWith(".ts") && !e.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(ARCHETYPE_DIR);
const violations = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const { pattern, label } of FORBIDDEN) {
      if (pattern.test(lines[i])) {
        violations.push({
          file: relative(join(__dirname, ".."), file),
          line: i + 1,
          text: lines[i].trim(),
          label,
        });
      }
    }
  }
}

if (violations.length === 0) {
  console.log("archetype-isolation-check: PASS — 0 LLM imports in archetype/");
  process.exit(0);
} else {
  console.error("archetype-isolation-check: FAIL");
  console.error("Invariant: LLM clients forbidden in archetype/. Spec: docs/specs/ARCHETYPE_DETERMINISM_LOCK_V1.md\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.label}]`);
    console.error(`    ${v.text}`);
  }
  process.exit(1);
}
