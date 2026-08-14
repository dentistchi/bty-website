/**
 * /api/me/today/brief — Host Leadership Attention field contract (Slice 3.1B-3L, tests 27–29, 36).
 * hostAttention is a SEPARATE top-level array (never merged into reminders); learner reminders pass
 * through unchanged; a Host-projection failure never removes reminders/brief; Cache-Control stays
 * private, no-store. buildTodayReminders / composeTodayBrief / getHostDailyAttention are mocked.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockGetAdmin = vi.fn();
const mockReminders = vi.fn();
const mockBrief = vi.fn();
const mockHostAttention = vi.fn();

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
  buildActionStatus: () => Promise.resolve([]),
}));
vi.mock("@/lib/bty/daily/todayBrief.server", () => ({ composeTodayBrief: (...a: unknown[]) => mockBrief(...a) }));
vi.mock("@/lib/bty/foundry/events/hostAttentionService", () => ({ getHostDailyAttention: (...a: unknown[]) => mockHostAttention(...a) }));

import { GET } from "./route";

const LEARNER_REMINDER = {
  stableId: "followup:abc",
  category: "FOLLOW_UP_DUE",
  title: "7-day follow-up · Consent",
  state: "overdue",
  sourceTimestamp: "2026-07-15T05:00:00.000Z",
  roleContext: "learner",
  canonicalDeepLink: "/en/app?tab=foundry&followup=abc",
};
const HOST_ITEM = {
  stableId: "host-followup-overdue:fu1",
  category: "FOLLOW_UP_OVERDUE",
  eventId: "e1",
  focusId: "fu1",
  participantDisplayName: "Kim",
  trainingTitle: "Consent",
  reason: "7-day follow-up has not been answered",
  sourceTimestamp: "2026-07-15T05:00:00.000Z",
  deepLink: "/en/app?tab=foundry&event=e1&section=followups&focus=fu1",
};

const get = () => new NextRequest("http://localhost/api/me/today/brief?locale=en&tz=UTC");

// Consent read: admin.from("user_conversation_preferences").select().eq().maybeSingle() → {data:null}
const adminStub = () => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }),
});

describe("/api/me/today/brief hostAttention field", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "host-1" } }, error: null });
    mockGetAdmin.mockReturnValue(adminStub());
    mockReminders.mockResolvedValue([LEARNER_REMINDER]);
    mockBrief.mockResolvedValue(null);
    mockHostAttention.mockResolvedValue([HOST_ITEM]);
  });

  it("(27) returns hostAttention as a separate array from reminders", async () => {
    const res = await GET(get());
    const body = await res.json();
    expect(Array.isArray(body.reminders)).toBe(true);
    expect(Array.isArray(body.hostAttention)).toBe(true);
    expect(body.hostAttention).toHaveLength(1);
    expect(body.hostAttention[0].category).toBe("FOLLOW_UP_OVERDUE");
    // Host item is NOT inside reminders.
    expect(body.reminders.some((r: { stableId: string }) => r.stableId.startsWith("host-"))).toBe(false);
  });

  it("(28) learner reminders pass through unchanged", async () => {
    const res = await GET(get());
    const body = await res.json();
    expect(body.reminders).toHaveLength(1);
    expect(body.reminders[0]).toMatchObject({ stableId: "followup:abc", roleContext: "learner" });
  });

  it("(29) hostAttention is [] when the projection has no items", async () => {
    mockHostAttention.mockResolvedValue([]);
    const res = await GET(get());
    const body = await res.json();
    expect(body.hostAttention).toEqual([]);
    expect(body.reminders).toHaveLength(1);
  });

  it("a Host-projection failure never removes reminders or brief (fail-soft)", async () => {
    mockHostAttention.mockRejectedValue(new Error("boom"));
    const res = await GET(get());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.hostAttention).toEqual([]);
    expect(body.reminders).toHaveLength(1);
  });

  it("(36) Cache-Control stays private, no-store", async () => {
    const res = await GET(get());
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("(34,35) the serialized hostAttention DTO carries no private body/reflection field", async () => {
    const res = await GET(get());
    const raw = JSON.stringify((await res.json()).hostAttention);
    expect(raw).not.toContain("response_text");
    expect(raw).not.toContain("sharedResponse");
    expect(raw).not.toContain("reviewNote");
  });
});
