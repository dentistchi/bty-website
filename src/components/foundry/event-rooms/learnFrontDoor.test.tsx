/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import FoundryEventRooms from "./FoundryEventRooms";
import { LearnDoors } from "./LearnDoors";

/**
 * R4-R5C6 — LEARN SURFACE SINGLE FRONT DOOR.
 *
 * The learner's Learn surface had two plausible ways to "start learning": a large history card
 * whose body read *"Open required training or continue where you left off"*, rendered ABOVE the
 * Required Learning section that actually offers that work. This pins the repair: current work
 * leads, and the history entry describes the destination it truly opens.
 */

const ROOMS = join(process.cwd(), "src/components/foundry/event-rooms");
const read = (f: string) => readFileSync(join(ROOMS, f), "utf8");
/** Assertions target real code. These files' comments QUOTE the old copy on purpose. */
const code = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderRooms(eventsResponse: { ok: boolean; status: number; body: unknown }) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/bty/foundry/events") {
      return { ok: eventsResponse.ok, status: eventsResponse.status, json: async () => eventsResponse.body };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, assignments: [], drafts: [] }) };
  }));
  render(<FoundryEventRooms locale="en" onOpenEvent={vi.fn()} />);
}

describe("T1 — the learner sees current work first", () => {
  it("the fallback lists required learning before learning history", async () => {
    renderRooms({ ok: false, status: 403, body: { error: "foundry_author_required" } });
    const required = await screen.findByTestId("foundry-required-learning");
    expect(required.compareDocumentPosition(screen.getByTestId("learn-doors")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId("training-creation")).toBeNull();
  });

  it("a self-owned training author sees required learning first and can open Quick training", async () => {
    renderRooms({ ok: true, status: 200, body: { events: [], canManageOrganization: false } });
    const required = await screen.findByTestId("foundry-required-learning");
    const training = screen.getByTestId("training-creation");
    expect(required.compareDocumentPosition(training) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByTestId("door-quick-training"));
    expect(screen.getByRole("heading", { name: "Quick training" })).toBeTruthy();
  });

  it("T8 — the Host list keeps authoring above Required Learning", async () => {
    renderRooms({ ok: true, status: 200, body: { events: [], canManageOrganization: true } });
    const required = await screen.findByTestId("foundry-required-learning");
    expect(required.compareDocumentPosition(screen.getByTestId("training-creation")) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it("T8b — training and live events retain separate controls", () => {
    const d = code(read("LearnDoors.tsx"));
    for (const t of ["door-create-training", "door-open-event"]) expect(d).toContain(t);
    // The legacy QR "My events" door was retired from the UI in IA simplification V1.
    expect(d).not.toContain("door-my-events");
    expect(d).toContain("{canCreate ? (");
    // Create training keeps its distinct emphasis; only the history door was made secondary.
    expect(d).toContain('text-lg font-semibold text-[#E5B769]">{t.createTitle}');
  });
});

describe("T2/T3 — the history door describes its own destination", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("EN copy is truthful and carries no current-work promise", () => {
    render(<LearnDoors locale="en" canCreate={false} onOpenLearning={() => {}} onCreate={() => {}} />);
    const door = screen.getByTestId("door-my-learning");
    expect(door.textContent).toContain("Learning history");
    expect(door.textContent).toContain("See what you've completed and learned.");
    expect(door.textContent).toContain("View history");
  });

  it("KO copy makes the same distinction", () => {
    render(<LearnDoors locale="ko" canCreate={false} onOpenLearning={() => {}} onCreate={() => {}} />);
    const door = screen.getByTestId("door-my-learning");
    expect(door.textContent).toContain("학습 기록");
    // Retargeted by the KO native-copy pass: the door still describes its own destination
    // (finished learning), in Korean that was written rather than translated.
    expect(door.textContent).toContain("지금까지 마친 학습을 다시 보세요.");
    expect(door.textContent).toContain("기록 보기");
  });

  it("a learner sees exactly ONE door, and it is the history one", () => {
    render(<LearnDoors locale="en" canCreate={false} onOpenLearning={() => {}} onCreate={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByTestId("door-create-training")).toBeNull();
  });
});

describe("T4 — the promise is not duplicated", () => {
  it("no current-work language survives anywhere in the history door's copy", () => {
    const d = code(read("LearnDoors.tsx"));
    const strings = [...d.matchAll(/learn(?:Title|Body|Cta): "((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1] ?? "");
    expect(strings.length, "en + ko × 3 keys").toBe(6);
    const forbidden = /required|continue|start|assigned|배정|이어서|시작|필수/i;
    expect(strings.filter((v) => forbidden.test(v))).toEqual([]);
  });

  it("…and the words that DO belong to current work still live in Required Learning", () => {
    const r = code(read("FoundryRequiredLearning.tsx"));
    expect(r).toContain('requiredHeader: "Required learning"');
    expect(r).toContain('startCta: "Start learning"');
    expect(r).toContain('continueCta: "Continue learning"');
  });
});

describe("T5 — the destination did not move", () => {
  it("the door still fires the shell's single My-Learning authority", () => {
    const onOpenLearning = vi.fn();
    render(<LearnDoors locale="en" canCreate={false} onOpenLearning={onOpenLearning} onCreate={() => {}} />);
    screen.getByTestId("door-my-learning").click();
    expect(onOpenLearning).toHaveBeenCalledTimes(1);
  });

  it("FoundryEventRooms still passes that same callback through, unrenamed", () => {
    const c = code(read("FoundryEventRooms.tsx"));
    expect(c).toContain("const openLearning = onOpenMyLearning;");
    expect(c).toContain("onOpenLearning={openLearning}");
  });

  it("the destination is history — it reads the history API and labels completions", () => {
    const m = code(read("FoundryMyLearning.tsx"));
    expect(m).toContain('"/api/bty/foundry/history"');
    expect(m).toContain('empty: "No completed trainings yet."');
  });
});

describe("T6/T7/T10 — nothing else moved", () => {
  const r = code(read("FoundryRequiredLearning.tsx"));

  it("T6 — assigned / in_progress / completed behaviour is untouched", () => {
    expect(r).toContain('a.status === "in_progress" ? t.continueCta : t.startCta');
    expect(r).toContain('assignments.filter((a) => a.status === "assigned" || a.status === "in_progress")');
    expect(r).toContain("completed-disclosure");
  });

  it("T7 — the C1 assignment focus target is intact", () => {
    expect(r).toContain("focusAssignmentId");
    expect(r).toContain("onFocusConsumed");
    expect(r).toContain('data-testid="required-card"');
    const c = code(read("FoundryEventRooms.tsx"));
    expect(c).toContain("focusAssignmentId={focusAssignmentId}");
    expect(c).toContain('<div id="learn-required">');
  });

  it("T9 — learning history stays reachable when required learning is empty", async () => {
    renderRooms({ ok: false, status: 403, body: { error: "foundry_author_required" } });
    expect((await screen.findByTestId("required-empty")).textContent).toContain("Nothing required right now");
    expect(screen.getByTestId("door-my-learning")).toBeTruthy();
  });

  it("T10 — this slice changed no route, query parameter, API or data path", () => {
    for (const f of ["LearnDoors.tsx", "FoundryEventRooms.tsx"]) {
      const c = code(read(f));
      expect(c, f).not.toMatch(/supabase|migration|\.rpc\(/);
    }
    // The door remains a callback, never a route link.
    expect(code(read("LearnDoors.tsx"))).not.toMatch(/href=|<a\s/);
  });
});

describe("T8c — visual hierarchy uses the existing scale", () => {
  it("the history title matches the assigned card's own scale, and its CTA is not a filled button", () => {
    const d = code(read("LearnDoors.tsx"));
    expect(d).toContain('text-[0.98rem] font-medium text-white/90">{t.learnTitle}');
    expect(d).toContain('text-sm font-semibold text-[#C9A66B]">{t.learnCta}'); // gold TEXT
    expect(d).not.toMatch(/bg-\[#C9A66B\][^"]*>\{t\.learnCta\}/); // never a filled primary
    // The current-work CTA keeps the filled primary treatment.
    expect(code(read("FoundryRequiredLearning.tsx"))).toContain("bg-[#C9A66B] px-4 py-2 text-sm font-semibold text-[#0B1F3A]");
  });
});
