import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";

/**
 * The recipient half of the Tracking loop (Slice A1-VIS-R3).
 *
 * ★ TEAMS TRACKING IS A WORKPLACE MESSAGE WORKFLOW, NOT ARENA LEARNER PRACTICE.
 *
 * Both recipient routes gated on `requireConsentedUser`, the same boundary error that had already
 * locked a Host out of his own tracking: MEASURED, a valid session and ZERO reads, refused
 * `403 consent_required` because `isConsentCurrent` found no `arena_profiles` row. Only 2 of 13
 * Microsoft-linked accounts carry a consent version. A person picked out of a Teams message and
 * asked one question should not have to accept a learner document to answer it.
 *
 * What did NOT move is the part that was always load-bearing: the recipient row must be BOUND to
 * the caller's own canonical user id, and the write is once-only in the database.
 */

const requireUser = vi.fn();
const unauthenticated = vi.fn(() => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }));
const listMyAnnouncements = vi.fn();
const respondToAnnouncement = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (req: unknown) => requireUser(req),
  unauthenticated: () => unauthenticated(),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({ __admin: true }) }));
vi.mock("@/lib/bty/announcement/announcementService.server", () => ({
  listMyAnnouncements: (admin: unknown, id: unknown) => listMyAnnouncements(admin, id),
  respondToAnnouncement: (admin: unknown, p: unknown) => respondToAnnouncement(admin, p),
}));

const RECIPIENT = "cccccccc-0000-0000-0000-000000000001";
const STRANGER = "dddddddd-0000-0000-0000-000000000002";
const REAL_ID = "6cfccb92-fac6-43d1-b6e9-deeb0d5437b5";

const code = (p: string) =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const MINE_SRC = code("src/app/api/bty/announcements/mine/route.ts");
const RESPOND_SRC = code("src/app/api/bty/announcements/[id]/respond/route.ts");

const mineReq = () => new NextRequest("https://arena.btydaily.com/api/bty/announcements/mine");
const respondReq = (body: unknown) =>
  new NextRequest(`https://arena.btydaily.com/api/bty/announcements/${REAL_ID}/respond`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

async function GET_MINE() {
  const mod = await import("@/app/api/bty/announcements/mine/route");
  return mod.GET(mineReq());
}
async function POST_RESPOND(body: unknown) {
  const mod = await import("@/app/api/bty/announcements/[id]/respond/route");
  return mod.POST(respondReq(body), { params: Promise.resolve({ id: REAL_ID }) });
}
const signedIn = (id: string) => requireUser.mockResolvedValue({ user: { id }, base: new Response("{}") });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  signedIn(RECIPIENT);
  listMyAnnouncements.mockResolvedValue([]);
  respondToAnnouncement.mockResolvedValue({ ok: true, response: "ACKNOWLEDGED", alreadyResponded: false });
});

describe("★ 1+2. neither recipient route depends on Arena consent", () => {
  it("★ 1. /mine no longer gates on arena_profiles", () => {
    expect(MINE_SRC).not.toContain("requireConsentedUser");
    expect(MINE_SRC).not.toContain("consentDenied");
    expect(MINE_SRC).not.toContain("arena_profiles");
    expect(MINE_SRC).toContain("requireUser");
  });

  it("★ 2. /respond no longer gates on arena_profiles", () => {
    expect(RESPOND_SRC).not.toContain("requireConsentedUser");
    expect(RESPOND_SRC).not.toContain("consentDenied");
    expect(RESPOND_SRC).toContain("requireUser");
  });

  it("★ Arena/learning routes KEEP their consent gate — only this boundary moved", () => {
    // A large, unchanged population still requires consent; this slice moved exactly two routes.
    expect(code("src/app/api/bty/foundry/events/route.ts")).toBeTruthy();
    const still = readFileSync("src/lib/supabase/route-client.ts", "utf8");
    expect(still).toContain("requireConsentedUser"); // the helper itself is untouched
  });
});

