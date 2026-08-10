import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createOrResumeRevision, isEventRevisable } from "./foundryRevisionService";

type Row = Record<string, unknown>;

/**
 * Table-aware fake covering the exact call shapes the revision seam + createDraft
 * use: select().eq()…maybeSingle(), select().eq()…order().limit().maybeSingle(),
 * insert().select().single(). No RPC is needed — a revision inherits program_id
 * from its parent (never re-resolves), which this fake proves by NOT providing rpc.
 */
function makeAdmin(seed: { modules?: Row[]; drafts?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    foundry_event_module: (seed.modules ?? []).map((r) => ({ ...r })),
    foundry_module_drafts: (seed.drafts ?? []).map((r) => ({ ...r })),
    foundry_programs: [],
  };
  let idSeq = 0;
  const calls = { rpc: 0 };

  function draftDefaults(row: Row): Row {
    const now = new Date().toISOString();
    return {
      id: row.id ?? `draft-${++idSeq}`,
      owner_user_id: row.owner_user_id,
      status: row.status ?? "draft",
      current_step: row.current_step ?? 1,
      answers: row.answers ?? {},
      module_version: row.module_version ?? 1,
      parent_module_id: row.parent_module_id ?? null,
      program_id: row.program_id ?? null,
      document_asset_ref: row.document_asset_ref ?? null,
      approved_at: row.approved_at ?? null,
      published_at: row.published_at ?? null,
      created_at: row.created_at ?? now,
      updated_at: row.updated_at ?? now,
    };
  }

  function from(table: string) {
    const rows = (tables[table] ??= []);
    const q = {
      _filters: [] as Array<{ c: string; v: unknown }>,
      _sort: null as { c: string; asc: boolean } | null,
      _limit: null as number | null,
      _insert: null as Row | null,
      insert(row: Row) {
        this._insert = row;
        return this;
      },
      delete() {
        return this;
      },
      select() {
        return this;
      },
      eq(c: string, v: unknown) {
        this._filters.push({ c, v });
        return this;
      },
      order(c: string, opts?: { ascending?: boolean }) {
        this._sort = { c, asc: opts?.ascending ?? true };
        return this;
      },
      limit(n: number) {
        this._limit = n;
        return this;
      },
      _match() {
        let out = rows.filter((r) => this._filters.every((f) => r[f.c] === f.v));
        if (this._sort) {
          const { c, asc } = this._sort;
          out = [...out].sort((a, b) => {
            const av = Number(a[c] ?? 0);
            const bv = Number(b[c] ?? 0);
            return asc ? av - bv : bv - av;
          });
        }
        if (this._limit != null) out = out.slice(0, this._limit);
        return out;
      },
      maybeSingle() {
        return Promise.resolve({ data: this._match()[0] ?? null, error: null });
      },
      /*
        Slice 3.2P-R2.1: revision creation now clones the parent's source attachment, and that
        read uses `.returns<T>()`. With no asset rows in these fixtures it resolves empty and
        the clone is a no-op — which is exactly the case these tests describe (a draft with no
        material). Asset copying itself is proved in `revisionAssetContinuity.test.ts`.
      */
      returns() {
        return Promise.resolve({ data: this._match(), error: null });
      },
      single() {
        if (this._insert) {
          const row = draftDefaults(this._insert);
          rows.push(row);
          return Promise.resolve({ data: row, error: null });
        }
        return Promise.resolve({ data: this._match()[0] ?? null, error: null });
      },
    };
    return q;
  }

  const admin = {
    from,
    rpc() {
      calls.rpc += 1;
      return Promise.resolve({ data: null, error: { message: "rpc_should_not_be_called_for_revision" } });
    },
  } as unknown as SupabaseClient;

  return { admin, tables, calls };
}

const OWNER = "owner-1";
const PROG = "prog-1";
// A published V1 draft + its event→module mapping, owned by OWNER.
function guidedSeed(overrides: { srcStatus?: string; srcProgram?: string | null; srcOwner?: string } = {}) {
  const v1: Row = {
    id: "v1",
    owner_user_id: overrides.srcOwner ?? OWNER,
    status: overrides.srcStatus ?? "published",
    module_version: 1,
    parent_module_id: null,
    program_id: overrides.srcProgram === undefined ? PROG : overrides.srcProgram,
    answers: { problem: "P", audienceType: "everyone", nested: { a: 1 } },
    approved_at: new Date().toISOString(),
    published_at: new Date().toISOString(),
  };
  return { modules: [{ event_id: "E1", source_draft_id: "v1" }], drafts: [v1] };
}

