import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { ensureActionCapture, listMyActionCaptures } from "./ensureActionCapture.server";

/**
 * Save intent, separated from source evidence (Slice A1-INTENT).
 *
 * ★ THE DEFECT. "Track with BTY" put the source message into the person's "Saved for later" list,
 * which they never asked for. `trackAnnouncement` calls `ensureActionCapture` — the same function
 * Save calls — because the announcement has a foreign key to a capture row. Reuse is CORRECT (a
 * message already saved must not produce a second capture, and the UNIQUE tuple guarantees it
 * does not); what was missing is that a capture then meant two different things and the Saved lane
 * filtered only on `status = 'captured'`, which every capture is.
 *
 * `saved_at` records which of the two happened, at the moment it is known. It decides one personal
 * lane and is never an authority for anything.
 */

/** The snake_case shape `resolveTeamsCaptureSource` actually reads — measured, not assumed. */
const CAPTURE = {
  provider: "teams",
  tenant_id: "11111111-1111-1111-1111-111111111111",
  conversation_id: "19:chat@unq.gbl.spaces",
  message_id: "m1",
  preview_text: "잘해보자 체크해줘",
  source_url: "https://teams.microsoft.com/l/message/19:chat@unq.gbl.spaces/m1",
} as never;

const USER = "18b1ee80-0000-0000-0000-000000000001";

/** A Supabase double that behaves like the real UNIQUE(user_id, source_type, external_key). */
function db() {
  const rows: Record<string, unknown>[] = [];
  const filtersOf = (f: [string, unknown][]) => Object.fromEntries(f);
  const make = (table: string) => {
    const f: [string, unknown][] = [];
    let mode: "select" | "insert" | "update" = "select";
    let payload: Record<string, unknown> = {};
    let nullCol: string | null = null;
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (c: string, v: unknown) => (f.push([c, v]), chain),
      is: (c: string, v: unknown) => (v === null ? ((nullCol = c), chain) : chain),
      not: (c: string, _op: string, v: unknown) => (v === null ? (f.push(["__notnull", c]), chain) : chain),
      order: () => chain,
      insert: (v: Record<string, unknown>) => ((mode = "insert"), (payload = v), chain),
      update: (v: Record<string, unknown>) => ((mode = "update"), (payload = v), chain),
      // maybeSingle/single yield ONE row or null — an empty array here would read as truthy and
      // make `if (existing)` fire on a table with no matching row at all.
      single: async () => one(),
      maybeSingle: async () => one(),
      then: (res: (v: unknown) => unknown) => res(run()),
    };
    const match = (r: Record<string, unknown>) => {
      const q = filtersOf(f.filter(([k]) => k !== "__notnull"));
      for (const [k, v] of Object.entries(q)) if (r[k] !== v) return false;
      for (const [k, col] of f) if (k === "__notnull" && r[col as string] == null) return false;
      if (nullCol && r[nullCol] != null) return false;
      return true;
    };
    const run = () => {
      if (mode === "insert") {
        const dup = rows.find(
          (r) =>
            r.user_id === payload.user_id &&
            r.source_type === payload.source_type &&
            r.external_key === payload.external_key,
        );
        if (dup) return { data: null, error: { code: "23505" } };
        const row = { id: `cap-${rows.length + 1}`, triage_choice: null, triaged_at: null, ...payload };
        rows.push(row);
        return { data: row, error: null };
      }
      if (mode === "update") {
        const hit = rows.find(match);
        if (!hit) return { data: null, error: null };
        Object.assign(hit, payload);
        return { data: hit, error: null };
      }
      return { data: rows.filter(match), error: null };
    };
    const one = () => {
      const r = run() as { data: unknown; error: unknown };
      if (r.error) return r;
      const d = r.data;
      return { data: Array.isArray(d) ? (d[0] ?? null) : d, error: null };
    };
    void table;
    return chain;
  };
  return { client: { from: (t: string) => make(t) } as never, rows };
}

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

const savedLane = async (c: never, rows: Record<string, unknown>[]) => {
  void rows;
  return listMyActionCaptures(c, USER);
};

describe("★ 1+2. Track does not save; Save does not track", () => {
  it("★ 1. a TRACK-only capture never enters Saved for later", async () => {
    const { client, rows } = db();
    const r = await ensureActionCapture(client, { userId: USER, input: CAPTURE, intent: "track_source" });
    expect(r.ok).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0].saved_at).toBeNull();          // the row exists as source evidence only
    expect(await savedLane(client, rows)).toHaveLength(0);
  });

  it("★ 2. a SAVE-only capture appears, and creates no announcement", async () => {
    const { client, rows } = db();
    await ensureActionCapture(client, { userId: USER, input: CAPTURE, intent: "save" });
    expect(rows[0].saved_at).toBeTruthy();
    expect(await savedLane(client, rows)).toHaveLength(1);
    // Nothing in this path writes an announcement; that is a separate command entirely.
    const TRACK = readFileSync("src/lib/bty/announcement/trackAnnouncement.server.ts", "utf8");
    expect(TRACK).toContain('intent: "track_source"');
  });
});

