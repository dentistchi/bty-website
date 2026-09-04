import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";

/**
 * BIND ON CANONICAL ENTRY — the rule was only on one road in. Stage 2.
 *
 * The Teams notification's "Open BTY" link sends a person to the ordinary web Microsoft sign-in.
 * That road created their account and bound NOTHING, so `listMyAnnouncements` — scoped on
 * `user_id` — showed them an empty list, and the Host waiting on them never learned why.
 *
 * MEASURED, not theorised: recipient 7e979fc3 was notified in Teams at 19:57 on 2026-09-03 and is
 * still unbound, because its owner has not since opened the Teams personal tab.
 *
 * These tests hold the shape of the repair: the SAME single UPDATE, reached from the other road,
 * deriving the identity tuple server-side because no verified Entra token exists there.
 */

const MIGRATION = "supabase/migrations/20260911000000_bty_bind_recipients_on_canonical_entry_v1.sql";
const BASE_MIGRATION = "supabase/migrations/20260902000000_bty_tracked_announcements_v1.sql";
const SQL = readFileSync(MIGRATION, "utf8");
const BASE_SQL = readFileSync(BASE_MIGRATION, "utf8");

/** ONE function body — a migration file may hold several. */
const bodyIn = (sql: string, name: string) => {
  const start = sql.indexOf(`create or replace function public.${name}`);
  expect(start, `${name} is not defined`).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf("$$;", start));
};
const FN = bodyIn(SQL, "bty_bind_announcement_recipients_for_user");

const code = (p: string) =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const SERVICE = code("src/lib/bty/announcement/trackAnnouncement.server.ts");
const MINE = code("src/app/api/bty/announcements/mine/route.ts");

/*
  MOCKS ARE HOISTED, so every fake they reference must live at module scope.

  ★ `trackAnnouncement.server` is deliberately NOT mocked. The route test drives the REAL wrapper
  through a fake admin client, so what is proven is the actual call the deployed route makes —
  a stub of the binder would prove only that a stub was called.
*/
const requireUser = vi.fn();
const listMyAnnouncements = vi.fn();
const rpc = vi.fn();
const order: string[] = [];

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: () => requireUser(),
  unauthenticated: () => new Response(null, { status: 401 }),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({ rpc: (name: string, args: unknown) => rpc(name, args) }),
}));
vi.mock("@/lib/bty/announcement/announcementService.server", () => ({
  listMyAnnouncements: () => listMyAnnouncements(),
  respondToAnnouncement: vi.fn(),
}));

describe("the derived-identity binder (SQL)", () => {
  it("reads the MEASURED claim path, and never the ones that fail silently", () => {
    expect(FN).toContain("identity_data->'custom_claims'->>'tid'");
    expect(FN).toContain("identity_data->'custom_claims'->>'oid'");
    // `identity_data->>'oid'` and provider_id/sub return ZERO rows for this tenant rather than an
    // error, which reads exactly like "this person has no announcements".
    expect(FN).not.toMatch(/identity_data->>'oid'/);
    expect(FN).not.toMatch(/identity_data->>'tid'/);
    expect(FN).not.toContain("provider_id");
    expect(FN).not.toContain("sub");
  });

  it("pins the provider and scopes to the ONE user it was given", () => {
    expect(FN).toMatch(/i\.provider = 'azure'/);
    expect(FN).toMatch(/i\.user_id = p_user_id/);
  });

  it("EMAIL IS NEVER IDENTITY — no email parameter, column or comparison", () => {
    expect(FN.toLowerCase()).not.toContain("email");
  });

  it("fails closed when an account carries more than one azure identity", () => {
    // Aggregated so "more than one" is a value that can be SEEN. A bare SELECT INTO would take an
    // arbitrary row and bind somebody's rows on a guess.
    expect(FN).toContain("array_agg");
    expect(FN).toMatch(/array_length\(v_tids, 1\) > 1/);
  });

  it("is SECURITY DEFINER with a pinned search_path, because auth.identities is unreachable otherwise", () => {
    expect(FN).toContain("security definer");
    expect(FN).toMatch(/set search_path = /);
  });

  it("★ DELEGATES — this schema keeps exactly ONE definition of what binding means", () => {
    expect(FN).toContain("public.bty_bind_announcement_recipients(p_user_id");
    // The never-re-point rule lives in the delegate. A second UPDATE here is how the two copies
    // would drift apart.
    expect(FN).not.toMatch(/update\s+public\.bty_tracked_announcement_recipients/i);
    expect(bodyIn(BASE_SQL, "bty_bind_announcement_recipients")).toMatch(/user_id is null/);
  });

  it("creates nothing and discloses nothing but a count", () => {
    expect(FN).not.toMatch(/insert into/i);
    expect(FN).not.toMatch(/auth\.users/);
    expect(FN).toMatch(/returns table \(bound integer\)/);
  });

  it("is reachable by the server only", () => {
    for (const role of ["public", "anon", "authenticated"]) {
      expect(SQL).toContain(
        `revoke all on function public.bty_bind_announcement_recipients_for_user(uuid) from ${role};`,
      );
    }
    expect(SQL).toContain(
      "grant execute on function public.bty_bind_announcement_recipients_for_user(uuid) to service_role;",
    );
  });

  it("is ADDITIVE — it drops and alters nothing", () => {
    expect(SQL).not.toMatch(/^\s*drop (table|column|policy)/im);
    expect(SQL).not.toMatch(/^\s*alter table/im);
    // The three-argument binder the Teams tab calls is left exactly as it was.
    expect(SQL).not.toContain("create or replace function public.bty_bind_announcement_recipients(");
  });
});

