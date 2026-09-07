import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * The Teams invoke route — ordering IS the security model.
 *
 * The claims that matter here are not "does it save", but: nothing is trusted before the token is
 * verified, the written user id comes only from the resolver, and an unresolvable Teams user never
 * causes a write.
 */

const verifyBotFrameworkToken = vi.fn();
const resolveBtyUserFromMicrosoftIdentity = vi.fn();
const ensureActionCapture = vi.fn();

vi.mock("@/lib/bty/teams/botTokenVerifier.server", () => ({ verifyBotFrameworkToken }));
vi.mock("@/lib/bty/identity-link/microsoftIdentityLink.server", () => ({ resolveBtyUserFromMicrosoftIdentity }));
vi.mock("@/lib/bty/action-capture/ensureActionCapture.server", () => ({ ensureActionCapture }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));

const TID = "11111111-1111-1111-1111-111111111111";

/*
  ★ THE TENANT BOUNDARY IS NOW PART OF THE CONTRACT (2026-09-04).

  Save and Track share one floor — `isCollaborationParticipant` — which requires the activity's
  tenant to be BTY's own. The Entra app is multi-tenant, so without this a foreign-tenant person who
  completed Microsoft sign-in would be a participant. These fixtures therefore have to say which
  tenant BTY is, exactly as production does through `TEAMS_BOT_TENANT_ID`.
*/
beforeEach(() => {
  vi.stubEnv("TEAMS_BOT_TENANT_ID", TID);
});
afterEach(() => {
  vi.unstubAllEnvs();
});
const OID = "22222222-2222-2222-2222-222222222222";
const RESOLVED_USER = "81f08aa1-0000-0000-0000-000000000000";

