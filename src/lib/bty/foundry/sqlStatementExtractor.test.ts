import { describe, it, expect } from "vitest";
import { splitStatements, classifySecurity, classifyConstraintSource } from "../../../../scripts/migration-proof/expected/sqlStatements.mjs";

/** Gate 7 — the SQL statement extractor must correctly ignore semicolons inside comments, strings,
 * quoted identifiers, and dollar-quoted function bodies. Pure text; no DB. */

describe("splitStatements — comment / string / dollar-quote aware", () => {
  it("does not split on a semicolon inside a dollar-quoted body", () => {
    const sql = "create function f() returns int language plpgsql as $$ begin select 1; select 2; return 3; end $$;\nrevoke all on function f() from public;";
    const s = splitStatements(sql);
    expect(s.length).toBe(2);
    expect(s[0].text).toContain("$$");
    expect(s[1].text.toLowerCase()).toContain("revoke");
  });

  it("does not split on a semicolon inside a line comment or block comment", () => {
    const sql = "-- a; b; c\nselect 1; /* x; y; */ select 2;";
    const s = splitStatements(sql);
    expect(s.length).toBe(2);
  });

  it("does not split on a semicolon inside a single-quoted string (incl. '' escape)", () => {
    const sql = "select 'a;b;c''d;e'; select 2;";
    const s = splitStatements(sql);
    expect(s.length).toBe(2);
    expect(s[0].text).toContain("'a;b;c''d;e'");
  });

  it("does not split on a semicolon inside a quoted identifier", () => {
    const sql = 'create table "weird;name" (id int); select 1;';
    expect(splitStatements(sql).length).toBe(2);
  });

  it("handles nested dollar tags ($do$ … $$ … $$ … $do$)", () => {
    const sql = "do $do$ begin perform 1; execute $q$ select 1; $q$; end $do$;\nselect 9;";
    const s = splitStatements(sql);
    expect(s.length).toBe(2);
    expect(s[0].text).toContain("$do$");
  });

  it("records deterministic source SHA-256 + start line per statement", () => {
    const s = splitStatements("select 1;\nselect 2;");
    expect(s[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(s[1].startLine).toBe(2);
    expect(s[0].sha256).not.toBe(s[1].sha256);
  });
});

describe("classifiers", () => {
  it("classifies security statements without being fooled by strings", () => {
    expect(classifySecurity({ text: "revoke all on function public.f(uuid) from anon, public;" })).toBe("REVOKE_FUNCTION");
    expect(classifySecurity({ text: "grant execute on function public.f() to service_role;" })).toBe("GRANT_FUNCTION");
    expect(classifySecurity({ text: "revoke all on public.t from anon;" })).toBe("REVOKE_TABLE");
    expect(classifySecurity({ text: "alter table public.t enable row level security;" })).toBe("RLS_ENABLE");
    expect(classifySecurity({ text: "create policy p on public.t for select using (true);" })).toBe("CREATE_POLICY");
    expect(classifySecurity({ text: "select 'grant execute to nobody';" })).toBeNull(); // string, not a statement
  });

  it("classifies constraint-source statements", () => {
    expect(classifyConstraintSource({ text: "create table public.t (id uuid primary key);" })).toBe("CREATE_TABLE");
    expect(classifyConstraintSource({ text: "alter table public.t add constraint c check (x > 0);" })).toBe("ALTER_ADD_CONSTRAINT");
    expect(classifyConstraintSource({ text: "select 1;" })).toBeNull();
  });
});
