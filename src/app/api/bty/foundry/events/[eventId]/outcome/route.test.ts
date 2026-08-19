import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * R4-R3A — THE WHOLE /outcome REQUEST IS READ-ONLY.
 *
 * The service was already proven write-free, but that was not the whole request. The route also
 * resolves the Host's timezone, and the product's canonical resolver best-effort PERSISTS a newly
 * seen device zone into `arena_profiles.timezone`. Correct on a learner surface; wrong here —
 * opening a panel to look at an outcome must not mutate the Host's profile.
 *
 * So this test traps mutation at the CLIENT, not inside one module: every `insert`, `update`,
 * `upsert`, `delete` and `rpc` throws. A single write anywhere in the request — service, timezone
 * path or route — fails the test. The request must still return its full outcome with all of them
 * armed.
 */

const requireManager = vi.fn();
vi.mock("@/lib/bty/foundry/events/managerGate", () => ({
  requireManager: (...a: unknown[]) => requireManager(...a),
  managerJson: (_base: unknown, _req: unknown, body: unknown, status = 200) =>
    NextResponse.json(body as Record<string, unknown>, { status }),
}));

import { GET } from "./route";

const OWNER = "owner-1";
const EVENT = "ev-1";

/** Rows shaped like production for the training that traversed the most stages. */
const ROWS: Record<string, unknown[]> = {
  arena_profiles: [{ timezone: null }],
  foundry_events: [{ id: EVENT }],
  foundry_event_participants: [
    { id: "p1", status: "joined" },
    { id: "p2", status: "joined" },
  ],
  foundry_event_training_progress: [
    { id: "pr1", completed_at: "2026-08-15T12:30:35Z", linked_user_id: "u1", decision_response_text: "Name one owner and one deadline." },
  ],
  foundry_participant_followups: [{ id: "f1", status: "PENDING", outcome: null, due_at: "2026-08-22T05:00:00Z" }],
  foundry_behavior_observations: [{ followup_id: "f1", outcome: "UNABLE_TO_TELL" }],
  foundry_event_module: [
    {
      module_snapshot: {
        realityGroundedJourneyV1: { elements: [{ kind: "action_decision", confirmationStatus: "grounded", content: "x" }] },
      },
    },
  ],
};

/** Every mutation method is armed to throw. Reads behave normally. */
function armedAdmin(onMutate: (what: string) => void, profileTz: string | null = null) {
  const rows: Record<string, unknown[]> = { ...ROWS, arena_profiles: [{ timezone: profileTz }] };
  const from = (table: string) => {
    const q: Record<string, unknown> = {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      in() {
        return this;
      },
      maybeSingle() {
        return Promise.resolve({ data: (rows[table] ?? [])[0] ?? null, error: null });
      },
      returns() {
        return Promise.resolve({ data: rows[table] ?? [], error: null });
      },
    };
    for (const m of ["insert", "update", "upsert", "delete"]) {
      q[m] = () => {
        onMutate(`${table}.${m}`);
        throw new Error(`FORBIDDEN WRITE: ${table}.${m}`);
      };
    }
    return q;
  };
  return {
    from,
    rpc: (name: string) => {
      onMutate(`rpc:${name}`);
      throw new Error(`FORBIDDEN RPC: ${name}`);
    },
  };
}

function makeReq(tz?: string) {
  const url = `https://x.dev/api/bty/foundry/events/${EVENT}/outcome${tz ? `?tz=${encodeURIComponent(tz)}` : ""}`;
  return { nextUrl: new URL(url) } as unknown as Parameters<typeof GET>[0];
}
const ctx = { params: Promise.resolve({ eventId: EVENT }) };

beforeEach(() => vi.clearAllMocks());

