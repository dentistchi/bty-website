// Deterministic SQL-statement extractor (Slice 3.2I-R5B1A.1-R2.5, Gate 7). Splits a migration file
// into TOP-LEVEL statements, correctly skipping over -- line comments, /* */ block comments,
// '...' / "..." quoted literals/identifiers, and $tag$...$tag$ dollar-quoted bodies (so semicolons
// inside a function body never split a statement). Pure — no I/O. Used to build exact source
// provenance for security + constraint statements (grep is diagnostic only).
import { createHash } from "node:crypto";

const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");

/** Return [{ ordinal, text, startIndex, endIndex, startLine, sha256 }] for each top-level statement. */
export function splitStatements(sql) {
  const out = [];
  let i = 0, n = sql.length, stmtStart = 0, ordinal = 0;
  const lineAt = (idx) => sql.slice(0, idx).split("\n").length;
  const startLineOf = (start, text) => { const ws = text.search(/\S/); return lineAt(start + (ws < 0 ? 0 : ws)); };
  while (i < n) {
    const c = sql[i], c2 = sql[i + 1];
    if (c === "-" && c2 === "-") { const nl = sql.indexOf("\n", i); i = nl === -1 ? n : nl + 1; continue; }
    if (c === "/" && c2 === "*") { const e = sql.indexOf("*/", i + 2); i = e === -1 ? n : e + 2; continue; }
    if (c === "'" || c === '"') {
      const q = c; i++;
      while (i < n) { if (sql[i] === q) { if (sql[i + 1] === q) { i += 2; continue; } i++; break; } i++; }
      continue;
    }
    if (c === "$") {
      const m = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i));
      if (m) { const tag = m[0]; const e = sql.indexOf(tag, i + tag.length); i = e === -1 ? n : e + tag.length; continue; }
    }
    if (c === ";") {
      const text = sql.slice(stmtStart, i + 1);
      if (text.trim().replace(/^\s*(--[^\n]*\n|\/\*[\s\S]*?\*\/|\s)+/g, "").length > 0) {
        out.push({ ordinal: ordinal++, text, startIndex: stmtStart, endIndex: i + 1, startLine: startLineOf(stmtStart, text), sha256: sha256(text) });
      }
      i++; stmtStart = i; continue;
    }
    i++;
  }
  const tail = sql.slice(stmtStart);
  if (tail.trim().length) out.push({ ordinal: ordinal++, text: tail, startIndex: stmtStart, endIndex: n, startLine: startLineOf(stmtStart, tail), sha256: sha256(tail) });
  return out;
}

/** Strip comments/strings for keyword classification (never used for digests). */
function scrub(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/\$([A-Za-z0-9_]*)\$[\s\S]*?\$\1\$/g, " $body$ ")
    .replace(/'([^']|'')*'/g, " '' ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Classify explicit SECURITY statements (GRANT/REVOKE/RLS/POLICY/OWNER/DEFAULT PRIVILEGES). */
export function classifySecurity(stmt) {
  const s = scrub(stmt.text).toUpperCase();
  if (/^GRANT\b/.test(s)) return s.includes("ON FUNCTION") ? "GRANT_FUNCTION" : "GRANT_TABLE";
  if (/^REVOKE\b/.test(s)) return s.includes("ON FUNCTION") ? "REVOKE_FUNCTION" : "REVOKE_TABLE";
  if (/^ALTER TABLE\b/.test(s) && /ENABLE ROW LEVEL SECURITY/.test(s)) return "RLS_ENABLE";
  if (/^ALTER TABLE\b/.test(s) && /FORCE ROW LEVEL SECURITY/.test(s)) return "RLS_FORCE";
  if (/^ALTER TABLE\b/.test(s) && /DISABLE ROW LEVEL SECURITY/.test(s)) return "RLS_DISABLE";
  if (/^CREATE POLICY\b/.test(s)) return "CREATE_POLICY";
  if (/^ALTER POLICY\b/.test(s)) return "ALTER_POLICY";
  if (/^DROP POLICY\b/.test(s)) return "DROP_POLICY";
  if (/^ALTER .* OWNER TO\b/.test(s)) return "ALTER_OWNER";
  if (/^ALTER DEFAULT PRIVILEGES\b/.test(s)) return "ALTER_DEFAULT_PRIVILEGES";
  return null;
}

/** Does a statement create/alter a table (carrying inline constraints) or add a constraint? */
export function classifyConstraintSource(stmt) {
  const s = scrub(stmt.text).toUpperCase();
  if (/^CREATE TABLE\b/.test(s)) return "CREATE_TABLE";
  if (/^ALTER TABLE\b/.test(s) && /ADD CONSTRAINT\b/.test(s)) return "ALTER_ADD_CONSTRAINT";
  if (/^DO\b/.test(s) && /ADD CONSTRAINT\b/.test(s)) return "DO_ADD_CONSTRAINT"; // guarded ALTERs inside DO $$
  return null;
}

export { sha256 };
