/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// Authentication and database/provider transports only are replaced. These tests
// execute the real manager gate, author resolver, owner-scoped draft service and
// client serializer together. Synthetic rows never leave this process.
const state = vi.hoisted(() => ({
  user: { id: "owner-1" } as ({ id: string } & Record<string, unknown>) | null,
  admin: true, adminReads: 0,
  failedTable: null as string | null,
  rows: {} as Record<string, Record<string, unknown>[]>,
  queries: [] as { table: string; filters: Record<string, unknown> }[],
  refresh: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
}));
vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: async () => ({ user: state.user, base: NextResponse.json({ ok: true }) }),
  unauthenticated: () => NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => {
    state.adminReads++;
    if (!state.admin) return null;
    return { from(table: string) {
      const filters: Record<string, unknown> = {};
      state.queries.push({ table, filters });
      const result = () => {
        if (table === state.failedTable) return { data: null, error: { code: "XX001" } };
        const rows = (state.rows[table] ?? []).filter(row => Object.entries(filters).every(([key, value]) => row[key] === value));
        return { data: rows, error: null };
      };
      const q = {
        select: () => q,
        eq: (column: string, value: unknown) => { filters[column] = value; return q; },
        order: () => q,
        async maybeSingle() { const r = result(); return { ...r, data: r.data?.[0] ?? null }; },
        async returns() { return result(); },
        then(resolve: (value: ReturnType<typeof result>) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(result()).then(resolve, reject);
        },
      };
      return q;
    } };
  },
}));
vi.mock("@/lib/bty/foundry/events/microsoftManagerSync.server", () => ({
  refreshMicrosoftAuthorityForCanonicalUser: (...args: unknown[]) => state.refresh(...args),
}));

import { GET as listDrafts } from "./modules/route";
import { GET as readDraft } from "./modules/[id]/route";
const request = (path = "/modules") => new NextRequest("http://localhost/api/bty/foundry" + path);
const read = (id: string) => readDraft(request("/modules/" + id), { params: Promise.resolve({ id }) });
const draft = (id: string, owner: string) => ({ id, owner_user_id: owner, status: "draft", current_step: 1,
  answers: { problem: "A synthetic training problem" }, module_version: 1, parent_module_id: null,
  program_id: null, document_asset_ref: null, approved_at: null, published_at: null,
  created_at: "2026-10-31T00:00:00Z", updated_at: "2026-10-31T00:00:00Z" });
const manualHost = (manual_granted: boolean | null = true) => {
  state.rows.foundry_host_grants = [{ user_id: "owner-1", status: "active", manual_granted }];
};
const directory = (patch: Record<string, unknown> = {}) => {
  state.rows.bty_microsoft_directory_authority = [{ linked_user_id: "owner-1", sync_status: "success",
    account_enabled: true, user_type: "Member", is_provider: true, is_manager: false, ...patch }];
};
const draftQueries = () => state.queries.filter(query => query.table === "foundry_module_drafts");

