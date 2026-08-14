/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Slice 3.1B-3E.1 review route. Auth REQUIRED (401), server-derived identity is the only
 * ownership key, and a null review (not owned / not completed / missing) is a neutral 404.
 */
const getSupabaseAdmin = vi.fn();
const getSupabaseServerClient = vi.fn();
const getMyCompletionReview = vi.fn();

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

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/bty/arena/supabaseServer", () => ({ getSupabaseServerClient: () => getSupabaseServerClient() }));
vi.mock("@/lib/bty/foundry/events/foundryCompletionReviewService", () => ({
  getMyCompletionReview: (...a: unknown[]) => getMyCompletionReview(...a),
}));

let GET: typeof import("./route").GET;
beforeEach(async () => {
  vi.clearAllMocks();
  ({ GET } = await import("./route"));
});

const ctx = (id: string) => ({ params: Promise.resolve({ assignmentId: id }) });
const req = () => new NextRequest("https://arena.btydaily.com/api/bty/foundry/assignment-review/a1");
function authed(uid: string | null) {
  getSupabaseServerClient.mockResolvedValue({
    auth: { getUser: () => Promise.resolve({ data: { user: uid ? { id: uid } : null } }) },
  });
}

describe("GET assignment-review", () => {
  it("401 when unauthenticated — service never reached", async () => {
    getSupabaseAdmin.mockReturnValue({});
    authed(null);
    const res = await GET(req(), ctx("a1"));
    expect(res.status).toBe(401);
    expect(getMyCompletionReview).not.toHaveBeenCalled();
  });

  it("503 when admin client unavailable", async () => {
    getSupabaseAdmin.mockReturnValue(null);
    const res = await GET(req(), ctx("a1"));
    expect(res.status).toBe(503);
  });

  it("owner (server-derived id) gets 200 with their review", async () => {
    getSupabaseAdmin.mockReturnValue({ __admin: true });
    authed("user-hanbit");
    getMyCompletionReview.mockResolvedValue({ assignmentId: "a1", title: "배가 고파", responseText: "x" });
    const res = await GET(req(), ctx("a1"));
    expect(res.status).toBe(200);
    expect(getMyCompletionReview).toHaveBeenCalledWith({ __admin: true }, "user-hanbit", "a1");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.review.title).toBe("배가 고파");
  });

  it("neutral 404 when the service returns null (not owned / not completed / missing)", async () => {
    getSupabaseAdmin.mockReturnValue({});
    authed("someone-else");
    getMyCompletionReview.mockResolvedValue(null);
    const res = await GET(req(), ctx("a1"));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("not_found");
  });
});
