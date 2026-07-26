import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveOrCreateProgramForActor, programIdForNewRun } from "./foundryProgramService";
import { createDraft } from "./foundryModuleService";

type Row = Record<string, unknown>;

/**
 * Minimal fake supporting the exact calls the Program seam uses:
 *   - admin.rpc(name, args) -> configured result (records the last call)
 *   - admin.from("foundry_module_drafts").insert(row).select(cols).single()
 *   - admin.from("foundry_module_drafts").select(cols).eq().eq().maybeSingle()
 */
function makeAdmin(opts: {
  rpc?: (name: string, args: Row) => { data: unknown; error: unknown };
  drafts?: Row[];
} = {}) {
  const calls: { rpc: { name: string; args: Row }[] } = { rpc: [] };
  const drafts: Row[] = (opts.drafts ?? []).map((r) => ({ ...r }));
  let idSeq = 0;

  const admin = {
    rpc(name: string, args: Row) {
      calls.rpc.push({ name, args });
      const res = opts.rpc ? opts.rpc(name, args) : { data: [{ program_id: null }], error: null };
      return Promise.resolve(res);
    },
    from(table: string) {
      if (table !== "foundry_module_drafts") throw new Error(`unexpected table ${table}`);
      const q = {
        _insert: null as Row | null,
        _filters: [] as Array<{ c: string; v: unknown }>,
        insert(row: Row) {
          this._insert = row;
          return this;
        },
        select() {
          return this;
        },
        eq(c: string, v: unknown) {
          this._filters.push({ c, v });
          return this;
        },
        single() {
          const now = new Date().toISOString();
          const row: Row = {
            id: `draft-${++idSeq}`,
            status: "draft",
            current_step: 1,
            answers: {},
            module_version: 1,
            parent_module_id: null,
            program_id: null,
            document_asset_ref: null,
            approved_at: null,
            published_at: null,
            created_at: now,
            updated_at: now,
            ...(this._insert ?? {}),
          };
          drafts.push(row);
          return Promise.resolve({ data: row, error: null });
        },
        maybeSingle() {
          const found = drafts.find((r) => this._filters.every((f) => r[f.c] === f.v));
          return Promise.resolve({ data: found ?? null, error: null });
        },
      };
      return q;
    },
  } as unknown as SupabaseClient;

  return { admin, calls };
}

describe("resolveOrCreateProgramForActor", () => {
  it("returns the program_id the RPC yields", async () => {
    const { admin, calls } = makeAdmin({ rpc: () => ({ data: [{ program_id: "prog-1" }], error: null }) });
    const id = await resolveOrCreateProgramForActor(admin, "u1", "My Title");
    expect(id).toBe("prog-1");
    expect(calls.rpc[0]?.name).toBe("bty_foundry_resolve_or_create_program");
    expect(calls.rpc[0]?.args).toMatchObject({ p_actor_user_id: "u1", p_title: "My Title", p_program_id: null });
  });

  it("returns null when the actor has no resolvable org (best-effort)", async () => {
    const { admin } = makeAdmin({ rpc: () => ({ data: [{ program_id: null }], error: null }) });
    expect(await resolveOrCreateProgramForActor(admin, "u1", "t")).toBeNull();
  });

  it("passes an explicit existing program_id through for same-org resolution", async () => {
    const { admin, calls } = makeAdmin({ rpc: () => ({ data: [{ program_id: "prog-9" }], error: null }) });
    await resolveOrCreateProgramForActor(admin, "u1", "t", "prog-9");
    expect(calls.rpc[0]?.args).toMatchObject({ p_program_id: "prog-9" });
  });

  it("THROWS (fails closed) on a cross-org / missing Program RPC error", async () => {
    const { admin } = makeAdmin({ rpc: () => ({ data: null, error: { message: "cross_organization" } }) });
    await expect(resolveOrCreateProgramForActor(admin, "u1", "t", "foreign-prog")).rejects.toThrow(/cross_organization/);
  });
});

describe("programIdForNewRun", () => {
  it("uses the Guided draft lineage EXACTLY when present (never calls the RPC)", async () => {
    const { admin, calls } = makeAdmin({ rpc: () => ({ data: [{ program_id: "SHOULD-NOT-USE" }], error: null }) });
    expect(await programIdForNewRun(admin, "u1", "t", { programId: "prog-7" })).toBe("prog-7");
    // a draft with NO recorded lineage yields an unlinked run (null), still no RPC
    expect(await programIdForNewRun(admin, "u1", "t", { programId: null })).toBeNull();
    expect(calls.rpc.length).toBe(0);
  });

  it("resolves a fresh Program when there is no lineage (Quick / direct create)", async () => {
    const { admin, calls } = makeAdmin({ rpc: () => ({ data: [{ program_id: "prog-quick" }], error: null }) });
    expect(await programIdForNewRun(admin, "u1", "t")).toBe("prog-quick");
    expect(calls.rpc.length).toBe(1);
  });

  it("is best-effort: a resolution error yields null, never blocking run creation", async () => {
    const { admin } = makeAdmin({ rpc: () => ({ data: null, error: { message: "boom" } }) });
    expect(await programIdForNewRun(admin, "u1", "t")).toBeNull();
  });
});

describe("createDraft — Program lineage", () => {
  it("an ORIGINAL draft receives a resolved Program identity", async () => {
    const { admin, calls } = makeAdmin({ rpc: () => ({ data: [{ program_id: "prog-1" }], error: null }) });
    const res = await createDraft(admin, "owner-1");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.program_id).toBe("prog-1");
    expect(calls.rpc.length).toBe(1);
  });

  it("an original draft is still created (unlinked) when the owner has no org", async () => {
    const { admin } = makeAdmin({ rpc: () => ({ data: [{ program_id: null }], error: null }) });
    const res = await createDraft(admin, "owner-1");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.program_id).toBeNull();
  });

  it("a REVISION INHERITS the parent's Program identity and does NOT re-resolve", async () => {
    const parent: Row = {
      id: "parent-1",
      owner_user_id: "owner-1",
      status: "published",
      current_step: 8,
      answers: {},
      module_version: 1,
      parent_module_id: null,
      program_id: "prog-parent",
      document_asset_ref: null,
      approved_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { admin, calls } = makeAdmin({
      drafts: [parent],
      rpc: () => ({ data: [{ program_id: "SHOULD-NOT-USE" }], error: null }),
    });
    const res = await createDraft(admin, "owner-1", { parentDraftId: "parent-1" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.program_id).toBe("prog-parent");
      expect(res.value.module_version).toBe(2);
      expect(res.value.parent_module_id).toBe("parent-1");
    }
    expect(calls.rpc.length).toBe(0); // inheritance never calls the resolver
  });
});
