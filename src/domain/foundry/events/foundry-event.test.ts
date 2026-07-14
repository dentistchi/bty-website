import { describe, it, expect } from "vitest";
import {
  validateEventTitle,
  validateDisplayName,
  canCloseEvent,
  nextJoinVersion,
  isJoinVersionCurrent,
  canAcceptNewJoin,
  FOUNDRY_TITLE_MAX,
  FOUNDRY_DISPLAY_NAME_MAX,
} from "./foundry-event";

const NUL = String.fromCharCode(0x00);
const LINE_SEP = String.fromCharCode(0x2028);

describe("validateEventTitle", () => {
  it("trims and accepts a normal title", () => {
    const r = validateEventTitle("  July Manager Meeting  ");
    expect(r).toEqual({ ok: true, value: "July Manager Meeting" });
  });

  it("rejects a non-string", () => {
    expect(validateEventTitle(42)).toEqual({ ok: false, reason: "title_required" });
    expect(validateEventTitle(null)).toEqual({ ok: false, reason: "title_required" });
    expect(validateEventTitle(undefined)).toEqual({ ok: false, reason: "title_required" });
  });

  it("rejects empty / whitespace-only", () => {
    expect(validateEventTitle("")).toEqual({ ok: false, reason: "title_required" });
    expect(validateEventTitle("     ")).toEqual({ ok: false, reason: "title_required" });
  });

  it("rejects a string that is only control characters", () => {
    const controlOnly = String.fromCharCode(0x00, 0x1f, 0x7f, 0x9f);
    expect(validateEventTitle(controlOnly)).toEqual({ ok: false, reason: "title_required" });
  });

  it("strips control chars but keeps the visible text", () => {
    const withControl = "July" + NUL + " Meeting";
    const r = validateEventTitle(withControl);
    expect(r).toEqual({ ok: true, value: "July Meeting" });
  });

  it("enforces the 80-char max (post-trim)", () => {
    const long = "a".repeat(FOUNDRY_TITLE_MAX + 1);
    expect(validateEventTitle(long)).toEqual({ ok: false, reason: "title_too_long" });
    const exact = "a".repeat(FOUNDRY_TITLE_MAX);
    expect(validateEventTitle(exact)).toEqual({ ok: true, value: exact });
  });

  it("keeps HTML-looking text as literal (no encoding — React escapes on render)", () => {
    const r = validateEventTitle("<script>alert(1)</script>");
    expect(r).toEqual({ ok: true, value: "<script>alert(1)</script>" });
  });
});

describe("validateDisplayName", () => {
  it("trims and accepts a normal name", () => {
    expect(validateDisplayName("  Sarah ")).toEqual({ ok: true, value: "Sarah" });
  });

  it("rejects empty", () => {
    expect(validateDisplayName("")).toEqual({ ok: false, reason: "name_required" });
    expect(validateDisplayName("   ")).toEqual({ ok: false, reason: "name_required" });
  });

  it("rejects a non-string", () => {
    expect(validateDisplayName(123)).toEqual({ ok: false, reason: "name_required" });
  });

  it("enforces the 60-char max", () => {
    const long = "n".repeat(FOUNDRY_DISPLAY_NAME_MAX + 1);
    expect(validateDisplayName(long)).toEqual({ ok: false, reason: "name_too_long" });
  });

  it("strips line/paragraph separators", () => {
    const withSep = "Sa" + LINE_SEP + "rah";
    expect(validateDisplayName(withSep)).toEqual({ ok: true, value: "Sarah" });
  });
});

describe("canCloseEvent", () => {
  it("closes an open event (state change)", () => {
    expect(canCloseEvent("open")).toEqual({ allowed: true, noop: false });
  });

  it("is an idempotent no-op on an already-closed event", () => {
    expect(canCloseEvent("closed")).toEqual({ allowed: true, noop: true });
  });
});

describe("nextJoinVersion", () => {
  it("increments a valid version", () => {
    expect(nextJoinVersion(1)).toBe(2);
    expect(nextJoinVersion(9)).toBe(10);
  });

  it("normalizes bad input to 1", () => {
    expect(nextJoinVersion(0)).toBe(1);
    expect(nextJoinVersion(-3)).toBe(1);
    expect(nextJoinVersion(1.5)).toBe(1);
    expect(nextJoinVersion(NaN)).toBe(1);
  });
});

describe("isJoinVersionCurrent", () => {
  it("matches equal integer versions", () => {
    expect(isJoinVersionCurrent(3, 3)).toBe(true);
  });

  it("rejects a stale (rotated) version", () => {
    expect(isJoinVersionCurrent(2, 3)).toBe(false);
  });

  it("rejects non-integer token versions", () => {
    expect(isJoinVersionCurrent(1.2, 1)).toBe(false);
  });
});

describe("canAcceptNewJoin", () => {
  it("accepts joins only while open", () => {
    expect(canAcceptNewJoin("open")).toBe(true);
    expect(canAcceptNewJoin("closed")).toBe(false);
  });
});
