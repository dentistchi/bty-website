/**
 * ★ ONE CONCEPT → ONE DOOR (IA simplification V1).
 *
 * Three coordinated simplifications, each asserted on the thing that actually changed rather than
 * on a label: the duplicate Learning door is gone, the legacy QR-event door is retired from the UI
 * while its domain stays whole, and the two Teams commands stop repeating the word BTY.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");
/** Source-text guards must read CODE, not the prose explaining it. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const SHELL = "src/components/app-shell/BtyDailyAppShell.tsx";
const DOORS = "src/components/foundry/event-rooms/LearnDoors.tsx";

describe("★ 1-6 — LEARNING: one door", () => {
  const shell = code(read(SHELL));

  it("★ 1. Me no longer offers 'What I learned' / '내가 배운 것'", () => {
    expect(shell).not.toContain("me-row-learned");
    expect(shell).not.toContain("내가 배운 것");
    expect(shell).not.toContain("What I learned");
  });

  it("★ 2. Learn still reaches FoundryMyLearning, unchanged", () => {
    expect(shell).toContain('foundryView === "my-learning"');
    expect(shell).toContain("<FoundryMyLearning");
    expect(shell).toContain('setFoundryView("my-learning")');
  });

  it("★ 4. the Learn-only deep-link focus is untouched", () => {
    expect(shell).toContain("focusEntryId={myLearningFocus}");
  });

  it("★ 5. 'me-my-learning' cannot be produced, and its dead state is gone", () => {
    expect(shell, "no meView branch").not.toContain('meView === "my-learning"');
    expect(shell, "no origin token in state").not.toContain("setFollowupReturn");
    expect(shell, "and no branch reading it").not.toContain('followupReturn === "me-my-learning"');
    // the meView union no longer carries it
    expect(shell).toMatch(/"home" \| "center" \| "past-tracks" \| "account"/);
  });

  it("★ 3+6. no learning DATA, component or API was removed", () => {
    expect(existsSync("src/components/foundry/event-rooms/FoundryMyLearning.tsx")).toBe(true);
    expect(shell).toContain('import FoundryMyLearning from "@/components/foundry/event-rooms/FoundryMyLearning"');
  });

  it("★ the remaining Me rows, in order", () => {
    const ids = [...shell.matchAll(/id: "(me-[a-z-]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(["me-row-past-tracks", "me-row-center", "me-account-row"]);
  });
});

describe("★ 7-9 — LEGACY QR EVENT DOOR: retired from UI, domain preserved", () => {
  it("★ 7. the door is not rendered", () => {
    const doors = code(read(DOORS));
    expect(doors).not.toContain('data-testid="door-my-events"');
    expect(doors, "and its labels are not painted").not.toMatch(/\{t\.myEventsTitle\}|\{t\.myEventsBody\}/);
  });

  it("★ 8. bty_events schema, routes and component are ALL still there", () => {
    for (const p of [
      "supabase/migrations/20260624000000_bty_events_slice1.sql",
      "src/app/api/bty/events/mine/route.ts",
      "src/components/bty/events/EventHostList.tsx",
    ]) {
      expect(existsSync(p), `${p} must survive`).toBe(true);
    }
    expect(read("src/app/api/bty/events/mine/route.ts")).toContain('from("bty_events")');
  });

  it("★ 9. the two event domains were NOT merged", () => {
    // Different tables, still read by different services. Nothing migrated between them.
    expect(read("src/app/api/bty/events/mine/route.ts")).toContain('from("bty_events")');
    expect(read("src/lib/bty/foundry/events/foundryEventService.ts")).toContain('from("foundry_events")');
    expect(read("src/lib/bty/foundry/events/foundryEventService.ts")).not.toContain("bty_events");
  });

  it("the callback is kept for a future deliberate Live Experience design", () => {
    expect(read(DOORS)).toContain("onOpenMyEvents");
  });
});

describe("★ FOUNDRY NAMING: two domains stop both being 'events'", () => {
  const copy = read("src/components/foundry/event-rooms/copy.ts");

  it("★ the section headings are training vocabulary now", () => {
    expect(copy).toContain('openHeader: "TRAINING SESSIONS"');
    expect(copy).toContain('pastHeader: "PAST TRAINING"');
    expect(copy).toContain('openHeader: "교육 세션"');
    expect(copy).toContain('pastHeader: "지난 교육"');
    expect(copy).toContain('pastViewAll: "View all past training"');
    expect(copy).toContain('pastViewAll: "지난 교육 모두 보기"');
  });

  it("★ it is a COPY change — the table is not renamed", () => {
    expect(read("src/lib/bty/foundry/events/foundryEventService.ts")).toContain('from("foundry_events")');
    expect(existsSync("supabase/migrations/20260714000000_foundry_event_rooms_v1.sql")).toBe(true);
  });

  it("★ participant-removal copy was NOT reused for history cleanup", () => {
    // Same English word, two different acts. Sharing a key would let one surface borrow the other's.
    expect(copy).toContain('removeConfirm: "Remove this participant?"');
    expect(copy).toContain('historyRemove: "Remove"');
    expect(copy).toContain('historyRemove: "치우기"');
  });
});

describe("★ 10-11 — TRAINING HISTORY: closed rows only", () => {
  const rooms = code(read("src/components/foundry/event-rooms/FoundryEventRooms.tsx"));

  it("★ 11. an OPEN row returns before any tray is built", () => {
    expect(rooms).toContain("if (isOpen || !onRemove || !setSwipeOpenId) return body;");
  });

  it("★ 10. only the PAST list receives the removal props", () => {
    const openList = rooms.slice(rooms.indexOf("{open.map("), rooms.indexOf("{past.length"));
    expect(openList, "the open section passes no remove").not.toContain("onRemove");
    const pastList = rooms.slice(rooms.indexOf("{past.slice(0, 3)"), rooms.indexOf("pastViewAll"));
    expect(pastList).toContain("onRemove={removeFromHistory}");
  });

  it("★ 9(UX). the proven destructive grammar is REUSED, not reimplemented", () => {
    expect(rooms).toContain('testIdPrefix="training-history"');
    expect(rooms).toContain("<TodaySwipeAction");
    /*
      Scoped to EventRow. This file ALSO contains a pre-existing swipe on the draft card
      (`DraftRow`, with its own SWIPE_REVEAL and touch handlers) which this slice neither added
      nor touched — a whole-file assertion would have been objecting to somebody else's code.
    */
    const start = rooms.indexOf("function EventRow(");
    const rest = rooms.slice(start + 1);
    const end = start + 1 + rest.search(/\nfunction \w+\(/); // the next top-level function
    const eventRow = rooms.slice(start, end);
    expect(eventRow, "EventRow implements no gesture of its own").not.toMatch(/onTouchStart|onTouchMove|REVEAL_PX|SWIPE_REVEAL/);
  });

  it("★ not gesture-only: an sr-only keyboard path exists", () => {
    expect(rooms).toContain('data-testid="training-history-remove"');
    expect(rooms).toContain("sr-only focus:not-sr-only");
  });

  it("★ no confirmation modal for history cleanup", () => {
    const near = rooms.slice(rooms.indexOf("removeFromHistory"), rooms.indexOf("removeFromHistory") + 1400);
    expect(near).not.toMatch(/window\.confirm/);
  });

  it("★ the client sends only the id, and never a user id", () => {
    expect(rooms).toContain("/api/bty/foundry/event-history/${encodeURIComponent(id)}/dismiss");
    expect(rooms).toContain('method: "POST"');
    expect(rooms).toContain('credentials: "include"');
    const near = rooms.slice(rooms.indexOf("removeFromHistory"), rooms.indexOf("removeFromHistory") + 1400);
    expect(near, "no body at all").not.toMatch(/body:/);
  });
});

