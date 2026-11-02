import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  data: null as unknown, error: null as { message: string; code?: string } | null,
  timezone: "UTC", timezoneError: false, timezoneThrows: false, throws: false, calls: [] as { name: string; args: Record<string, unknown> }[],
  directCore: vi.fn<(...args: unknown[]) => Promise<{ error: string }>>(async () => ({ error: "synthetic Core update failed" })),
  avatar: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
}));
vi.mock("@/lib/bty/arena/applyCoreXp", () => ({ applyDirectCoreXp: (...args: unknown[]) => state.directCore(...args) }));
vi.mock("@/engine/avatar/avatar-state.service", () => ({ syncAvatarStateAfterCoreXpChange: (...args: unknown[]) => state.avatar(...args) }));
import { parseFoundryAwardAcknowledgement, readConfirmedFoundryXpStatus, readFoundryRewardTimezone } from "./foundryXpAtomic.server";
import { awardTrainingCoreXp, outcomeToXpStatus } from "./foundryTrainingService";
const USER = "00000000-0000-4000-8000-000000000001";
const EVENT = "00000000-0000-4000-8000-000000000002";
const PROGRESS = "00000000-0000-4000-8000-000000000003";
const OWNER = "00000000-0000-4000-8000-000000000004";
const RECEIPT = { policyVersion: "foundry-core-atomic/v1", outcome: "awarded", userId: USER, eventId: EVENT,
  requestedProgressId: PROGRESS, awardedProgressId: PROGRESS,
  receiptId: "00000000-0000-4000-8000-000000000005", ledgerId: 1, deltaXp: 10,
  coreBefore: 0, coreAfter: 10, replayed: false };
const admin = { from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => { if (state.timezoneThrows) throw new Error("synthetic timezone transport failure"); return { data: { timezone: state.timezone }, error: state.timezoneError ? { code: "XX001" } : null }; } }), rpc: async (name: string, args: Record<string, unknown>) => {
  state.calls.push({ name, args });
  if (state.throws) throw new Error("synthetic transport failure");
  if (state.error) return { data: null, error: state.error };
  if (name === "bty_foundry_award_daily_capped") return { data: "awarded", error: null };
  return { data: state.data, error: null };
} } as never;
const award = () => awardTrainingCoreXp(admin, USER, EVENT, OWNER, PROGRESS);
beforeEach(() => { state.data = structuredClone(RECEIPT); state.error = null; state.throws = false;
  state.calls.length = 0; state.timezone = "UTC"; state.timezoneError = false; state.timezoneThrows = false; state.directCore.mockClear(); state.avatar.mockClear(); });

afterEach(() => vi.useRealTimers());

describe("Foundry Core reward atomic receipt boundary", () => {
  it("does not claim a split ledger/Core failure was paid", async () => {
    state.data = null;
    expect(await award()).toBe("unavailable");
    expect(state.directCore).not.toHaveBeenCalled();
  });
  it("uses one atomic private boundary instead of the old ledger then TypeScript Core update", async () => {
    expect(await award()).toBe("awarded");
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0]).toMatchObject({ name: "bty_foundry_award_core_atomic", args: {
      p_user_id: USER, p_event_id: EVENT, p_progress_id: PROGRESS,
    } });
    expect(state.directCore).not.toHaveBeenCalled();
  });
  it.each(["PGRST202", "42883", "XX001"])("reports unavailable on private RPC failure %s", async code => {
    state.error = { code, message: "synthetic server error" };
    expect(await award()).toBe("unavailable"); expect(outcomeToXpStatus(await award())).toBe("unavailable");
    expect(state.directCore).not.toHaveBeenCalled();
  });
  it("contains thrown transport errors without inventing an existing award", async () => {
    state.throws = true; expect(await award()).toBe("unavailable");
  });
  it.each([null, {}, [], "awarded", { ...RECEIPT, eventId: OWNER }, { ...RECEIPT, deltaXp: 999 },
    { ...RECEIPT, coreAfter: 9 }, { ...RECEIPT, receiptId: null }].map(value => ({ value })))(
    "rejects unsupported or mismatched acknowledgements $value", async ({ value }) => {
      state.data = value; expect(await award()).toBe("unavailable");
    },
  );
  it("returns an identical receipt replay without another Core or avatar transition", async () => {
    state.data = { ...RECEIPT, outcome: "already_awarded", replayed: true };
    expect(await award()).toBe("already_awarded");
    expect(state.directCore).not.toHaveBeenCalled(); expect(state.avatar).not.toHaveBeenCalled();
  });
  it("does not label historical ledger-only state as an established award", async () => {
    state.data = { policyVersion: "foundry-core-atomic/v1", outcome: "review_required" };
    expect(await award()).toBe("review_required"); expect(outcomeToXpStatus(await award())).toBe("review_required");
  });
  it("retains a truthful daily limit without an unsupported paid receipt", async () => {
    state.data = { policyVersion: "foundry-core-atomic/v1", outcome: "daily_limit" };
    expect(await award()).toBe("daily_limit");
  });
  it.each(["error", "throw"])("does not shift the reward day to UTC after a profile lookup %s", async failure => {
    state.timezoneError = failure === "error"; state.timezoneThrows = failure === "throw";
    expect(await award()).toBe("unavailable"); expect(state.calls).toEqual([]);
  });
  it("passes exact 25-hour Seattle fall-back bounds to the atomic RPC", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-31T20:00:00Z")); state.timezone = "America/Los_Angeles";
    expect(await award()).toBe("awarded"); expect(state.calls[0].args).toMatchObject({ p_day_start: "2026-10-31T12:00:00.000Z", p_day_end: "2026-11-01T13:00:00.000Z" });
  });
  it("preserves owner exclusion through the SQL authority without a Core mutation", async () => {
    state.data = { policyVersion: "foundry-core-atomic/v1", outcome: "owner_ineligible" };
    expect(await awardTrainingCoreXp(admin, OWNER, EVENT, OWNER, PROGRESS)).toBe("owner_ineligible");
    expect(state.calls).toHaveLength(1); expect(state.calls[0].name).toBe("bty_foundry_award_core_atomic");
    expect(state.directCore).not.toHaveBeenCalled();
  });
  it("does not hide a retained receipt if its learner later becomes the event owner", async () => {
    state.data = { ...RECEIPT, outcome: "already_awarded", replayed: true };
    expect(await awardTrainingCoreXp(admin, USER, EVENT, USER, PROGRESS)).toBe("already_awarded");
    expect(state.avatar).not.toHaveBeenCalled();
  });
});

