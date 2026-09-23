/** @vitest-environment jsdom */
/**
 * TODAY PERSONAL GREETING — the greeting Today opens with, addressed to the person.
 *
 * Mounts the REAL `TodayGreeting` (the component the shell renders on Today — the wiring is
 * asserted below against the render site) so a passing test means the live surface personalizes,
 * not just a pure function.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import {
  COPY,
  TodayGreeting,
  composeGreeting,
  fetchGreetingAddress,
} from "@/components/app-shell/BtyDailyAppShell";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const en = COPY.en.today;
const ko = COPY.ko.today;

const stubGreetingFetch = (payload: unknown, ok = true) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith("/api/me/greeting")) {
        return { ok, json: async () => payload } as unknown as Response;
      }
      throw new Error(`unexpected fetch: ${String(input)}`);
    }),
  );

describe("composeGreeting — the addressee is the ONLY thing personalized", () => {
  it("doctor + family name → 'Good morning, Dr. Chi.'", () => {
    expect(composeGreeting(en, 9, { kind: "doctor", addressee: "Chi" })).toBe("Good morning, Dr. Chi.");
  });

  it("keeps the existing daypart behavior across all four bands", () => {
    const a = { kind: "doctor", addressee: "Chi" } as const;
    expect(composeGreeting(en, 14, a)).toBe("Good afternoon, Dr. Chi.");
    expect(composeGreeting(en, 20, a)).toBe("Good evening, Dr. Chi.");
    expect(composeGreeting(en, 2, a)).toBe("Still awake, Dr. Chi?");
  });

  it("non-doctor → the plain first/preferred name, with no honorific", () => {
    expect(composeGreeting(en, 9, { kind: "personal", addressee: "Hanna" })).toBe("Good morning, Hanna.");
    expect(composeGreeting(en, 9, { kind: "personal", addressee: "Sarah" })).toBe("Good morning, Sarah.");
  });

  it("generic / absent address → the EXISTING unnamed greeting, unchanged", () => {
    expect(composeGreeting(en, 9, null)).toBe("Good morning.");
    expect(composeGreeting(en, 9, { kind: "generic", addressee: null })).toBe("Good morning.");
    expect(composeGreeting(en, 2, null)).toBe("Still awake?");
  });

  it("KO keeps its own band copy and its own form of address", () => {
    expect(composeGreeting(ko, 9, { kind: "doctor", addressee: "Chi" })).toBe("Dr. Chi, 좋은 아침입니다.");
    expect(composeGreeting(ko, 20, { kind: "personal", addressee: "한빛" })).toBe("한빛님, 좋은 저녁입니다.");
    expect(composeGreeting(ko, 9, null)).toBe("좋은 아침입니다.");
  });

  it("never renders a dangling placeholder or a doubled honorific", () => {
    const out = composeGreeting(en, 9, { kind: "doctor", addressee: "Chi" });
    expect(out).not.toContain("{name}");
    expect(out).not.toContain("undefined");
    expect(out.match(/Dr\./g)?.length).toBe(1);
  });
});

describe("fetchGreetingAddress — an unusable answer is the unnamed greeting, never a guess", () => {
  it("reads a well-formed owner-scoped answer", async () => {
    stubGreetingFetch({ ok: true, address: { kind: "doctor", addressee: "Chi" } });
    expect(await fetchGreetingAddress()).toEqual({ kind: "doctor", addressee: "Chi" });
  });

  it("generic, unknown kind, empty addressee, ok:false and HTTP failure all → null", async () => {
    const cases: Array<[unknown, boolean]> = [
      [{ ok: true, address: { kind: "generic", addressee: null } }, true],
      [{ ok: true, address: { kind: "professor", addressee: "Chi" } }, true],
      [{ ok: true, address: { kind: "doctor", addressee: "   " } }, true],
      [{ ok: false, address: { kind: "doctor", addressee: "Chi" } }, true],
      [{ ok: true, address: { kind: "doctor", addressee: "Chi" } }, false],
    ];
    for (const [payload, ok] of cases) {
      stubGreetingFetch(payload, ok);
      expect(await fetchGreetingAddress()).toBeNull();
    }
  });

  it("a thrown fetch falls back silently", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await fetchGreetingAddress()).toBeNull();
  });
});

describe("TodayGreeting — the surface Today actually renders", () => {
  it("renders 'Good morning, Dr. Chi.' for a doctor at 09:00 local", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 0, 1, 9, 0, 0));
    stubGreetingFetch({ ok: true, address: { kind: "doctor", addressee: "Chi" } });
    render(<TodayGreeting copy={en} ssrDefault={en.title} />);
    expect(await screen.findByText("Good morning, Dr. Chi.")).toBeTruthy();
  });

  it("renders the first name for a non-doctor, in the resolved evening band", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 0, 1, 20, 0, 0));
    stubGreetingFetch({ ok: true, address: { kind: "personal", addressee: "Hanna" } });
    render(<TodayGreeting copy={en} ssrDefault={en.title} />);
    expect(await screen.findByText("Good evening, Hanna.")).toBeTruthy();
  });

  it("keeps the generic greeting when identity is unavailable", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 0, 1, 9, 0, 0));
    stubGreetingFetch({ ok: true, address: { kind: "generic", addressee: null } });
    render(<TodayGreeting copy={en} ssrDefault={en.title} />);
    expect(await screen.findByText("Good morning.")).toBeTruthy();
  });

  it("no job title reaches the screen, even when one rides along in the payload", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 0, 1, 9, 0, 0));
    stubGreetingFetch({
      ok: true,
      address: { kind: "doctor", addressee: "Chi", jobTitle: "Regional Clinical Director" },
    });
    const { container } = render(<TodayGreeting copy={en} ssrDefault={en.title} />);
    await screen.findByText("Good morning, Dr. Chi.");
    await waitFor(() => {
      expect(container.textContent ?? "").not.toMatch(/director|clinical|doctor|dentist/i);
    });
  });
});

describe("wiring", () => {
  it("Today renders THIS component with the locale's Today copy", () => {
    const src = readFileSync("src/components/app-shell/BtyDailyAppShell.tsx", "utf8");
    expect(src).toContain("<TodayGreeting copy={t.today} ssrDefault={t.today.title} />");
  });
});
