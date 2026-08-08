import { describe, it, expect } from "vitest";
import { parseDraftDeepLink } from "./hostDeepLink";
import { computeInitialFoundryView } from "@/components/foundry/event-rooms/FoundryEventRooms";

const DRAFT = "093b0361-7cc8-4688-9f93-396d60582501";

/**
 * SLICE 3.2L-R11.4E — a draft has a stable address, like an event already did.
 */
describe("[3.2L-R11.4E] draft review deep link", () => {
  it("parses the canonical review link", () => {
    expect(parseDraftDeepLink(`?tab=foundry&draft=${DRAFT}&view=review`)).toEqual({ draftId: DRAFT, view: "review" });
  });

  it("without view=review it opens where the Host left off", () => {
    expect(parseDraftDeepLink(`?tab=foundry&draft=${DRAFT}`)).toEqual({ draftId: DRAFT, view: null });
    expect(parseDraftDeepLink(`?tab=foundry&draft=${DRAFT}&view=something-else`)).toEqual({ draftId: DRAFT, view: null });
  });

  it("a malformed or foreign link opens nothing — no partial state, no dead end", () => {
    for (const q of ["", "?tab=today&draft=" + DRAFT, "?tab=foundry", "?tab=foundry&draft=", "?tab=foundry&draft=abc", "?draft=" + DRAFT]) {
      expect(parseDraftDeepLink(q), q).toBeNull();
    }
  });

  it("it is reload-safe and bookmarkable: the same string always parses the same", () => {
    const q = `?tab=foundry&draft=${DRAFT}&view=review`;
    expect(parseDraftDeepLink(q)).toEqual(parseDraftDeepLink(q));
  });

  it("the FIRST committed view is the Builder on that draft — no Learn-home flash", () => {
    expect(computeInitialFoundryView(null, null, null, null, DRAFT, "review")).toEqual({
      kind: "builder", draftId: DRAFT, initialView: "review",
    });
    expect(computeInitialFoundryView(null, null, null, null, DRAFT, null)).toEqual({
      kind: "builder", draftId: DRAFT, initialView: undefined,
    });
  });

  it("no draft target still returns the existing home, and an event target still wins its room", () => {
    expect(computeInitialFoundryView(null, null, null, null, null, null).kind).toBe("home");
    expect(computeInitialFoundryView("ev-1111111111111111", "followups", "f-1111111111111111", null).kind).toBe("control");
  });

  it("authorization is not in the URL — it carries an id and nothing else", () => {
    const link = parseDraftDeepLink(`?tab=foundry&draft=${DRAFT}&view=review`)!;
    expect(Object.keys(link).sort()).toEqual(["draftId", "view"]);
    expect(JSON.stringify(link)).not.toMatch(/token|key|role|auth/i);
  });
});
