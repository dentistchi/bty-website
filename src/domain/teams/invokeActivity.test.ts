import { describe, it, expect } from "vitest";
import {
  parseTeamsMessageAction,
  canonicalConversationId,
  previewFromBody,
  TEAMS_INVOKE_FETCH_TASK,
  TEAMS_INVOKE_SUBMIT_ACTION,
} from "@/domain/teams/invokeActivity";
import { resolveTeamsCaptureSource, PREVIEW_MAX } from "@/domain/action-capture/captureSource";

const TID = "11111111-1111-1111-1111-111111111111";
const OID = "22222222-2222-2222-2222-222222222222";

function activity(over: Record<string, unknown> = {}) {
  return {
    name: TEAMS_INVOKE_FETCH_TASK,
    channelData: { tenant: { id: TID } },
    from: { id: "29:bot-scoped-address", aadObjectId: OID },
    conversation: { id: "19:abc@thread.tacv2" },
    value: {
      messagePayload: {
        id: "1700000000000",
        body: { contentType: "html", content: "<p>Review the staffing plan</p>" },
        linkToMessage: "https://teams.microsoft.com/l/message/19:abc@thread.tacv2/1700000000000",
        from: { user: { displayName: "Dr. X", id: "someone-else-oid" } },
        createdDateTime: "2026-08-30T15:00:00Z",
      },
    },
    ...over,
  };
}

describe("Teams message action → capture input (pure)", () => {
  it("reads identity from aadObjectId and NEVER from from.id", () => {
    const r = parseTeamsMessageAction(activity());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.aadObjectId).toBe(OID);
    expect(r.tenantId).toBe(TID);
    expect(JSON.stringify(r)).not.toContain("29:bot-scoped-address");
  });

  it("P7 — a different from.id with the same aadObjectId is the same person", () => {
    const a = parseTeamsMessageAction(activity({ from: { id: "29:AAA", aadObjectId: OID } }));
    const b = parseTeamsMessageAction(activity({ from: { id: "29:BBB", aadObjectId: OID } }));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.aadObjectId).toBe(b.aadObjectId);
    expect(resolveTeamsCaptureSource(a.capture)).toEqual(resolveTeamsCaptureSource(b.capture));
  });

  it("P8 — there is no email/UPN input at all, so it cannot become identity", () => {
    const withEmail = activity({
      from: { id: "29:x", aadObjectId: OID, name: "Someone", userPrincipalName: "a@b.com" },
    });
    const r = parseTeamsMessageAction(withEmail);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.stringify(r.capture)).not.toContain("a@b.com");
  });

  it("P6 — an edited message keeps the same external key", () => {
    const before = parseTeamsMessageAction(activity());
    const edited = activity();
    // Same message id, different body + a later edit timestamp.
    (edited.value.messagePayload as Record<string, unknown>).body = { content: "<p>Review it by Tuesday</p>" };
    const after = parseTeamsMessageAction(edited);
    expect(before.ok && after.ok).toBe(true);
    if (!before.ok || !after.ok) return;
    const k = (c: typeof before.capture) => {
      const s = resolveTeamsCaptureSource(c);
      return s.ok ? s.externalKey : null;
    };
    expect(k(before.capture)).toBe(k(after.capture));
  });

  it("P5 — a missing identifier segment is rejected, never an empty segment", () => {
    for (const bad of [
      activity({ channelData: { tenant: { id: "  " } } }),
      activity({ conversation: { id: "" } }),
      activity({ value: { messagePayload: { id: "" } } }),
      activity({ from: { id: "29:x" } }),
    ]) {
      const r = parseTeamsMessageAction(bad);
      expect(r.ok).toBe(false);
    }
  });

  it("channel conversation ids drop the ;messageid= suffix so the key names the conversation", () => {
    expect(canonicalConversationId("19:abc@thread.tacv2;messageid=170")).toBe("19:abc@thread.tacv2");
    expect(canonicalConversationId("19:chat@thread.v2")).toBe("19:chat@thread.v2");
    const a = parseTeamsMessageAction(activity({ conversation: { id: "19:abc@thread.tacv2;messageid=170" } }));
    const b = parseTeamsMessageAction(activity({ conversation: { id: "19:abc@thread.tacv2" } }));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.capture.conversation_id).toBe(b.capture.conversation_id);
  });

  it("only the two message-action invokes are answered", () => {
    for (const name of [TEAMS_INVOKE_FETCH_TASK, TEAMS_INVOKE_SUBMIT_ACTION]) {
      expect(parseTeamsMessageAction(activity({ name })).ok).toBe(true);
    }
    for (const name of ["message", "composeExtension/query", "task/fetch", "", undefined]) {
      const r = parseTeamsMessageAction(activity({ name }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("unsupported_invoke");
    }
  });

  it("Q — the preview is plain text, clamped, and the raw HTML body is not carried", () => {
    const long = "x".repeat(PREVIEW_MAX + 500);
    const r = parseTeamsMessageAction(
      activity({ value: { messagePayload: { id: "m1", body: { content: `<div>${long}</div>` } } } }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.capture.preview_text?.length).toBe(PREVIEW_MAX);
    expect(r.capture.preview_text).not.toContain("<");
    expect(previewFromBody("<p>a&nbsp;&amp;&nbsp;b</p>")).toBe("a & b");
  });

  it("records explicit_save as provenance without touching identity", () => {
    const r = parseTeamsMessageAction(activity());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = resolveTeamsCaptureSource(r.capture);
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.sourceMetadata.capture_reason).toBe("explicit_save");
    expect(s.externalKey).not.toContain("explicit_save");
    expect(s.externalKey).toBe(`teams:${TID}:19:abc@thread.tacv2:1700000000000`);
  });

  it("an unsafe deep link is dropped rather than rendered", () => {
    const r = parseTeamsMessageAction(
      activity({
        value: { messagePayload: { id: "m1", linkToMessage: "javascript:alert(1)" } },
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = resolveTeamsCaptureSource(r.capture);
    expect(s.ok && s.sourceUrl).toBe(null);
  });
});
