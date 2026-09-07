/** @vitest-environment jsdom */
/**
 * ★ A TRACK WHOSE HOST ACCOUNT IS GONE: READABLE, AND CLOSED TO NEW WRITING.
 *
 * The database refuses both write paths with `host_unavailable`, and that refusal stays the
 * authority. These tests hold the surface's side of the same fact: it must stop OFFERING the
 * controls before somebody uses them, say plainly why, and never take away what was already said.
 *
 * The one thing it must never do is leave a person permanently asked to answer somebody who no
 * longer exists, with no way to clear the card.
 */
import { describe, it, expect } from "vitest";

/**
 * Source-text guards must read CODE, not the prose explaining it. Both of these assertions first
 * matched the very comments that describe the change they check for — a guard that fires on its own
 * documentation proves nothing.
 */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
import { recipientTodayAction } from "@/domain/daily/todayDismissal";
import { projectForRecipient } from "@/domain/announcement/trackedAnnouncement";

describe("★ I — the Today matrix for an orphaned Track", () => {
  const orphan = (response: string | null, unreadCount: number) =>
    recipientTodayAction({ response, unreadCount, hostAvailable: false });

  it("★ unread Host reply ⇒ Read reply, whatever the response was", () => {
    for (const r of [null, "ACKNOWLEDGED", "QUESTION", "HELP_NEEDED"]) {
      expect(orphan(r, 1), `response=${r}`).toEqual({ removable: false, blocker: "unread" });
    }
  });

  it("★ nothing unread ⇒ Remove, for EVERY response state including no response at all", () => {
    for (const r of [null, "ACKNOWLEDGED", "QUESTION", "HELP_NEEDED"]) {
      expect(orphan(r, 0), `response=${r}`).toEqual({ removable: true, blocker: null });
    }
  });

  it("★ a no-response orphan MUST NOT say 'Respond first' — nobody is waiting for it", () => {
    expect(orphan(null, 0).blocker).not.toBe("needs_response");
    expect(orphan(null, 0).removable).toBe(true);
  });

  it("★ and a LIVE Track is completely unchanged", () => {
    const live = (response: string | null, unreadCount: number) =>
      recipientTodayAction({ response, unreadCount, hostAvailable: true });
    expect(live(null, 0)).toEqual({ removable: false, blocker: "needs_response" });
    expect(live("QUESTION", 1)).toEqual({ removable: false, blocker: "unread" });
    expect(live("ACKNOWLEDGED", 0)).toEqual({ removable: true, blocker: null });
  });

  it("★ an OMITTED flag reads as the ordinary case, never as 'no Host'", () => {
    // A caller that predates this must not silently turn every live Track read-only.
    expect(recipientTodayAction({ response: null, unreadCount: 0 })).toEqual({
      removable: false,
      blocker: "needs_response",
    });
  });
});

describe("★ the projection carries the fact, and defaults safely", () => {
  const base = { announcementId: "a", recipientId: "r", hostFraming: "hi" };

  it("hostAvailable false survives projection", () => {
    expect(projectForRecipient({ ...base, hostAvailable: false }).hostAvailable).toBe(false);
  });

  it("★ absent ⇒ true; only an explicit false means the Host is gone", () => {
    expect(projectForRecipient({ ...base }).hostAvailable).toBe(true);
    expect(projectForRecipient({ ...base, hostAvailable: null }).hostAvailable).toBe(true);
    expect(projectForRecipient({ ...base, hostAvailable: true }).hostAvailable).toBe(true);
  });

  it("★ a missing source link is tolerated, and never fabricated", () => {
    const p = projectForRecipient({ ...base, sourceUrl: null, hostAvailable: false });
    expect(p.sourceUrl).toBeNull();
    expect(p.hostFraming, "the Host's own words are what actually carries the card").toBe("hi");
  });

  it("the snapshot uuid has no way into the projection at all", () => {
    const p = projectForRecipient({ ...base, hostAvailable: false } as never);
    expect(Object.keys(p)).not.toContain("ownerUserIdSnapshot");
    expect(JSON.stringify(p)).not.toMatch(/snapshot/i);
  });
});

describe("★ H — the recipient query must not use an inner join on the capture", () => {
  it("★ source_capture_id NULL would otherwise erase the whole historical card", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/bty/announcement/announcementService.server.ts", "utf8");
    const select = code(src.slice(src.indexOf("listMyAnnouncements"), src.indexOf("listHostAnnouncements")));
    expect(select, "the capture relation must be optional").not.toContain("bty_action_captures!inner");
    expect(select).toContain("bty_action_captures(source_url)");
    // the announcement relation itself stays inner: a recipient row always has one
    expect(select).toContain("bty_tracked_announcements!inner");
  });
});

describe("★ G/J — the write paths and the surface agree on one domain fact", () => {
  it("both service result types carry host_unavailable", async () => {
    const fs = await import("node:fs");
    const thread = fs.readFileSync("src/lib/bty/announcement/announcementThread.server.ts", "utf8");
    const service = fs.readFileSync("src/lib/bty/announcement/announcementService.server.ts", "utf8");
    for (const [name, src] of [["thread", thread], ["respond", service]] as const) {
      expect(src, `${name} maps the result`).toContain('result === "host_unavailable"');
      expect(src, `${name} exposes the reason`).toContain('"host_unavailable"');
    }
  });

  it("★ both routes answer 409 — the request was fine, the world changed", async () => {
    const fs = await import("node:fs");
    const t = fs.readFileSync("src/app/api/bty/announcements/recipients/[recipientId]/thread/route.ts", "utf8");
    const r = fs.readFileSync("src/app/api/bty/announcements/[id]/respond/route.ts", "utf8");
    expect(t).toMatch(/host_unavailable:\s*409/);
    expect(r).toMatch(/host_unavailable"\s*\?\s*409/);
  });

  it("★ the card hides the controls and says why, without a modal", async () => {
    const fs = await import("node:fs");
    const ui = fs.readFileSync("src/components/app-shell/NeedsYourResponse.tsx", "utf8");
    expect(ui).toContain('data-testid="announcement-host-gone"');
    expect(ui).toContain("Host account removed. This Track is read-only.");
    expect(ui).toContain("Host 계정이 삭제되어 이 Track은 기록으로만 남아 있습니다.");
    expect(ui, "the answer buttons are not offered").toContain("hostGone && !answered ? null");
    expect(ui, "the conversation composer is not offered").toContain("readOnly={hostGone}");
    expect(ui, "no modal").not.toMatch(/role="dialog"/);
    expect(code(ui), "the internal snapshot id is never shown").not.toMatch(/snapshot/i);
  });

  it("★ the conversation still RENDERS when there is history to read", async () => {
    const fs = await import("node:fs");
    const ui = fs.readFileSync("src/components/app-shell/NeedsYourResponse.tsx", "utf8");
    expect(ui).toContain("hostGone ? it.messageCount > 0 : continuable || it.messageCount > 0");
    const convo = fs.readFileSync("src/components/app-shell/TrackConversation.tsx", "utf8");
    expect(convo, "only the composer is withheld").toContain("{readOnly ? null : (");
    expect(convo, "messages are not gated on it").toContain('data-testid="track-conversation-messages"');
  });
});
