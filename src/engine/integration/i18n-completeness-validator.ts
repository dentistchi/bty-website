/**
 * Cross-checks `t('…')`, `i18n.*`, `getMessages(…).*` (and `t` bindings) against `ko` / `en` message trees
 * from {@link getMessages}. Persists rows to `i18n_audit_log`.
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";

import { getMessages, type Locale } from "@/lib/i18n";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const I18N_DEFINITION_FILES = ["i18n.ts"] as const;

export type I18nAuditReport = {
  runAt: string;
  missingKo: string[];
  missingEn: string[];
  orphanedKeys: string[];
  missingKoCount: number;
  missingEnCount: number;
  orphanedCount: number;
  usedKeysCount: number;
  definedKoLeafCount: number;
  definedEnLeafCount: number;
  /** True when `ko` and `en` leaf key sets differ (structural drift). */
  koEnKeyMismatch: boolean;
  koOnlyKeys: string[];
  enOnlyKeys: string[];
};

function isLeafValue(v: unknown): boolean {
  return typeof v === "string";
}

/** Chained JS calls mistaken for i18n path segments, e.g. `t.dearMeComposerCharCount.replace`. */
const TRAILING_NOT_I18N_SEGMENTS = new Set([
  "replace",
  "map",
  "trim",
  "filter",
  "slice",
  "join",
  "split",
  "toLowerCase",
  "toUpperCase",
  "substring",
  "startsWith",
  "endsWith",
  "includes",
  "padStart",
  "padEnd",
  "repeat",
  "valueOf",
  "toString",
  "length",
]);

/** Drop trailing `.replace` / `.map` / … so `center.dearMeComposerCharCount.replace` → `center.dearMeComposerCharCount`. */
export function normalizeAuditedKeyPath(path: string): string {
  const parts = path.split(".").filter(Boolean);
  while (parts.length > 0 && TRAILING_NOT_I18N_SEGMENTS.has(parts[parts.length - 1]!)) {
    parts.pop();
  }
  return parts.join(".");
}

function isPresentMessageValue(v: unknown): boolean {
  if (v === undefined) return false;
  if (typeof v === "string") return true;
  if (Array.isArray(v)) return v.every((x) => typeof x === "string" || (x !== null && typeof x === "object"));
  if (v !== null && typeof v === "object") return true;
  return false;
}

/** Dot paths for every string leaf under a message tree. */
export function flattenMessageLeafKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || obj === undefined) return [];
  if (typeof obj === "string") return prefix ? [prefix] : [];
  if (typeof obj !== "object") return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") {
      out.push(p);
    } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flattenMessageLeafKeys(v, p));
    }
  }
  return out;
}

function getAtPath(obj: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

async function listFilesRecursive(dir: string, acc: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next" || e.name === "dist") continue;
      await listFilesRecursive(p, acc);
    } else if (/\.(tsx?)$/.test(e.name)) {
      if (/\.(test|spec)\.tsx?$/.test(e.name)) continue;
      acc.push(p);
    }
  }
  return acc;
}

function isI18nDefinitionPath(filePath: string): boolean {
  const base = filePath.split(/[/\\]/).pop() ?? "";
  return I18N_DEFINITION_FILES.includes(base as (typeof I18N_DEFINITION_FILES)[number]);
}

/** Avoid self-matching docstrings / examples in the audit implementation file. */
function isI18nValidatorSourcePath(filePath: string): boolean {
  return filePath.replace(/\\/g, "/").endsWith("/engine/integration/i18n-completeness-validator.ts");
}

/** Remove block + line comments so doc examples are not counted as i18n usage. */
function stripTsCommentsForI18nScan(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/gm, "$1 ");
}

/** Chained property access after `getMessages(...)`: `?.bty.title` → `bty.title`. */
function extractGetMessageChains(content: string): string[] {
  const out: string[] = [];
  const re = /getMessages\s*\([^)]*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    let i = m.index + m[0].length;
    const parts: string[] = [];
    while (i < content.length) {
      if (content.slice(i, i + 2) === "?.") {
        i += 2;
        const id = content.slice(i).match(/^[a-zA-Z_][a-zA-Z0-9_]*/)?.[0];
        if (!id) break;
        parts.push(id);
        i += id.length;
      } else if (content[i] === ".") {
        i += 1;
        const id = content.slice(i).match(/^[a-zA-Z_][a-zA-Z0-9_]*/)?.[0];
        if (!id) break;
        parts.push(id);
        i += id.length;
      } else {
        break;
      }
    }
    if (parts.length) out.push(parts.join("."));
  }
  return out;
}

