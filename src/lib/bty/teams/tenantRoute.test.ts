/**
 * Verified Teams routing. Slice Teams Chat-Native Text Training + Quiz V1.
 *
 * The property: a serviceUrl is LEARNED from verified traffic, never guessed, and a tenant BTY has
 * never heard from has no route at all — which is a refusal, not a prompt to invent one.
 */
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rememberTenantRoute, readTenantRoute } from "./tenantRoute.server";

const TENANT = "10110d5c-bd30-467e-9912-e44e67777647";
const SERVICE_URL = "https://smba.trafficmanager.net/amer/";

function makeAdmin(seed: Record<string, unknown>[] = []) {
  const rows = [...seed];
  const from = () => {
    const st = { f: [] as { c: string; v: unknown }[], op: "select" as string, ins: null as Record<string, unknown> | null };
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (c: string, v: unknown) => { st.f.push({ c, v }); return q; },
      upsert: (r: Record<string, unknown>) => { st.op = "upsert"; st.ins = r; return q; },
      maybeSingle: () => Promise.resolve({ data: rows.find((r) => st.f.every((x) => r[x.c] === x.v)) ?? null, error: null }),
      then: (onF: (v: { data: unknown; error: unknown }) => unknown) => {
        if (st.op === "upsert" && st.ins) {
          const hit = rows.find((r) => r.tenant_id === st.ins!.tenant_id);
          if (hit) Object.assign(hit, st.ins); else rows.push({ ...st.ins });
        }
        return Promise.resolve({ data: null, error: null }).then(onF);
      },
    };
    return q;
  };
  return { admin: { from } as unknown as SupabaseClient, rows };
}

describe("routing is recorded only from a well-formed verified observation", () => {
  it("records the tenant's observed url", async () => {
    const { admin, rows } = makeAdmin();
    expect(await rememberTenantRoute(admin, { tenantId: TENANT, serviceUrl: SERVICE_URL })).toBe(true);
    expect(rows[0]).toMatchObject({ tenant_id: TENANT, service_url: SERVICE_URL });
  });

  it("refreshes rather than duplicating when the same tenant is seen again", async () => {
    const { admin, rows } = makeAdmin();
    await rememberTenantRoute(admin, { tenantId: TENANT, serviceUrl: SERVICE_URL });
    await rememberTenantRoute(admin, { tenantId: TENANT, serviceUrl: "https://smba.trafficmanager.net/emea/" });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.service_url).toBe("https://smba.trafficmanager.net/emea/");
  });

  it("refuses a malformed tenant or an empty url rather than half-recording", async () => {
    const { admin, rows } = makeAdmin();
    for (const bad of [
      { tenantId: "", serviceUrl: SERVICE_URL },
      { tenantId: "not-a-guid", serviceUrl: SERVICE_URL },
      { tenantId: TENANT, serviceUrl: "" },
      { tenantId: TENANT, serviceUrl: "   " },
    ]) {
      expect(await rememberTenantRoute(admin, bad), JSON.stringify(bad)).toBe(false);
    }
    expect(rows).toHaveLength(0);
  });
});

describe("★ an unknown tenant has NO route — nothing is defaulted", () => {
  it("reads the recorded url", async () => {
    const { admin } = makeAdmin([{ tenant_id: TENANT, service_url: SERVICE_URL }]);
    expect(await readTenantRoute(admin, TENANT)).toBe(SERVICE_URL);
    expect(await readTenantRoute(admin, TENANT.toUpperCase())).toBe(SERVICE_URL);
  });

  it("returns null for a tenant never observed, and for a malformed one", async () => {
    const { admin } = makeAdmin([{ tenant_id: TENANT, service_url: SERVICE_URL }]);
    expect(await readTenantRoute(admin, "99999999-9999-4999-8999-999999999999")).toBeNull();
    expect(await readTenantRoute(admin, "nonsense")).toBeNull();
    expect(await readTenantRoute(admin, "")).toBeNull();
  });

  it("no regional endpoint is hardcoded in the module", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./tenantRoute.server.ts", import.meta.url), "utf8"),
    );
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/smba|botframework\.com|trafficmanager/i);
  });
});
