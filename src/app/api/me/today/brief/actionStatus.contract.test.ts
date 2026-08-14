/**
 * /api/me/today/brief — actionStatus field contract (Slice 3.1B-3M, tests 15–21, 36).
 * actionStatus is a SEPARATE top-level array (never merged into reminders); allow-listed fields only;
 * no private body/reflection/host-note/AI; Cache-Control private, no-store. All projections mocked.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockGetAdmin = vi.fn();
const mockReminders = vi.fn();
const mockBrief = vi.fn();
const mockHostAttention = vi.fn();
const mockActionStatus = vi.fn();

/*
  R9B.2: these routes now require CURRENT consent. This suite is about the route's own behaviour,
  and its subject has always been an ordinary consented learner — so the consent primitive says so
  explicitly. The consent VERDICT itself is proven by `requireConsentedUser.test.ts` and
  `learnerConsentGuard.route.test.ts`, which do not mock it.
*/
vi.mock("@/lib/legal/activeConsent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/legal/activeConsent")>()),
  isConsentCurrent: async () => true,
}));

vi.mock("@/lib/supabase-server", () => ({ getSupabaseServer: () => Promise.resolve({ auth: { getUser: () => mockGetUser() } }) }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => mockGetAdmin() }));
vi.mock("@/lib/bty/daily/userDay", () => ({ resolveUserTzContext: () => Promise.resolve({ timezone: "UTC" }) }));
vi.mock("@/lib/bty/daily/todayReminders.server", () => ({
  buildTodayReminders: (...a: unknown[]) => mockReminders(...a),
  buildActionStatus: (...a: unknown[]) => mockActionStatus(...a),
}));
vi.mock("@/lib/bty/daily/todayBrief.server", () => ({ composeTodayBrief: (...a: unknown[]) => mockBrief(...a) }));
vi.mock("@/lib/bty/foundry/events/hostAttentionService", () => ({ getHostDailyAttention: (...a: unknown[]) => mockHostAttention(...a) }));

import { GET } from "./route";

const REMINDER = { stableId: "action:p1", category: "ACTION_DUE", title: "do it", state: "overdue", sourceTimestamp: "2026-07-22T04:00:00Z", roleContext: "learner", canonicalDeepLink: "/en/app?tab=arena" };
// A domain item carrying EXTRA private-ish fields the route must NOT serialize.
const ACTION_ITEM = {
  stableId: "actionstatus:s1", contractId: "s1", status: "verification_pending", title: "submitted action",
  patternFamily: "future_deferral", sourceTitle: null, originalDeadline: "2026-05-05T04:00:00Z", deepLink: "/en/app?tab=arena",
  // fields that must be dropped by the allow-list:
  response_text: "PRIVATE", raw_text: "SECRET", user_id: "u1",
};

const get = () => new NextRequest("http://localhost/api/me/today/brief?locale=en&tz=UTC");
const adminStub = () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }) });

describe("/api/me/today/brief actionStatus field", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockGetAdmin.mockReturnValue(adminStub());
    mockReminders.mockResolvedValue([REMINDER]);
    mockBrief.mockResolvedValue(null);
    mockHostAttention.mockResolvedValue([]);
    mockActionStatus.mockResolvedValue([ACTION_ITEM]);
  });

  it("(15) actionStatus is a separate array from reminders", async () => {
    const body = await (await GET(get())).json();
    expect(Array.isArray(body.actionStatus)).toBe(true);
    expect(Array.isArray(body.reminders)).toBe(true);
    expect(body.actionStatus).toHaveLength(1);
    expect(body.reminders.some((r: { stableId: string }) => r.stableId.startsWith("actionstatus:"))).toBe(false);
  });

  it("(16/17/18/19/20) DTO carries only allow-listed fields — no private/DB-only leakage", async () => {
    const body = await (await GET(get())).json();
    const a = body.actionStatus[0];
    expect(Object.keys(a).sort()).toEqual(
      ["contractId", "deepLink", "originalDeadline", "patternFamily", "sourceTitle", "stableId", "status", "title"].sort(),
    );
    const raw = JSON.stringify(body.actionStatus);
    expect(raw).not.toContain("PRIVATE");
    expect(raw).not.toContain("SECRET");
    expect(raw).not.toContain("response_text");
    expect(raw).not.toContain("raw_text");
    expect(raw).not.toContain("user_id");
  });

  it("a projection failure never removes reminders (fail-soft)", async () => {
    mockActionStatus.mockRejectedValue(new Error("boom"));
    const res = await GET(get());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.actionStatus).toEqual([]);
    expect(body.reminders).toHaveLength(1);
  });

  it("(36) Cache-Control stays private, no-store", async () => {
    expect((await GET(get())).headers.get("Cache-Control")).toBe("private, no-store");
  });
});
