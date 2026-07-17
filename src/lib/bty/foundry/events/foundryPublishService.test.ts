import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Publish transaction (Slice 2.3A). The two heavy collaborators — YouTube event
 * creation (network embeddability) and the content-type-aware room snapshot — are
 * mocked; every draft/event_module/asset DB op runs against a fake admin so the
 * transaction spine (idempotency, snapshot whitelist, PDF durable-reference,
 * draft->published, compensation) is exercised for real.
 */
const createTrainingEvent = vi.fn();
const getOwnerRoomSnapshot = vi.fn();

vi.mock("./foundryTrainingService", () => ({
  createTrainingEvent: (...a: unknown[]) => createTrainingEvent(...a),
}));
vi.mock("./foundryDocumentService", () => ({
  getOwnerRoomSnapshot: (...a: unknown[]) => getOwnerRoomSnapshot(...a),
}));

import { publishDraft } from "./foundryPublishService";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

function makeFakeAdmin(tables: Tables) {
  function from(table: string) {
    const rows = tables[table] ?? (tables[table] = []);
    const q: Record<string, unknown> = {
      _op: "select" as "select" | "insert" | "update" | "delete",
      _filters: [] as Array<{ c: string; v: unknown }>,
      _ins: [] as Array<{ c: string; arr: unknown[] }>,
      _patch: {} as Row,
      _insert: null as Row | null,
      _limit: Infinity,
      insert(this: Record<string, unknown>, row: Row) {
        this._op = "insert";
        this._insert = row;
        return this;
      },
      update(this: Record<string, unknown>, patch: Row) {
        this._op = "update";
        this._patch = patch;
        return this;
      },
      delete(this: Record<string, unknown>) {
        this._op = "delete";
        return this;
      },
      select() {
        return this;
      },
      eq(this: { _filters: Array<{ c: string; v: unknown }> }, c: string, v: unknown) {
        this._filters.push({ c, v });
        return this;
      },
      in(this: { _ins: Array<{ c: string; arr: unknown[] }> }, c: string, arr: unknown[]) {
        this._ins.push({ c, arr });
        return this;
      },
      order() {
        return this;
      },
      limit(this: Record<string, unknown>, n: number) {
        this._limit = n;
        return this;
      },
      _match(this: { _filters: Array<{ c: string; v: unknown }>; _ins: Array<{ c: string; arr: unknown[] }> }, r: Row) {
        return this._filters.every((f) => r[f.c] === f.v) && this._ins.every((f) => f.arr.includes(r[f.c]));
      },
      _matches(this: { _match: (r: Row) => boolean; _limit: number }) {
        const out = rows.filter((r) => this._match(r));
        return Number.isFinite(this._limit) ? out.slice(0, this._limit as number) : out;
      },
      single(this: Record<string, unknown>) {
        if (this._op === "insert" && this._insert) {
          const row = { ...(this._insert as Row) };
          if (table === "foundry_events" && !row.id) row.id = `ev-${rows.length + 1}`;
          rows.push(row);
          return Promise.resolve({ data: { ...row }, error: null });
        }
        const hit = (this._matches as () => Row[])()[0] ?? null;
        return Promise.resolve({ data: hit ? { ...hit } : null, error: null });
      },
      maybeSingle(this: Record<string, unknown>) {
        const hit = (this._matches as () => Row[])()[0] ?? null;
        return Promise.resolve({ data: hit ? { ...hit } : null, error: null });
      },
      returns(this: Record<string, unknown>) {
        return Promise.resolve({ data: (this._matches as () => Row[])().map((r) => ({ ...r })), error: null });
      },
      then(this: Record<string, unknown>, onF: (v: { data: unknown; error: unknown }) => unknown) {
        if (this._op === "insert" && this._insert) {
          const uniqOn = table === "foundry_event_module" ? "source_draft_id" : null;
          if (uniqOn && rows.some((r) => r[uniqOn] === (this._insert as Row)[uniqOn])) {
            return Promise.resolve({ data: null, error: { code: "23505", message: "unique" } }).then(onF);
          }
          rows.push({ ...(this._insert as Row) });
          return Promise.resolve({ data: null, error: null }).then(onF);
        }
        if (this._op === "update") {
          (this._matches as () => Row[])().forEach((r) => Object.assign(r, this._patch));
        } else if (this._op === "delete") {
          for (const r of (this._matches as () => Row[])()) {
            const i = rows.indexOf(r);
            if (i >= 0) rows.splice(i, 1);
          }
        }
        return Promise.resolve({ data: null, error: null }).then(onF);
      },
    };
    return q;
  }
  return { from } as unknown as SupabaseClient;
}

