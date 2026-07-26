import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveOrCreateProgramForActor, programIdForNewRun, programErrorReason } from "./foundryProgramService";
import { createDraft } from "./foundryModuleService";

type Row = Record<string, unknown>;

/**
 * Minimal fake supporting the exact calls the Program seam uses:
 *   - admin.rpc(name, args) -> configured result (records the last call)
 *   - admin.from("foundry_module_drafts").insert(row).select(cols).single()
 *   - admin.from("foundry_module_drafts").select(cols).eq().eq().maybeSingle()
 *   - admin.from("foundry_programs").delete().eq().eq()  (compensation)
 */
function makeAdmin(opts: {
  rpc?: (name: string, args: Row) => { data: unknown; error: unknown };
  drafts?: Row[];
  failDraftInsert?: boolean;
} = {}) {
  const calls = { rpc: [] as { name: string; args: Row }[], programDeletes: [] as Row[] };
  const drafts: Row[] = (opts.drafts ?? []).map((r) => ({ ...r }));
  let idSeq = 0;

  const admin = {
    rpc(name: string, args: Row) {
      calls.rpc.push({ name, args });
      const res = opts.rpc ? opts.rpc(name, args) : { data: [{ program_id: null }], error: null };
      return Promise.resolve(res);
    },
    from(table: string) {
      if (table === "foundry_programs") {
        const f: Row = {};
        const q = {
          delete() {
            return this;
          },
          eq(c: string, v: unknown) {
            f[c] = v;
            return this;
          },
          then(res: (v: { error: null }) => unknown) {
            calls.programDeletes.push({ ...f });
            return Promise.resolve({ error: null }).then(res);
          },
        };
        return q;
      }
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
          if (opts.failDraftInsert) return Promise.resolve({ data: null, error: { message: "draft_boom" } });
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

  return { admin, calls, drafts };
}

const okRpc = (id: string) => () => ({ data: [{ program_id: id }], error: null });
const errRpc = (msg: string) => () => ({ data: null, error: { message: msg } });

describe("programErrorReason", () => {
  it("maps known raises to stable reasons and defaults otherwise", () => {
    expect(programErrorReason(new Error("...organization_unresolved..."))).toBe("organization_unresolved");
    expect(programErrorReason(new Error("organization_ambiguous"))).toBe("organization_ambiguous");
    expect(programErrorReason(new Error("cross_organization"))).toBe("cross_organization");
    expect(programErrorReason(new Error("program_missing"))).toBe("program_missing");
    expect(programErrorReason(new Error("weird db error"))).toBe("program_resolve_failed");
  });
});

describe("resolveOrCreateProgramForActor (fail-closed)", () => {
  it("returns a NON-NULL program_id the RPC yields", async () => {
    const { admin, calls } = makeAdmin({ rpc: okRpc("prog-1") });
    expect(await resolveOrCreateProgramForActor(admin, "u1", "My Title")).toBe("prog-1");
    expect(calls.rpc[0]?.args).toMatchObject({ p_actor_user_id: "u1", p_title: "My Title", p_program_id: null });
  });

  it("THROWS organization_unresolved when there is no canonical org (no silent null)", async () => {
    const { admin } = makeAdmin({ rpc: errRpc("organization_unresolved") });
    await expect(resolveOrCreateProgramForActor(admin, "u1", "t")).rejects.toThrow(/organization_unresolved/);
  });

  it("THROWS organization_ambiguous on >1 active-primary membership", async () => {
    const { admin } = makeAdmin({ rpc: errRpc("organization_ambiguous") });
    await expect(resolveOrCreateProgramForActor(admin, "u1", "t")).rejects.toThrow(/organization_ambiguous/);
  });

  it("THROWS (fails closed) on a cross-org / missing supplied Program id", async () => {
    const { admin, calls } = makeAdmin({ rpc: errRpc("cross_organization") });
    await expect(resolveOrCreateProgramForActor(admin, "u1", "t", "foreign-prog")).rejects.toThrow(/cross_organization/);
    expect(calls.rpc[0]?.args).toMatchObject({ p_program_id: "foreign-prog" });
  });

  it("treats a null RPC row as unresolved (contract double-guard), never a silent link", async () => {
    const { admin } = makeAdmin({ rpc: () => ({ data: [{ program_id: null }], error: null }) });
    await expect(resolveOrCreateProgramForActor(admin, "u1", "t")).rejects.toThrow(/organization_unresolved/);
  });
});

describe("programIdForNewRun", () => {
  it("uses the Guided draft lineage EXACTLY when present (incl. null), never calling the RPC", async () => {
    const { admin, calls } = makeAdmin({ rpc: okRpc("SHOULD-NOT-USE") });
    expect(await programIdForNewRun(admin, "u1", "t", { programId: "prog-7" })).toBe("prog-7");
    expect(await programIdForNewRun(admin, "u1", "t", { programId: null })).toBeNull();
    expect(calls.rpc.length).toBe(0);
  });

  it("resolves a fresh Program when there is no lineage (Quick / direct create)", async () => {
    const { admin, calls } = makeAdmin({ rpc: okRpc("prog-quick") });
    expect(await programIdForNewRun(admin, "u1", "t")).toBe("prog-quick");
    expect(calls.rpc.length).toBe(1);
  });

  it("FAILS CLOSED (throws) on a resolution error — never a silent null run", async () => {
    const { admin } = makeAdmin({ rpc: errRpc("organization_unresolved") });
    await expect(programIdForNewRun(admin, "u1", "t")).rejects.toThrow(/organization_unresolved/);
  });
});

describe("createDraft — Program lineage (fail-closed)", () => {
  it("an ORIGINAL draft receives a resolved Program identity", async () => {
    const { admin, calls } = makeAdmin({ rpc: okRpc("prog-1") });
    const res = await createDraft(admin, "owner-1");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.program_id).toBe("prog-1");
    expect(calls.rpc.length).toBe(1);
  });

  it("REJECTS a new Guided Program when the owner has no canonical org — NO partial draft", async () => {
    const { admin, drafts } = makeAdmin({ rpc: errRpc("organization_unresolved") });
    const res = await createDraft(admin, "owner-1");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("organization_unresolved");
    expect(drafts.length).toBe(0); // no draft row created
  });

  it("REJECTS on ambiguous org (>1 active-primary), no partial draft", async () => {
    const { admin, drafts } = makeAdmin({ rpc: errRpc("organization_ambiguous") });
    const res = await createDraft(admin, "owner-1");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("organization_ambiguous");
    expect(drafts.length).toBe(0);
  });

  it("COMPENSATES the just-created Program when the draft insert fails (both-or-neither)", async () => {
    const { admin, calls } = makeAdmin({ rpc: okRpc("prog-orphan"), failDraftInsert: true });
    const res = await createDraft(admin, "owner-1");
    expect(res.ok).toBe(false);
    // the Program THIS call minted is deleted so no orphan root remains
    expect(calls.programDeletes).toContainEqual({ id: "prog-orphan", owner_user_id_snapshot: "owner-1" });
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
    const { admin, calls } = makeAdmin({ drafts: [parent], rpc: okRpc("SHOULD-NOT-USE") });
    const res = await createDraft(admin, "owner-1", { parentDraftId: "parent-1" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.program_id).toBe("prog-parent");
      expect(res.value.module_version).toBe(2);
      expect(res.value.parent_module_id).toBe("parent-1");
    }
    expect(calls.rpc.length).toBe(0);
  });

  it("a REVISION of a HISTORICAL (null-lineage) draft inherits null and still succeeds", async () => {
    const legacyParent: Row = {
      id: "legacy-1",
      owner_user_id: "owner-1",
      status: "published",
      current_step: 8,
      answers: {},
      module_version: 1,
      parent_module_id: null,
      program_id: null, // legacy: lineage not recorded
      document_asset_ref: null,
      approved_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { admin, calls } = makeAdmin({ drafts: [legacyParent], rpc: okRpc("SHOULD-NOT-USE") });
    const res = await createDraft(admin, "owner-1", { parentDraftId: "legacy-1" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.program_id).toBeNull();
    expect(calls.rpc.length).toBe(0);
  });
});
