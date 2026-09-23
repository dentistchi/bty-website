/** @vitest-environment node */
/**
 * The canonical identity behind the Today greeting: which EXISTING sources are read, and what a
 * missing or broken one degrades to.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveGreetingIdentity } from "@/lib/bty/daily/greetingIdentity.server";

const USER = "11111111-1111-1111-1111-111111111111";

type Script = {
  profileFullName?: string | null;
  memberships?: Array<{ role?: string | null; job_function?: string | null }>;
  approvedRequest?: { job_function?: string | null } | null;
  /** Tables whose reads throw, to prove each source is independently fail-soft. */
  throwOn?: string[];
};

type Capture = { tables: string[]; filters: Array<[string, unknown]> };

function makeAdmin(script: Script, cap: Capture): SupabaseClient {
  const client = {
    from(table: string) {
      cap.tables.push(table);
      const boom = () => {
        if (script.throwOn?.includes(table)) throw new Error(`read failed: ${table}`);
      };
      const builder: Record<string, unknown> = {
        select: () => {
          boom();
          return builder;
        },
        eq: (col: string, val: unknown) => {
          cap.filters.push([col, val]);
          return builder;
        },
        maybeSingle: () => {
          boom();
          if (table === "arena_profiles") {
            return Promise.resolve({
              data: script.profileFullName === undefined ? null : { full_name: script.profileFullName },
              error: null,
            });
          }
          return Promise.resolve({ data: script.approvedRequest ?? null, error: null });
        },
        then: (resolve: (v: { data: unknown[]; error: null }) => void) => {
          boom();
          resolve({ data: script.memberships ?? [], error: null });
        },
      };
      return builder;
    },
  };
  return client as unknown as SupabaseClient;
}

const run = (script: Script, metadata: Record<string, unknown> | null = null) => {
  const cap: Capture = { tables: [], filters: [] };
  return resolveGreetingIdentity(makeAdmin(script, cap), USER, metadata).then((address) => ({ address, cap }));
};

describe("resolveGreetingIdentity", () => {
  it("a doctor role on the canonical membership earns the doctor form", async () => {
    const { address } = await run(
      { memberships: [{ role: "doctor", job_function: "senior_doctor" }] },
      { full_name: "Hanbit Chi" },
    );
    expect(address).toEqual({ kind: "doctor", addressee: "Chi" });
  });

  it("the approved Arena membership request is also read for the position", async () => {
    const { address, cap } = await run(
      { memberships: [], approvedRequest: { job_function: "Lead Dentist" } },
      { full_name: "Hanbit Chi" },
    );
    expect(address).toEqual({ kind: "doctor", addressee: "Chi" });
    expect(cap.tables).toContain("arena_membership_requests");
  });

  it("every read is owner-scoped to the signed-in user", async () => {
    const { cap } = await run({ memberships: [] }, { full_name: "Hanbit Chi" });
    expect(cap.tables).toEqual(expect.arrayContaining(["arena_profiles", "memberships", "arena_membership_requests"]));
    expect(cap.filters).toEqual(expect.arrayContaining([["user_id", USER]]));
  });

  it("a non-clinical role is the plain first-name form", async () => {
    const { address } = await run(
      { memberships: [{ role: "office_manager", job_function: "office_manager" }] },
      { full_name: "Hanna Kim" },
    );
    expect(address).toEqual({ kind: "personal", addressee: "Hanna" });
  });

  it("no role rows at all → the safe non-doctor form, never a guess", async () => {
    const { address } = await run({ memberships: [] }, { full_name: "Hanbit Chi" });
    expect(address).toEqual({ kind: "personal", addressee: "Hanbit" });
  });

  it("the real name BTY holds beats the provider name", async () => {
    const { address } = await run({ profileFullName: "Hanbit Chi", memberships: [] }, { full_name: "hchi" });
    expect(address).toEqual({ kind: "personal", addressee: "Hanbit" });
  });

  it("a broken role read only costs the honorific; a broken name read costs the name", async () => {
    const both = await run(
      { throwOn: ["memberships", "arena_membership_requests"], memberships: [{ role: "doctor" }] },
      { full_name: "Hanbit Chi" },
    );
    expect(both.address).toEqual({ kind: "personal", addressee: "Hanbit" });

    const noName = await run(
      { throwOn: ["arena_profiles"], memberships: [{ role: "doctor" }] },
      { full_name: "Hanbit Chi" },
    );
    expect(noName.address).toEqual({ kind: "doctor", addressee: "Chi" });
  });

  it("no identity material anywhere → the generic greeting", async () => {
    const { address } = await run({ memberships: [{ role: "doctor" }] }, null);
    expect(address).toEqual({ kind: "generic", addressee: null });
  });

  it("the ROLE STRING never rides along — only the form of address and the name", async () => {
    const { address } = await run(
      { memberships: [{ role: "doctor", job_function: "Regional Clinical Director" }] },
      { full_name: "Hanbit Chi" },
    );
    // `kind` is the form of address ("doctor"), which the copy layer turns into "Dr.". The
    // position that CHOSE it must not be reachable from the payload in any form.
    expect(Object.keys(address).sort()).toEqual(["addressee", "kind"]);
    expect(address.addressee).toBe("Chi");
    expect(JSON.stringify(address)).not.toMatch(/director|clinical|job_function|role/i);
  });
});