describe("★ 3. doing both produces both, on ONE row", () => {
  it("★ Track then Save: one capture, and it becomes visible", async () => {
    const { client, rows } = db();
    await ensureActionCapture(client, { userId: USER, input: CAPTURE, intent: "track_source" });
    expect(await savedLane(client, rows)).toHaveLength(0);

    const second = await ensureActionCapture(client, { userId: USER, input: CAPTURE, intent: "save" });
    expect(second.ok && second.created).toBe(false);   // reused, never duplicated
    expect(rows).toHaveLength(1);
    expect(rows[0].saved_at).toBeTruthy();
    expect(await savedLane(client, rows)).toHaveLength(1);
  });

  it("★ Save then Track: still one capture, and it STAYS visible", async () => {
    const { client, rows } = db();
    await ensureActionCapture(client, { userId: USER, input: CAPTURE, intent: "save" });
    const stampedAt = rows[0].saved_at;

    await ensureActionCapture(client, { userId: USER, input: CAPTURE, intent: "track_source" });
    expect(rows).toHaveLength(1);
    expect(rows[0].saved_at).toBe(stampedAt);          // Track never clears or moves it
    expect(await savedLane(client, rows)).toHaveLength(1);
  });

  it("★ a second Save does not move the original timestamp", async () => {
    const { client, rows } = db();
    await ensureActionCapture(client, { userId: USER, input: CAPTURE, intent: "save" });
    const first = rows[0].saved_at;
    await ensureActionCapture(client, { userId: USER, input: CAPTURE, intent: "save" });
    expect(rows[0].saved_at).toBe(first);
  });

  it("★ intent cannot be omitted — the type has no default to fall back to", () => {
    /*
      A default of "save" would have silently picked one of two opposite meanings for whoever
      forgot to say which they meant. `intent` is now a REQUIRED property, so a new call site that
      omits it fails `tsc` rather than quietly adding somebody's message to their Saved list.
      Asserted on the signature, because the failure this protects against is a compile error and
      a compiled test cannot contain one.
    */
    const SRC = readFileSync("src/lib/bty/action-capture/ensureActionCapture.server.ts", "utf8");
    expect(SRC).toMatch(/intent: "save" \| "track_source" \}/);
    expect(SRC).not.toMatch(/intent\?:/);
    expect(SRC).not.toMatch(/params\.intent \?\?/);
  });
});