describe("read-only account/event reward proof", () => {
  const progress = { id: PROGRESS, event_id: EVENT, linked_user_id: USER, completed_at: "2026-10-31T00:00:00Z", xp_awarded_at: "2026-10-31T00:00:00Z" };
  function db(result: unknown, error: unknown = null) {
    const filters: Record<string, unknown> = {};
    const q = { select: () => q, eq: (key: string, value: unknown) => { filters[key] = value; return q; },
      maybeSingle: async () => ({ data: result === null ? null : { result }, error }) };
    return { admin: { from: () => q } as never, filters };
  }
  it("keeps owner exclusion truthful after a reload without inventing a claimable reward", async () => {
    expect(await readConfirmedFoundryXpStatus(db(null).admin, { ...progress, xp_awarded_at: null }, USER)).toBe("owner_ineligible");
  });
  it("retains a proven payment when its account is now the event owner", async () => {
    expect(await readConfirmedFoundryXpStatus(db(RECEIPT).admin, progress, USER)).toBe("awarded");
  });
  it("reports historical timestamps without receipts as review-required", async () => {
    expect(await readConfirmedFoundryXpStatus(db(null).admin, progress)).toBe("review_required");
  });
  it("reports unavailable storage instead of a paid timestamp", async () => {
    expect(await readConfirmedFoundryXpStatus(db(null, { code: "XX001" }).admin, progress)).toBe("unavailable");
  });
  it("confirms an original positive receipt without any write", async () => {
    expect(await readConfirmedFoundryXpStatus(db(RECEIPT).admin, progress)).toBe("awarded");
  });
  it("retains account-event payment truth across another progress/session without inventing its marker", async () => {
    const next = { ...progress, id: OWNER, xp_awarded_at: null };
    const r = db(RECEIPT); expect(await readConfirmedFoundryXpStatus(r.admin, next)).toBe("awarded");
    expect(r.filters).toEqual({ user_id: USER, event_id: EVENT }); expect(next.xp_awarded_at).toBeNull();
  });
  it("does not interpret anonymous completion as an awarded account", async () => {
    expect(await readConfirmedFoundryXpStatus(db(null).admin, { ...progress, linked_user_id: null, xp_awarded_at: null })).toBe("claimable");
  });
  it("rejects an event replay whose original progress is not a canonical UUID", () => {
    expect(parseFoundryAwardAcknowledgement({ ...RECEIPT, outcome: "event_already_awarded", replayed: true, awardedProgressId: "not-a-uuid" },
      { userId: USER, eventId: EVENT, progressId: PROGRESS })).toBeNull();
  });
});

describe("strict read-only reward timezone preparation", () => {
  function db(timezone: unknown) {
    const writes = vi.fn(() => { throw new Error("Unexpected profile write"); });
    const q = { select: () => q, eq: () => q, update: writes, maybeSingle: async () => ({ data: timezone === undefined ? null : { timezone }, error: null }) };
    return { admin: { from: () => q } as never, writes };
  }
  it("uses the stored IANA zone before a device hint without writing", async () => {
    const r = db("America/Los_Angeles"); expect(await readFoundryRewardTimezone(r.admin, USER, "Asia/Seoul")).toBe("America/Los_Angeles"); expect(r.writes).not.toHaveBeenCalled();
  });
  it("uses a valid hint only for truly unresolved storage and never captures it outside the transaction", async () => {
    const r = db(null); expect(await readFoundryRewardTimezone(r.admin, USER, "Asia/Seoul")).toBe("Asia/Seoul"); expect(r.writes).not.toHaveBeenCalled();
  });
  it("uses UTC only when neither stored nor device timezone is resolved", async () => {
    const r = db(undefined); expect(await readFoundryRewardTimezone(r.admin, USER, "not/a-zone")).toBe("UTC"); expect(r.writes).not.toHaveBeenCalled();
  });
});
