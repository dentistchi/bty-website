/** @vitest-environment jsdom */
/**
 * TODAY PERSONAL GREETING — edges the main suite does not pin: the exact client-local daypart
 * boundaries, the SSR/hydration first paint, and that Today is the only surface that asks.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { cleanup, render, screen } from "@testing-library/react";
import { COPY, TodayGreeting, composeGreeting, greetingBand } from "@/components/app-shell/BtyDailyAppShell";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const en = COPY.en.today;
const doctor = { kind: "doctor", addressee: "Chi" } as const;

describe("client-local daypart boundaries", () => {
  it.each([
    [4, "Still awake, Dr. Chi?"],
    [5, "Good morning, Dr. Chi."],
    [11, "Good morning, Dr. Chi."],
    [12, "Good afternoon, Dr. Chi."],
    [16, "Good afternoon, Dr. Chi."],
    [17, "Good evening, Dr. Chi."],
    [22, "Good evening, Dr. Chi."],
    [23, "Still awake, Dr. Chi?"],
    [0, "Still awake, Dr. Chi?"],
  ])("%i:00 → %s", (hour, expected) => {
    expect(composeGreeting(en, hour, doctor)).toBe(expected);
  });

  it("every band boundary maps as specified", () => {
    expect([4, 5, 11, 12, 16, 17, 22, 23].map(greetingBand)).toEqual([
      "lateNight", "morning", "morning", "afternoon", "afternoon", "evening", "evening", "lateNight",
    ]);
  });

  it("the rendered surface uses the DEVICE clock at the boundary (22:59 evening, 23:00 still awake)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, address: doctor }) })));
    vi.setSystemTime(new Date(2026, 0, 1, 22, 59, 0));
    render(<TodayGreeting copy={en} ssrDefault={en.title} />);
    expect(await screen.findByText("Good evening, Dr. Chi.")).toBeTruthy();
    cleanup();
    vi.setSystemTime(new Date(2026, 0, 1, 23, 0, 0));
    render(<TodayGreeting copy={en} ssrDefault={en.title} />);
    expect(await screen.findByText("Still awake, Dr. Chi?")).toBeTruthy();
  });
});

describe("hydration", () => {
  it("the server render is the unnamed default and makes no request — nothing to mismatch", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const html = renderToString(<TodayGreeting copy={en} ssrDefault={en.title} />);
    expect(html).toContain(">Good morning.</h1>");
    expect(html).not.toMatch(/Dr\.|,\s*\./);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("the first client paint equals the server paint (hydrateRoot sees no difference)", async () => {
    const { hydrateRoot } = await import("react-dom/client");
    const html = renderToString(<TodayGreeting copy={en} ssrDefault={en.title} />);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    const recoverable = vi.fn();
    hydrateRoot(container, <TodayGreeting copy={en} ssrDefault={en.title} />, { onRecoverableError: recoverable });
    await new Promise((r) => setTimeout(r, 20));
    expect(recoverable).not.toHaveBeenCalled();
    expect(errors.mock.calls.flat().join(" ")).not.toMatch(/hydrat/i);
    container.remove();
  });
});

describe("Today is the only surface that personalizes", () => {
  it("/api/me/greeting has exactly one client caller, and TodayGreeting renders only on the Today tab", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && readFileSync(p, "utf8").includes("/api/me/greeting")) hits.push(p);
      }
    };
    walk("src/components");
    walk("src/app/[locale]");
    walk("src/lib");
    expect(hits).toEqual(["src/components/app-shell/BtyDailyAppShell.tsx"]);
    const src = readFileSync("src/components/app-shell/BtyDailyAppShell.tsx", "utf8");
    expect(src.match(/<TodayGreeting /g)).toHaveLength(1);
  });

  it("the Teams tab renders that same shell, so Teams Today gets the same greeting", () => {
    const teams = readFileSync("src/components/teams/TeamsTabShell.tsx", "utf8");
    expect(teams).toContain("<BtyDailyAppShell");
  });
});
