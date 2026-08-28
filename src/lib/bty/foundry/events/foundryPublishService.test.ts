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
        } else {
          // An AWAITED select resolves to the matched ROWS — that is what PostgREST does.
          // This previously resolved to `data: null`, which no real client ever returns;
          // it went unnoticed only because nothing awaited a bare select. The program
          // generation authority read (Slice 3.2L-R1.1) does, and it fails CLOSED on a
          // shape it cannot read, so the fixture has to model the client honestly.
          return Promise.resolve({ data: (this._matches as () => Row[])().map((r) => ({ ...r })), error: null }).then(onF);
        }
        return Promise.resolve({ data: null, error: null }).then(onF);
      },
    };
    return q;
  }
  // Slice 3.1B-3C: publishDraft now calls the assignment RPCs on assigned_overlay. The fake
  // resolves them from an injected `rpc` map so OPEN_LINK never touches them.
  const rpc = (name: string, params: Record<string, unknown>) => {
    const impl = (tables.__rpc as unknown as RpcMap | undefined)?.[name];
    return Promise.resolve(impl ? impl(params) : { data: null, error: null });
  };
  return { from, rpc } as unknown as SupabaseClient;
}

type RpcMap = Record<string, (p: Record<string, unknown>) => { data: unknown; error: { message: string } | null }>;

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
      // Slice 3.2R-R2.1 — a complete draft carries a NAME distinct from its problem.
      title: "Read Back Before Sign-Off",
      problem: "Handoffs skip the double-check.",
      audienceType: "everyone",
      recurringMoment: "at each handoff point",
      observableBehavior: "The charge nurse reads back the dosage before sign-off.",
      successEvidence: "Sign-offs include a witnessed read-back.",
      evidenceType: "seen",
      learningNeeds: ["practice"],
      materialIntent: "youtube",
      materialText: "https://youtu.be/dQw4w9WgXcQ",
      // R4-R7A: no behaviour intent declared, so this fixture tests what it claims — publish
      // mechanics / legacy content — rather than a draft whose Host scheduled a follow-up.
      followUpDays: 0,
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

// --- Slice 3.2C-B3A: Journey-enabled publish (title + completion from the approved Journey) ---
/**
 * Slice 3.2P-R2.1 — this fixture now carries every kind `youtubeDraft`'s Host intent requires
 * (`practice` + a 7-day follow-up ⇒ scenario, field_application, follow_up), in canonical
 * order. It previously held three, which was enough while publish checked only approvability
 * and is no longer: program completeness is now a server invariant. What these tests are
 * about — the title and completion coming from the approved Journey, and the Journey being
 * frozen into the snapshot — is unchanged.
 */
function groundedJourney(over: Record<string, unknown> = {}) {
  const el = (kind: string, content: string, field: string) => ({
    id: `el_${kind}`, kind, content,
    grounding: [{ sourceType: "host_statement", field }],
    confirmationStatus: "grounded",
  });
  return {
    version: 1,
    displayTitle: "Read-back before sign-off",
    displayTitleStatus: "grounded",
    elements: [
      el("why_it_matters", "Handoffs skip the double-check.", "problem"),
      el("observable_standard", "The charge nurse reads back the dosage before sign-off.", "observableBehavior"),
      el("scenario", "The unit is busy and two people are already waiting to ask you something.", "problem"),
      el("field_application", "At the next sign-off, read the dosage back before you sign.", "observableBehavior"),
      /*
        WHAT SUCCESS LOOKS LIKE is a required kind since Slice R4-R5C14A whenever the Host stated
        success evidence, so an approvable Journey now carries it. Its content is the Host's own
        `successEvidence`, grounded on that field.
      */
      el("evidence", "The signed record shows the dosage was read back.", "successEvidence"),
      el("completion_check", "What read-back will you commit to?", "completionPrompt"),
      el("follow_up", "In seven days you will be asked what you actually read back.", "successEvidence"),
    ],
    ...over,
  };
}
function journeyDraft(journey: Record<string, unknown>): Row {
  const base = youtubeDraft();
  return { ...base, answers: { ...(base.answers as Row), realityGroundedJourneyV1: journey } };
}