describe("R4-R3A · 3 · the full GET /outcome path performs zero writes", () => {
  it("returns the outcome with insert/update/upsert/delete/rpc ALL armed to throw", async () => {
    const mutations: string[] = [];
    requireManager.mockResolvedValue({
      ok: true,
      ctx: { user: { id: OWNER }, admin: armedAdmin((m) => mutations.push(m)), base: NextResponse.next() },
    });

    const res = await GET(makeReq("Asia/Seoul"), ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; outcome: Record<string, unknown> };
    expect(body.ok).toBe(true);
    expect(body.outcome).toBeTruthy();

    // The decisive assertion: nothing tried to write, anywhere in the request.
    expect(mutations).toEqual([]);
  });

  it("the timezone path specifically does not persist the device hint", async () => {
    /*
      This is the exact behaviour that blocked the slice: `resolveUserTzContext` writes the newly
      resolved zone back to `arena_profiles`. With no stored profile tz and a valid device hint,
      the writing resolver WOULD have issued an update here. The read-only twin must not.
    */
    const mutations: string[] = [];
    requireManager.mockResolvedValue({
      ok: true,
      ctx: { user: { id: OWNER }, admin: armedAdmin((m) => mutations.push(m), null), base: NextResponse.next() },
    });

    const res = await GET(makeReq("America/Los_Angeles"), ctx);
    expect(res.status).toBe(200);
    expect(mutations.filter((m) => m.startsWith("arena_profiles"))).toEqual([]);
    expect(mutations).toEqual([]);
  });
});

/*
  PRECEDENCE IS PROVEN IN `readUserTzContext.test.ts`, NOT HERE — there the function returns the
  zone it chose, so the assertion is about the decision itself. Through the route it could only be
  read indirectly, via a classification that holds for either branch, which would be a test that
  looks stronger than it is. What these cover is the route's ROBUSTNESS: whatever the stored or
  hinted zone, the request resolves and classifies without throwing.
*/
describe("R4-R3A · 4 · the route resolves and classifies under every timezone shape", () => {
  const outcomeFor = async (profileTz: string | null, hint?: string) => {
    requireManager.mockResolvedValue({
      ok: true,
      ctx: {
        user: { id: OWNER },
        admin: armedAdmin(() => {
          throw new Error("unexpected write");
        }, profileTz),
        base: NextResponse.next(),
      },
    });
    const res = await GET(makeReq(hint), ctx);
    return (await res.json()) as { outcome: { followUp: { overdue: number; waiting: number } } };
  };

  /* The follow-up is due 2026-08-22 (05:00-local start) in whichever frame is resolved. */
  it("a stored profile timezone and a conflicting hint both classify cleanly", async () => {
    const withProfile = await outcomeFor("Pacific/Kiritimati", "Pacific/Midway");
    expect(withProfile.outcome.followUp.overdue + withProfile.outcome.followUp.waiting).toBe(1);
  });

  it("extreme zones on either side of the line still classify exactly one follow-up", async () => {
    const seoul = await outcomeFor(null, "Asia/Seoul");
    const la = await outcomeFor(null, "America/Los_Angeles");
    // Both resolve to exactly one follow-up; the frames differ but the row is always classified.
    expect(seoul.outcome.followUp.overdue + seoul.outcome.followUp.waiting).toBe(1);
    expect(la.outcome.followUp.overdue + la.outcome.followUp.waiting).toBe(1);
  });

  it("a malformed hint and no profile fall back defensively without throwing", async () => {
    const bad = await outcomeFor(null, "Not/AZone");
    expect(bad.outcome.followUp.overdue + bad.outcome.followUp.waiting).toBe(1);

    const missing = await outcomeFor(null, undefined);
    expect(missing.outcome.followUp.overdue + missing.outcome.followUp.waiting).toBe(1);
  });

  it("a malformed STORED profile tz does not poison the resolution", async () => {
    const res = await outcomeFor("Mars/Olympus", "Asia/Seoul");
    expect(res.outcome.followUp.overdue + res.outcome.followUp.waiting).toBe(1);
  });
});
