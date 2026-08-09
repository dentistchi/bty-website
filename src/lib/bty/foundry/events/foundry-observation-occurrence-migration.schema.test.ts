import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Slice 3.2M-5 — schema-intent guard for the occurrence-date migration.
 *
 * Additive only: two columns and two indexes on the 3.2M-4 observation table. The properties
 * asserted here are the ones a later edit could quietly undo — that the occurrence date is
 * mandatory, that no summary rung is stored beside the facts, and that the uniqueness boundary
 * is the one the idempotency rule depends on.
 */
const PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260814000000_foundry_observation_occurrence_date_v1.sql",
);
const RAW = readFileSync(PATH, "utf8");
const CODE = RAW.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ").toLowerCase();

describe("foundry observation occurrence-date migration (schema-intent)", () => {
  it("adds the occurrence date as MANDATORY — an observation with no date is not evidence", () => {
    expect(CODE).toContain("add column if not exists observed_on date not null");
  });

  it("adds the durable timezone snapshot the date is read in", () => {
    expect(CODE).toContain("add column if not exists observation_timezone_snapshot text");
  });

  it("is additive and idempotent — no drop, no rewrite, no backfill of a date nobody reported", () => {
    expect(CODE).not.toMatch(/\bdrop table\b/);
    expect(CODE).not.toMatch(/\bdrop column\b/);
    expect(CODE).not.toMatch(/\bupdate public\./);
    expect(CODE).not.toMatch(/\binsert into public\./);
    // A default would manufacture an occurrence date for a row that never carried one.
    expect(CODE).not.toMatch(/observed_on date not null default/);
  });

  it("stores NO summary rung beside the facts — SUSTAINED is derived or it is nothing", () => {
    for (const forbidden of ["sustained", "streak", "observation_count", "habit"]) {
      expect(CODE, forbidden).not.toContain(forbidden);
    }
  });

  it("the uniqueness boundary is (obligation, observer, occurrence date, answer)", () => {
    expect(CODE).toContain(
      "create unique index if not exists foundry_observation_occurrence_unique on public.foundry_behavior_observations (followup_id, observer_user_id, observed_on, outcome)",
    );
  });

  it("that index is PLAIN, not partial — every column in it is NOT NULL, so there is no predicate", () => {
    const unique = /create unique index[^;]*foundry_observation_occurrence_unique[^;]*;/.exec(CODE)?.[0] ?? "";
    expect(unique).not.toContain(" where ");
  });

  it("indexes the occurrence-order read the temporal derivation makes", () => {
    expect(CODE).toContain("foundry_observations_followup_date_idx");
    expect(CODE).toContain("(followup_id, observed_on)");
  });

  it("carries a rollback for every object it creates", () => {
    const raw = RAW.toLowerCase();
    for (const obj of [
      "drop index if exists public.foundry_observations_followup_date_idx",
      "drop index if exists public.foundry_observation_occurrence_unique",
      "drop column if exists observation_timezone_snapshot",
      "drop column if exists observed_on",
    ]) {
      expect(raw, obj).toContain(obj);
    }
  });
});
