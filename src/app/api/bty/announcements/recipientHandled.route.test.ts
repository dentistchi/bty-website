import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";

/**
 * Per-recipient follow-up closure (Slice A1-CLOSURE).
 *
 * ★ WHY THIS IS NOT `closed_at`. Production holds three announcements whose recipients are in
 * three different states at once: one never opened BTY, one asked for help, one asked a real
 * question. A Host who answers one person has not closed the announcement, and an
 * announcement-level timestamp cannot say "settled for her, still open for him".
 *
 * ★ WHERE OWNERSHIP IS DECIDED. Not here. `bty_handle_announcement_recipient` joins the recipient
 * to its announcement and requires the actor to be `owner_user_id`, so a different Host, the
 * recipient themselves, and a direct client call all fail identically — and a wrong owner is
 * answered `not_found`, so nobody can probe for a run they do not own.
 */

const requireUser = vi.fn();
const unauthenticated = vi.fn(() => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }));
const canTrackWithBty = vi.fn();
const handleRecipientFollowUp = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (req: unknown) => requireUser(req),
  unauthenticated: () => unauthenticated(),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({ __admin: true }) }));
vi.mock("@/lib/bty/authority/platformAdmin.server", () => ({
  canTrackWithBty: (a: unknown, i: unknown) => canTrackWithBty(a, i),
}));
vi.mock("@/lib/bty/announcement/announcementService.server", () => ({
  handleRecipientFollowUp: (a: unknown, p: unknown) => handleRecipientFollowUp(a, p),
}));

const HOST = "18b1ee80-0000-0000-0000-000000000001";
const OTHER_HOST = "617f7cea-0000-0000-0000-000000000002";
const RECIPIENT_ROW = "1a5d1547-0000-0000-0000-000000000003";

const req = (body: unknown) =>
  new NextRequest(`https://arena.btydaily.com/api/bty/announcements/recipients/${RECIPIENT_ROW}/handle`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

async function POST(body: unknown, id = RECIPIENT_ROW) {
  const mod = await import("@/app/api/bty/announcements/recipients/[recipientId]/handle/route");
  return mod.POST(req(body), { params: Promise.resolve({ recipientId: id }) });
}
const signedIn = (id: string) => requireUser.mockResolvedValue({ user: { id }, base: new Response("{}") });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  signedIn(HOST);
  canTrackWithBty.mockResolvedValue(true);
  handleRecipientFollowUp.mockResolvedValue({ ok: true, handled: true });
});

describe("★ the owning Host settles one person", () => {
  it("★ marks handled, and the acting user is the SESSION user", async () => {
    const res = await POST({ handled: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, handled: true });
    expect(handleRecipientFollowUp).toHaveBeenCalledWith(
      { __admin: true },
      { recipientId: RECIPIENT_ROW, actorUserId: HOST, handled: true },
    );
  });

  it("★ re-opening is the same authority, expressed by the same call", async () => {
    handleRecipientFollowUp.mockResolvedValue({ ok: true, handled: false });
    const res = await POST({ handled: false });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, handled: false });
    expect(handleRecipientFollowUp.mock.calls[0][1]).toMatchObject({ handled: false });
  });

  it("★ a malformed body settles rather than silently re-opening someone's follow-up", async () => {
    await POST({});
    expect(handleRecipientFollowUp.mock.calls[0][1]).toMatchObject({ handled: true });
  });

  it("★ the body cannot choose the actor, the owner, or the announcement", async () => {
    await POST({ handled: true, actorUserId: OTHER_HOST, userId: OTHER_HOST, ownerUserId: OTHER_HOST });
    const passed = handleRecipientFollowUp.mock.calls[0][1] as Record<string, unknown>;
    expect(passed.actorUserId).toBe(HOST);
    expect(Object.keys(passed).sort()).toEqual(["actorUserId", "handled", "recipientId"]);
  });
});