describe("createOrResumeRevision — resolver / authorization (A)", () => {
  it("non-Guided event (no module mapping) → not_guided_program", async () => {
    const { admin } = makeAdmin({ modules: [], drafts: [] });
    expect(await createOrResumeRevision(admin, OWNER, "E1")).toEqual({ ok: false, reason: "not_guided_program" });
    expect(await isEventRevisable(admin, OWNER, "E1")).toBe(false);
  });

  it("missing source draft → source_not_found", async () => {
    const { admin } = makeAdmin({ modules: [{ event_id: "E1", source_draft_id: "gone" }], drafts: [] });
    expect(await createOrResumeRevision(admin, OWNER, "E1")).toEqual({ ok: false, reason: "source_not_found" });
  });

  it("another Host's source draft → not_owner (non-disclosing)", async () => {
    const { admin } = makeAdmin(guidedSeed({ srcOwner: "other" }));
    expect(await createOrResumeRevision(admin, OWNER, "E1")).toEqual({ ok: false, reason: "not_owner" });
    expect(await isEventRevisable(admin, OWNER, "E1")).toBe(false);
  });

  it("source not published → source_not_published", async () => {
    const { admin } = makeAdmin(guidedSeed({ srcStatus: "draft" }));
    expect(await createOrResumeRevision(admin, OWNER, "E1")).toEqual({ ok: false, reason: "source_not_published" });
  });

  it("source has no program lineage → program_lineage_missing", async () => {
    const { admin } = makeAdmin(guidedSeed({ srcProgram: null }));
    expect(await createOrResumeRevision(admin, OWNER, "E1")).toEqual({ ok: false, reason: "program_lineage_missing" });
  });

  it("valid Guided published source owned by caller → revisable", async () => {
    const { admin } = makeAdmin(guidedSeed());
    expect(await isEventRevisable(admin, OWNER, "E1")).toBe(true);
  });
});

describe("createOrResumeRevision — version lineage (B) + prefill (C) + no Program mint", () => {
  it("creates V2: new id, parent=V1, next version, inherited program_id, copied answers; no rpc, no event, V1 untouched", async () => {
    const { admin, tables, calls } = makeAdmin(guidedSeed());
    const res = await createOrResumeRevision(admin, OWNER, "E1");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.resumed).toBe(false);
      expect(res.programId).toBe(PROG);
      expect(res.moduleVersion).toBe(2);
    }
    const v2 = tables.foundry_module_drafts.find((d) => d.id !== "v1");
    expect(v2?.parent_module_id).toBe("v1"); // B: parent lineage
    expect(v2?.module_version).toBe(2); // B: next version
    expect(v2?.program_id).toBe(PROG); // B: inherited program_id
    expect(v2?.answers).toEqual({ problem: "P", audienceType: "everyone", nested: { a: 1 } }); // C: prefill copied
    expect(calls.rpc).toBe(0); // B: revision NEVER re-resolves a Program (no mint)
    expect(tables.foundry_programs.length).toBe(0); // B: no new Program row
    // V1 unchanged
    const v1 = tables.foundry_module_drafts.find((d) => d.id === "v1");
    expect(v1?.status).toBe("published");
    expect(v1?.module_version).toBe(1);
    // no event created by the revision entry
    expect(Object.keys(tables)).not.toContain("foundry_events");
  });

  it("editing V2 answers never mutates V1 answers (independent rows)", async () => {
    const { admin, tables } = makeAdmin(guidedSeed());
    await createOrResumeRevision(admin, OWNER, "E1");
    const v2 = tables.foundry_module_drafts.find((d) => d.id !== "v1")!;
    (v2.answers as Row).problem = "EDITED";
    const v1 = tables.foundry_module_drafts.find((d) => d.id === "v1")!;
    expect((v1.answers as Row).problem).toBe("P"); // V1 intact
  });
});

describe("createOrResumeRevision — idempotency / linearity (D)", () => {
  it("a second call RESUMES the existing open child (no duplicate open draft)", async () => {
    const { admin, tables } = makeAdmin(guidedSeed());
    const first = await createOrResumeRevision(admin, OWNER, "E1");
    const second = await createOrResumeRevision(admin, OWNER, "E1");
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.resumed).toBe(true);
      expect(second.draftId).toBe(first.draftId);
    }
    // exactly one V2 draft exists
    expect(tables.foundry_module_drafts.filter((d) => d.parent_module_id === "v1").length).toBe(1);
  });

  it("selecting an OLD version when a newer published version exists → newer_version_exists + latest id", async () => {
    const seed = guidedSeed();
    // add a newer published V2 in the same program; the event still points at V1.
    seed.drafts.push({
      id: "v2pub",
      owner_user_id: OWNER,
      status: "published",
      module_version: 2,
      parent_module_id: "v1",
      program_id: PROG,
      answers: {},
      approved_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
    });
    const { admin } = makeAdmin(seed);
    const res = await createOrResumeRevision(admin, OWNER, "E1");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("newer_version_exists");
      expect(res.latestVersionDraftId).toBe("v2pub");
    }
  });
});
