import { describe, it, expect, vi } from "vitest";
import { completePractice, fetchPracticeList, startPractice } from "./arenaRoomActions";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";

function validScenario(): ArenaScenarioDraft {
  return {
    title: "T",
    opening: "An opening situation.",
    primary: { choices: [{ id: "p1", label: "A" }, { id: "p2", label: "B" }] },
    tradeoff: { escalationText: "It gets harder.", choices: [{ id: "t1", label: "C" }, { id: "t2", label: "D" }] },
    actionDecision: {
      prompt: "Decide?",
      choices: [
        { id: "a1", label: "Act", isActionCommitment: true },
        { id: "a2", label: "Wait", isActionCommitment: false },
      ],
    },
  };
}

/** Minimal Response-like builder for a mock fetch. */
function res(ok: boolean, body: unknown, status = ok ? 200 : 500) {
  return { ok, status, json: async () => body } as unknown as Response;
}

/** A mock fetch that maps URL+method → queued responses. */
function mockFetch(routes: Record<string, () => Response>) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url.split("?")[0]}`;
    const handler = routes[key];
    if (!handler) throw new Error(`unexpected fetch: ${key}`);
    return handler();
  }) as unknown as typeof fetch;
}

const PID = "prac-1";
const snapshotUrl = `GET /api/arena/practice/${PID}`;
const startUrl = `POST /api/arena/practice/${PID}/start`;
const completeUrl = `POST /api/arena/practice/${PID}/complete`;

describe("startPractice — START CONTRACT (snapshot → validate → start → runId)", () => {
  it("enters playing only after start succeeds with a valid run id", async () => {
    const f = mockFetch({
      [snapshotUrl]: () => res(true, { practice: { id: PID, practice_title: "P", source_training_title: "S", source_module_version: 1, scenario: validScenario() } }),
      [startUrl]: () => res(true, { run_id: "run-9" }, 201),
    });
    const r = await startPractice(f, PID);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.runId).toBe("run-9");
      expect(r.practice.id).toBe(PID);
    }
  });

  it("does NOT enter playing when the snapshot is unavailable", async () => {
    const f = mockFetch({ [snapshotUrl]: () => res(false, {}) });
    const r = await startPractice(f, PID);
    expect(r).toEqual({ ok: false, reason: "snapshot_unavailable" });
  });

  it("does NOT enter playing when the snapshot is structurally INVALID", async () => {
    const bad = validScenario();
    bad.primary.choices = []; // invalid cardinality
    const f = mockFetch({
      [snapshotUrl]: () => res(true, { practice: { id: PID, practice_title: "P", source_training_title: "S", source_module_version: 1, scenario: bad } }),
    });
    const r = await startPractice(f, PID);
    expect(r).toEqual({ ok: false, reason: "snapshot_invalid" });
  });

  it("does NOT enter playing when the start endpoint fails (no false success)", async () => {
    const f = mockFetch({
      [snapshotUrl]: () => res(true, { practice: { id: PID, practice_title: "P", source_training_title: "S", source_module_version: 1, scenario: validScenario() } }),
      [startUrl]: () => res(false, {}),
    });
    const r = await startPractice(f, PID);
    expect(r).toEqual({ ok: false, reason: "start_failed" });
  });

  it("does NOT enter playing when start returns no run id", async () => {
    const f = mockFetch({
      [snapshotUrl]: () => res(true, { practice: { id: PID, practice_title: "P", source_training_title: "S", source_module_version: 1, scenario: validScenario() } }),
      [startUrl]: () => res(true, {}),
    });
    const r = await startPractice(f, PID);
    expect(r).toEqual({ ok: false, reason: "start_failed" });
  });

  it("duplicate start resolves to ONE run (server idempotency: resumed run id returned)", async () => {
    // The start endpoint returns the same run id (resume) on a second tap.
    const f = mockFetch({
      [snapshotUrl]: () => res(true, { practice: { id: PID, practice_title: "P", source_training_title: "S", source_module_version: 1, scenario: validScenario() } }),
      [startUrl]: () => res(true, { run_id: "run-9", resumed: true }, 200),
    });
    const a = await startPractice(f, PID);
    const b = await startPractice(f, PID);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.runId).toBe(b.runId);
  });
});

describe("completePractice — honest persistence", () => {
  it("reports ok only on a real success response", async () => {
    const f = mockFetch({ [completeUrl]: () => res(true, { completed: true }) });
    expect(await completePractice(f, PID, "run-9")).toEqual({ ok: true });
  });

  it("reports NOT ok when the server rejects (no false persisted completion)", async () => {
    const f = mockFetch({ [completeUrl]: () => res(false, {}) });
    expect(await completePractice(f, PID, "run-9")).toEqual({ ok: false });
  });

  it("reports NOT ok on a network exception", async () => {
    const f = vi.fn(async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    expect(await completePractice(f, PID, "run-9")).toEqual({ ok: false });
  });
});

describe("fetchPracticeList — error is never an empty list", () => {
  it("returns ok+practices on success", async () => {
    const f = mockFetch({ "GET /api/arena/practice": () => res(true, { practices: [{ id: PID, practice_title: "P", source_training_title: "S", completed: false }] }) });
    const r = await fetchPracticeList(f);
    expect(r).toEqual({ ok: true, practices: [{ id: PID, practice_title: "P", source_training_title: "S", completed: false }] });
  });

  it("returns ok:false on error (distinct from an empty list)", async () => {
    const f = mockFetch({ "GET /api/arena/practice": () => res(false, {}) });
    expect(await fetchPracticeList(f)).toEqual({ ok: false });
  });

  it("only ever calls published-practice endpoints (no /api/arena/run, no XP)", async () => {
    const spy = mockFetch({
      "GET /api/arena/practice": () => res(true, { practices: [] }),
      [snapshotUrl]: () => res(true, { practice: { id: PID, practice_title: "P", source_training_title: "S", source_module_version: 1, scenario: validScenario() } }),
      [startUrl]: () => res(true, { run_id: "r" }, 201),
      [completeUrl]: () => res(true, {}),
    });
    await fetchPracticeList(spy);
    await startPractice(spy, PID);
    await completePractice(spy, PID, "r");
    for (const call of (spy as unknown as { mock: { calls: unknown[][] } }).mock.calls) {
      const url = String(call[0]);
      expect(url.startsWith("/api/arena/practice")).toBe(true);
      expect(url).not.toContain("/api/arena/run");
    }
  });
});
