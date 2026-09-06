import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { listHostAnnouncements, listMyAnnouncements, respondToAnnouncement } from "./announcementService.server";

/**
 * Who may READ a tracked announcement, and what they are shown (Slice A1-VIS).
 *
 * The Host surface added in this slice is the first thing that ever renders a run's contents, so
 * these prove the boundary at the query level rather than in the component: the scope is in the
 * `.eq()` and the SELECT list, where it cannot be forgotten by a later renderer.
 */

const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const SERVICE = code(readFileSync("src/lib/bty/announcement/announcementService.server.ts", "utf8"));
const NAMES = code(readFileSync("src/lib/bty/announcement/recipientDisplayName.server.ts", "utf8"));

/** Records every table, select list and filter the service applies. */
function db(rows: Record<string, unknown[]>) {
  const seen: { table: string; select: string; filters: [string, unknown][] }[] = [];
  const api = (table: string) => {
    const rec = { table, select: "", filters: [] as [string, unknown][] };
    seen.push(rec);
    const chain: Record<string, unknown> = {
      select: (s: string) => ((rec.select = s), chain),
      eq: (c: string, v: unknown) => (rec.filters.push([c, v]), chain),
      in: (c: string, v: unknown) => (rec.filters.push([c, v]), chain),
      order: () => chain,
      returns: async () => ({ data: rows[table] ?? [], error: null }),
      then: (res: (v: unknown) => unknown) => res({ data: rows[table] ?? [], error: null }),
    };
    return chain;
  };
  return { client: { from: api } as never, seen };
}

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

describe("★ 1+2. the Host list is owner-scoped in the query", () => {
  it("★ filters bty_tracked_announcements by owner_user_id — the caller's own id", async () => {
    const { client, seen } = db({ bty_tracked_announcements: [] });
    await listHostAnnouncements(client, "18b1ee80-2200-4bc6-91d7-039ba43f6a50");
    const runs = seen.find((s) => s.table === "bty_tracked_announcements")!;
    expect(runs.filters).toContainEqual(["owner_user_id", "18b1ee80-2200-4bc6-91d7-039ba43f6a50"]);
  });

  it("★ there is no code path that reads a client-supplied owner", () => {
    expect(SERVICE).toMatch(/\.eq\("owner_user_id", ownerUserId\)/);
    expect(SERVICE).not.toMatch(/req\.|searchParams|body\./);
  });
});

describe("★ the Host projection never selects a directory identity", () => {
  it("★ tenant_id and conversation_id are not in the Host SELECT list", () => {
    const hostSelect = SERVICE.slice(SERVICE.indexOf("listHostAnnouncements"));
    expect(hostSelect).not.toMatch(/select\([^)]*tenant_id/);
    expect(hostSelect).not.toMatch(/select\([^)]*conversation_id/);
    expect(hostSelect).not.toMatch(/aad_object_id/);
  });

  it("★ the recipient rows the Host reads carry no oid, tenant or email", () => {
    /*
      A1-CLOSURE added `id` (the handle the Handled control needs) and `handled_at` to this SELECT.
      Neither is an identity: `id` is an internal row id that says nothing about who the person is,
      and ownership is re-verified in the database on every write, so holding one grants nothing.

      Asserted as a WHITELIST rather than a fixed string, so the next column added has to pass this
      list deliberately instead of slipping in behind a literal that was already stale.
    */
    const m = SERVICE.match(/\.select\("(id, announcement_id[^"]*)"\)/);
    expect(m, "the Host recipient select changed shape").toBeTruthy();
    const cols = m![1].split(",").map((c) => c.trim());
    /*
      Track conversation V1 added `host_last_read_at`. It is a TIMESTAMP OF THE HOST'S OWN
      behaviour — when they last opened this person's conversation — and says nothing whatever
      about who the recipient is. It is here because the Host's unread count is computed against it.
    */
    expect(cols).toEqual([
      "id", "announcement_id", "user_id", "response", "responded_at", "question_text", "handled_at",
      "host_last_read_at",
    ]);
    for (const forbidden of ["tenant_id", "aad_object_id", "email", "preferred_username"]) {
      expect(cols, forbidden).not.toContain(forbidden);
    }
  });

  it("the recipient's OWN projection still refuses preview and metadata", () => {
    // Unchanged by this slice: being selected into an audience is not access to the source.
    const mine = SERVICE.slice(SERVICE.indexOf("listMyAnnouncements"), SERVICE.indexOf("respondToAnnouncement"));
    expect(mine).not.toContain("preview_text");
    expect(mine).not.toContain("source_metadata");
    expect(mine).not.toContain("tenant_id");
  });

  it("★ preview_text reaches ONLY the owner-scoped projection", () => {
    const host = SERVICE.slice(SERVICE.indexOf("listHostAnnouncements"));
    expect(host).toContain("preview_text");
  });
});

