#!/usr/bin/env node
/**
 * IB-TERMINOLOGY-LINT-01 / QA G-B11 — forbidden substitutions from four terminology lock tables.
 * @see scripts/terminology-lint/README.md
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const CONFIG_PATH = join(__dirname, "terminology-lint.config.json");

const LOCK_FILE_HEADINGS = [
  { file: "PHILOSOPHY_LOCK_V1.md", heading: "## [LOCKED] Section 6 — Locked Terminology" },
  { file: "DIFFICULTY_LEVEL_MODEL_V1.md", heading: "## Section 6 — Terminology Lock Addendum" },
  { file: "PATTERN_ACTION_MODEL_V1.md", heading: "## Section 7 — Terminology Lock Addendum" },
  { file: "VALIDATOR_ARCHITECTURE_V1.md", heading: "## Section 6 — Terminology Lock Addendum" },
];

function loadConfig() {
  const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  return {
    lockDir: join(ROOT, raw.lockDir || "docs/terminology-locks"),
    excludePathSubstrings: raw.excludePathSubstrings || [],
    excludeFileSuffixes: raw.excludeFileSuffixes || [],
    narrativeExcludeSubstrings: raw.narrativeExcludeSubstrings || [],
    systemApiNamingSubstrings: raw.systemApiNamingSubstrings || [],
    i18nPathSubstrings: raw.i18nPathSubstrings || [],
    /** When false, only comma-separated fragments containing a space are matched (avoids status/tier/step false positives). */
    matchSingleWordSubstitutions: raw.matchSingleWordSubstitutions === true,
  };
}

function stripMdBold(s) {
  return s.replace(/\*\*/g, "").trim();
}

function splitForbiddenCell(cell) {
  const c = stripMdBold(cell);
  const annIdx = c.search(/\*\*Annotation:\*\*/i);
  let main = annIdx >= 0 ? c.slice(0, annIdx) : c;
  main = main.replace(/\.\s*$/, "").trim();
  const parts = main
    .split(",")
    .map((p) => p.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  return parts;
}

function parseLockTable(content, heading, sourceFile) {
  const h = content.indexOf(heading);
  if (h < 0) {
    console.error(`terminology-lint: missing heading in ${sourceFile}: ${heading.slice(0, 50)}…`);
    process.exit(2);
  }
  const after = content.slice(h);
  const lines = after.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && !/^\|\s*Term\s*\|/.test(lines[i])) i++;
  if (i >= lines.length) {
    console.error(`terminology-lint: no table in ${sourceFile}`);
    process.exit(2);
  }
  i++;
  if (i < lines.length && /^\|\s*---/.test(lines[i])) i++;

  const rows = [];
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim().startsWith("|")) break;
    const parts = line.split("|").map((c) => c.trim());
    if (parts[0] === "") parts.shift();
    if (parts.length && parts[parts.length - 1] === "") parts.pop();
    if (parts.length >= 3 && parts[0] !== "Term") {
      rows.push({
        term: stripMdBold(parts[0]),
        forbiddenRaw: parts[2],
        phrases: splitForbiddenCell(parts[2]),
      });
    }
    i++;
  }
  return rows;
}

/**
 * VALIDATOR_ARCHITECTURE_V1.md §6 Escalate: "pending review" forbidden in system/API naming only
 * (per lock annotation). Other phrases in that cell use default (full) scan scope.
 */
function phraseScope(sourceFile, lockedTerm, phrase) {
  const p = phrase.toLowerCase();
  if (
    sourceFile === "VALIDATOR_ARCHITECTURE_V1.md" &&
    lockedTerm.toLowerCase() === "escalate" &&
    (p === "pending review" || p === "pendingreview")
  ) {
    return "system_api_naming";
  }
  return "full";
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRegexes(phrase) {
  const p = phrase.trim().replace(/\s+/g, " ");
  const words = p.split(/\s+/).filter(Boolean);
  const out = [];
  if (words.length === 1) {
    const e = escapeRe(words[0]);
    out.push(new RegExp(`(?<![A-Za-z0-9])${e}(?![A-Za-z0-9])`, "i"));
    return out;
  }
  const sep = "[\\s\\u00a0]+";
  const inner = words.map((w) => escapeRe(w)).join(sep);
  out.push(new RegExp(`(?<![A-Za-z0-9])(?:${inner})(?![A-Za-z0-9])`, "i"));
  if (words.length >= 2) {
    const camel =
      words[0].toLowerCase() +
      words
        .slice(1)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join("");
    const cc = escapeRe(camel);
    out.push(new RegExp(`(?<![A-Za-z0-9])${cc}(?![A-Za-z0-9])`));
    const snake = words.map((w) => w.toLowerCase()).join("_");
    out.push(new RegExp(`(?<![A-Za-z0-9])${escapeRe(snake)}(?![A-Za-z0-9])`, "i"));
  }
  return out;
}

function* walkFiles(dir, exts) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next" || ent.name === ".git") continue;
      yield* walkFiles(p, exts);
    } else if (ent.isFile()) {
      const ok = exts.some((ext) => ent.name.endsWith(ext));
      if (ok) yield p;
    }
  }
}