function req(body: unknown) {
  return new NextRequest("https://arena.btydaily.com/api/bty/teams/invoke", {
    method: "POST",
    headers: { authorization: "Bearer x", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function activity(over: Record<string, unknown> = {}) {
  return {
    name: "composeExtension/fetchTask",
    channelData: { tenant: { id: TID } },
    from: { id: "29:addr", aadObjectId: OID },
    conversation: { id: "19:abc@thread.tacv2" },
    value: { messagePayload: { id: "m1", body: { content: "hi" }, linkToMessage: "https://teams.microsoft.com/l/message/x/m1" } },
    ...over,
  };
}


/** The single line of text a fetchTask confirmation card carries. */
function cardText(body: Record<string, unknown>): string {
  const task = (body.task ?? {}) as Record<string, unknown>;
  const value = (task.value ?? {}) as Record<string, unknown>;
  const card = (value.card ?? {}) as Record<string, unknown>;
  const content = (card.content ?? {}) as Record<string, unknown>;
  const first = ((content.body ?? []) as Record<string, unknown>[])[0] ?? {};
  return String(first.text ?? "");
}

async function POST(r: NextRequest) {
  const mod = await import("@/app/api/bty/teams/invoke/route");
  return mod.POST(r);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  verifyBotFrameworkToken.mockResolvedValue({ ok: true, payload: {} });
  resolveBtyUserFromMicrosoftIdentity.mockResolvedValue({ status: "RESOLVED", userId: RESOLVED_USER });
  ensureActionCapture.mockResolvedValue({ ok: true, created: true, capture: { id: "c1" } });
});

describe("POST /api/bty/teams/invoke", () => {
  it("an unverified token is 401 and NOTHING downstream runs", async () => {
    verifyBotFrameworkToken.mockResolvedValue({ ok: false, reason: "invalid_token" });
    const res = await POST(req(activity()));
    expect(res.status).toBe(401);
    expect(resolveBtyUserFromMicrosoftIdentity).not.toHaveBeenCalled();
    expect(ensureActionCapture).not.toHaveBeenCalled();
  });

  it("writes ONLY the resolver's user id — a body-supplied user_id is ignored", async () => {
    await POST(req({ ...activity(), user_id: "attacker-owned", userId: "attacker-owned" }));
    expect(ensureActionCapture).toHaveBeenCalledTimes(1);
    const params = ensureActionCapture.mock.calls[0][1];
    expect(params.userId).toBe(RESOLVED_USER);
    expect(JSON.stringify(params)).not.toContain("attacker-owned");
  });

  it("resolves identity from tenant + aadObjectId, never from.id", async () => {
    await POST(req(activity()));
    expect(resolveBtyUserFromMicrosoftIdentity).toHaveBeenCalledWith(expect.anything(), TID, OID);
    expect(resolveBtyUserFromMicrosoftIdentity).not.toHaveBeenCalledWith(expect.anything(), TID, "29:addr");
  });

  it("NOT_LINKED never creates a user and never writes a capture", async () => {
    resolveBtyUserFromMicrosoftIdentity.mockResolvedValue({ status: "NOT_LINKED" });
    const res = await POST(req(activity()));
    expect(ensureActionCapture).not.toHaveBeenCalled();
    expect(cardText(await res.json())).toBe("Sign in to BTY with Microsoft first.");
  });

  it("an ambiguous or failed lookup fails closed without writing", async () => {
    for (const status of ["AMBIGUOUS_IDENTITY", "LOOKUP_FAILED", "INVALID_INPUT"]) {
      vi.clearAllMocks();
      verifyBotFrameworkToken.mockResolvedValue({ ok: true, payload: {} });
      resolveBtyUserFromMicrosoftIdentity.mockResolvedValue({ status });
      const res = await POST(req(activity()));
      expect(ensureActionCapture).not.toHaveBeenCalled();
      expect(cardText(await res.json())).toBe("Couldn't save. Please go again in a moment.");
    }
  });

  it("a duplicate save reads as the same calm success", async () => {
    ensureActionCapture.mockResolvedValue({ ok: true, created: false, capture: { id: "c1" } });
    const res = await POST(req(activity()));
    const body = await res.json();
    expect(cardText(body)).toBe("\u2713 Saved");
    expect(JSON.stringify(body)).not.toContain("Duplicate");
  });

  it("an unsupported invoke gets a safe refusal, not a general-purpose bot", async () => {
    const res = await POST(req(activity({ name: "message" })));
    expect(ensureActionCapture).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("the reply envelope follows the invoke type", async () => {
    const fetchRes = await POST(req(activity({ name: "composeExtension/fetchTask" })));
    expect(cardText(await fetchRes.json())).toBe("\u2713 Saved");
    const submitRes = await POST(req(activity({ name: "composeExtension/submitAction" })));
    expect((await submitRes.json()).composeExtension.text).toBe("\u2713 Saved");
  });


  it("RENDER CONTRACT — a successful fetchTask returns a Teams-renderable card, not a bare message", async () => {
    /*
      ★ THIS IS THE GUARD THAT MUST NOT BE TRADED FOR A LIGHTER-LOOKING RESPONSE.

      `task.type: "message"` is documented for exactly this case and IS what this returned first.
      On the Founder's iPhone it rendered NOTHING, twice, on invokes that were otherwise completely
      successful — JWT valid, identity RESOLVED, capture written, HTTP 200. The save worked and the
      person could not tell. The card is the repair, and it stays.

      The 2026-09-07 lightening changed the card's CONTENT — no title, default text size, "✓ Saved"
      — and deliberately not its TYPE. A confirmation nobody sees is worse than a heavy one.
    */
    const res = await POST(req(activity({ name: "composeExtension/fetchTask" })));
    const body = await res.json();
    expect(body.task.type).toBe("continue");
    expect(body.task.type, "never a bare message — it rendered nothing on device").not.toBe("message");
    expect(body.task.value.title, "no redundant BTY header").toBeUndefined();
    const card = body.task.value.card;
    expect(card.contentType).toBe("application/vnd.microsoft.card.adaptive");
    expect(card.content.type).toBe("AdaptiveCard");
    expect(cardText(body)).toBe("\u2713 Saved");
    // Confirmation, not a form: nothing to fill in and nothing to press.
    expect(card.content.body).toHaveLength(1);
    expect(card.content.actions).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("Input.");
  });

  it("a duplicate save returns the SAME renderable confirmation", async () => {
    ensureActionCapture.mockResolvedValue({ ok: true, created: false, capture: { id: "c1" } });
    const body = await (await POST(req(activity()))).json();
    expect(body.task.type).toBe("continue");
    expect(cardText(body)).toBe("\u2713 Saved");
    expect(JSON.stringify(body)).not.toContain("Duplicate");
  });

  it("the confirmation card leaks no internal or Microsoft identifiers", async () => {
    const body = JSON.stringify(await (await POST(req(activity()))).json());
    for (const secret of [RESOLVED_USER, TID, OID, "c1", "29:addr", "m1"]) {
      expect(body).not.toContain(secret);
    }
  });

  it("never returns internal ids or Microsoft identifiers to Teams", async () => {
    const res = await POST(req(activity()));
    const body = JSON.stringify(await res.json());
    for (const secret of [RESOLVED_USER, TID, OID, "c1", "29:addr"]) {
      expect(body).not.toContain(secret);
    }
  });
});

/**
 * ★ SUCCESS IS AN ACKNOWLEDGEMENT (2026-09-07 Founder device observation).
 *
 * After a successful Save, Teams showed a large sheet titled "BTY" containing "Saved to BTY." —
 * the brand three times, in a header that made a one-line receipt read as an unfinished form.
 *
 * What changed is the card's CONTENT. What deliberately did NOT change is its TYPE: `task.type:
 * "message"` is documented for exactly this case, was what this returned first, and rendered
 * NOTHING on the Founder's iPhone twice on otherwise completely successful invokes. A confirmation
 * nobody sees is worse than a heavy one, so the mechanism stays and only the weight came off.
 */
describe("★ the success confirmation is light, and still visible", () => {
  it("★ Save says '✓ Saved' — not the brand, a third time", async () => {
    const body = await (await POST(req(activity({ name: "composeExtension/fetchTask" })))).json();
    expect(cardText(body)).toBe("✓ Saved");
    expect(JSON.stringify(body), "the brand is not repeated in the payload").not.toContain("BTY");
  });

  it("★ no dialog header, and no headline-sized text", async () => {
    const body = await (await POST(req(activity({ name: "composeExtension/fetchTask" })))).json();
    expect(body.task.value.title, "Teams already attributes the command to BTY").toBeUndefined();
    expect(body.task.value.card.content.body[0].size, "a receipt, not a headline").toBeUndefined();
    // The height moved to an explicit 130px in the device-gated experiment below; what this test
    // guards is the absence of a header and headline sizing, which is unchanged.
    expect(body.task.value.width).toBe("small");
  });

  it("★ still not a form: nothing to fill in, nothing to press, one line only", async () => {
    const body = await (await POST(req(activity({ name: "composeExtension/fetchTask" })))).json();
    const card = body.task.value.card;
    expect(card.content.body).toHaveLength(1);
    expect(card.content.actions).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("Input.");
  });

  it("★ the submitAction envelope is unchanged — a different invoke, a different shape", async () => {
    const body = await (await POST(req(activity({ name: "composeExtension/submitAction" })))).json();
    expect(body.composeExtension.type).toBe("message");
    expect(body.composeExtension.text).toBe("✓ Saved");
    expect(body.task, "a submitAction never returns a task").toBeUndefined();
  });

  it("★ FAILURES ARE NOT DRESSED AS SUCCESS, and expose no internal code", async () => {
    // The file's own mock, already wired at the top — no second import needed.
    resolveBtyUserFromMicrosoftIdentity.mockResolvedValueOnce({ status: "NOT_LINKED" });
    const body = await (await POST(req(activity({ name: "composeExtension/fetchTask" })))).json();
    const text = cardText(body);
    expect(text).not.toContain("✓");
    expect(text).toBe("Sign in to BTY with Microsoft first.");
    // No code, no status enum, no stack — the person gets a sentence they can act on.
    for (const leak of ["NOT_LINKED", "500", "error", "code"]) {
      expect(JSON.stringify(body), leak).not.toContain(leak);
    }
  });
});

/**
 * ★ DEVICE-GATED HEIGHT EXPERIMENT (2026-09-07).
 *
 * The confirmation content is already one line, and the iPhone still renders it inside a nearly
 * full-height sheet — so the empty space is the Teams DIALOG CONTAINER, not Adaptive Card padding,
 * and no further trimming of the card can reach it. Teams documents numeric pixel heights for
 * message-extension dialogs; whether iOS honours them is unknown and cannot be feature-detected.
 *
 * These tests pin the numbers so the experiment is reproducible and so a later "tidy-up" cannot
 * silently revert it to "small" and lose the measurement.
 */
describe("★ explicit pixel height on the terminal confirmations", () => {
  it("★ Save success asks for 130px, small width, and is still one line", async () => {
    const body = await (await POST(req(activity({ name: "composeExtension/fetchTask" })))).json();
    expect(body.task.type).toBe("continue");
    expect(body.task.value.height).toBe(130);
    expect(body.task.value.width).toBe("small");
    expect(body.task.value.title).toBeUndefined();
    const card = body.task.value.card;
    expect(card.content.body).toHaveLength(1);
    expect(card.content.body[0].text).toBe("✓ Saved");
    expect(card.content.actions).toBeUndefined();
  });

  it("★ A FAILURE KEEPS \"small\" — the number must not reach a message someone has to read", async () => {
    /*
      `say()` builds the same card for refusals, and those are longer sentences. A pixel height
      pinned globally could clip the one message that actually matters, so only the success path
      passes a number.
    */
    resolveBtyUserFromMicrosoftIdentity.mockResolvedValueOnce({ status: "NOT_LINKED" });
    const body = await (await POST(req(activity({ name: "composeExtension/fetchTask" })))).json();
    expect(body.task.value.height).toBe("small");
    expect(cardText(body)).toBe("Sign in to BTY with Microsoft first.");
  });
});