describe("★ 9. a participant sees only rows bound to their own id", () => {
  it("★ listMyAnnouncements filters by user_id and by active status", async () => {
    const { client, seen } = db({ bty_tracked_announcement_recipients: [] });
    await listMyAnnouncements(client, "u-1");
    const r = seen.find((s) => s.table === "bty_tracked_announcement_recipients")!;
    expect(r.filters).toContainEqual(["user_id", "u-1"]);
    expect(r.filters).toContainEqual(["bty_tracked_announcements.status", "active"]);
  });

  it("★ 5. an unbound row belongs to nobody, so no participant query can return it", () => {
    // The filter is equality on user_id; NULL never equals a uuid.
    expect(SERVICE).toMatch(/\.eq\("user_id", userId\)/);
  });
});

describe("★ 10+11+12. the response contract is unchanged and still canonical", () => {
  const rpc = vi.fn();
  const client = { rpc } as never;

  it("★ 10. each allowed response is accepted", async () => {
    for (const r of ["ACKNOWLEDGED", "QUESTION", "HELP_NEEDED"]) {
      rpc.mockResolvedValue({ data: [{ result: "responded", response: r }], error: null });
      const out = await respondToAnnouncement(client, {
        announcementId: "a", userId: "u", response: r, questionText: r === "QUESTION" ? "why?" : null,
      });
      expect(out).toEqual({ ok: true, response: r, alreadyResponded: false });
    }
  });

  it("★ 11. question text is dropped for every response except QUESTION", async () => {
    rpc.mockResolvedValue({ data: [{ result: "responded", response: "ACKNOWLEDGED" }], error: null });
    await respondToAnnouncement(client, {
      announcementId: "a", userId: "u", response: "ACKNOWLEDGED", questionText: "sneaky",
    });
    expect(rpc.mock.calls.at(-1)![1].p_question_text).toBeNull();
  });

  it("★ 12. a second response returns the settled answer and never overwrites", async () => {
    rpc.mockResolvedValue({ data: [{ result: "already_responded", response: "ACKNOWLEDGED" }], error: null });
    const out = await respondToAnnouncement(client, {
      announcementId: "a", userId: "u", response: "HELP_NEEDED", questionText: null,
    });
    expect(out).toEqual({ ok: true, response: "ACKNOWLEDGED", alreadyResponded: true });
  });

  it("a caller who is not a recipient is refused by the RPC, not by the client", async () => {
    rpc.mockResolvedValue({ data: [{ result: "not_a_recipient" }], error: null });
    const out = await respondToAnnouncement(client, {
      announcementId: "a", userId: "stranger", response: "ACKNOWLEDGED", questionText: null,
    });
    expect(out).toEqual({ ok: false, reason: "not_a_recipient" });
  });

  it("★ ownership is the RPC's pairing — a RESPONSE has no recipient id to guess", () => {
    /*
      Still true of responding, which is what this test is about: the recipient row is found by
      (announcement_id, caller's own user_id), so there is no row id a participant could supply.

      A1-CLOSURE's Handled call does take a `p_recipient_id` — a HOST action on someone else's row,
      where the row must be named. That one is safe for the opposite reason: the RPC joins to
      `owner_user_id` and answers a non-owner `not_found`, so the id names a row it cannot reach.
    */
    const respond = SERVICE.slice(SERVICE.indexOf("export async function respondToAnnouncement"),
                                 SERVICE.indexOf("export type HostAnnouncement"));
    expect(respond).toMatch(/p_user_id: params\.userId/);
    expect(respond).not.toMatch(/recipient_id/);
  });
});

