/**
 * POST /api/bty/events/scan — Reality Event scan + Core XP award (Slice 2b).
 *
 * The atomic insert + Core XP add live in the `bty_event_scan_award` RPC, which is
 * mocked here (migration is file-only until applied). These tests pin the route
 * contract: gate order, DB event guards, idempotent benign duplicate, and that
 * the Core XP path (RPC + reprojection) only fires for an approved member on a
 * fresh scan.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signEventQrToken } from "@/lib/bty/event-qr/event-qr-token";

const getUser = vi.fn();
vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));

const requireApprovedMembership = vi.fn();
vi.mock("@/lib/bty/arena/requireApprovedMembership", () => ({
  requireApprovedMembership: (...args: unknown[]) => requireApprovedMembership(...args),
}));

const reprojectCoreDerivedFields = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/bty/event-qr/reprojectCoreDerivedFields", () => ({
  reprojectCoreDerivedFields: (...args: unknown[]) => reprojectCoreDerivedFields(...args),
}));

const eventsMaybeSingle = vi.fn();
const rpc = vi.fn();
const adminFrom = vi.fn(() => ({
  select: () => ({ eq: () => ({ maybeSingle: eventsMaybeSingle }) }),
}));
const admin = { from: adminFrom, rpc };
const getSupabaseAdmin = vi.fn(() => admin);
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}));

// Import AFTER mocks are registered.
import { POST } from "./route";

const USER = { id: "scanner-1" };
const EVENT_ID = "11111111-1111-1111-1111-111111111111";

function tokenFor(eventId: string, exp: number): string {
  return signEventQrToken({
    type: "event",
    eventId,
    issuedBy: "creator-1",
    issuedAt: 1_700_000_000_000,
    exp,
  });
}

function liveEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    title: "Morning Standup",
    event_type: "checkin",
    xp_value: 50,
    valid_until: new Date(Date.now() + 3_600_000).toISOString(),
    status: "active",
    ...overrides,
  };
}

function post(body: unknown): NextRequest {
  return new NextRequest("https://app.test/api/bty/events/scan", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/bty/events/scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("EVENT_QR_SECRET", "test-event-secret");
    getUser.mockResolvedValue({ data: { user: USER } });
    requireApprovedMembership.mockResolvedValue({ approved: true });
    eventsMaybeSingle.mockResolvedValue({ data: liveEvent(), error: null });
    reprojectCoreDerivedFields.mockResolvedValue(undefined);
  });

  it("(1) non-approved member → 403 and NO insert/award (rpc not called)", async () => {
    requireApprovedMembership.mockResolvedValue({
      approved: false,
      status: 403,
      error: "MEMBERSHIP_REQUIRED",
      reason: "pending",
    });
    const token = tokenFor(EVENT_ID, Date.now() + 3_600_000);

    const res = await POST(post({ token }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json).toMatchObject({ ok: false, error: "MEMBERSHIP_REQUIRED" });
    expect(rpc).not.toHaveBeenCalled();
    expect(reprojectCoreDerivedFields).not.toHaveBeenCalled();
  });

  it("(R2) an unexpected throw returns a CLEAN JSON 500 (never a raw Internal Server Error)", async () => {
    getUser.mockRejectedValue(new Error("boom (e.g. cookie/session parse)"));
    const token = tokenFor(EVENT_ID, Date.now() + 3_600_000);
    const res = await POST(post({ token }));
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json).toEqual({ ok: false, error: "scan_failed" });
  });

  it("(R2) an RPC failure returns a stable 500 code (exact error logged server-side, not leaked)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23503", message: "insert or update on table violates foreign key" } });
    const token = tokenFor(EVENT_ID, Date.now() + 3_600_000);
    const res = await POST(post({ token }));
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json).toEqual({ ok: false, error: "scan_award_failed" }); // no raw SQL/constraint leaked
  });

  it("(2) fresh scan → 200, awards xp_value via RPC + reprojection", async () => {
    rpc.mockResolvedValue({
      data: [{ fresh_insert: true, already_scanned: false, xp_awarded: 50, new_core_xp: 150 }],
      error: null,
    });
    const token = tokenFor(EVENT_ID, Date.now() + 3_600_000);

    const res = await POST(post({ token }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      ok: true,
      already_scanned: false,
      xp_awarded: 50,
      newCoreTotal: 150,
    });
    expect(json.event).toMatchObject({ id: EVENT_ID, xp_value: 50 });
    // RPC invoked once with the event's xp_value (the atomic insert+award).
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("bty_event_scan_award", {
      p_event_id: EVENT_ID,
      p_user_id: USER.id,
      p_xp: 50,
    });
    // Best-effort derived projection runs once on fresh award.
    expect(reprojectCoreDerivedFields).toHaveBeenCalledTimes(1);
    expect(reprojectCoreDerivedFields).toHaveBeenCalledWith(admin, USER.id, 150, 50);
  });

  it("(3) duplicate scan → 200 benign already_scanned, no XP, no double-add", async () => {
    rpc.mockResolvedValue({
      data: [{ fresh_insert: false, already_scanned: true, xp_awarded: 0, new_core_xp: 150 }],
      error: null,
    });
    const token = tokenFor(EVENT_ID, Date.now() + 3_600_000);

    const res = await POST(post({ token }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, already_scanned: true, xp_awarded: 0 });
    // RPC still called (it is the idempotency gate) but reprojection must NOT run
    // again — Core XP stays unchanged on a re-scan.
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(reprojectCoreDerivedFields).not.toHaveBeenCalled();
  });

  it("(4) cancelled event → 409 event_cancelled, no award", async () => {
    eventsMaybeSingle.mockResolvedValue({ data: liveEvent({ status: "cancelled" }), error: null });
    const token = tokenFor(EVENT_ID, Date.now() + 3_600_000);

    const res = await POST(post({ token }));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toMatchObject({ ok: false, error: "event_cancelled" });
    expect(rpc).not.toHaveBeenCalled();
    expect(reprojectCoreDerivedFields).not.toHaveBeenCalled();
  });

  it("(5) expired token → 401, no DB lookup, no award", async () => {
    const token = tokenFor(EVENT_ID, Date.now() - 1_000); // already expired

    const res = await POST(post({ token }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toMatchObject({ ok: false, error: "expired" });
    expect(adminFrom).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(reprojectCoreDerivedFields).not.toHaveBeenCalled();
  });
});