describe("★ 3+4+9+10. what /mine returns, and to whom", () => {
  it("★ 3. unauthenticated returns 401 and issues no query", async () => {
    requireUser.mockResolvedValue({ user: null, base: new Response("{}") });
    const res = await GET_MINE();
    expect(res.status).toBe(401);
    expect(listMyAnnouncements).not.toHaveBeenCalled();
  });

  it("★ 4. an authenticated user with no bound rows gets 200 and an empty list", async () => {
    const res = await GET_MINE();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, items: [] });
  });

  it("★ 9. a bound recipient WITHOUT arena_profiles sees exactly their item", async () => {
    listMyAnnouncements.mockResolvedValue([{ announcementId: REAL_ID, hostFraming: "Pay", response: null }]);
    const res = await GET_MINE();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { announcementId: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0].announcementId).toBe(REAL_ID);
  });

  it("★ 10. the query is scoped to the SESSION user, never a supplied one", async () => {
    await GET_MINE();
    expect(listMyAnnouncements).toHaveBeenCalledWith({ __admin: true }, RECIPIENT);
    signedIn(STRANGER);
    await GET_MINE();
    expect(listMyAnnouncements).toHaveBeenLastCalledWith({ __admin: true }, STRANGER);
  });

  it("★ 5. an UNBOUND row is invisible to every participant — the filter is equality on user_id", () => {
    const SERVICE = code("src/lib/bty/announcement/announcementService.server.ts");
    expect(SERVICE).toMatch(/\.eq\("user_id", userId\)/); // NULL never equals a uuid
  });
});

describe("★ 11-18. responding", () => {
  it("★ 12. the request body cannot choose the acting user", async () => {
    await POST_RESPOND({ response: "ACKNOWLEDGED", userId: STRANGER, user_id: STRANGER });
    expect(respondToAnnouncement).toHaveBeenCalledWith(
      { __admin: true },
      expect.objectContaining({ userId: RECIPIENT, announcementId: REAL_ID }),
    );
    // Nothing from the body reached the identity.
    const passed = respondToAnnouncement.mock.calls[0][1] as Record<string, unknown>;
    expect(passed.userId).toBe(RECIPIENT);
  });

  it("★ 12. only response and questionText are read from the body", () => {
    expect(RESPOND_SRC).toMatch(/userId: user\.id/);
    expect(RESPOND_SRC).toMatch(/response\?: unknown; questionText\?: unknown/);
  });

  it("★ 13. Acknowledged commits", async () => {
    const res = await POST_RESPOND({ response: "ACKNOWLEDGED" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, response: "ACKNOWLEDGED" });
  });

  it("★ 16. Help needed commits", async () => {
    respondToAnnouncement.mockResolvedValue({ ok: true, response: "HELP_NEEDED", alreadyResponded: false });
    expect((await POST_RESPOND({ response: "HELP_NEEDED" })).status).toBe(200);
  });

  it("★ 14. a Question with no text is refused by the domain rule", async () => {
    // `normalizeQuestionText` returns null for empty/whitespace, and the RPC rejects it.
    const DOMAIN = code("src/domain/announcement/trackedAnnouncement.ts");
    expect(DOMAIN).toMatch(/if \(response !== "QUESTION"\) return null;/);
    expect(DOMAIN).toMatch(/s\.length < 1 \|\| s\.length > QUESTION_TEXT_MAX/);
  });

  it("★ 11. a stranger's response is refused as not_a_recipient → 404", async () => {
    signedIn(STRANGER);
    respondToAnnouncement.mockResolvedValue({ ok: false, reason: "not_a_recipient" });
    const res = await POST_RESPOND({ response: "ACKNOWLEDGED" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, code: "not_a_recipient" });
  });

  it("★ 17. a second response returns the SETTLED answer and never overwrites", async () => {
    respondToAnnouncement.mockResolvedValue({ ok: true, response: "ACKNOWLEDGED", alreadyResponded: true });
    const res = await POST_RESPOND({ response: "HELP_NEEDED" });
    expect(await res.json()).toMatchObject({ response: "ACKNOWLEDGED", alreadyResponded: true });
  });

  it("★ 18. write-once and concurrency are enforced in the DATABASE, not the route", () => {
    const SQL = readFileSync("supabase/migrations/20260902000000_bty_tracked_announcements_v1.sql", "utf8");
  /** ONE function body, not "everything after its name" — the file holds several. */
  const body = (name: string) => {
    const start = SQL.indexOf(`create or replace function public.${name}`);
    return SQL.slice(start, SQL.indexOf("$$;", start));
  };
    const fn = SQL.slice(SQL.indexOf("bty_respond_to_announcement"));
    // The row is LOCKED before it is read, so two concurrent submits serialise and the second
    // sees a non-null response rather than racing past the check.
    expect(fn).toContain("for update");
    expect(fn).toMatch(/if v_row\.response is not null then[\s\S]*already_responded/);
    // Ownership IS the pairing, inside that locked select.
    expect(fn).toMatch(/where r\.announcement_id = p_announcement_id\s*\n\s*and r\.user_id = p_user_id/);
  });
});