beforeEach(() => {
  state.user = { id: "owner-1" }; state.admin = true; state.adminReads = 0; state.failedTable = null;
  state.rows = { foundry_module_drafts: [draft("owned", "owner-1"), draft("foreign", "other-owner")] };
  state.queries.length = 0; state.refresh.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("External requests are forbidden in this fixture"); }));
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("actual Foundry author gate and owned-draft route/service contract", () => {
  it("refuses unauthenticated callers before acquiring a private client or reading content", async () => {
    state.user = null; expect((await listDrafts(request())).status).toBe(401);
    expect(state.adminReads).toBe(0); expect(state.queries).toEqual([]);
  });
  it("fails closed when the private client is unavailable", async () => {
    state.admin = false; const response = await listDrafts(request());
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: "ADMIN_CLIENT_UNAVAILABLE" });
    expect(state.queries).toEqual([]);
  });
  it("does not treat authentication as author authority", async () => {
    const response = await listDrafts(request());
    expect(response.status).toBe(403); expect(await response.json()).toEqual({ error: "foundry_author_required" });
    expect(draftQueries()).toEqual([]);
  });
  it("allows a platform admin without querying unrelated Host/directory sources", async () => {
    state.rows.bty_platform_admin_grants = [{ user_id: "owner-1", status: "active" }];
    expect((await read("owned")).status).toBe(200);
    expect(state.queries.some(q => q.table === "foundry_host_grants")).toBe(false);
    expect(state.queries.some(q => q.table === "bty_microsoft_directory_authority")).toBe(false);
    expect(state.refresh).not.toHaveBeenCalled();
  });
  it.each([true, null])("preserves explicit/legacy manual Host exception (%s)", async manual => {
    manualHost(manual); expect((await read("owned")).status).toBe(200);
    expect(state.queries.some(q => q.table === "bty_microsoft_directory_authority")).toBe(false);
    expect(state.refresh).not.toHaveBeenCalled();
  });
  it.each([
    { is_provider: true, is_manager: false }, { is_provider: false, is_manager: true },
  ])("allows a successfully synced enabled Microsoft member (%j)", async role => {
    directory(role); expect((await read("owned")).status).toBe(200);
    expect(state.refresh).not.toHaveBeenCalled();
  });
  it.each([
    { account_enabled: false }, { user_type: "Guest" }, { sync_status: "indeterminate" },
    { is_provider: false, is_manager: false }, { linked_user_id: "other-owner" },
  ])("refuses ineligible/foreign Microsoft snapshots (%j) before content access", async patch => {
    directory(patch); expect((await listDrafts(request())).status).toBe(403); expect(draftQueries()).toEqual([]);
  });
  it("does not accept a Microsoft-derived Host grant without a currently eligible directory snapshot", async () => {
    manualHost(false); directory({ is_provider: false, is_manager: false });
    expect((await listDrafts(request())).status).toBe(403); expect(draftQueries()).toEqual([]);
  });
  it("does not accept a revoked explicit Host grant", async () => {
    manualHost(); state.rows.foundry_host_grants[0].status = "revoked";
    expect((await listDrafts(request())).status).toBe(403); expect(draftQueries()).toEqual([]);
  });
  it("fails closed when the directory authority query fails", async () => {
    directory(); state.failedTable = "bty_microsoft_directory_authority";
    expect((await listDrafts(request())).status).toBe(403); expect(draftQueries()).toEqual([]);
  });
  it("never authorizes from client/user metadata, an email or a claimed role", async () => {
    state.user = { id: "owner-1", email: "admin@example.invalid", user_metadata: { role: "doctor", is_manager: true } };
    expect((await listDrafts(request("/modules?role=admin&owner_user_id=other-owner"))).status).toBe(403);
    expect(draftQueries()).toEqual([]);
  });
  it("lists only the canonical caller's drafts even when another owner is requested", async () => {
    manualHost(); const response = await listDrafts(request("/modules?owner_user_id=other-owner&userId=other-owner"));
    expect(response.status).toBe(200); const body = await response.json();
    expect(body.drafts.map((row: { id: string }) => row.id)).toEqual(["owned"]);
    expect(JSON.stringify(body)).not.toMatch(/owner_user_id|other-owner/);
    expect(draftQueries()).toEqual([{ table: "foundry_module_drafts", filters: { owner_user_id: "owner-1" } }]);
  });
  it("makes foreign and missing drafts indistinguishable through the real owner-scoped service", async () => {
    manualHost(); const foreign = await read("foreign"), missing = await read("missing");
    expect(foreign.status).toBe(404); expect(missing.status).toBe(404);
    expect(await foreign.json()).toEqual(await missing.json());
    expect(draftQueries().every(q => q.filters.owner_user_id === "owner-1")).toBe(true);
    expect(state.queries.some(q => q.table === "foundry_module_draft_assets")).toBe(false);
  });
  it("keeps platform admin capability owner-scoped instead of granting foreign-content access", async () => {
    state.rows.bty_platform_admin_grants = [{ user_id: "owner-1", status: "active" }];
    expect((await read("foreign")).status).toBe(404);
    expect(draftQueries()).toEqual([{ table: "foundry_module_drafts", filters: { id: "foreign", owner_user_id: "owner-1" } }]);
  });
});
