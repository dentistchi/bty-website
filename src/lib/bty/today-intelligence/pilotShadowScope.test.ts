/**
 * Pilot shadow — USER SCOPE at the query boundary (matrix §12: USER SCOPE 14–17). Synthetic, no DB.
 */
import { describe, it, expect, vi } from "vitest";
import {
  runPilotEvidenceShadow,
  makeSupabaseReadOnlyReaders,
  requireUserScope,
  PilotScopeError,
} from "@/lib/bty/today-intelligence/pilotShadow";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  okConfig,
  makeFakeReaders,
  shorterLatencyCompletions,
  SYNTH_USER_ID,
} from "@/lib/bty/today-intelligence/__fixtures__/pilotShadowFixtures";

const NOW = new Date("2026-07-10T18:00:00Z");

/** Chainable recording fake — records .from tables and .eq(col,val); resolves to empty reads. */
function makeRecordingClient() {
  const calls = { tables: [] as string[], eqs: [] as [string, unknown][] };
  const builder: Record<string, unknown> = {};
  Object.assign(builder, {
    select: () => builder,
    eq: (col: string, val: unknown) => (calls.eqs.push([col, val]), builder),
    in: () => builder,
    not: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve({ data: null }),
    then: (res: (v: { data: unknown[] }) => unknown) => Promise.resolve({ data: [] }).then(res),
  });
  const client = { from: (t: string) => (calls.tables.push(t), builder) } as unknown as SupabaseClient;
  return { client, calls };
}

describe("pilot user-scope enforcement", () => {
  it("14. every reader receives the same explicit user ID", async () => {
    const { readers, spy } = makeFakeReaders({ completions: shorterLatencyCompletions() });
    await runPilotEvidenceShadow({ config: okConfig(), now: NOW, armed: true, readers });
    expect(spy.userIds.length).toBeGreaterThanOrEqual(2);
    for (const id of [...spy.userIds, ...spy.briefUserIds]) expect(id).toBe(SYNTH_USER_ID);
  });

  it("15. missing user scope blocks query construction (throws before .from())", () => {
    const { client, calls } = makeRecordingClient();
    const fromSpy = vi.spyOn(client, "from");
    const readers = makeSupabaseReadOnlyReaders(client);
    expect(() => readers.readCompletionsForLatency("")).toThrow(PilotScopeError);
    expect(() => readers.readTopSignature("   ")).toThrow(PilotScopeError);
    expect(fromSpy).not.toHaveBeenCalled();
    expect(calls.tables).toHaveLength(0);
    expect(() => requireUserScope("")).toThrow(PilotScopeError);
  });

  it("16. cross-user synthetic rows cannot enter the packet", async () => {
    // Two shorter-pair completions, but the second belongs to ANOTHER user → filtered out.
    const completions = [
      { id: "mine", patternFamily: "future_deferral", chosenAt: "2026-07-09T10:00:00Z", verifiedAt: "2026-07-09T14:00:00Z", userId: SYNTH_USER_ID },
      { id: "theirs", patternFamily: "future_deferral", chosenAt: "2026-07-09T10:00:00Z", verifiedAt: "2026-07-09T10:30:00Z", userId: "99999999-8888-4777-8666-555555555555" },
    ];
    const { readers } = makeFakeReaders({ completions });
    const status = await runPilotEvidenceShadow({ config: okConfig(), now: NOW, armed: true, readers });
    expect(status.signals.completionInterval.candidateSignalEmitted).toBe(false);
    expect(status.signals.completionInterval.heldReason ?? "").toMatch(/^LATENCY_/);
  });

  it("17. no cohort-wide query is issued — user_id is bound in every reader query", async () => {
    const { client, calls } = makeRecordingClient();
    const readers = makeSupabaseReadOnlyReaders(client);
    await readers.readCompletionsForLatency(SYNTH_USER_ID);
    await readers.readTopSignature(SYNTH_USER_ID);
    expect(calls.tables.length).toBe(2);
    const userIdEqs = calls.eqs.filter(([c]) => c === "user_id");
    expect(userIdEqs.length).toBe(2); // one per reader
    for (const [, val] of userIdEqs) expect(val).toBe(SYNTH_USER_ID);
  });
});