const OWNER = "owner-1";

function youtubeDraft(over: Row = {}): Row {
  return {
    id: "d-yt",
    owner_user_id: OWNER,
    status: "draft",
    module_version: 1,
    approved_at: null,
    published_at: null,
    answers: {
      problem: "Handoffs skip the double-check.",
      audienceType: "everyone",
      observableBehavior: "The charge nurse reads back the dosage before sign-off.",
      successEvidence: "Sign-offs include a witnessed read-back.",
      evidenceType: "seen",
      learningNeeds: ["practice"],
      materialIntent: "youtube",
      materialText: "https://youtu.be/dQw4w9WgXcQ",
      followUpDays: 7,
      completionPrompt: "What read-back will you commit to?",
      // a runtime/private key that must NOT be snapshotted:
      document_asset_ref: "SECRET_PATH",
    },
    ...over,
  };
}

const SNAP = { event: { id: "ev-1", title: "T", status: "open", join_token: "tok", content_type: "youtube" }, participants: [], joined_count: 0, completed_count: 0 };

beforeEach(() => {
  createTrainingEvent.mockReset();
  getOwnerRoomSnapshot.mockReset();
  getOwnerRoomSnapshot.mockResolvedValue(SNAP);
  createTrainingEvent.mockResolvedValue({ ok: true, value: { event: { id: "ev-1" } } });
});

describe("publishDraft — YouTube", () => {
  it("publishes: creates the event, freezes a whitelisted snapshot, marks the draft published", async () => {
    const tables: Tables = { foundry_module_drafts: [youtubeDraft()], foundry_event_module: [] };
    const admin = makeFakeAdmin(tables);
    const r = await publishDraft(admin, OWNER, "d-yt", "en");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.reused).toBe(false);
    expect(createTrainingEvent).toHaveBeenCalledOnce();

    const mod = tables.foundry_event_module[0];
    expect(mod.event_id).toBe("ev-1");
    expect(mod.source_draft_id).toBe("d-yt");
    // snapshot is whitelisted — never the private/runtime key
    expect(JSON.stringify(mod.module_snapshot)).not.toContain("SECRET_PATH");
    expect((mod.module_snapshot as Row).problem).toBe("Handoffs skip the double-check.");

    const draft = tables.foundry_module_drafts[0];
    expect(draft.status).toBe("published");
    expect(draft.approved_at).toBeTruthy();
    expect(draft.published_at).toBeTruthy();
  });

  it("is idempotent: a re-publish returns the existing event without re-creating", async () => {
    const tables: Tables = {
      foundry_module_drafts: [youtubeDraft({ status: "published", approved_at: "t", published_at: "t" })],
      foundry_event_module: [{ event_id: "ev-1", source_draft_id: "d-yt", module_version: 1, module_snapshot: {} }],
    };
    const admin = makeFakeAdmin(tables);
    const r = await publishDraft(admin, OWNER, "d-yt", "en");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.reused).toBe(true);
    expect(createTrainingEvent).not.toHaveBeenCalled();
    expect(tables.foundry_event_module).toHaveLength(1);
  });

  it("rejects a not-ready draft without creating anything", async () => {
    const tables: Tables = { foundry_module_drafts: [youtubeDraft({ answers: { problem: "only this" } })], foundry_event_module: [] };
    const admin = makeFakeAdmin(tables);
    const r = await publishDraft(admin, OWNER, "d-yt", "en");
    expect(r.ok).toBe(false);
    expect(createTrainingEvent).not.toHaveBeenCalled();
    expect(tables.foundry_event_module).toHaveLength(0);
  });

  it("a foreign / missing draft is non-disclosing not-found", async () => {
    const admin = makeFakeAdmin({ foundry_module_drafts: [youtubeDraft({ owner_user_id: "someone-else" })], foundry_event_module: [] });
    const r = await publishDraft(admin, OWNER, "d-yt", "en");
    expect(r).toEqual({ ok: false, reason: "draft_not_found" });
  });

  it("uses the localized default completion prompt only when the host left it blank", async () => {
    const draft = youtubeDraft();
    (draft.answers as Row).completionPrompt = "   ";
    const tables: Tables = { foundry_module_drafts: [draft], foundry_event_module: [] };
    const admin = makeFakeAdmin(tables);
    await publishDraft(admin, OWNER, "d-yt", "en");
    const call = createTrainingEvent.mock.calls[0][2] as { completion_prompt: string };
    expect(call.completion_prompt).toBe("What is one thing from this you will apply this week?");
  });
});

