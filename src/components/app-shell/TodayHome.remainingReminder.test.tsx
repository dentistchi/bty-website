/** @vitest-environment jsdom */
/**
 * TODAY REMAINING REMINDER — the real TodayHome decides the reminder from the SAME brief answer it
 * renders, only on the web shell, and only after the brief read succeeded.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TodayHome from "./TodayHome";
import { TODAY_REMAINING_REMINDER_ID } from "@/domain/daily/todayRemainingReminder";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (window as unknown as Record<string, unknown>).Capacitor;
  delete (window as unknown as Record<string, unknown>).__btyTodayRemainingReminder__;
});

const REQUIRED = {
  stableId: "req:a1",
  category: "REQUIRED_LEARNING",
  title: "Handling an angry customer",
  state: "incomplete_required",
  canonicalDeepLink: "/en/app?tab=foundry",
};

function stubBrief(brief: unknown | "fail") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).startsWith("/api/me/today/brief")) {
        if (brief === "fail") return new Response("{}", { status: 500 });
        return new Response(JSON.stringify(brief), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }),
  );
}

function nativeBridge() {
  const LocalNotifications = {
    checkPermissions: vi.fn(async () => ({ display: "granted" })),
    requestPermissions: vi.fn(async () => ({ display: "granted" })),
    schedule: vi.fn(async () => ({})),
    cancel: vi.fn(async () => {}),
    addListener: vi.fn(async () => ({ remove: () => {} })),
  };
  (window as unknown as { Capacitor: unknown }).Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => "ios",
    Plugins: { LocalNotifications, App: { addListener: vi.fn(async () => ({ remove: () => {} })) } },
  };
  const total = () =>
    Object.values(LocalNotifications).reduce((n, fn) => n + (fn as ReturnType<typeof vi.fn>).mock.calls.length, 0);
  return { LocalNotifications, total };
}

describe("TodayHome → remaining reminder", () => {
  it("web shell on the iPhone app + an open item that Today renders → schedules the one reminder", async () => {
    const b = nativeBridge();
    stubBrief({ ok: true, reminders: [REQUIRED], hostAttention: [] });
    render(<TodayHome locale="en" nativeReminder onNavigate={() => {}} />);
    expect(await screen.findByText("Handling an angry customer")).toBeTruthy();
    await waitFor(() => expect(b.LocalNotifications.schedule).toHaveBeenCalledTimes(1));
    const arg = b.LocalNotifications.schedule.mock.calls[0] as unknown as [{ notifications: { id: number; body: string }[] }];
    expect(arg[0].notifications[0].id).toBe(TODAY_REMAINING_REMINDER_ID);
    expect(JSON.stringify(arg[0])).not.toContain("Handling an angry customer");
  });

  it("an empty Today → cancels the fixed id, schedules nothing", async () => {
    const b = nativeBridge();
    stubBrief({ ok: true, reminders: [], hostAttention: [] });
    render(<TodayHome locale="en" nativeReminder onNavigate={() => {}} />);
    await screen.findByTestId("today-empty");
    await waitFor(() =>
      expect(b.LocalNotifications.cancel).toHaveBeenCalledWith({ notifications: [{ id: TODAY_REMAINING_REMINDER_ID }] }),
    );
    expect(b.LocalNotifications.schedule).not.toHaveBeenCalled();
  });

  it("Teams (nativeReminder not set) → ZERO plugin calls even with an open item and a bridge present", async () => {
    const b = nativeBridge();
    stubBrief({ ok: true, reminders: [REQUIRED], hostAttention: [] });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    await screen.findByText("Handling an angry customer");
    await new Promise((r) => setTimeout(r, 20));
    expect(b.total()).toBe(0);
  });

  it("a FAILED brief read decides nothing — no cancel, no schedule, no prompt", async () => {
    const b = nativeBridge();
    stubBrief("fail");
    render(<TodayHome locale="en" nativeReminder onNavigate={() => {}} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(b.total()).toBe(0);
  });

  it("a plain browser (no bridge) renders Today exactly as before", async () => {
    stubBrief({ ok: true, reminders: [REQUIRED], hostAttention: [] });
    render(<TodayHome locale="en" nativeReminder onNavigate={() => {}} />);
    expect(await screen.findByText("Handling an angry customer")).toBeTruthy();
  });
});

describe("shell wiring", () => {
  const src = readFileSync("src/components/app-shell/BtyDailyAppShell.tsx", "utf8");
  it("the reminder is enabled for the web runtime only — Teams passes runtime='teams'", () => {
    expect(src).toContain('nativeReminder={runtime === "web"}');
    expect(src).toContain('useTodayRemainingReminder(locale, runtime === "web")');
    expect(readFileSync("src/components/teams/TeamsTabShell.tsx", "utf8")).toContain('runtime="teams"');
  });
});


describe("announcement completion → Today and 08:00 reminder", () => {
  it.each(["acknowledgment", "response"])("%s remains after opening and leaves after the explicit required action", async trackingMode => {
    const b = nativeBridge();
    let completed = false;
    let opened = false;
    const item = { announcementId:"a",recipientId:"r",hostFraming:"Notice",sourceUrl:"https://teams.microsoft.com/x",trackingMode,
      openedAt:null,acknowledgedAt:null,responseSubmittedAt:null,response:null,respondedAt:null,unreadCount:0,messageCount:0 };
    vi.stubGlobal("fetch",vi.fn(async(url: string, init?: RequestInit) => {
      if (String(url).startsWith("/api/me/today/brief")) return new Response(JSON.stringify({ok:true,reminders:[],hostAttention:[]}));
      if (url === "/api/bty/announcements/mine") return new Response(JSON.stringify({ok:true,items:completed?[]:[{...item,openedAt:opened?"now":null}]}));
      if (String(url).endsWith("/evidence")) {
        const body = JSON.parse(init?.body as string);
        if (body.action === "open") opened = true;
        else completed = true;
        return new Response('{"ok":true}');
      }
      return new Response('{}');
    }));
    render(<TodayHome locale="en" nativeReminder />);
    await screen.findByTestId("announcement-evidence");
    await waitFor(()=>expect(b.LocalNotifications.schedule).toHaveBeenCalled());
    expect(screen.queryByTestId("today-empty")).toBeNull();
    fireEvent.click(screen.getByText("Open announcement"));
    await screen.findByText("Notice");
    expect(completed).toBe(false);
    if (trackingMode === "response") {
      fireEvent.change(screen.getByLabelText("Your response"),{target:{value:"Answer"}});
      fireEvent.click(screen.getByText("Submit response"));
    } else fireEvent.click(screen.getByText("I acknowledge"));
    await waitFor(()=>expect(screen.queryByTestId("announcement-evidence")).toBeNull());
    await screen.findByTestId("today-empty");
    await waitFor(()=>expect(b.LocalNotifications.cancel.mock.invocationCallOrder.at(-1)).toBeGreaterThan(b.LocalNotifications.schedule.mock.invocationCallOrder.at(-1)!));
  });
});
