import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * Manager collection route — proves the AUTH GATE and the canonical response
 * shape (join_url from request origin; join_token never leaked). Create/list
 * behavior is covered by the service tests; here the service + supabase layers
 * are mocked so we exercise only the route + gate + attachJoinUrl.
 */
const currentUser = vi.fn<() => { id: string } | null>();
const createTrainingEvent = vi.fn();
const listOwnerEvents = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: async () => ({ user: currentUser(), base: NextResponse.json({ ok: true }) }),
  unauthenticated: () => NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/bty/foundry/events/foundryTrainingService", () => ({
  createTrainingEvent: (...args: unknown[]) => createTrainingEvent(...args),
}));
vi.mock("@/lib/bty/foundry/events/foundryEventService", () => ({
  listOwnerEvents: (...args: unknown[]) => listOwnerEvents(...args),
}));

let POST: typeof import("./route").POST;
let GET: typeof import("./route").GET;

beforeAll(async () => {
  ({ POST, GET } = await import("./route"));
});

beforeEach(() => {
  currentUser.mockReset();
  createTrainingEvent.mockReset();
  listOwnerEvents.mockReset();
});

function req(body?: unknown) {
  return new NextRequest("http://localhost/api/bty/foundry/events", {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", origin: "https://bty-arena-staging.workers.dev" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const VALID = {
  title: "Handling Difficult Conversations",
  youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  completion_prompt: "What will you handle differently?",
};

const SNAPSHOT = {
  event: {
    id: "ev-1",
    title: VALID.title,
    status: "open",
    join_token: "btyfr1.abc.def",
    created_at: "2026-07-14T00:00:00.000Z",
    closed_at: null,
    training: { youtube_video_id: "dQw4w9WgXcQ", youtube_title: null, youtube_thumbnail_url: "x", completion_prompt: VALID.completion_prompt },
  },
  participants: [],
  joined_count: 0,
  completed_count: 0,
};

describe("POST /api/bty/foundry/events", () => {
  it("401s an unauthenticated caller (before touching the service)", async () => {
    currentUser.mockReturnValue(null);
    const res = await POST(req(VALID));
    expect(res.status).toBe(401);
    expect(createTrainingEvent).not.toHaveBeenCalled();
  });

  it("creates a training event and returns join_url from the request origin", async () => {
    currentUser.mockReturnValue({ id: "owner-1" });
    createTrainingEvent.mockResolvedValue({ ok: true, value: SNAPSHOT });
    const res = await POST(req(VALID));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.event.training.youtube_video_id).toBe("dQw4w9WgXcQ");
    expect(json.event.join_url).toMatch(/^https:\/\/bty-arena-staging\.workers\.dev\/f\/btyfr1\./);
    expect(json.event.join_token).toBeUndefined(); // token stays inside the URL only
    expect(json.completed_count).toBe(0);
  });

  it("400s an invalid YouTube url (service reason surfaced)", async () => {
    currentUser.mockReturnValue({ id: "owner-1" });
    createTrainingEvent.mockResolvedValue({ ok: false, reason: "youtube_url_invalid" });
    const res = await POST(req({ ...VALID, youtube_url: "nope" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("youtube_url_invalid");
  });
});

describe("GET /api/bty/foundry/events", () => {
  it("401s an unauthenticated caller", async () => {
    currentUser.mockReturnValue(null);
    expect((await GET(req())).status).toBe(401);
  });

  it("returns an events array for an authenticated owner", async () => {
    currentUser.mockReturnValue({ id: "owner-1" });
    listOwnerEvents.mockResolvedValue([]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(Array.isArray((await res.json()).events)).toBe(true);
  });
});