/** `const t = getMessages(...).center` → map `t` → `center`. */
function extractBindingPrefixes(content: string): Map<string, string> {
  const bindings = new Map<string, string>();
  const bindRe =
    /(?:const|let)\s+([a-zA-Z_$][\w$]*)\s*=\s*getMessages\s*\([^)]*\)\s*\.((?:[a-zA-Z_][a-zA-Z0-9_]*)(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/g;
  let m: RegExpExecArray | null;
  while ((m = bindRe.exec(content)) !== null) {
    bindings.set(m[1], m[2]);
  }
  const bindI18n =
    /(?:const|let)\s+([a-zA-Z_$][\w$]*)\s*=\s*i18n\.((?:[a-zA-Z_][a-zA-Z0-9_]*)(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/g;
  while ((m = bindI18n.exec(content)) !== null) {
    bindings.set(m[1], m[2]);
  }
  return bindings;
}

/** `t.foo`, `t.foo.bar` when `t` was bound to a message subtree prefix. */
function extractBoundTPaths(content: string, bindings: Map<string, string>): string[] {
  const names = [...bindings.keys()];
  if (names.length === 0) return [];
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`\\b(${escaped})\\.((?:[a-zA-Z_][a-zA-Z0-9_]*)(?:\\.[a-zA-Z_][a-zA-Z0-9_]*)*)`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const prefix = bindings.get(m[1]);
    if (!prefix) continue;
    out.push(`${prefix}.${m[2]}`);
  }
  return out;
}

function extractPatternsFromSource(content: string): string[] {
  const keys: string[] = [];

  /** Word-boundary `t` so `.select("user_id")` does not match as `t("user_id")`. */
  const tString = /\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = tString.exec(content)) !== null) {
    keys.push(normalizeAuditedKeyPath(m[1]));
  }

  const tTpl = /\bt\(\s*`([a-zA-Z0-9_.]+)`\s*\)/g;
  while ((m = tTpl.exec(content)) !== null) {
    keys.push(normalizeAuditedKeyPath(m[1]));
  }

  const i18nPath = /\bi18n\.([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/g;
  while ((m = i18nPath.exec(content)) !== null) {
    keys.push(normalizeAuditedKeyPath(m[1]));
  }

  keys.push(...extractGetMessageChains(content).map(normalizeAuditedKeyPath));

  const bindings = extractBindingPrefixes(content);
  keys.push(...extractBoundTPaths(content, bindings).map(normalizeAuditedKeyPath));

  return keys;
}

async function collectUsedKeysFromSrc(srcRoot: string): Promise<Set<string>> {
  const files = await listFilesRecursive(srcRoot);
  const used = new Set<string>();

  for (const filePath of files) {
    if (isI18nDefinitionPath(filePath)) continue;
    if (isI18nValidatorSourcePath(filePath)) continue;
    const raw = await readFile(filePath, "utf8");
    const content = stripTsCommentsForI18nScan(raw);
    for (const k of extractPatternsFromSource(content)) {
      if (k.trim() !== "") used.add(k);
    }
  }

  return used;
}

function sortUnique(arr: string[]): string[] {
  return [...new Set(arr)].sort((a, b) => a.localeCompare(b));
}

/**
 * Runs the audit: scans `src/` (excluding `i18n.ts` bodies for *usage*), compares to `ko`/`en` leaves,
 * inserts one `i18n_audit_log` row when Supabase admin is available.
 */
export async function runI18nAudit(): Promise<I18nAuditReport> {
  const runAt = new Date().toISOString();
  const srcRoot = join(process.cwd(), "src");

  const ko = getMessages("ko" as Locale);
  const en = getMessages("en" as Locale);

  const definedKo = sortUnique(flattenMessageLeafKeys(ko));
  const definedEn = sortUnique(flattenMessageLeafKeys(en));
  const definedKoSet = new Set(definedKo);
  const definedEnSet = new Set(definedEn);

  const koOnlyKeys = definedKo.filter((k) => !definedEnSet.has(k));
  const enOnlyKeys = definedEn.filter((k) => !definedKoSet.has(k));
  const koEnKeyMismatch = koOnlyKeys.length > 0 || enOnlyKeys.length > 0;

  const used = await collectUsedKeysFromSrc(srcRoot);
  const usedList = sortUnique([...used]);

  const missingKo: string[] = [];
  const missingEn: string[] = [];
  for (const path of used) {
    if (!isPresentMessageValue(getAtPath(ko, path))) missingKo.push(path);
    if (!isPresentMessageValue(getAtPath(en, path))) missingEn.push(path);
  }

  const usedSet = used;
  const orphanedKeys = sortUnique(
    definedKo.filter((k) => definedEnSet.has(k) && !usedSet.has(k)),
  );

  const report: I18nAuditReport = {
    runAt,
    missingKo: sortUnique(missingKo),
    missingEn: sortUnique(missingEn),
    orphanedKeys,
    missingKoCount: missingKo.length,
    missingEnCount: missingEn.length,
    orphanedCount: orphanedKeys.length,
    usedKeysCount: usedList.length,
    definedKoLeafCount: definedKo.length,
    definedEnLeafCount: definedEn.length,
    koEnKeyMismatch,
    koOnlyKeys: sortUnique(koOnlyKeys),
    enOnlyKeys: sortUnique(enOnlyKeys),
  };

  const admin = getSupabaseAdmin();
  if (admin) {
    const details = {
      missing_ko: report.missingKo,
      missing_en: report.missingEn,
      orphaned_keys: report.orphanedKeys,
      ko_only_keys: report.koOnlyKeys,
      en_only_keys: report.enOnlyKeys,
      used_keys_sample: usedList.slice(0, 500),
      used_keys_total: usedList.length,
    };
    const { error } = await admin.from("i18n_audit_log").insert({
      run_at: runAt,
      missing_ko_count: report.missingKoCount,
      missing_en_count: report.missingEnCount,
      orphaned_count: report.orphanedCount,
      details,
    });
    if (error) {
      console.warn("[i18n-audit] i18n_audit_log insert failed:", error.message);
    }
  } else {
    console.warn("[i18n-audit] Supabase admin unavailable; skipping persist.");
  }

  return report;
}
