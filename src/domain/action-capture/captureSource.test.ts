import { describe, expect, it } from "vitest";
import {
  resolveTeamsCaptureSource,
  safeSourceUrl,
  CAPTURE_SOURCE_TYPE_TEAMS,
  PREVIEW_MAX,
  type TeamsCaptureInput,
} from "./captureSource";

const base: TeamsCaptureInput = {
  provider: "teams",
  tenant_id: "T1",
  conversation_id: "C1",
  message_id: "M1",
};

describe("resolveTeamsCaptureSource — server-owned identity", () => {
  it("derives source_type and the canonical external_key", () => {
    const r = resolveTeamsCaptureSource(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sourceType).toBe(CAPTURE_SOURCE_TYPE_TEAMS);
    expect(r.externalKey).toBe("teams:T1:C1:M1");
  });

  it("trims the required identifiers before building the key", () => {
    const r = resolveTeamsCaptureSource({ ...base, tenant_id: "  T1 ", conversation_id: "\tC1", message_id: "M1  " });
    expect(r.ok && r.externalKey).toBe("teams:T1:C1:M1");
  });

  it.each([
    ["tenant_id", { ...base, tenant_id: "   " }],
    ["conversation_id", { ...base, conversation_id: "" }],
    ["message_id", { ...base, message_id: "  " }],
  ])("rejects an empty %s rather than emitting an empty key segment", (_n, input) => {
    const r = resolveTeamsCaptureSource(input as TeamsCaptureInput);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("missing_identifier");
  });

  it("rejects an unsupported provider", () => {
    const r = resolveTeamsCaptureSource({ ...base, provider: "slack" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("unsupported_provider");
  });

  it("IDENTITY IGNORES PREVIEW AND SENDER — the same message re-saved is the same message", () => {
    const a = resolveTeamsCaptureSource({ ...base, preview_text: "first text", sender_display: "Ana" });
    const b = resolveTeamsCaptureSource({ ...base, preview_text: "EDITED text", sender_display: "Ana Renamed" });
    expect(a.ok && b.ok && a.externalKey === b.externalKey).toBe(true);
  });

  it("different tenants with identical conversation/message ids do NOT collide", () => {
    const a = resolveTeamsCaptureSource({ ...base, tenant_id: "T1" });
    const b = resolveTeamsCaptureSource({ ...base, tenant_id: "T2" });
    expect(a.ok && b.ok && a.externalKey === b.externalKey).toBe(false);
  });

  it("stores provenance only — never priority, deadline, category or interpretation", () => {
    const r = resolveTeamsCaptureSource({
      ...base,
      sender_display: "Ana",
      channel_id: "CH1",
      chat_id: "CHAT1",
      captured_at: "2026-08-28T10:00:00Z",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sourceMetadata).toEqual({
      provider: "teams",
      tenant_id: "T1",
      conversation_id: "C1",
      message_id: "M1",
      sender_display: "Ana",
      channel_id: "CH1",
      chat_id: "CHAT1",
      captured_at_source: "2026-08-28T10:00:00Z",
    });
    for (const forbidden of ["priority", "deadline", "due", "category", "urgency", "summary", "title", "recommendation"]) {
      expect(Object.keys(r.sourceMetadata)).not.toContain(forbidden);
    }
  });

  it("omits absent provenance rather than storing empty strings", () => {
    const r = resolveTeamsCaptureSource(base);
    expect(r.ok && Object.keys(r.sourceMetadata).sort()).toEqual([
      "conversation_id",
      "message_id",
      "provider",
      "tenant_id",
    ]);
  });

  it("caps preview length and nulls a blank preview (never invents one)", () => {
    const long = resolveTeamsCaptureSource({ ...base, preview_text: "x".repeat(PREVIEW_MAX + 50) });
    expect(long.ok && long.previewText?.length).toBe(PREVIEW_MAX);
    const blank = resolveTeamsCaptureSource({ ...base, preview_text: "   " });
    expect(blank.ok && blank.previewText).toBe(null);
  });
});

describe("safeSourceUrl — provenance, not an XSS vector", () => {
  it("keeps schemes that can actually open a Teams message", () => {
    expect(safeSourceUrl("https://teams.microsoft.com/l/message/x")).toBe("https://teams.microsoft.com/l/message/x");
    expect(safeSourceUrl("msteams:/l/message/x")).toBe("msteams:/l/message/x");
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>", "file:///etc/passwd", "not a url", "", "   "])(
    "drops %s",
    (bad) => {
      expect(safeSourceUrl(bad)).toBe(null);
    },
  );

  it("a dropped URL means the row simply has none", () => {
    const r = resolveTeamsCaptureSource({ ...base, source_url: "javascript:alert(1)" });
    expect(r.ok && r.sourceUrl).toBe(null);
  });
});