describe("★ everyone else is refused", () => {
  it("★ unauthenticated is 401 and reaches nothing", async () => {
    requireUser.mockResolvedValue({ user: null, base: new Response("{}") });
    expect((await POST({ handled: true })).status).toBe(401);
    expect(canTrackWithBty).not.toHaveBeenCalled();
    expect(handleRecipientFollowUp).not.toHaveBeenCalled();
  });

  it("★ a participant with no Track capability is 403 and writes nothing", async () => {
    canTrackWithBty.mockResolvedValue(false);
    const res = await POST({ handled: true });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "track_capability_required" });
    expect(handleRecipientFollowUp).not.toHaveBeenCalled();
  });

  it("★ ANOTHER Host holds capability but is answered not_found — ownership is decided in SQL", async () => {
    signedIn(OTHER_HOST);
    handleRecipientFollowUp.mockResolvedValue({ ok: false, reason: "not_found" });
    const res = await POST({ handled: true });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, code: "not_found" });
    // The actor it asked about was the other Host, never the owner.
    expect(handleRecipientFollowUp.mock.calls[0][1]).toMatchObject({ actorUserId: OTHER_HOST });
  });

  it("★ a wrong owner and a missing row are INDISTINGUISHABLE", () => {
    const SQL = readFileSync("supabase/migrations/20260906000000_bty_announcement_recipient_handled_v1.sql", "utf8");
    const fn = SQL.slice(SQL.indexOf("create or replace function public.bty_handle_announcement_recipient"));
    expect(fn).toMatch(/if v_owner is distinct from p_actor_user_id then[\s\S]{0,120}'not_found'/);
  });

  it("an unanswered or already-acknowledged person cannot be 'handled' — 409", async () => {
    handleRecipientFollowUp.mockResolvedValue({ ok: false, reason: "not_handleable" });
    expect((await POST({ handled: true })).status).toBe(409);
  });
});

describe("★ what the database enforces, not the route", () => {
  const SQL = readFileSync("supabase/migrations/20260906000000_bty_announcement_recipient_handled_v1.sql", "utf8");
  const fn = SQL.slice(SQL.indexOf("create or replace function public.bty_handle_announcement_recipient"));

  it("★ ownership is a JOIN to the announcement owner", () => {
    expect(fn).toMatch(/join public\.bty_tracked_announcements a on a\.id = r\.announcement_id/);
    expect(fn).toMatch(/select a\.owner_user_id, r\.response/);
  });

  it("★ the row is LOCKED before the decision, so two taps cannot both pass", () => {
    expect(fn).toMatch(/for update of r/);
  });

  it("★ only QUESTION and HELP_NEEDED are handleable — ACKNOWLEDGED is already an ending", () => {
    expect(fn).toMatch(/not in \('QUESTION', 'HELP_NEEDED'\)[\s\S]{0,120}'not_handleable'/);
    expect(SQL).toMatch(/check \(handled_at is null or response in \('QUESTION', 'HELP_NEEDED'\)\)/);
  });

  it("★ handling NEVER clears the audit: response, responded_at, question_text survive", () => {
    const updates = fn.match(/update public\.bty_tracked_announcement_recipients[\s\S]*?where id = p_recipient_id;/g) ?? [];
    expect(updates.length).toBeGreaterThan(0);
    for (const u of updates) {
      expect(u).not.toMatch(/\bresponse\s*=/);
      expect(u).not.toMatch(/responded_at\s*=/);
      expect(u).not.toMatch(/question_text\s*=/);
    }
  });

  it("★ handled_at and handled_by_user_id are set and cleared together", () => {
    expect(SQL).toMatch(/check \(\(handled_at is null\) = \(handled_by_user_id is null\)\)/);
  });

  it("★ no client role may execute it", () => {
    expect(SQL).toMatch(/revoke all on function public\.bty_handle_announcement_recipient\(uuid, uuid, boolean\) from public, anon, authenticated;/);
    expect(SQL).toMatch(/grant execute on function public\.bty_handle_announcement_recipient\(uuid, uuid, boolean\) to service_role;/);
  });

  it("★ additive only — nothing existing is dropped or deleted", () => {
    const ddl = SQL.replace(/^\s*--.*$/gm, "");
    expect(ddl).toMatch(/add column if not exists handled_at timestamptz/);
    expect(ddl).not.toMatch(/drop table|delete from|drop column(?!.*if exists.*ROLLBACK)/i);
    expect(ddl).not.toMatch(/alter table[^;]*closed_at/i);   // announcement-level state untouched
  });

  it("is ordered after the three hand-applied migrations", () => {
    expect(SQL).toContain("20260906");
    expect(SQL).toMatch(/20260903 \/ 20260904 \/ 20260905/);
  });
});

describe("★ Arena consent is not consulted, and Track capability is", () => {
  it("the route uses requireUser + canTrackWithBty", () => {
    const SRC = readFileSync("src/app/api/bty/announcements/recipients/[recipientId]/handle/route.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(SRC).toContain("requireUser");
    expect(SRC).toContain("canTrackWithBty");
    expect(SRC).not.toContain("requireConsentedUser");
    expect(SRC).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(SRC).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