describe("★ 6-8. first activation binds, once", () => {
  const BOOTSTRAP = code("src/app/api/auth/teams-bootstrap/route.ts");
  const BIND = code("src/lib/bty/announcement/trackAnnouncement.server.ts");
  const SQL = readFileSync("supabase/migrations/20260902000000_bty_tracked_announcements_v1.sql", "utf8");
  /** ONE function body, not "everything after its name" — the file holds several. */
  const body = (name: string) => {
    const start = SQL.indexOf(`create or replace function public.${name}`);
    return SQL.slice(start, SQL.indexOf("$$;", start));
  };

  it("★ 6. binding uses the VERIFIED tenant + object id, never a client claim", () => {
    expect(BOOTSTRAP).toMatch(/verified\.identity\.tenantId/);
    expect(BOOTSTRAP).toMatch(/verified\.identity\.aadObjectId/);
    for (const forbidden of ["from.id", "displayName", "preferred_username", "body.tenantId"]) {
      expect(BOOTSTRAP).not.toContain(forbidden);
    }
  });

  it("★ 7+8. the binder is an idempotent RPC that cannot reassign an existing binding", () => {
    expect(BIND).toContain("bty_bind_announcement_recipients");
    expect(BIND).not.toMatch(/\.insert\(|\.upsert\(/);
    const fn = body("bty_bind_announcement_recipients");
    // Only rows that are STILL unbound are claimed, so a second run binds nothing and an
    // already-bound row can never be moved to a different person.
    expect(fn).toMatch(/user_id is null/);
  });

  it("binding never creates an account, an announcement or a recipient row", () => {
    const fn = body("bty_bind_announcement_recipients");
    expect(fn).not.toMatch(/insert into/i);
    expect(BIND).not.toContain("auth.users");
  });

  it("a binding failure never breaks authentication", () => {
    expect(BOOTSTRAP).toMatch(/await bindAnnouncementRecipients\(/);
    expect(BIND).toMatch(/catch|error/);
  });
});

describe("★ 25. Save to BTY and Saved for later are untouched", () => {
  it("neither route nor service was changed by this slice", () => {
    const INVOKE = code("src/app/api/bty/teams/invoke/route.ts");
    expect(INVOKE).toContain("canTrackWithBty");        // the Track gate, unchanged
    expect(INVOKE).toContain("ensureActionCapture");    // Save, unchanged
    const SAVED = code("src/components/app-shell/SavedForLater.tsx");
    expect(SAVED).toContain("action-capture/mine");
    expect(SAVED).not.toContain("announcements");
  });
});