describe("★ 4+5+6. nothing else moves", () => {
  it("★ 5. the Saved lane still filters on status, and now ALSO on explicit intent", () => {
    const SRC = readFileSync("src/lib/bty/action-capture/ensureActionCapture.server.ts", "utf8");
    expect(SRC).toMatch(/\.eq\("status", "captured"\)/);
    expect(SRC).toMatch(/\.not\("saved_at", "is", null\)/);
  });

  it("★ 6. Soon/Later triage is untouched by this slice", () => {
    const SRC = readFileSync("src/lib/bty/action-capture/ensureActionCapture.server.ts", "utf8");
    expect(SRC).toMatch(/triage_choice: params\.choice/);
    expect(SRC).toContain("compareForSavedLane");
  });

  it("★ 4. an announcement's source is never deleted or detached by any of this", () => {
    const SRC = readFileSync("src/lib/bty/action-capture/ensureActionCapture.server.ts", "utf8");
    expect(SRC).not.toMatch(/\.delete\(/);
    // Track still ensures the row it needs; it just does not claim it as a save.
    const TRACK = readFileSync("src/lib/bty/announcement/trackAnnouncement.server.ts", "utf8");
    expect(TRACK).toContain("ensureActionCapture");
  });

  it("saved_at never reaches a client — the projection is an explicit literal", () => {
    const SRC = readFileSync("src/lib/bty/action-capture/ensureActionCapture.server.ts", "utf8");
    const proj = SRC.slice(SRC.indexOf("function project"), SRC.indexOf("function project") + 700);
    expect(proj).not.toContain("saved_at");
    expect(proj).not.toContain("savedAt");
  });

  it("★ intent is never an authority — no gate reads it", () => {
    for (const p of [
      "src/lib/bty/authority/platformAdmin.server.ts",
      "src/app/api/bty/announcements/host/route.ts",
      "src/app/api/bty/announcements/mine/route.ts",
    ]) {
      expect(readFileSync(p, "utf8"), p).not.toContain("saved_at");
    }
  });
});

describe("★ a re-application leaves later Track-only rows alone", () => {
  /**
   * The behaviour the corrected SQL guarantees, expressed as the sequence it protects:
   *   1. migration runs, existing rows are backfilled
   *   2. Track creates a source-evidence row -> saved_at NULL
   *   3. migration runs AGAIN (repair, replay, fresh environment)
   *   4. that row must STILL be NULL, and must still not be in the Saved lane
   */
  const applyMigration = (rows: { saved_at: string | null; captured_at: string }[], columnExists: boolean) => {
    if (!columnExists) for (const r of rows) r.saved_at = r.captured_at;   // first run only
    return true;                                                           // later runs: no-op
  };

  it("★ first run backfills the rows that predate the distinction", () => {
    const rows = [{ saved_at: null as string | null, captured_at: "2026-08-28T00:00:00Z" }];
    applyMigration(rows, false);
    expect(rows[0].saved_at).toBe("2026-08-28T00:00:00Z");
  });

  it("★ a Track-only row created AFTER the migration stays NULL on a re-run", () => {
    const rows = [{ saved_at: null as string | null, captured_at: "2026-08-28T00:00:00Z" }];
    applyMigration(rows, false);                       // first application
    const trackOnly = { saved_at: null as string | null, captured_at: "2026-09-03T00:00:00Z" };
    rows.push(trackOnly);                              // Track, afterwards
    applyMigration(rows, true);                        // replay
    expect(trackOnly.saved_at).toBeNull();
    // ...and the Saved lane's filter still excludes it.
    expect(rows.filter((r) => r.saved_at !== null)).toHaveLength(1);
  });
});

describe("★ the migration says exactly what was approved", () => {
  const SQL = readFileSync("supabase/migrations/20260905000000_bty_action_capture_saved_at_v1.sql", "utf8");

  it("adds one nullable column, additively", () => {
    // Comments stripped: the file's prose explains WHY it is nullable ("NOT `boolean not null`"),
    // and a guard that reads the explanation instead of the DDL proves nothing.
    const ddl = SQL.replace(/^\s*--.*$/gm, "");
    // The COLUMN DECLARATION carries no constraint. A blanket /not null/ search would be wrong
    // here and was: `if not exists` and the index's `is not null` predicate are both legitimate.
    expect(ddl).toMatch(/add column if not exists saved_at timestamptz;/);
    expect(ddl).not.toMatch(/saved_at timestamptz[^;]*not null/i);
    expect(ddl).not.toMatch(/saved_at timestamptz[^;]*default/i);
    expect(ddl).not.toMatch(/drop column|drop table|delete from/i);
  });

  it("★ backfills ONLY on first creation — a re-run cannot resurrect intent", () => {
    const ddl = SQL.replace(/^\s*--.*$/gm, "");

    // Existence is read BEFORE the ALTER; after it the answer is always "yes" and could no longer
    // tell a first application from a replay.
    const check = ddl.indexOf("into v_column_existed");
    const alter = ddl.indexOf("add column if not exists saved_at");
    const update = ddl.indexOf("update public.bty_action_captures set saved_at");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(alter);
    expect(alter).toBeLessThan(update);

    // The UPDATE is reachable only when the column did not exist a moment ago.
    expect(ddl).toMatch(/if not v_column_existed then[\s\S]*update public\.bty_action_captures set saved_at = captured_at;/);

    // ★ AND IT NO LONGER CARRIES `where saved_at is null`. That clause reads like a guard and is
    // the opposite of one: every Track-only row created after this migration has saved_at NULL by
    // design, so a replay would have stamped all of them and put messages nobody saved back into
    // people's Saved for later lists.
    expect(ddl).not.toMatch(/set saved_at = captured_at[\s\S]{0,80}where saved_at is null/);
  });

  it("★ adds no index — the lane's real order is decided in the application", () => {
    expect(SQL.replace(/^\s*--.*$/gm, "")).not.toMatch(/create index/i);
    const SRC = readFileSync("src/lib/bty/action-capture/ensureActionCapture.server.ts", "utf8");
    expect(SRC).toContain("compareForSavedLane"); // undecided, then soon, then later — not saved_at
  });

  it("is ordered after the two hand-applied migrations", () => {
    expect(SQL).toContain("20260905");
    // 20260903 and 20260904 are applied in production but absent from the ledger.
    expect(SQL).toMatch(/20260903[\s\S]*20260904/);
  });
});
