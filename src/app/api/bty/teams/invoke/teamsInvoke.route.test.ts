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


  it("RENDER CONTRACT — the ONLY response family Teams iOS actually paints", async () => {
    /*
      ★ SETTLED BY DEVICE MEASUREMENT. FOUR THINGS WERE TRIED ON THE FOUNDER'S IPHONE:

        task.type = "message"              INVISIBLE (twice). Fully successful invokes — JWT valid,
                                           identity RESOLVED, capture written, HTTP 200. The save
                                           worked and the person could not tell.
        composeExtension.type = "message"  INVISIBLE (2026-09-07). A DIFFERENT response family from
                                           the above, and the same outcome.
        task.type = "continue" + card      VISIBLE. This one.
        height "small" vs 130              NO APPARENT DIFFERENCE — the sheet stays nearly full
                                           height, so the whitespace is Teams iOS dialog chrome.

      Both "message" families are documented for exactly this case and neither reaches a human on
      this platform. Documentation describes intent; the client decides what it paints. Do not
      reintroduce either on the strength of a citation — only on a NEW device experiment somebody
      actually ran. A confirmation nobody sees is worse than a heavy one.
    */
    const body = await (await POST(req(activity({ name: "composeExtension/fetchTask" })))).json();
    expect(body.task.type).toBe("continue");
    expect(body.task.type, "INVISIBLE on device — see above").not.toBe("message");
    expect(body.composeExtension, "INVISIBLE on device — see above").toBeUndefined();
    const card = body.task.value.card;
    expect(card.contentType).toBe("application/vnd.microsoft.card.adaptive");
    expect(card.content.type).toBe("AdaptiveCard");
    expect(cardText(body)).toBe("✓ Saved");
    expect(body.task.value.title, "no redundant BTY header").toBeUndefined();
    expect(card.content.body).toHaveLength(1);
    expect(card.content.body[0].size, "a receipt, not a headline").toBeUndefined();
    expect(card.content.actions).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("Input.");
    expect(JSON.stringify(body), "and the brand is not repeated").not.toContain("BTY");
  });

  it("a duplicate save returns the SAME confirmation — idempotency is unchanged", async () => {
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
/**
 * ★ SAVE SUCCESS — TRANSPORT EXPERIMENT (2026-09-07), device-gated.
 *
 * MEASURED AND SETTLED FIRST: `height: "small"` and `height: 130` produced the SAME nearly
 * full-height white sheet on the Founder's iPhone. The remaining space is Teams iOS dialog chrome,
 * so no card layout, padding, width or content change can reach it. Layout is exhausted.
 *
 * ★ THE DISTINCTION THAT MAKES THIS DIFFERENT FROM THE KNOWN FAILURE. Two response FAMILIES share
 * the word "message":
 *
 *     task.type = "message"              TASK family. Tried. Rendered NOTHING, twice, on the
 *                                        Founder's iPhone, on fully successful invokes.
 *     composeExtension.type = "message"  MESSAGE-EXTENSION family. This experiment: the extension
 *                                        answers without opening a dialog at all.
 *
 * These tests pin that distinction so the two can never be conflated in a later change.
 */
/**
 * ★ THE TRANSPORT QUESTION IS CLOSED. Kept as a record of what was measured, not as an open thread.
 *
 * A lighter response family was tried and REJECTED BY THE DEVICE, twice over:
 *
 *   task.type = "message"              invisible on the Founder's iPhone (twice)
 *   composeExtension.type = "message"  invisible on the Founder's iPhone (2026-09-07)
 *
 * Both are documented for exactly this case. Both render nothing here. The Adaptive Card is the
 * only shape that reaches a person, and the sheet's size is Teams iOS chrome that no card property
 * can reach — "small" and 130 look identical on the phone.
 *
 * These tests exist so a future cleanup cannot quietly reintroduce either invisible family. Doing
 * so needs a NEW device experiment somebody actually ran, not a citation.
 */
describe("★ neither invisible response family may return without a new device experiment", () => {
  it("★ Save success is the CARD family — not task.type='message', not composeExtension", async () => {
    const body = await (await POST(req(activity({ name: "composeExtension/fetchTask" })))).json();
    expect(body.task.type).toBe("continue");
    expect(body.task.type, "REJECTED BY DEVICE: invisible twice").not.toBe("message");
    expect(body.composeExtension, "REJECTED BY DEVICE: invisible 2026-09-07").toBeUndefined();
    expect(cardText(body)).toBe("✓ Saved");
  });

  it("★ the source still contains no path that could emit either invisible shape on success", async () => {
    const fs = await import("node:fs");
    const src = fs
      .readFileSync("src/app/api/bty/teams/invoke/route.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    // Asserted on CODE: the file documents both failures at length, and a guard that fired on the
    // documentation would be objecting to the evidence it exists to preserve.
    expect(src, "no task.type message").not.toMatch(/task:\s*\{\s*type:\s*["']message["']/);
    // One composeExtension emitter survives, and it is the submitAction branch of `say()` — the
    // documented shape for THAT invoke, not a success transport.
    expect((src.match(/composeExtension:\s*\{/g) ?? []).length).toBe(1);
  });

  it("★ 5+6. the backend write and its idempotency are unchanged by the rollback", async () => {
    await POST(req(activity({ name: "composeExtension/fetchTask" })));
    expect(ensureActionCapture).toHaveBeenCalledTimes(1);
    expect(ensureActionCapture.mock.calls[0][1]).toMatchObject({ intent: "save" });
    ensureActionCapture.mockResolvedValueOnce({ ok: true, created: false, capture: { id: "c1" } });
    const dup = await (await POST(req(activity({ name: "composeExtension/fetchTask" })))).json();
    expect(cardText(dup), "a repeat save is the same calm success").toBe("✓ Saved");
  });

  it("★ 7. failures were never moved, and still are not", async () => {
    resolveBtyUserFromMicrosoftIdentity.mockResolvedValueOnce({ status: "NOT_LINKED" });
    const body = await (await POST(req(activity({ name: "composeExtension/fetchTask" })))).json();
    expect(body.task.type).toBe("continue");
    expect(body.task.value.height).toBe("small");
    expect(cardText(body)).toBe("Sign in to BTY with Microsoft first.");
    expect(body.composeExtension).toBeUndefined();
  });

  it("★ a failure never wears the success mark", async () => {
    resolveBtyUserFromMicrosoftIdentity.mockResolvedValueOnce({ status: "NOT_LINKED" });
    const body = JSON.stringify(await (await POST(req(activity({ name: "composeExtension/fetchTask" })))).json());
    expect(body).not.toContain("✓");
    for (const leak of ["NOT_LINKED", "stack", "500"]) expect(body, leak).not.toContain(leak);
  });
});