describe("publishDraft — Journey-enabled (B3A)", () => {
  /*
    RETARGETED, NOT WEAKENED (Slice Title Authority V1). This asserted that the published event
    took its title from `journey.displayTitle`. That is exactly the behaviour the Founder hit: the
    training they named 회의 후 실행 확인하기 published as the model's sentence and read as missing.
    The Host's own name is now the training's identity. Everything else this test protected —
    the completion check coming from the Journey rather than `completionPrompt`, and the exact
    Journey being frozen into the snapshot — is unchanged and still asserted here.
  */
  it("publishes under the HOST's own title, and still takes completion_check from the Journey", async () => {
    const tables: Tables = { foundry_module_drafts: [journeyDraft(groundedJourney())], foundry_event_module: [] };
    const admin = makeFakeAdmin(tables);
    const r = await publishDraft(admin, OWNER, "d-yt", "en");
    expect(r.ok).toBe(true);
    const call = createTrainingEvent.mock.calls[0];
    expect(call[2].title, "published training must retain the Host-authored title").toBe("Read Back Before Sign-Off");
    expect(call[2].completion_prompt).toBe("What read-back will you commit to?");
    /*
      AND THE PROPOSAL'S IDENTITY IS UNTOUCHED. `displayTitle` is hashed into the adoption digest,
      so the frozen Journey must still carry the title it was adopted with — naming the training
      is not editing the program.
    */
    const snap = tables.foundry_event_module[0].module_snapshot as Row;
    expect((snap.realityGroundedJourneyV1 as Row).displayTitle).toBe("Read-back before sign-off");
  });

  it("a draft with no authored title cannot publish at all — so publish never has to invent a name", async () => {
    /*
      MEASURED WHILE BUILDING TITLE AUTHORITY V1, and it makes the invariant stronger than it
      looked. `stepBlockers` pushes `title_required`, so readiness refuses a nameless draft before
      publish is reached: EVERY publishable draft carries a Host-authored title. The journey
      fallback in `publishedTrainingTitle` is therefore a defensive shape for direct callers, not
      a live path — and no existing training can be renamed by this slice, because none of them
      can reach publish without the name their Host gave them.
    */
    const base = journeyDraft(groundedJourney());
    const nameless = { ...base, answers: { ...(base.answers as Row), title: undefined } };
    const tables: Tables = { foundry_module_drafts: [nameless], foundry_event_module: [] };
    const admin = makeFakeAdmin(tables);
    const r = await publishDraft(admin, OWNER, "d-yt", "en");
    expect(r.ok).toBe(false);
    expect(createTrainingEvent).not.toHaveBeenCalled();
    expect(tables.foundry_event_module).toHaveLength(0);
  });

  it("BLOCKS publish while the Journey is not fully grounded (needs_confirmation) — nothing created", async () => {
    const notApproved = groundedJourney({ displayTitleStatus: "needs_confirmation" });
    const tables: Tables = { foundry_module_drafts: [journeyDraft(notApproved)], foundry_event_module: [] };
    const admin = makeFakeAdmin(tables);
    const r = await publishDraft(admin, OWNER, "d-yt", "en");
    expect(r).toEqual({ ok: false, reason: "journey_not_approved" });
    expect(tables.foundry_event_module).toHaveLength(0);
    expect(createTrainingEvent).not.toHaveBeenCalled();
  });
});

