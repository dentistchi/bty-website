import { describe, it, expect, vi } from "vitest";
import { markProgramAttemptApplied } from "./programGenerationRecorder";

/**
 * SLICE 3.2L-R11.1 — the receipt itself, against a mocked client.
 *
 * The failure matrix this proves: first receipt wins, a wrong owner cannot stamp, a failed
 * update reports false so the caller can retry rather than assume, and re-offering the same
 * stamp never moves the timestamp.
 */
type Row = { applied_at: string | null; owner: string };

function client(rows: Record<string, Row>, opts: { updateFails?: boolean } = {}) {
  const calls: { id: string; owner: string; onlyIfNull: boolean }[] = [];
  const admin = {
    from: () => {
      let id = "";
      let owner = "";
      let onlyIfNull = false;
      let mode: "update" | "select" = "select";
      const chain = {
        update: () => { mode = "update"; return chain; },
        select: () => { mode = "select"; return chain; },
        eq: (col: string, v: string) => { if (col === "id") id = v; if (col === "owner_user_id") owner = v; return chain; },
        is: () => { onlyIfNull = true; return chain; },
        maybeSingle: async () => {
          const r = rows[id];
          return { data: r && r.owner === owner ? { applied_at: r.applied_at } : null };
        },
        then: (res: (v: { error: unknown }) => unknown) => {
          if (mode === "update") {
            calls.push({ id, owner, onlyIfNull });
            if (opts.updateFails) return res({ error: { message: "boom" } });
            const r = rows[id];
            if (r && r.owner === owner && (!onlyIfNull || r.applied_at === null)) r.applied_at = "2026-08-07T20:00:00Z";
            return res({ error: null });
          }
          return res({ error: null });
        },
      };
      return chain;
    },
  } as never;
  return { admin, calls };
}

describe("[3.2L-R11.1] adoption receipt", () => {
  it("G1: a successful stamp reports true and is durable", async () => {
    const rows: Record<string, Row> = { a1: { applied_at: null, owner: "u1" } };
    const { admin } = client(rows);
    expect(await markProgramAttemptApplied(admin, "a1", "u1")).toBe(true);
    expect(rows.a1.applied_at).not.toBeNull();
  });

  it("G4: first receipt wins — re-offering never moves the timestamp", async () => {
    const rows: Record<string, Row> = { a1: { applied_at: null, owner: "u1" } };
    const { admin, calls } = client(rows);
    await markProgramAttemptApplied(admin, "a1", "u1");
    const first = rows.a1.applied_at;
    for (let i = 0; i < 3; i++) expect(await markProgramAttemptApplied(admin, "a1", "u1")).toBe(true);
    expect(rows.a1.applied_at).toBe(first);
    expect(calls.every((c) => c.onlyIfNull)).toBe(true);
  });

  it("G6: a different owner cannot stamp another Host's attempt", async () => {
    const rows: Record<string, Row> = { a1: { applied_at: null, owner: "u1" } };
    const { admin } = client(rows);
    expect(await markProgramAttemptApplied(admin, "a1", "someone-else")).toBe(false);
    expect(rows.a1.applied_at).toBeNull();
  });

  it("a stamp on an attempt that does not exist reports false, never true", async () => {
    const { admin } = client({});
    expect(await markProgramAttemptApplied(admin, "missing", "u1")).toBe(false);
  });

  it("CASE B: a failed update reports false, so the marker can complete it later", async () => {
    const rows: Record<string, Row> = { a1: { applied_at: null, owner: "u1" } };
    const { admin } = client(rows, { updateFails: true });
    expect(await markProgramAttemptApplied(admin, "a1", "u1")).toBe(false);
    expect(rows.a1.applied_at).toBeNull();
    // …and the very next save, with the durable marker still on the draft, completes it.
    const { admin: healthy } = client(rows);
    expect(await markProgramAttemptApplied(healthy, "a1", "u1")).toBe(true);
    expect(rows.a1.applied_at).not.toBeNull();
  });

  it("G5: concurrent duplicate stamps converge to one receipt", async () => {
    const rows: Record<string, Row> = { a1: { applied_at: null, owner: "u1" } };
    const { admin } = client(rows);
    const results = await Promise.all([
      markProgramAttemptApplied(admin, "a1", "u1"),
      markProgramAttemptApplied(admin, "a1", "u1"),
      markProgramAttemptApplied(admin, "a1", "u1"),
    ]);
    expect(results.every(Boolean)).toBe(true);
    expect(typeof rows.a1.applied_at).toBe("string");
  });
});
