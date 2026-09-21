/**
 * POST /api/bty/foundry/teams/room/open — the one server seam Teams-native delivery added.
 * Slice Teams-Native Delivery V1.
 *
 * The properties proved here are the security ones: identity comes from the SESSION, the target is
 * navigation only, and nothing the caller sends can name a person.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const { getUser, openAccountRoom } = vi.hoisted(() => ({
  getUser: vi.fn<() => Promise<{ data: { user: { id: string } | null } }>>(async () => ({
    data: { user: { id: "user-A" } },
  })),
  openAccountRoom: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/bty/foundry/events/accountParticipant", () => ({ openAccountRoom }));

import { POST } from "./route";

const TOKEN = "btyfr1.eyJ0eXBlIjoiZm91bmRyeV9yb29tIn0.c2lnbmF0dXJlLXZhbHVl";

function post(body: unknown) {
  return POST(
    new NextRequest("https://arena.btydaily.com/api/bty/foundry/teams/room/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const ROOM_OK = {
  ok: true,
  event: { id: "ev-1", title: "Morning Office Opening", content_type: "written_guidance" },
  participant: { id: "pt-1", display_name: "Ari Kim" },
  participantSession: "session-secret",
  created: true,
};

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-A" } } });
  openAccountRoom.mockReset().mockResolvedValue(ROOM_OK);
});

describe("identity comes from the session, never from the request", () => {
  it("opens the room as the SERVER-DERIVED user", async () => {
    const res = await post({ target: `foundry-training:${TOKEN}` });
    expect(res.status).toBe(200);
    expect(openAccountRoom).toHaveBeenCalledWith(expect.anything(), TOKEN, "user-A");
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, joinToken: TOKEN, contentType: "written_guidance", displayName: "Ari Kim" });
  });

  it("IGNORES every identity field a caller tries to supply", async () => {
    await post({
      target: `foundry-training:${TOKEN}`,
      userId: "user-B",
      user_id: "user-B",
      oid: "another-oid",
      tid: "another-tenant",
      email: "someone.else@contoso.com",
      upn: "someone.else@contoso.com",
      displayName: "Someone Else",
      participantId: "pt-999",
      eventId: "ev-999",
    });
    // The user is the session's, and the room is the TOKEN's — nothing else was read.
    expect(openAccountRoom).toHaveBeenCalledWith(expect.anything(), TOKEN, "user-A");
  });

  it("401s an unauthenticated caller — this route has no anonymous mode", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await post({ target: `foundry-training:${TOKEN}` });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: "unauthenticated" });
    expect(openAccountRoom).not.toHaveBeenCalled();
  });
});

describe("a forged target cannot become navigation", () => {
  it("400s anything outside the one approved grammar, and opens nothing", async () => {
    for (const target of [
      undefined,
      null,
      "",
      "/en/app",
      "https://evil.example/f/btyfr1.a.b",
      "foundry-training:",
      "foundry-training:../../admin",
      `foundry-training:${TOKEN}&x=1`,
      { subEntityId: `foundry-training:${TOKEN}` },
      123,
    ]) {
      const res = await post({ target });
      expect(res.status, JSON.stringify(target)).toBe(400);
      expect(await res.json()).toEqual({ ok: false, error: "target_invalid" });
    }
    expect(openAccountRoom).not.toHaveBeenCalled();
  });
});

describe("the room's own refusals are surfaced honestly", () => {
  it.each([
    ["inactive", 410],
    ["qr_rotated", 410],
    ["removed", 403],
  ])("%s → %i", async (reason, status) => {
    openAccountRoom.mockResolvedValue({ ok: false, reason });
    const res = await post({ target: `foundry-training:${TOKEN}` });
    expect(res.status).toBe(status);
  });

  it("an unknown content type refuses rather than guessing a runtime", async () => {
    openAccountRoom.mockResolvedValue({ ...ROOM_OK, event: { ...ROOM_OK.event, content_type: "hologram" } });
    const res = await post({ target: `foundry-training:${TOKEN}` });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "unsupported_room" });
  });
});

describe("the response carries a capability, not a directory", () => {
  it("returns only what the room needs — no user id, no email, no event id", async () => {
    const body = await (await post({ target: `foundry-training:${TOKEN}` })).json();
    expect(Object.keys(body).sort()).toEqual([
      "contentType",
      "displayName",
      "joinToken",
      "ok",
      "participantSession",
      "title",
    ]);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("user-A");
    expect(serialized).not.toContain("ev-1");
    expect(serialized).not.toMatch(/@/);
  });
});