describe("publishDraft — PDF (durable-reference reuse)", () => {
  function pdfSetup(): Tables {
    return {
      foundry_module_drafts: [
        youtubeDraft({
          id: "d-pdf",
          answers: {
            problem: "Read the safety manual.",
            audienceType: "everyone",
            observableBehavior: "Staff follow the lockout steps in order.",
            successEvidence: "Observed correct lockout on the floor.",
            evidenceType: "seen",
            learningNeeds: ["know"],
            materialIntent: "pdf",
            followUpDays: 0,
            completionPrompt: "What will you double-check next shift?",
          },
        }),
      ],
      foundry_module_draft_assets: [
        {
          id: "asset-1",
          draft_id: "d-pdf",
          file_kind: "pdf",
          storage_bucket: "foundry-docs",
          storage_path: "owner-1/uuid.pdf",
          original_filename: "safety.pdf",
          byte_size: 1000,
          page_count: 8,
          page_count_verified: true,
          content_hash: "deadbeef",
          created_at: "t",
        },
      ],
      foundry_events: [],
      foundry_event_document_content: [],
      foundry_event_module: [],
    };
  }

  it("publishes a PDF by REFERENCING the draft's durable object (no copy, asset untouched)", async () => {
    const tables = pdfSetup();
    getOwnerRoomSnapshot.mockResolvedValue({ ...SNAP, event: { ...SNAP.event, content_type: "document" } });
    const admin = makeFakeAdmin(tables);
    const r = await publishDraft(admin, OWNER, "d-pdf", "en");
    expect(r.ok).toBe(true);
    // document_content points at the SAME storage object as the draft asset
    const content = tables.foundry_event_document_content[0];
    expect(content.storage_path).toBe("owner-1/uuid.pdf");
    expect(content.storage_bucket).toBe("foundry-docs");
    expect(content.completion_prompt).toBe("What will you double-check next shift?");
    // the draft asset row is UNCHANGED (never consumed/deleted)
    expect(tables.foundry_module_draft_assets).toHaveLength(1);
    expect(tables.foundry_module_draft_assets[0].storage_path).toBe("owner-1/uuid.pdf");
    // youtube path not used
    expect(createTrainingEvent).not.toHaveBeenCalled();
  });

  it("blocks a PDF draft with no stored pdf asset", async () => {
    const tables = pdfSetup();
    tables.foundry_module_draft_assets = [];
    const admin = makeFakeAdmin(tables);
    const r = await publishDraft(admin, OWNER, "d-pdf", "en");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("material_pdf_required");
    expect(tables.foundry_event_module).toHaveLength(0);
  });
});
