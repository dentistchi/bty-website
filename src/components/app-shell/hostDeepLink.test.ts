import { describe, it, expect } from "vitest";
import { parseHostDeepLink } from "./hostDeepLink";

/**
 * Host Leadership Attention deep-link parsing (Slice 3.1B-3L, required tests 37–43 parse layer).
 * A well-formed link parses to the exact {eventId, section, focusId}; any malformed/foreign/partial
 * link parses to null (fails safely — no disclosure, no dead-end). Existing app-shell params (?tab,
 * ?review, ?followup, ?entry, ?view) are untouched by this helper.
 */

const EVENT = "4dc5f309-1111-4222-8333-444444444444";
const FOCUS = "9ab0c1d2-5555-4666-8777-888888888888";

describe("parseHostDeepLink", () => {
  it("(37) parses a followups deep link (no origin → returnTab null)", () => {
    expect(parseHostDeepLink(`?tab=foundry&event=${EVENT}&section=followups&focus=${FOCUS}`)).toEqual({
      eventId: EVENT,
      section: "followups",
      focusId: FOCUS,
      returnTab: null,
    });
  });

  it("(38) parses a shared-understanding deep link (no origin → returnTab null)", () => {
    expect(
      parseHostDeepLink(`?tab=foundry&event=${EVENT}&section=shared-understanding&focus=${FOCUS}`),
    ).toEqual({ eventId: EVENT, section: "shared-understanding", focusId: FOCUS, returnTab: null });
  });

  it("(3.2G-R1) parses a Today-origin (from=today) into returnTab 'today', target unchanged", () => {
    expect(
      parseHostDeepLink(`?tab=foundry&event=${EVENT}&section=followups&focus=${FOCUS}&from=today`),
    ).toEqual({ eventId: EVENT, section: "followups", focusId: FOCUS, returnTab: "today" });
  });

  it("(3.2G-R1 security) an unknown/hostile from value falls back to null (no arbitrary nav, no open redirect)", () => {
    for (const bad of ["learn", "practice", "me", "https://evil.example.com", "//evil.com", "javascript:alert(1)", "", "TODAY"]) {
      const r = parseHostDeepLink(`?tab=foundry&event=${EVENT}&section=followups&focus=${FOCUS}&from=${encodeURIComponent(bad)}`);
      expect(r).not.toBeNull();
      expect(r!.returnTab).toBeNull(); // canonical target still resolves; only the origin is dropped
      expect(r!.eventId).toBe(EVENT);
    }
  });

  it("(40) an invalid/short event id fails safely to null", () => {
    expect(parseHostDeepLink(`?tab=foundry&event=nope&section=followups&focus=${FOCUS}`)).toBeNull();
  });

  it("rejects an unknown section", () => {
    expect(parseHostDeepLink(`?tab=foundry&event=${EVENT}&section=roster&focus=${FOCUS}`)).toBeNull();
  });

  it("rejects a missing focus id", () => {
    expect(parseHostDeepLink(`?tab=foundry&event=${EVENT}&section=followups`)).toBeNull();
  });

  it("requires tab=foundry (a bare event/section on another tab is not a host link)", () => {
    expect(parseHostDeepLink(`?tab=center&event=${EVENT}&section=followups&focus=${FOCUS}`)).toBeNull();
  });

  it("(43) does not treat the learner ?followup= link or a plain ?tab=foundry as a host link", () => {
    expect(parseHostDeepLink(`?tab=foundry&followup=${FOCUS}`)).toBeNull();
    expect(parseHostDeepLink(`?tab=foundry`)).toBeNull();
  });
});