describe("publishDraft — PDF (durable-reference reuse)", () => {
  function pdfSetup(): Tables {
    return {
      foundry_module_drafts: [
        youtubeDraft({
          id: "d-pdf",
          answers: {
            // Slice 3.2R-R2.1 — a complete draft carries a NAME distinct from its problem.
            title: "Read Back Before Sign-Off",
            problem: "Read the safety manual.",
            audienceType: "everyone",
            recurringMoment: "at each handoff point",
            observableBehavior: "Staff follow the lockout steps in order.",
            successEvidence: "Observed correct lockout on the floor.",
            evidenceType: "seen",
            learningNeeds: ["know"],
            materialIntent: "pdf",
            followUpDays: 0,
            completionPrompt: "What will you double-check next shift?",
            /*
              Slice 3.2R-R3: a PDF training is publishable only once the Host has confirmed the
              exact attached document. Bound by content hash, so this fixture names the asset's.
            */
            materialReviewV1: { contentHash: "deadbeef", confirmedAt: "2026-08-13T10:00:00.000Z" },
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

/**
 * Slice 3.1B-3C — participation mode at publish. OPEN_LINK (absent/explicit) must be exactly
 * today's behavior with no assignment artifacts; ASSIGNED_OVERLAY runs the pre-flight then
 * the atomic RPC, and a failed assigned publish compensates the event.
 */
describe("publishDraft — participation mode (3.1B-3C)", () => {
  const okRpc: RpcMap = {
    bty_foundry_resolve_audience: () => ({ data: [{ membership_id: "m1", user_id: "u1", organization_id: "org-a" }], error: null }),
    bty_foundry_publish_assignments: () => ({ data: [{ assignment_count: 1, organization_id: "org-a" }], error: null }),
  };

  it("(1) OPEN_LINK publish creates the event with NO assignment artifacts", async () => {
    const tables: Tables = { foundry_module_drafts: [youtubeDraft()], foundry_event_module: [] };
    const admin = makeFakeAdmin(tables);
    const r = await publishDraft(admin, OWNER, "d-yt", "en", { mode: "open_link" });
    expect(r.ok).toBe(true);
    expect(tables.foundry_event_module).toHaveLength(1);
    expect(tables.foundry_event_assignments ?? []).toHaveLength(0);
    expect(tables.foundry_event_audience_snapshot ?? []).toHaveLength(0);
  });

  it("(2) absent participation arg = unchanged legacy behavior (no RPC call)", async () => {
    const tables: Tables = { foundry_module_drafts: [youtubeDraft()], foundry_event_module: [], __rpc: okRpc as never };
    const admin = makeFakeAdmin(tables);
    const spy = vi.spyOn(admin, "rpc");
    const r = await publishDraft(admin, OWNER, "d-yt", "en"); // no participation
    expect(r.ok).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it("(3) ASSIGNED_OVERLAY + Leaders creates the event and calls the atomic RPC", async () => {
    const tables: Tables = { foundry_module_drafts: [youtubeDraft()], foundry_event_module: [], __rpc: okRpc as never };
    const admin = makeFakeAdmin(tables);
    const r = await publishDraft(admin, OWNER, "d-yt", "en", {
      mode: "assigned_overlay",
      audience: { audienceType: "leaders", audienceDetail: null },
    });
    expect(r.ok).toBe(true);
    expect(tables.foundry_event_module).toHaveLength(1);
  });

  it("(11/12) zero recipients BLOCKS assigned publish and creates NOTHING (no fallback)", async () => {
    const zeroRpc: RpcMap = { bty_foundry_resolve_audience: () => ({ data: [], error: null }) };
    const tables: Tables = { foundry_module_drafts: [youtubeDraft()], foundry_event_module: [], __rpc: zeroRpc as never };
    const admin = makeFakeAdmin(tables);
    const r = await publishDraft(admin, OWNER, "d-yt", "en", {
      mode: "assigned_overlay",
      audience: { audienceType: "leaders", audienceDetail: null },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("zero_recipients");
    // pre-flight failed BEFORE event creation → nothing exists
    expect(tables.foundry_event_module).toHaveLength(0);
    expect(createTrainingEvent).not.toHaveBeenCalled();
  });

  it("(17) a failing atomic RPC compensates: event is deleted, draft stays publishable", async () => {
    const failRpc: RpcMap = {
      bty_foundry_resolve_audience: () => ({ data: [{ membership_id: "m1", user_id: "u1", organization_id: "org-a" }], error: null }),
      bty_foundry_publish_assignments: () => ({ data: null, error: { message: "assignment write blew up" } }),
    };
    const tables: Tables = {
      foundry_module_drafts: [youtubeDraft()],
      foundry_event_module: [],
      foundry_events: [],
      __rpc: failRpc as never,
    };
    const admin = makeFakeAdmin(tables);
    const r = await publishDraft(admin, OWNER, "d-yt", "en", {
      mode: "assigned_overlay",
      audience: { audienceType: "leaders", audienceDetail: null },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("assignment_write_failed");
    // event compensated
    expect(tables.foundry_events).toHaveLength(0);
    // draft NOT transitioned to published → still recoverable
    expect(tables.foundry_module_drafts[0].status).toBe("draft");
  });

  it("(21) assigned publish creates no participant row", async () => {
    const tables: Tables = {
      foundry_module_drafts: [youtubeDraft()],
      foundry_event_module: [],
      foundry_event_participants: [],
      __rpc: okRpc as never,
    };
    const admin = makeFakeAdmin(tables);
    await publishDraft(admin, OWNER, "d-yt", "en", {
      mode: "assigned_overlay",
      audience: { audienceType: "leaders", audienceDetail: null },
    });
    expect(tables.foundry_event_participants).toHaveLength(0);
  });
});
