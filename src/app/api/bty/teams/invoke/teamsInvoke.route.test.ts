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
    // Save success is now a message-extension reply, not a card — see the transport note below.
    expect(body.composeExtension.text).toBe("\u2713 Saved");
    expect(JSON.stringify(body)).not.toContain("Duplicate");
  });

  it("an unsupported invoke gets a safe refusal, not a general-purpose bot", async () => {
    const res = await POST(req(activity({ name: "message" })));
    expect(ensureActionCapture).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("★ SAVE SUCCESS answers in ONE shape now, whichever invoke asked", async () => {
    /*
      It used to follow the invoke: a task reply to `fetchTask`, a composeExtension reply to
      `submitAction`. The task reply is the giant sheet, so success now answers in the
      message-extension family either way. Failures still follow the invoke.
    */
    for (const name of ["composeExtension/fetchTask", "composeExtension/submitAction"]) {
      const body = await (await POST(req(activity({ name })))).json();
      expect(body.composeExtension.type, name).toBe("message");
      expect(body.composeExtension.text, name).toBe("\u2713 Saved");
      expect(body.task, `${name} opens no dialog`).toBeUndefined();
    }
  });


  it("RENDER CONTRACT — a task-family reply is a renderable CARD, never a bare message", async () => {
    /*
      ★ THE LESSON THIS GUARD CARRIES, AND WHY IT MOVED TO THE FAILURE PATH.

      `task.type: "message"` is documented for exactly this case and IS what this endpoint returned
      first. On the Founder's iPhone it rendered NOTHING, twice, on invokes that were otherwise
      completely successful — JWT valid, identity RESOLVED, capture written, HTTP 200. The write
      worked and the person could not tell.

      Save SUCCESS no longer uses the task family at all (2026-09-07 transport experiment), so this
      now guards the failures, which still do — and failures are where an invisible reply would be
      worst, because the message is the whole point.
    */
    resolveBtyUserFromMicrosoftIdentity.mockResolvedValueOnce({ status: "NOT_LINKED" });
    const res = await POST(req(activity({ name: "composeExtension/fetchTask" })));
    const body = await res.json();
    expect(body.task.type).toBe("continue");
    expect(body.task.type, "never a bare message — it rendered nothing on device").not.toBe("message");
    expect(body.task.value.title, "no redundant BTY header").toBeUndefined();
    const card = body.task.value.card;
    expect(card.contentType).toBe("application/vnd.microsoft.card.adaptive");
    expect(card.content.type).toBe("AdaptiveCard");
    expect(cardText(body)).toBe("Sign in to BTY with Microsoft first.");
    expect(card.content.actions).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("Input.");
  });

  it("a duplicate save returns the SAME confirmation — idempotency is unchanged", async () => {
    ensureActionCapture.mockResolvedValue({ ok: true, created: false, capture: { id: "c1" } });
    const body = await (await POST(req(activity()))).json();
    expect(body.composeExtension.type).toBe("message");
    expect(body.composeExtension.text).toBe("\u2713 Saved");
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
describe("★ Save success returns a message-extension reply, not a task module", () => {
  it("★ 1+2+3. composeExtension.type = 'message', text '✓ Saved', and NO task property", async () => {
    const body = await (await POST(req(activity({ name: "composeExtension/fetchTask" })))).json();
    expect(body.composeExtension.type).toBe("message");
    expect(body.composeExtension.text).toBe("✓ Saved");
    expect(body.task, "★ no dialog is opened at all").toBeUndefined();
  });

  it("★ 4. no Adaptive Card anywhere in a Save success", async () => {
    const body = JSON.stringify(await (await POST(req(activity({ name: "composeExtension/fetchTask" })))).json());
    expect(body).not.toContain("AdaptiveCard");
    expect(body).not.toContain("application/vnd.microsoft.card.adaptive");
    expect(body).not.toContain("TextBlock");
    expect(body, "and the brand is not repeated").not.toContain("BTY");
  });

  it("★ IT IS NOT THE SHAPE THAT ALREADY FAILED — task family vs message-extension family", async () => {
    const body = await (await POST(req(activity({ name: "composeExtension/fetchTask" })))).json();
    // The failed experiment was `task.type === "message"`. There is no `task` here at all.
    expect(body.task).toBeUndefined();
    expect(Object.keys(body)).toEqual(["composeExtension"]);
  });

  it("★ 5+6. the backend write and its idempotency are untouched", async () => {
    await POST(req(activity({ name: "composeExtension/fetchTask" })));
    expect(ensureActionCapture).toHaveBeenCalledTimes(1);
    expect(ensureActionCapture.mock.calls[0][1]).toMatchObject({ intent: "save" });
    ensureActionCapture.mockResolvedValueOnce({ ok: true, created: false, capture: { id: "c1" } });
    const dup = await (await POST(req(activity({ name: "composeExtension/fetchTask" })))).json();
    expect(dup.composeExtension.text, "a repeat save is the same calm success").toBe("✓ Saved");
  });

  it("★ 7. FAILURES DID NOT MOVE — they keep the render-proven card path", async () => {
    /*
      Moving failures onto an unproven transport would risk a person being unable to see WHY
      something did not work — the one message they actually need. Success only.
    */
    resolveBtyUserFromMicrosoftIdentity.mockResolvedValueOnce({ status: "NOT_LINKED" });
    const body = await (await POST(req(activity({ name: "composeExtension/fetchTask" })))).json();
    expect(body.task.type).toBe("continue");
    expect(body.task.value.height).toBe("small");
    expect(cardText(body)).toBe("Sign in to BTY with Microsoft first.");
    expect(body.composeExtension, "a failure is still a dialog").toBeUndefined();
  });

  it("★ a failure never wears the success mark", async () => {
    resolveBtyUserFromMicrosoftIdentity.mockResolvedValueOnce({ status: "NOT_LINKED" });
    const body = JSON.stringify(await (await POST(req(activity({ name: "composeExtension/fetchTask" })))).json());
    expect(body).not.toContain("✓");
    for (const leak of ["NOT_LINKED", "stack", "500"]) expect(body, leak).not.toContain(leak);
  });
});
