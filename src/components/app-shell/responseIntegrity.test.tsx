/** @vitest-environment jsdom */
/**
 * The choice a person touches is the choice that is stored (production defect, 2026-09-02).
 *
 * ★ WHAT PRODUCTION SHOWED. A person reports choosing "I have a question". The database holds
 * `HELP_NEEDED` with `question_text` NULL, and the Host card correctly renders "1 Help needed" —
 * the Host projection was faithful to what was stored.
 *
 * ★ WHAT WAS ACTUALLY WRONG, MEASURED WITH REAL TOUCH AT 390px. The mapping was never broken.
 * The three controls WRAPPED onto two lines, leaving "I need help applying this" 8px below
 * "I have a question", each only 38px tall. A tap SIX pixels low landed on the lower control and
 * committed HELP_NEEDED instantly, with no text — exactly the stored evidence. Write-once then
 * made it permanent.
 *
 * These tests pin both halves: the enum each visible control sends, and the geometry that decides
 * which control a thumb actually reaches.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";

vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null }, error: null })) } } }));

import NeedsYourResponse from "./NeedsYourResponse";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const ID = "aaaaaaaa-0000-0000-0000-000000000001";
const ITEM: {
  announcementId: string; hostFraming: string; hostDisplay: string | null; sourceUrl: string | null;
  response: string | null; respondedAt: string | null;
} = {
  announcementId: ID, hostFraming: "트랙이 되는지 확인해야해", hostDisplay: null,
  sourceUrl: "https://teams.microsoft.com/l/message/19:chat@unq.gbl.spaces/1", response: null, respondedAt: null,
};

function stub(item = ITEM) {
  const sent: { response?: string; questionText?: string | null }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("/respond")) {
      sent.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ items: [item] }), { status: 200, headers: { "content-type": "application/json" } });
  }));
  return sent;
}

describe("★ 7. each visible control sends its exact enum", () => {
  it("★ 'Got it' sends ACKNOWLEDGED and no question text", async () => {
    const sent = stub();
    render(<NeedsYourResponse locale="en" />);
    fireEvent.click(await screen.findByTestId("announcement-got-it"));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ response: "ACKNOWLEDGED", questionText: null });
  });

  it("★ 'I need help applying this' sends HELP_NEEDED and no question text", async () => {
    const sent = stub();
    render(<NeedsYourResponse locale="en" />);
    fireEvent.click(await screen.findByTestId("announcement-help"));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ response: "HELP_NEEDED", questionText: null });
  });

  it("★ 'I have a question' COMMITS NOTHING — it opens the form", async () => {
    const sent = stub();
    render(<NeedsYourResponse locale="en" />);
    fireEvent.click(await screen.findByTestId("announcement-question"));
    expect(await screen.findByTestId("announcement-question-form")).toBeTruthy();
    expect(sent).toEqual([]); // the reversible one; nothing is stored by pressing it
  });

  it("★ 8. QUESTION sends its trimmed text, and Send is disabled until there is some", async () => {
    const sent = stub();
    render(<NeedsYourResponse locale="en" />);
    fireEvent.click(await screen.findByTestId("announcement-question"));
    const send = screen.getByTestId("announcement-question-send") as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    expect((screen.getByTestId("announcement-question-send") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Which account should I use?" } });
    fireEvent.click(screen.getByTestId("announcement-question-send"));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ response: "QUESTION", questionText: "Which account should I use?" });
  });

  it("★ 8. the other two choices can never carry question text", () => {
    const DOMAIN = readFileSync("src/domain/announcement/trackedAnnouncement.ts", "utf8");
    expect(DOMAIN).toMatch(/if \(response !== "QUESTION"\) return null;/);
  });
});

describe("★ 9. the Host renders the stored category, and never corrects it", () => {
  it("★ the projection maps each stored value to its own bucket", () => {
    const SERVICE = readFileSync("src/lib/bty/announcement/announcementService.server.ts", "utf8");
    for (const v of ["ACKNOWLEDGED", "QUESTION", "HELP_NEEDED"]) expect(SERVICE).toContain(v);
    // No remap, no fallback that could turn one answer into another.
    expect(SERVICE).not.toMatch(/HELP_NEEDED.*\?\s*"QUESTION"|QUESTION.*\?\s*"HELP_NEEDED"/);
  });

  it("★ an unrecognised stored value is counted as NO response, never as a real answer", () => {
    const DOMAIN = readFileSync("src/domain/announcement/trackedAnnouncement.ts", "utf8");
    // summariseAnnouncement only increments a bucket on an exact match.
    expect(DOMAIN).toMatch(/if \(r\.response === "ACKNOWLEDGED"\)/);
    expect(DOMAIN).toMatch(/else if \(r\.response === "QUESTION"\)/);
    expect(DOMAIN).toMatch(/else if \(r\.response === "HELP_NEEDED"\)/);
  });
});

describe("★ 10. one response only", () => {
  it("a settled row shows the committed state and offers no way to change it", async () => {
    stub({ ...ITEM, response: "QUESTION", respondedAt: "2026-09-02T22:00:00Z" });
    render(<NeedsYourResponse locale="en" />);
    expect((await screen.findByTestId("announcement-answered")).textContent).toContain("You asked a question");
    for (const t of ["announcement-got-it", "announcement-question", "announcement-help"]) {
      expect(screen.queryByTestId(t)).toBeNull();
    }
  });

  it("write-once stays authoritative in the database", () => {
    const SQL = readFileSync("supabase/migrations/20260902000000_bty_tracked_announcements_v1.sql", "utf8");
    const start = SQL.indexOf("create or replace function public.bty_respond_to_announcement");
    const fn = SQL.slice(start, SQL.indexOf("$$;", start));
    expect(fn).toContain("for update");
    expect(fn).toMatch(/if v_row\.response is not null then[\s\S]*already_responded/);
  });
});

describe("★ 11. the geometry that decides which control a thumb reaches", () => {
  const UI = readFileSync("src/components/app-shell/NeedsYourResponse.tsx", "utf8");

  it("★ the three controls STACK — they cannot wrap into a label-length-dependent order", () => {
    // `flex-wrap` put "I need help" 8px under "I have a question" at 390px; a 6px-low tap
    // committed HELP_NEEDED. A column cannot reorder itself when a translation gets longer.
    expect(UI).toContain("flex flex-col gap-3");
    expect(UI).not.toMatch(/<div className="flex flex-wrap gap-2">\s*\n\s*<button[\s\S]{0,200}announcement-got-it/);
  });

  it("★ every response control meets the app's 44px thumb target and spans the row", () => {
    for (const t of ["announcement-got-it", "announcement-question", "announcement-help"]) {
      // Anchored to the EXACT attribute: a bare indexOf("announcement-question") matches
      // `announcement-question-form` first, which is the textarea's container, not a control.
      const i = UI.indexOf(`data-testid="${t}"\n`);
      expect(i, `${t} not found as an exact testid`).toBeGreaterThan(-1);
      const cls = UI.slice(i, i + 400);
      expect(cls, t).toContain("min-h-[2.75rem]");
      expect(cls, t).toContain("w-full");
    }
  });

  it("★ the irreversible controls are not adjacent by a hair — the gap is 12px", () => {
    expect(UI).toContain("gap-3"); // 0.75rem between stacked controls
  });
});

describe("★ 14. no identity of any kind reaches the recipient view", () => {
  it("no uuid, email, tenant or object id is rendered", async () => {
    stub();
    render(<NeedsYourResponse locale="en" />);
    await waitFor(() => expect(screen.getByTestId("announcement-item")).toBeTruthy());
    const text = screen.getByTestId("needs-your-response").textContent ?? "";
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(text).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
  });
});
