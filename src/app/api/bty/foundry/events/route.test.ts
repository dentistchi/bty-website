import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * Manager collection route — proves the AUTH GATE and the canonical response
 * shape (join_url derived from the request origin). Deep create/list behavior is
 * covered by the service test; here the supabase layer is mocked.
 */
const currentUser = vi.fn<() => { id: string } | null>();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: async () => ({ user: currentUser(), base: NextResponse.json({ ok: true }) }),
  unauthenticated: () => NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
  copyCookiesAndDebug: () => {},
}));

// Minimal chainable admin: from().insert().select().single() and
// from().select().eq().order().returns() for list.
function fakeAdmin() {
  const events: Record<string, unknown>[] = [];
  let n = 0;
  return {
    from() {
      const q = {
        _insert: null as Record<string, unknown> | null,
        insert(r: Record<string, unknown>) {
          this._insert = r;
          return this;
        },
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order() {
          return this;
        },
        returns() {
          return this;
        },
        in() {
          return this;
        },
        single() {
          const row = {
            id: `ev-${++n}`,
            owner_user_id: this._insert?.owner_user_id,
            title: this._insert?.title,
            status: "open",
            join_version: 1,
            created_at: "2026-07-14T00:00:00.000Z",
            closed_at: null,
          };
          events.push(row);
          return Promise.resolve({ data: row, error: null });
        },
        then(onF: (v: { data: unknown[]; error: null }) => unknown) {
          return Promise.resolve({ data: events, error: null }).then(onF);
        },
      };
      return q;
    },
  };
}

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => fakeAdmin() }));

let POST: typeof import("./route").POST;
let GET: typeof import("./route").GET;

beforeAll(async () => {
  process.env.FOUNDRY_ROOM_QR_SECRET = "test-foundry-room-secret-route-0123456789";
  ({ POST, GET } = await import("./route"));
});

beforeEach(() => {
  currentUser.mockReset();
});

function req(body?: unknown) {
  return new NextRequest("http://localhost/api/bty/foundry/events", {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", origin: "https://bty-arena-staging.workers.dev" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/bty/foundry/events", () => {
  it("401s an unauthenticated caller", async () => {
    currentUser.mockReturnValue(null);
    const res = await POST(req({ title: "July Manager Meeting" }));
    expect(res.status).toBe(401);
  });

  it("creates an event and returns join_url from the request origin", async () => {
    currentUser.mockReturnValue({ id: "owner-1" });
    const res = await POST(req({ title: "July Manager Meeting" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.event.title).toBe("July Manager Meeting");
    expect(json.event.status).toBe("open");
    expect(json.event.join_url).toMatch(/^https:\/\/bty-arena-staging\.workers\.dev\/f\/btyfr1\./);
    expect(json.event.join_token).toBeUndefined(); // token stays inside the URL only
  });

  it("400s a blank title", async () => {
    currentUser.mockReturnValue({ id: "owner-1" });
    const res = await POST(req({ title: "   " }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/bty/foundry/events", () => {
  it("401s an unauthenticated caller", async () => {
    currentUser.mockReturnValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("returns an events array for an authenticated owner", async () => {
    currentUser.mockReturnValue({ id: "owner-1" });
    const res = await GET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.events)).toBe(true);
  });
});