describe("the service wrapper", () => {
  const wrapperRpc = vi.fn();
  const admin = { rpc: wrapperRpc } as never;
  beforeEach(() => wrapperRpc.mockReset());

  it("passes only the user id — there is no tuple to supply on this road", async () => {
    wrapperRpc.mockResolvedValue({ data: [{ bound: 2 }], error: null });
    const { bindAnnouncementRecipientsForUser } = await import(
      "@/lib/bty/announcement/trackAnnouncement.server"
    );
    expect(await bindAnnouncementRecipientsForUser(admin, "u-1")).toBe(2);
    expect(wrapperRpc).toHaveBeenCalledWith("bty_bind_announcement_recipients_for_user", {
      p_user_id: "u-1",
    });
  });

  it("a failure returns 0 and never throws — it must not be able to hide the list", async () => {
    wrapperRpc.mockResolvedValue({ data: null, error: { code: "42883" } });
    const { bindAnnouncementRecipientsForUser } = await import(
      "@/lib/bty/announcement/trackAnnouncement.server"
    );
    await expect(bindAnnouncementRecipientsForUser(admin, "u-1")).resolves.toBe(0);
  });

  it("writes through the RPC and never through the table", () => {
    expect(SERVICE).not.toMatch(/\.from\("bty_tracked_announcement_recipients"\)/);
  });
});

describe("★ the road that was missing: GET /mine", () => {
  const GET = async () => {
    const mod = await import("@/app/api/bty/announcements/mine/route");
    return mod.GET(new NextRequest("https://arena.btydaily.com/api/bty/announcements/mine"));
  };

  beforeEach(() => {
    order.length = 0;
    rpc.mockReset();
    listMyAnnouncements.mockReset();
    requireUser.mockReset();
    rpc.mockImplementation(async (name: string) => {
      order.push(name);
      return { data: [{ bound: 1 }], error: null };
    });
    listMyAnnouncements.mockImplementation(async () => {
      order.push("list");
      return [{ announcementId: "a-1" }];
    });
    requireUser.mockResolvedValue({ user: { id: "u-1" }, base: {} });
  });

  it("★ REGRESSION: the caller's binding is settled BEFORE the list is read", async () => {
    // Against the pre-fix route this fails outright: no RPC was issued at all, so `order` was
    // ["list"] and the derived-identity binder never ran on this road.
    const res = await GET();
    expect(res.status).toBe(200);
    expect(order).toEqual(["bty_bind_announcement_recipients_for_user", "list"]);
    expect(rpc).toHaveBeenCalledWith("bty_bind_announcement_recipients_for_user", {
      p_user_id: "u-1",
    });
  });

  it("a failed binding still returns the list — it cannot hide what it was about to reveal", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42883" } });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, items: [{ announcementId: "a-1" }] });
  });

  it("an unauthenticated caller binds nothing", async () => {
    requireUser.mockResolvedValue({ user: null, base: {} });
    expect((await GET()).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("the binding is not in the failure path — it cannot refuse the request", () => {
    expect(MINE).toMatch(/await bindAnnouncementRecipientsForUser\(admin, user\.id\)/);
    // No branch on the count: a person with zero newly-bound rows still gets their list.
    expect(MINE).not.toMatch(/if\s*\(\s*(await\s*)?bindAnnouncementRecipientsForUser/);
    expect(MINE).not.toMatch(/const\s+\w+\s*=\s*await bindAnnouncementRecipientsForUser/);
  });

  it("the response is still owner-scoped to the session, never a supplied id", () => {
    expect(MINE).toContain("user.id");
    expect(MINE).not.toMatch(/searchParams\.get\(|req\.json\(\)/);
  });
});
