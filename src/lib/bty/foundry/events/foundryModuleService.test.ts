import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  approveDraft,
  createDraft,
  deleteDraft,
  getOwnerDraft,
  getPublishedEventBySourceDraft,
  listOwnerDrafts,
  updateDraftStep,
} from "./foundryModuleService";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

type Row = Record<string, unknown>;

/**
 * Table-aware fake for the two module tables. Emulates the exact Supabase call
 * shapes the service uses: insert().select().single(), select().eq().maybeSingle(),
 * select().eq().order().returns(), update().eq()… (terminal), delete().eq()…
 * (terminal). DB-side defaults for foundry_module_drafts inserts are applied here.
 */
function makeFakeAdmin(seed: { drafts?: Row[]; modules?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    foundry_module_drafts: seed.drafts ? seed.drafts.map((r) => ({ ...r })) : [],
    foundry_event_module: seed.modules ? seed.modules.map((r) => ({ ...r })) : [],
  };
  let idSeq = 0;
  const nextId = (t: string) => `${t}-${++idSeq}`;

  function applyDraftDefaults(row: Row): Row {
    const now = new Date().toISOString();
    return {
      id: row.id ?? nextId("draft"),
      owner_user_id: row.owner_user_id,
      status: row.status ?? "draft",
      current_step: row.current_step ?? 1,
      answers: row.answers ?? {},
      module_version: row.module_version ?? 1,
      parent_module_id: row.parent_module_id ?? null,
      document_asset_ref: row.document_asset_ref ?? null,
      approved_at: row.approved_at ?? null,
      published_at: row.published_at ?? null,
      created_at: row.created_at ?? now,
      updated_at: row.updated_at ?? now,
    };
  }

  function from(table: string) {
    const rows = tables[table] ?? (tables[table] = []); // tolerate new tables (e.g. draft assets sweep)
    const q = {
      _op: "select" as "select" | "insert" | "update" | "delete",
      _filters: [] as Array<{ c: string; v: unknown }>,
      _patch: {} as Row,
      _insert: null as Row | null,
      _sort: null as { c: string; asc: boolean } | null,

      insert(row: Row) {
        this._op = "insert";
        this._insert = row;
        return this;
      },
      update(patch: Row) {
        this._op = "update";
        this._patch = patch;
        return this;
      },
      delete() {
        this._op = "delete";
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
      _match(r: Row) {
        return this._filters.every((f) => r[f.c] === f.v);
      },
      _matches() {
        let out = rows.filter((r) => this._match(r));
        if (this._sort) {
          const { c, asc } = this._sort;
          out = [...out].sort((a, b) => {
            const av = String(a[c] ?? "");
            const bv = String(b[c] ?? "");
            return asc ? av.localeCompare(bv) : bv.localeCompare(av);
          });
        }
        return out;
      },
      single() {
        if (this._op === "insert" && this._insert) {
          const row = table === "foundry_module_drafts" ? applyDraftDefaults(this._insert) : { ...this._insert };
          rows.push(row);
          return Promise.resolve({ data: { ...row }, error: null });
        }
        const hit = this._matches()[0] ?? null;
        return Promise.resolve({ data: hit ? { ...hit } : null, error: null });
      },
      maybeSingle() {
        const hit = this._matches()[0] ?? null;
        return Promise.resolve({ data: hit ? { ...hit } : null, error: null });
      },
      returns() {
        return Promise.resolve({ data: this._matches().map((r) => ({ ...r })), error: null });
      },
      then(onF: (v: { data: null; error: null }) => unknown) {
        // terminal for update()/delete() (no .select() chained).
        if (this._op === "update") {
          this._matches().forEach((r) => Object.assign(r, this._patch));
        } else if (this._op === "delete") {
          for (const r of this._matches()) {
            const i = rows.indexOf(r);
            if (i >= 0) rows.splice(i, 1);
          }
        }
        return Promise.resolve({ data: null, error: null }).then(onF);
      },
    };
    return q;
  }

  // Program resolve-or-create RPC (Slice 3.2C-R1): default = a Host WITH one
  // active-primary org → a resolved Program identity. createDraft now fails closed
  // without it, so an original draft receives a non-null program_id here.
  function rpc(name: string) {
    if (name === "bty_foundry_resolve_or_create_program") {
      return Promise.resolve({ data: [{ program_id: "prog-test" }], error: null });
    }
    return Promise.resolve({ data: null, error: { message: "unknown rpc" } });
  }
  return { admin: { from, rpc } as unknown as SupabaseClient, tables };
}

const OWNER = "owner-1";
const OTHER = "owner-2";

/** A builder-complete draft (YouTube material) — passes the builder approval gate. */
function completeAnswers(): BuilderAnswers {
  return {
    problem: "Handoffs skip the double-check.",
    audienceType: "everyone",
    observableBehavior: "The charge nurse reads back the dosage at every shift handoff before sign-off.",
    successEvidence: "Sign-offs include a witnessed verbal read-back.",
    evidenceType: "seen",
    learningNeeds: ["practice"],
    materialIntent: "youtube",
    materialText: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    followUpDays: 7,
    completionPrompt: "What read-back will you commit to next shift?",
  };
}

describe("createDraft", () => {
  it("creates an owner-scoped draft with defaults (draft, v1, step 1)", async () => {
    const { admin } = makeFakeAdmin();
    const r = await createDraft(admin, OWNER);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.owner_user_id).toBe(OWNER);
    expect(r.value.status).toBe("draft");
    expect(r.value.module_version).toBe(1);
    expect(r.value.current_step).toBe(1);
    expect(r.value.parent_module_id).toBeNull();
  });

  it("a revision from a parent bumps the version and links lineage", async () => {
    const { admin } = makeFakeAdmin({
      drafts: [
        { id: "d-parent", owner_user_id: OWNER, status: "published", module_version: 1, approved_at: "t", published_at: "t" },
      ],
    });
    const r = await createDraft(admin, OWNER, { parentDraftId: "d-parent" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.module_version).toBe(2);
    expect(r.value.parent_module_id).toBe("d-parent");
    expect(r.value.status).toBe("draft");
  });

  it("refuses a revision from a foreign-owner parent (non-disclosing)", async () => {
    const { admin } = makeFakeAdmin({
      drafts: [{ id: "d-parent", owner_user_id: OTHER, status: "published", module_version: 3 }],
    });
    const r = await createDraft(admin, OWNER, { parentDraftId: "d-parent" });
    expect(r).toEqual({ ok: false, reason: "parent_not_found" });
  });
});

describe("owner isolation", () => {
  it("getOwnerDraft returns null for another owner's draft", async () => {
    const { admin } = makeFakeAdmin({ drafts: [{ id: "d1", owner_user_id: OTHER, status: "draft" }] });
    expect(await getOwnerDraft(admin, OWNER, "d1")).toBeNull();
  });

  it("listOwnerDrafts returns only the caller's drafts", async () => {
    const { admin } = makeFakeAdmin({
      drafts: [
        { id: "d1", owner_user_id: OWNER, status: "draft", current_step: 1, module_version: 1, updated_at: "2026-01-02", created_at: "2026-01-01" },
        { id: "d2", owner_user_id: OTHER, status: "draft", current_step: 1, module_version: 1, updated_at: "2026-01-03", created_at: "2026-01-01" },
      ],
    });
    const list = await listOwnerDrafts(admin, OWNER);
    expect(list.map((d) => d.id)).toEqual(["d1"]);
  });

  it("updateDraftStep cannot touch a foreign owner's draft", async () => {
    const { admin } = makeFakeAdmin({ drafts: [{ id: "d1", owner_user_id: OTHER, status: "draft" }] });
    const r = await updateDraftStep(admin, OWNER, "d1", { currentStep: 3 });
    expect(r).toEqual({ ok: false, reason: "draft_not_found" });
  });
});

describe("updateDraftStep", () => {
  it("shallow-merges answers and advances the step while draft", async () => {
    const { admin } = makeFakeAdmin();
    const created = await createDraft(admin, OWNER, { answers: { problem: "old" } });
    if (!created.ok) throw new Error("setup");
    const r = await updateDraftStep(admin, OWNER, created.value.id, {
      answers: { capability: "new" },
      currentStep: 2,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.answers).toEqual({ problem: "old", capability: "new" });
    expect(r.value.current_step).toBe(2);
  });

  it("rejects mutation after approval (immutable)", async () => {
    const { admin } = makeFakeAdmin({
      drafts: [{ id: "d1", owner_user_id: OWNER, status: "approved", answers: {}, approved_at: "t" }],
    });
    const r = await updateDraftStep(admin, OWNER, "d1", { currentStep: 2 });
    expect(r).toEqual({ ok: false, reason: "draft_not_mutable" });
  });
});

describe("approveDraft (draft -> approved)", () => {
  it("approves a complete draft and stamps approved_at", async () => {
    const { admin } = makeFakeAdmin();
    const created = await createDraft(admin, OWNER, { answers: completeAnswers() });
    if (!created.ok) throw new Error("setup");
    const r = await approveDraft(admin, OWNER, created.value.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.status).toBe("approved");
    expect(r.value.approved_at).toBeTruthy();
  });

  it("refuses to approve an incomplete draft with the failing reason", async () => {
    const { admin } = makeFakeAdmin();
    const created = await createDraft(admin, OWNER, { answers: { problem: "only this" } });
    if (!created.ok) throw new Error("setup");
    const r = await approveDraft(admin, OWNER, created.value.id);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).not.toBe("");
  });

  it("refuses to re-approve an already-approved draft (no backward mutation)", async () => {
    const { admin } = makeFakeAdmin({
      drafts: [{ id: "d1", owner_user_id: OWNER, status: "approved", answers: completeAnswers(), approved_at: "t" }],
    });
    const r = await approveDraft(admin, OWNER, "d1");
    expect(r).toEqual({ ok: false, reason: "draft_not_mutable" });
  });
});

describe("deleteDraft", () => {
  it("deletes a draft", async () => {
    const { admin, tables } = makeFakeAdmin();
    const created = await createDraft(admin, OWNER);
    if (!created.ok) throw new Error("setup");
    const r = await deleteDraft(admin, OWNER, created.value.id);
    expect(r).toEqual({ ok: true, value: { deleted: true } });
    expect(tables.foundry_module_drafts).toHaveLength(0);
  });

  it("refuses to delete a published draft (immutable + FK-referenced)", async () => {
    const { admin } = makeFakeAdmin({
      drafts: [{ id: "d1", owner_user_id: OWNER, status: "published", approved_at: "t", published_at: "t" }],
    });
    const r = await deleteDraft(admin, OWNER, "d1");
    expect(r).toEqual({ ok: false, reason: "draft_not_mutable" });
  });

  it("refuses to delete a foreign owner's draft", async () => {
    const { admin } = makeFakeAdmin({ drafts: [{ id: "d1", owner_user_id: OTHER, status: "draft" }] });
    const r = await deleteDraft(admin, OWNER, "d1");
    expect(r).toEqual({ ok: false, reason: "draft_not_found" });
  });
});

describe("getPublishedEventBySourceDraft (publish idempotency lookup seam)", () => {
  it("resolves the event a draft version already published", async () => {
    const { admin } = makeFakeAdmin({
      modules: [{ event_id: "e1", source_draft_id: "d1", module_version: 1 }],
    });
    const ref = await getPublishedEventBySourceDraft(admin, "d1");
    expect(ref).toEqual({ event_id: "e1", source_draft_id: "d1", module_version: 1 });
  });

  it("returns null when the draft has not been published", async () => {
    const { admin } = makeFakeAdmin();
    expect(await getPublishedEventBySourceDraft(admin, "d-unpublished")).toBeNull();
  });
});
