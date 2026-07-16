import { describe, it, expect } from "vitest";
import {
  buildFoundryInvitation,
  buildTeamsMessage,
  buildTeamsShareUrl,
  TEAMS_MESSAGE_MAX,
} from "./foundryInvitation";

const URL = "https://bty-arena-staging.ywamer2022.workers.dev/f/btyfr1.ABC.DEF";

describe("buildFoundryInvitation", () => {
  it("YouTube: title + watch instruction + open-room + URL (no progress line)", () => {
    const inv = buildFoundryInvitation({ locale: "en", title: "Monthly Clinical Update", contentType: "youtube", participantUrl: URL });
    expect(inv).toContain("Monthly Clinical Update");
    expect(inv).toContain("Watch the training video and complete the reflection.");
    expect(inv).not.toContain("reading progress");
    expect(inv).toContain("Open the Foundry room:");
    expect(inv).toContain(URL);
  });

  it("Document: read instruction + progress-saved line + URL", () => {
    const inv = buildFoundryInvitation({ locale: "en", title: "All-on-X Review", contentType: "document", participantUrl: URL });
    expect(inv).toContain("Read the document and complete the reflection.");
    expect(inv).toContain("Your reading progress will be saved.");
    expect(inv).toContain(URL);
  });

  it("includes an optional intro when present, omits it when blank", () => {
    const withIntro = buildFoundryInvitation({ locale: "en", title: "T", contentType: "document", participantUrl: URL, intro: "Focus on pages 3-5." });
    expect(withIntro).toContain("Focus on pages 3-5.");
    const noIntro = buildFoundryInvitation({ locale: "en", title: "T", contentType: "document", participantUrl: URL, intro: "   " });
    expect(noIntro).not.toMatch(/Focus/);
  });

  it("never invents a deadline or duration", () => {
    const inv = buildFoundryInvitation({ locale: "en", title: "T", contentType: "youtube", participantUrl: URL });
    expect(inv).not.toMatch(/minute|complete by|deadline/i);
  });

  it("includes an honest duration/deadline ONLY when provided (extension seam)", () => {
    const inv = buildFoundryInvitation({ locale: "en", title: "T", contentType: "youtube", participantUrl: URL, estimatedMinutes: 12, deadline: "July 20, 2026" });
    expect(inv).toContain("About 12 minutes");
    expect(inv).toContain("Please complete by July 20, 2026");
  });

  it("includes the canonical URL exactly once and no other http(s) URL", () => {
    const inv = buildFoundryInvitation({ locale: "en", title: "T", contentType: "document", participantUrl: URL, intro: "hi" });
    expect(inv.split(URL).length - 1).toBe(1);
    expect((inv.match(/https?:\/\//g) ?? []).length).toBe(1);
  });

  it("contains no internal ids / storage / db / xp terminology", () => {
    const inv = buildFoundryInvitation({ locale: "en", title: "T", contentType: "document", participantUrl: URL, intro: "read it" });
    expect(inv).not.toMatch(/owner_user_id|storage|supabase|core_xp|signedURL|session_token|foundry_event/i);
  });

  it("normalizes messy whitespace in title/intro", () => {
    const inv = buildFoundryInvitation({ locale: "en", title: "  Big   Title \n\n", contentType: "youtube", participantUrl: URL, intro: "line1\n\n\n\nline2   " });
    expect(inv).toContain("Big   Title"); // internal single spaces kept, edges trimmed
    expect(inv).not.toMatch(/\n{3,}/);
    expect(inv).toContain("line1\n\nline2");
  });

  it("Korean locale renders localized instruction", () => {
    const inv = buildFoundryInvitation({ locale: "ko", title: "제목", contentType: "document", participantUrl: URL });
    expect(inv).toContain("문서를 읽고 성찰을 완료해 주세요.");
    expect(inv).toContain(URL);
  });
});

describe("buildTeamsMessage", () => {
  it("is concise and within the platform limit", () => {
    const msg = buildTeamsMessage({ locale: "en", title: "Monthly Clinical Update" });
    expect(msg).toContain("Monthly Clinical Update");
    expect(msg.length).toBeLessThanOrEqual(TEAMS_MESSAGE_MAX);
    expect(msg).not.toContain("https://"); // the URL rides in href, not the message
  });
  it("truncates an over-long title within the limit", () => {
    const msg = buildTeamsMessage({ locale: "en", title: "X".repeat(500) });
    expect(msg.length).toBeLessThanOrEqual(TEAMS_MESSAGE_MAX);
  });
});

describe("buildTeamsShareUrl — same canonical URL", () => {
  it("uses the official share endpoint and encodes the SAME participant URL as href", () => {
    const message = buildTeamsMessage({ locale: "en", title: "T" });
    const share = buildTeamsShareUrl({ participantUrl: URL, message });
    expect(share.startsWith("https://teams.microsoft.com/share?")).toBe(true);
    const href = new URLSearchParams(share.split("?")[1]).get("href");
    expect(href).toBe(URL); // decodes back to the canonical participant URL
  });

  it("QR URL === Copy-invitation URL === Teams-share href (one canonical URL)", () => {
    // The three paths all consume the same event.join_url. Prove they agree.
    const qrUrl = URL;
    const invitation = buildFoundryInvitation({ locale: "en", title: "T", contentType: "document", participantUrl: qrUrl });
    const share = buildTeamsShareUrl({ participantUrl: qrUrl, message: buildTeamsMessage({ locale: "en", title: "T" }) });
    const teamsHref = new URLSearchParams(share.split("?")[1]).get("href");
    expect(invitation).toContain(qrUrl);
    expect(teamsHref).toBe(qrUrl);
  });
});