describe("★ 6+7+8. first activation binds, and binding is idempotent", () => {
  const BOOTSTRAP = code(readFileSync("src/app/api/auth/teams-bootstrap/route.ts", "utf8"));
  const BIND = code(readFileSync("src/lib/bty/announcement/trackAnnouncement.server.ts", "utf8"));

  it("★ 6. activation calls the binder with the VERIFIED tenant + oid", () => {
    expect(BOOTSTRAP).toContain("bindAnnouncementRecipients");
    expect(BOOTSTRAP).toMatch(/verified\.identity\.tenantId/);
    expect(BOOTSTRAP).toMatch(/verified\.identity\.aadObjectId/);
    // Never a client-supplied identity.
    expect(BOOTSTRAP).not.toMatch(/body\.tenantId|body\.aadObjectId/);
  });

  it("★ 8. binding goes through the existing idempotent RPC, not an ad-hoc update", () => {
    expect(BIND).toContain("bty_bind_announcement_recipients");
    expect(BIND).not.toMatch(/\.insert\(|\.upsert\(/);
  });

  it("★ 7. once bound, the row satisfies the participant's own filter", async () => {
    // Binding sets user_id; listMyAnnouncements filters on exactly that column.
    const { client, seen } = db({
      bty_tracked_announcement_recipients: [
        {
          announcement_id: "6cfccb92-fac6-43d1-b6e9-deeb0d5437b5",
          response: null,
          responded_at: null,
          bty_tracked_announcements: {
            id: "6cfccb92-fac6-43d1-b6e9-deeb0d5437b5",
            host_framing: "Pay",
            owner_user_id: "18b1ee80-2200-4bc6-91d7-039ba43f6a50",
            bty_action_captures: { source_url: "https://teams.microsoft.com/l/message/x" },
          },
        },
      ],
    });
    const mine = await listMyAnnouncements(client, "newly-bound-user");
    expect(mine).toHaveLength(1);
    expect(mine[0].hostFraming).toBe("Pay");
    expect(seen[0].filters).toContainEqual(["user_id", "newly-bound-user"]);
  });

  it("a sign-in never fails because a binding did", () => {
    expect(BOOTSTRAP).toMatch(/await bindAnnouncementRecipients\(/);
    expect(BIND).toMatch(/catch|error/);
  });
});

describe("★ 15. the Teams confirmation says where it went", () => {
  const CARD = readFileSync("src/lib/bty/teams/trackDialogCard.ts", "utf8");
  it("★ names Today → Tracking", () => {
    expect(CARD).toContain("Tracked in BTY. See it in Today");
    expect(CARD).toContain("Tracking.");
  });
});

describe("★ 3. Platform Admin inheritance is unchanged by this slice", () => {
  it("the Host list is scoped by ownership, NOT by capability — admin gains no broader read", () => {
    // Admin inherits the ability to TRACK. It does not silently widen what a Host can read.
    expect(SERVICE).not.toContain("isActivePlatformAdmin");
    expect(SERVICE).not.toContain("hasHostCapability");
  });
});

describe("★ the display name comes from a source the subject cannot edit", () => {
  it("★ reads auth.identities.identity_data, NEVER user_metadata", () => {
    // They usually hold the same string. The difference is that `user_metadata` is writable by the
    // account holder, and a Host acts on these names.
    expect(NAMES).toContain("identity_data");
    expect(NAMES).not.toContain("user_metadata");
    expect(NAMES).not.toContain("raw_user_meta_data");
  });

  it("★ 9. never reads an email or a UPN", () => {
    expect(NAMES).not.toContain("preferred_username");
    expect(NAMES).not.toMatch(/\bemail\b/);
    expect(NAMES).not.toMatch(/\bupn\b/i);
  });

  it("★ never reads Microsoft Graph — no credentials are provisioned", () => {
    expect(NAMES).not.toMatch(/graph\.microsoft|fetch\(/);
  });

  it("only the two provider name keys are accepted, in order", () => {
    expect(NAMES).toMatch(/NAME_KEYS = \["full_name", "name"\]/);
  });

  it("★ 5. names are resolved from user ids ONLY — an oid never reaches the resolver", () => {
    expect(NAMES).not.toContain("aad_object_id");
    expect(NAMES).not.toContain("tenant_id");
    // The caller filters to bound rows before asking.
    expect(SERVICE).toMatch(/\.map\(\(r\) => r\.user_id\)\.filter/);
  });

  it("★ 6. an UNBOUND recipient is never asked about, so it can never be named", () => {
    expect(SERVICE).toMatch(/const bound = rows\.filter\(\(r\) => typeof r\.user_id === "string"/);
    // Every named bucket is BUILT from `bound`, not from `rows`. Anchored to the implementation
    // rather than the type declaration above it, which names the same keys.
    for (const b of ["acknowledged", "question", "needHelp", "noResponse"]) {
      expect(SERVICE, b).toContain(`${b}: bound`);
    }
  });

  it("a failed lookup yields null rather than dropping the person", () => {
    expect(NAMES).toMatch(/out\.set\(id, null\)/);
  });

  it("lookups are deduplicated across a Host's runs", () => {
    expect(NAMES).toContain("new Set(");
  });
});

describe("★ 7+8. names never leave the owner-scoped route", () => {
  it("★ 8. the participant projection returns no OTHER RECIPIENT, named or otherwise", () => {
    /*
      ★ WHAT CHANGED, AND WHY IT IS NOT THIS INVARIANT.

      This asserted `hostDisplay: null` and no name lookup at all, because A1 had nowhere to show a
      name. Track conversation V1 does: a reply that reads only "message" is a message from nobody,
      so the HOST — the one person who addressed this recipient directly, whose framing they are
      already reading — is named. `RecipientProjection` has carried a `hostDisplay` field since A1
      for exactly this.

      The invariant this test is actually about is UNCHANGED and is asserted harder below: the ONLY
      user ids this projection ever resolves are announcement OWNERS. No other recipient of the same
      announcement is named, counted, or so much as looked up.
    */
    const mine = SERVICE.slice(SERVICE.indexOf("listMyAnnouncements"), SERVICE.indexOf("respondToAnnouncement"));
    expect(mine).not.toContain("responders");

    // ★ The one name lookup here is fed OWNER ids and nothing else.
    const call = mine.match(/resolveDisplayNames\(\s*admin,\s*([\s\S]*?)\);/);
    expect(call, "listMyAnnouncements changed how it resolves names").toBeTruthy();
    expect(call![1]).toContain("owner_user_id");
    expect(call![1]).not.toContain("user_id)");
    expect(call![1]).not.toMatch(/\br\.user_id\b/);

    // And the thread metadata it loads is keyed on the CALLER'S OWN rows, which are all this
    // `user_id`-scoped query can contain.
    expect(mine).toContain("loadThreadMeta(admin, rows.map((r) => r.id))");
    expect(mine).toContain('.eq("user_id", userId)');
  });

  it("★ 7. names are produced only inside the owner-scoped Host list", () => {
    const host = SERVICE.slice(SERVICE.indexOf("listHostAnnouncements"));
    expect(host).toContain("resolveDisplayNames");
    // ...and that function is filtered by owner_user_id before any name is resolved.
    expect(host).toMatch(/\.eq\("owner_user_id", ownerUserId\)/);
  });

  it("★ 7. only the owner-scoped route exposes the Host projection", () => {
    const HOST_ROUTE = code(readFileSync("src/app/api/bty/announcements/host/route.ts", "utf8"));
    const MINE_ROUTE = code(readFileSync("src/app/api/bty/announcements/mine/route.ts", "utf8"));
    expect(HOST_ROUTE).toContain("listHostAnnouncements");
    expect(HOST_ROUTE).toMatch(/listHostAnnouncements\(admin, user\.id\)/);
    expect(MINE_ROUTE).not.toContain("listHostAnnouncements");
    expect(MINE_ROUTE).not.toContain("resolveDisplayNames");
  });
});

describe("★ the People Picker gives BTY no name to store", () => {
  const DOMAIN = code(readFileSync("src/domain/announcement/trackedAnnouncement.ts", "utf8"));
  it("★ every submitted value that is not a GUID is dropped", () => {
    expect(DOMAIN).toMatch(/if \(!GUID\.test\(id\)/);
  });
  it("★ no display name is parsed, stored, or inferred at Track time", () => {
    const TRACK = code(readFileSync("src/lib/bty/announcement/trackAnnouncement.server.ts", "utf8"));
    expect(TRACK).not.toContain("display_name");
    expect(TRACK).not.toContain("displayName");
  });
});
