/**
 * The participant session, when a cookie cannot travel. Slice Teams-Native Delivery V1.
 *
 * `/teams` is a third-party browsing context, so the per-event HttpOnly cookie the public room
 * relies on does not arrive. The framed client presents the SAME opaque capability in a header
 * instead. What must remain true:
 *
 *   - the cookie still wins wherever it exists, so the web and native paths are byte-identical;
 *   - the header is only read for a VALID room token, and resolves scoped to that event.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { readParticipantSession, PARTICIPANT_SESSION_HEADER } from "./publicRoute";
import { signFoundryRoomToken } from "./foundry-room-token";
import { participantCookieName } from "./participant-session";

beforeAll(() => {
  process.env.FOUNDRY_ROOM_QR_SECRET = "test-participant-header-secret-0123456789";
});

const token = (eventId: string) =>
  signFoundryRoomToken({ type: "foundry_room", eventId, joinVersion: 1, iat: Date.now() });

const EV = "11111111-1111-4111-8111-111111111111";

function req(opts: { cookie?: [string, string]; header?: string } = {}) {
  const headers = new Headers();
  if (opts.header) headers.set(PARTICIPANT_SESSION_HEADER, opts.header);
  if (opts.cookie) headers.set("cookie", `${opts.cookie[0]}=${opts.cookie[1]}`);
  return new NextRequest("https://arena.btydaily.com/api/bty/foundry/public/x/snapshot", { headers });
}

describe("the cookie path is unchanged", () => {
  it("reads the per-event cookie exactly as before", () => {
    const r = req({ cookie: [participantCookieName(EV), "cookie-session"] });
    expect(readParticipantSession(r, token(EV))).toBe("cookie-session");
  });

  it("a cookie WINS over a header — a framed fallback never overrides a real session", () => {
    const r = req({ cookie: [participantCookieName(EV), "cookie-session"], header: "header-session" });
    expect(readParticipantSession(r, token(EV))).toBe("cookie-session");
  });

  it("no cookie and no header is still nothing", () => {
    expect(readParticipantSession(req(), token(EV))).toBeNull();
  });
});

describe("the header is read only behind a valid room token", () => {
  it("is used when there is no cookie", () => {
    expect(readParticipantSession(req({ header: "header-session" }), token(EV))).toBe("header-session");
  });

  it("is IGNORED when the room token is forged or malformed", () => {
    for (const bad of ["", "btyfr1.a.b", "nonsense", token(EV) + "x"]) {
      expect(readParticipantSession(req({ header: "header-session" }), bad), bad).toBeNull();
    }
  });

  it("an empty or whitespace header is nothing, not an empty session", () => {
    for (const v of ["", "   "]) {
      expect(readParticipantSession(req({ header: v }), token(EV))).toBeNull();
    }
  });

  /*
    CROSS-EVENT CONTAINMENT is structural rather than checked here: the value returned is handed to
    `findParticipantBySession(admin, event.id, session)`, which filters by BOTH the hash AND the
    event id. A session minted for event A therefore resolves NO row under event B, whichever
    transport carried it. This test pins the half this function owns — that the token decides which
    event is being asked about at all.
  */
  it("the token names the event whose session is being read", () => {
    const other = "22222222-2222-4222-8222-222222222222";
    const r = req({ cookie: [participantCookieName(EV), "a-session"] });
    // Presented with ANOTHER event's token, this request carries no cookie for that event.
    expect(readParticipantSession(r, token(other))).toBeNull();
  });
});
