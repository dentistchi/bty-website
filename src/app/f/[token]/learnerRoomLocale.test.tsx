/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

/* The document room pulls in react-pdf, which needs a canvas this environment has no reason to
   provide. Stubbed exactly as the other document-room suites do. */
vi.mock("./PdfReader", () => ({ default: () => null }));
import { resolveRoomLocale, resolveRoomLocaleOnClient } from "./roomLocale";
import FoundryGuidanceClient from "./FoundryGuidanceClient";
import FoundryJoinClient from "./FoundryJoinClient";
import FoundryDocumentClient from "./FoundryDocumentClient";

/**
 * SLICE R4-R5C16A — THE ROOM SPEAKS THE LANGUAGE THE PERSON CHOSE.
 *
 * MEASURED ON A REAL LEARNER, mid-training. The app shell was Korean, every string the room
 * needed already had a Korean translation, and the room rendered English — because all three
 * clients each resolved locale from `navigator.language`, which on that iPhone is English.
 *
 * A device language is a guess about a person; `NEXT_LOCALE` is that person's answer. The answer
 * wins, and it is read on the server so the first paint is already right.
 */

const dir = join(process.cwd(), "src/app/f/[token]");
const src = (f: string) => readFileSync(join(dir, f), "utf8");
const ROOMS = ["FoundryJoinClient.tsx", "FoundryDocumentClient.tsx", "FoundryGuidanceClient.tsx"] as const;

const withNavigator = (lang: string) =>
  Object.defineProperty(window.navigator, "language", { value: lang, configurable: true });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("[R4-R5C16A · T1-T4] precedence: a chosen language beats the device", () => {
  it("T1 BTY=KO + device EN → KO (the exact real-device shape)", () => {
    expect(resolveRoomLocale("ko", "en-US")).toBe("ko");
  });

  it("T2 BTY=EN + device KO → EN", () => {
    expect(resolveRoomLocale("en", "ko-KR")).toBe("en");
  });

  it("T3 no preference + device KO → KO", () => {
    expect(resolveRoomLocale(null, "ko-KR")).toBe("ko");
    expect(resolveRoomLocale(undefined, "ko")).toBe("ko");
  });

  it("T4 no preference + device EN → EN, and an unrecognised value is not a preference", () => {
    expect(resolveRoomLocale(null, "en-GB")).toBe("en");
    expect(resolveRoomLocale("fr", "en-GB")).toBe("en");
    expect(resolveRoomLocale("", null)).toBe("en");
  });

  it("the client half reads the device only when nothing was chosen", () => {
    withNavigator("en-US");
    expect(resolveRoomLocaleOnClient("ko")).toBe("ko");
    expect(resolveRoomLocaleOnClient(null)).toBe("en");
    withNavigator("ko-KR");
    expect(resolveRoomLocaleOnClient("en")).toBe("en");
    expect(resolveRoomLocaleOnClient(null)).toBe("ko");
  });
});

describe("[R4-R5C16A · T5-T8] all three families ask the same question", () => {
  it("no room carries its own navigator-only resolver any more", () => {
    for (const f of ROOMS) {
      expect(src(f), f).not.toMatch(/function resolveLocale\(\)/);
      expect(src(f), f).toContain("resolveRoomLocale");
    }
  });

  it("T5-T8 each family takes the server's answer and seeds state with it", () => {
    for (const f of ROOMS) {
      expect(src(f), f).toContain("savedLocale");
      expect(src(f), f).toMatch(/useState<Locale>\(\(\) => resolveRoomLocale\(savedLocale, null\)\)/);
    }
  });

  it("the route resolves it server-side and hands it to all three", () => {
    const page = src("page.tsx");
    expect(page).toContain("LOCALE_COOKIE");
    expect(page).toContain("isSavedLocale");
    for (const c of ["FoundryDocumentClient", "FoundryGuidanceClient", "FoundryJoinClient"]) {
      expect(page, c).toMatch(new RegExp(`<${c}[^/]*savedLocale=\\{savedLocale\\}`));
    }
  });
});

describe("[R4-R5C16A · T9/T13] no English-then-Korean flash", () => {
  /** The device that produced the defect: app chose Korean, phone is English. */
  const REAL_DEVICE = { savedLocale: "ko" as const, navigator: "en-US" };

  it("T9/T13 the FIRST paint of the entry screen is already Korean", async () => {
    withNavigator(REAL_DEVICE.navigator);
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as never;
    render(<FoundryGuidanceClient token="t-1" contentType="live_discussion" savedLocale={REAL_DEVICE.savedLocale} />);
    /*
      Asserted on the very first synchronous render — before any effect could correct it — which
      is exactly what "no flash" means. The room is still loading its snapshot here, so this is
      the earliest thing a learner can possibly see.
    */
    expect(document.body.textContent ?? "").not.toMatch(/Name shown for this training|Continue to|Loading/i);
  });

  it("the initializer, not an effect, decides when a preference exists", () => {
    for (const f of ROOMS) {
      const body = src(f);
      const init = body.indexOf("resolveRoomLocale(savedLocale, null)");
      const effect = body.indexOf("resolveRoomLocaleOnClient(savedLocale)");
      expect(init, f).toBeGreaterThan(-1);
      expect(effect, f).toBeGreaterThan(init);
    }
  });
});

describe("[R4-R5C16A · T10-T12] the Korean the room already had is now selected", () => {
  it("T10 Journey headings exist in both languages and are chosen by locale", () => {
    const reading = src("JourneyReading.tsx");
    expect(reading).toContain('ko: "왜 중요한가"');
    expect(reading).toContain('ko: "기준"');
    expect(reading).toMatch(/locale === "ko" \? "ko" : "en"/);
  });

  it("T11/T12 the discussion, answer and completion copy have Korean for every English key", () => {
    const g = src("FoundryGuidanceClient.tsx");
    const en = g.slice(g.indexOf("  en: {"), g.indexOf("  ko: {"));
    const ko = g.slice(g.indexOf("  ko: {"));
    const keys = (s: string) => new Set(Array.from(s.matchAll(/^\s{4}(\w+):/gm), (m) => m[1]));
    const enKeys = keys(en);
    const koKeys = keys(ko);
    expect(enKeys.size).toBeGreaterThan(30);
    for (const k of enKeys) expect(koKeys.has(k), `ko is missing ${k}`).toBe(true);
  });
});

describe("[R4-R5C16A · T16] nothing was written to resolve a language", () => {
  it("T16 the resolver is pure, and the route only reads a cookie", () => {
    const resolver = src("roomLocale.ts");
    expect(resolver).not.toMatch(/fetch|cookies\(\)|document\.cookie\s*=/);
    const page = src("page.tsx");
    expect(page).not.toMatch(/cookies\(\)\.set|\.set\(/);
  });

  it("T15 the token, participant and content-type semantics are untouched", () => {
    const page = src("page.tsx");
    expect(page).toContain("resolveEventByToken");
    expect(page).toContain("readContentType");
    expect(page).toContain("isGuidanceContentType");
    expect(page).toContain("<FoundryUnsupportedRoom />");
  });
});

describe("[R4-R5C16A] the video and document rooms mount with the preference too", () => {
  it("both accept it without disturbing their own load", async () => {
    withNavigator("en-US");
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as never;
    render(<FoundryJoinClient token="t-1" savedLocale="ko" />);
    render(<FoundryDocumentClient token="t-2" savedLocale="ko" />);
    await waitFor(() => expect(screen.queryAllByText(/Name shown for this training/i).length).toBe(0));
  });
});
