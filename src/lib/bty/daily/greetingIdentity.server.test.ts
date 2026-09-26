/** @vitest-environment node */
/**
 * The canonical identity behind the Today greeting: which sources are read, how the roster query
 * is scoped, and what a missing or broken one degrades to.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveGreetingIdentity } from "@/lib/bty/daily/greetingIdentity.server";

const USER = "11111111-1111-1111-1111-111111111111";

type Script = {
  profileFullName?: string | null;
  /** The row `bty_org_memberships` returns for the ACTIVE+PRIMARY filter, or null. */
  membership?: Record<string, unknown> | null;
  /** Tables whose reads throw, to prove each source is independently fail-soft. */
  throwOn?: string[];
};

type Capture = { tables: string[]; filters: Array<[string, unknown]>; columns: string[] };

function makeAdmin(script: Script, cap: Capture): SupabaseClient {
  const client = {
    from(table: string) {
      cap.tables.push(table);
      const boom = () => {
        if (script.throwOn?.includes(table)) throw new Error(`read failed: ${table}`);
      };
      const builder: Record<string, unknown> = {
        select: (cols: string) => {
          cap.columns.push(`${table}:${cols}`);
          boom();
          return builder;
        },
        eq: (col: string, val: unknown) => {
          cap.filters.push([`${table}.${col}`, val]);
          return builder;
        },
        maybeSingle: () => {
          boom();
          if (table === "arena_profiles") {
            return Promise.resolve({
              data: script.profileFullName === undefined ? null : { full_name: script.profileFullName },
            });
          }
          return Promise.resolve({ data: script.membership ?? null });
        },
      };
      return builder;
    },
  };
  return client as unknown as SupabaseClient;
}

const run = (script: Script, metadata: Record<string, unknown> | null = { full_name: "Hanbit Chi" }) => {
  const cap: Capture = { tables: [], filters: [], columns: [] };
  return resolveGreetingIdentity(makeAdmin(script, cap), USER, metadata).then((address) => ({ address, cap }));
};

describe("resolveGreetingIdentity — canonical roster as the professional source", () => {
  it("CLINICAL_PROVIDER + GENERAL_DENTIST earns the doctor form", async () => {
    const { address } = await run({
      membership: { job_family_key: "CLINICAL_PROVIDER", primary_role_key: "GENERAL_DENTIST" },
    });
    expect(address).toEqual({ kind: "doctor", addressee: "Chi" });
  });

  it("CLINICAL_PROVIDER + ORTHODONTIST earns it too", async () => {
    const { address } = await run({
      membership: { job_family_key: "CLINICAL_PROVIDER", primary_role_key: "ORTHODONTIST" },
    });
    expect(address).toEqual({ kind: "doctor", addressee: "Chi" });
  });

  it("READS THE CANONICAL TABLE ONLY — never the legacy one", async () => {
    const { cap } = await run({ membership: null });
    expect(cap.tables).toContain("bty_org_memberships");
    expect(cap.tables).not.toContain("memberships");
    expect(cap.tables).not.toContain("arena_membership_requests");
    // Only the two descriptive keys are selected — no organization, dates or provenance.
    expect(cap.columns).toContain("bty_org_memberships:job_family_key, primary_role_key");
  });

  it("G/H. the query is scoped to the user's ACTIVE PRIMARY membership", async () => {
    const { cap } = await run({ membership: null });
    expect(cap.filters).toEqual(
      expect.arrayContaining([
        ["bty_org_memberships.user_id", USER],
        ["bty_org_memberships.status", "active"],
        ["bty_org_memberships.is_primary", true],
      ]),
    );
  });

  it("no membership row → personal form", async () => {
    const { address } = await run({ membership: null });
    expect(address).toEqual({ kind: "personal", addressee: "Hanbit" });
  });

  it("membership with null role keys → personal form", async () => {
    const { address } = await run({ membership: { job_family_key: null, primary_role_key: null } });
    expect(address).toEqual({ kind: "personal", addressee: "Hanbit" });
  });

  it("a non-provider canonical role → personal form", async () => {
    const { address } = await run({
      membership: { job_family_key: "CLINICAL_SUPPORT", primary_role_key: "DENTAL_ASSISTANT" },
    });
    expect(address).toEqual({ kind: "personal", addressee: "Hanbit" });
  });

  it("K. a failed roster read costs only the honorific, never the person's name", async () => {
    const { address } = await run({ throwOn: ["bty_org_memberships"], membership: { job_family_key: "CLINICAL_PROVIDER", primary_role_key: "GENERAL_DENTIST" } });
    expect(address).toEqual({ kind: "personal", addressee: "Hanbit" });
  });

  it("a failed NAME read costs the name; the roster still decides the form", async () => {
    const { address } = await run(
      { throwOn: ["arena_profiles"], membership: { job_family_key: "CLINICAL_PROVIDER", primary_role_key: "GENERAL_DENTIST" } },
      { full_name: "Hanbit Chi" },
    );
    expect(address).toEqual({ kind: "doctor", addressee: "Chi" });
  });

  it("no identity material anywhere → the generic greeting", async () => {
    const { address } = await run(
      { membership: { job_family_key: "CLINICAL_PROVIDER", primary_role_key: "GENERAL_DENTIST" } },
      null,
    );
    expect(address).toEqual({ kind: "generic", addressee: null });
  });

  it("the real name BTY holds still beats the provider name", async () => {
    const { address } = await run({ profileFullName: "Hanbit Chi", membership: null }, { full_name: "hchi" });
    expect(address).toEqual({ kind: "personal", addressee: "Hanbit" });
  });

  it("I. the Founder's real provider name resolves to 'Chi'", async () => {
    const { address } = await run(
      { membership: { job_family_key: "CLINICAL_PROVIDER", primary_role_key: "GENERAL_DENTIST" } },
      { full_name: "Dr. Hanbit Chi (hc)" },
    );
    expect(address).toEqual({ kind: "doctor", addressee: "Chi" });
  });

  it("J. an email-shaped name is refused at every tier", async () => {
    const { address } = await run(
      { profileFullName: "hc@bty-dso.com", membership: { job_family_key: "CLINICAL_PROVIDER", primary_role_key: "GENERAL_DENTIST" } },
      { full_name: "hc@bty-dso.com", name: "hchi@bty-dso.com" },
    );
    expect(address).toEqual({ kind: "generic", addressee: null });
  });

  it("the ROLE KEY never rides along — only the form of address and the name", async () => {
    const { address } = await run({
      membership: { job_family_key: "CLINICAL_PROVIDER", primary_role_key: "GENERAL_DENTIST" },
    });
    expect(Object.keys(address).sort()).toEqual(["addressee", "kind"]);
    expect(JSON.stringify(address)).not.toMatch(/clinical|dentist|provider|job_family|primary_role/i);
  });
});