describe("★ 8(read filter) — both owner-scoped history reads subtract dismissals", () => {
  it("the archive and the owner list both apply it, on the SERVER", () => {
    for (const p of [
      "src/lib/bty/foundry/events/foundryHostHistoryService.ts",
      "src/lib/bty/foundry/events/foundryEventService.ts",
    ]) {
      const s = code(read(p));
      expect(s, p).toContain("loadHistoryDismissals(admin, ownerUserId)");
    }
  });

  it("★ the owner list subtracts CLOSED only — an open session can never be hidden", () => {
    expect(code(read("src/lib/bty/foundry/events/foundryEventService.ts")))
      .toContain('!(e.status === "closed" && hidden.has(e.id))');
  });

  it("★ no status mutation anywhere in the dismissal path", () => {
    const s = code(read("src/lib/bty/foundry/events/foundryEventHistoryDismissal.server.ts"));
    expect(s).not.toMatch(/\.update\(|\.delete\(|\.upsert\(/);
    expect(s, "it inserts, and reads to check ownership").toContain(".insert(");
    expect(s).toContain('.eq("owner_user_id", userId)');
    expect(s).toContain('event.status !== "closed"');
  });
});

describe("★ 22-27 — TEAMS: the packaged manifest", () => {
  const pkg = JSON.parse(read("teams/manifest/manifest.json"));
  const cmds = pkg.composeExtensions[0].commands;

  it("★ 22-23. the titles are now Save and Track", () => {
    expect(cmds.map((c: { title: string }) => c.title)).toEqual(["Save", "Track"]);
  });

  it("★ 24. command IDs are UNCHANGED — backend routing keys off these", () => {
    expect(cmds.map((c: { id: string }) => c.id)).toEqual(["saveToBty", "trackWithBty"]);
  });

  it("★ 25. array order is Save then Track", () => {
    expect(cmds[0].id).toBe("saveToBty");
    expect(cmds[1].id).toBe("trackWithBty");
  });

  it("★ 26. the app short name is still BTY — the second line is Teams' attribution", () => {
    expect(pkg.name.short).toBe("BTY");
    expect(pkg.name.full).toBe("BTY Training Center");
  });

  it("★ fetchTask, context and descriptions are untouched", () => {
    for (const c of cmds) {
      expect(c.fetchTask).toBe(true);
      expect(c.context).toEqual(["message"]);
      expect(typeof c.description).toBe("string");
      expect(c.description.length).toBeGreaterThan(10);
    }
  });

  it("★ 27. icon assets are unchanged, and none were renamed", () => {
    expect(pkg.icons.color).toBe("color.png");
    expect(pkg.icons.outline).toBe("outline-s1-v112.png");
    expect(existsSync("teams/manifest/color.png")).toBe(true);
    expect(existsSync("teams/manifest/outline-s1-v112.png")).toBe(true);
  });

  it("★ version bumped to 1.0.13", () => {
    expect(pkg.version).toBe("1.0.13");
    expect(pkg.manifestVersion).toBe("1.25");
  });

  it("★ 11(order). no new Teams surface was added in this slice", () => {
    expect(pkg.bots?.[0]?.commandLists, "no bot command lists").toBeUndefined();
    for (const c of cmds) expect(c.context, "no commandBox/compose context").toEqual(["message"]);
    expect(pkg.composeExtensions[0].messageHandlers).toBeUndefined();
  });
});