function pathMatchesAny(absPath, substrings) {
  const norm = absPath.split(sep).join("/");
  return substrings.some((s) => norm.includes(s.replace(/\\/g, "/")));
}

function shouldScanPath(absPath, cfg) {
  const norm = absPath.split(sep).join("/");
  for (const s of cfg.excludePathSubstrings) {
    if (norm.includes(s.replace(/\\/g, "/"))) return false;
  }
  for (const suf of cfg.excludeFileSuffixes) {
    if (norm.endsWith(suf)) return false;
  }
  for (const s of cfg.narrativeExcludeSubstrings) {
    if (norm.includes(s.replace(/\\/g, "/"))) return false;
  }
  return true;
}

function fileMatchesFullScope(absPath, cfg) {
  const n = normPath(absPath);
  if (!n.includes("/src/")) return false;
  for (const s of cfg.narrativeExcludeSubstrings) {
    if (n.includes(s.replace(/\\/g, "/"))) return false;
  }
  return true;
}

function fileMatchesSystemApi(absPath, cfg) {
  const n = normPath(absPath);
  return cfg.systemApiNamingSubstrings.some((s) => n.includes(s.replace(/\\/g, "/")));
}

function normPath(p) {
  return p.split(sep).join("/");
}

/** Extract double-quoted string contents on a line (simple, no nested quotes). */
function extractQuotedStrings(line) {
  const out = [];
  const re = /"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    out.push(m[1].replace(/\\"/g, '"'));
  }
  return out;
}

function scanLine(line, rules, absPath, lineNo, violations, scopeFilter) {
  for (const rule of rules) {
    if (rule.scope !== scopeFilter) continue;
    for (const rx of rule.regexes) {
      if (rx.test(line)) {
        violations.push({
          file: relative(ROOT, absPath),
          line: lineNo,
          phrase: rule.phrase,
          lockedTerm: rule.lockedTerm,
          lockFile: rule.lockFile,
        });
        break;
      }
    }
  }
}

function main() {
  const strictSingles = process.argv.includes("--strict-singles");
  const cfg = loadConfig();
  if (strictSingles) cfg.matchSingleWordSubstitutions = true;
  const violations = [];

  const allRules = [];
  for (const { file, heading } of LOCK_FILE_HEADINGS) {
    const fp = join(cfg.lockDir, file);
    const content = readFileSync(fp, "utf8");
    const rows = parseLockTable(content, heading, file);
    for (const row of rows) {
      for (const phrase of row.phrases) {
        if (!phrase) continue;
        const isMultiWord = phrase.includes(" ");
        if (!cfg.matchSingleWordSubstitutions && !isMultiWord) continue;
        const scope = phraseScope(file, row.term, phrase);
        const regexes = buildRegexes(phrase);
        allRules.push({
          phrase,
          lockedTerm: row.term,
          lockFile: file,
          scope: scope === "system_api_naming" ? "system_api_naming" : "full",
          regexes,
        });
      }
    }
  }

  const fullRules = allRules.filter((r) => r.scope === "full");
  const apiRules = allRules.filter((r) => r.scope === "system_api_naming");

  for (const absPath of walkFiles(join(ROOT, "supabase", "migrations"), [".sql"])) {
    if (!shouldScanPath(absPath, cfg)) continue;
    const text = readFileSync(absPath, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, idx) => {
      scanLine(line, fullRules, absPath, idx + 1, violations, "full");
      scanLine(line, apiRules, absPath, idx + 1, violations, "system_api_naming");
    });
  }

  for (const absPath of walkFiles(join(ROOT, "src"), [".ts", ".tsx"])) {
    if (!shouldScanPath(absPath, cfg)) continue;
    const isI18n = pathMatchesAny(absPath, cfg.i18nPathSubstrings);
    if (!fileMatchesFullScope(absPath, cfg) && !isI18n) continue;

    const text = readFileSync(absPath, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (isI18n) {
        for (const chunk of extractQuotedStrings(line)) {
          scanLine(chunk, fullRules, absPath, idx + 1, violations, "full");
        }
      } else if (fileMatchesFullScope(absPath, cfg)) {
        scanLine(line, fullRules, absPath, idx + 1, violations, "full");
      }
      if (fileMatchesSystemApi(absPath, cfg)) {
        scanLine(line, apiRules, absPath, idx + 1, violations, "system_api_naming");
      }
    });
  }

  if (violations.length > 0) {
    console.error(
      `terminology-lint: ${violations.length} violation(s) (G-B11 / IB-TERMINOLOGY-LINT-01)${cfg.matchSingleWordSubstitutions ? " [strict singles]" : " [multi-word phrases only]"}\n`,
    );
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  [${v.lockFile} → ${v.lockedTerm}]  phrase: ${JSON.stringify(v.phrase)}`);
    }
    process.exit(1);
  }
  console.log("terminology-lint: OK (zero forbidden-substitution violations in scanned scope)");
}

main();
