/** @vitest-environment jsdom */
/**
 * TODAY REMAINING REMINDER — the native adapter, against a fake that behaves like
 * `@capacitor/local-notifications` 8.x on iOS: pending requests are keyed by identifier (a schedule
 * with an existing id REPLACES it), `cancel` removes only the ids it is given, and
 * `localNotificationActionPerformed` is delivered to every registered listener.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bindTodayRemainingReminder,
  openTodayFromReminder,
  reminderBridge,
  syncTodayRemainingReminder,
} from "@/lib/native/todayRemainingReminder";
import { TODAY_REMAINING_REMINDER_ID } from "@/domain/daily/todayRemainingReminder";
import { BTY_SHELL_DESTINATION_EVENT } from "@/domain/teams/btyDestination";

type Listener = (payload: unknown) => void;

function fakeBridge(opts: {
  permission?: string;
  afterRequest?: string;
  native?: boolean;
  platform?: string;
  withPlugin?: boolean;
} = {}) {
  let permission = opts.permission ?? "granted";
  const pending = new Map<string, { id: number; title: string; body: string; schedule: { at: Date }; extra: unknown }>();
  const listeners: Record<string, Listener[]> = {};
  const calls: string[] = [];
  const LocalNotifications = {
    checkPermissions: vi.fn(async () => {
      calls.push("checkPermissions");
      return { display: permission };
    }),
    requestPermissions: vi.fn(async () => {
      calls.push("requestPermissions");
      permission = opts.afterRequest ?? "granted";
      return { display: permission };
    }),
    schedule: vi.fn(async ({ notifications }: { notifications: { id: number }[] }) => {
      calls.push("schedule");
      for (const n of notifications) pending.set(String(n.id), n as never);
      return { notifications: notifications.map((n) => ({ id: n.id })) };
    }),
    cancel: vi.fn(async ({ notifications }: { notifications: { id: number }[] }) => {
      calls.push("cancel");
      for (const n of notifications) pending.delete(String(n.id));
    }),
    cancelAll: vi.fn(async () => {
      calls.push("cancelAll");
      pending.clear();
    }),
    addListener: vi.fn(async (event: string, cb: Listener) => {
      calls.push(`addListener:${event}`);
      (listeners[event] ??= []).push(cb);
      return { remove: () => {} };
    }),
  };
  const App = {
    addListener: vi.fn(async (event: string, cb: Listener) => {
      calls.push(`App.addListener:${event}`);
      (listeners[event] ??= []).push(cb);
      return { remove: () => {} };
    }),
  };
  (window as unknown as { Capacitor: unknown }).Capacitor = {
    isNativePlatform: () => opts.native ?? true,
    getPlatform: () => opts.platform ?? "ios",
    Plugins: opts.withPlugin === false ? { App } : { LocalNotifications, App },
  };
  const emit = (event: string, payload: unknown) => (listeners[event] ?? []).forEach((l) => l(payload));
  return { LocalNotifications, App, pending, calls, listeners, emit };
}

const at9 = () => new Date(2026, 8, 26, 9, 0, 0);
const at7 = () => new Date(2026, 8, 26, 7, 30, 0);

beforeEach(() => {
  window.history.replaceState({}, "", "/en/app");
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).Capacitor;
  delete (window as unknown as Record<string, unknown>).__btyTodayRemainingReminder__;
  vi.restoreAllMocks();
});

describe("never outside the BTY iPhone app", () => {
  it("plain browser (no bridge): not_native, and nothing to call", async () => {
    expect(reminderBridge()).toBeNull();
    expect(await syncTodayRemainingReminder({ openCount: 3, locale: "en" })).toBe("not_native");
    expect(bindTodayRemainingReminder({ locale: "en", onResume: () => {} })).toBeTypeOf("function");
  });

  it("a bridge that says NOT native → zero plugin calls, no permission prompt", async () => {
    const f = fakeBridge({ native: false, permission: "prompt" });
    expect(await syncTodayRemainingReminder({ openCount: 3, locale: "en" })).toBe("not_native");
    bindTodayRemainingReminder({ locale: "en", onResume: () => {} });
    await Promise.resolve();
    expect(f.calls).toEqual([]);
  });

  it("native Android / an older iOS build without the plugin → zero plugin calls", async () => {
    const android = fakeBridge({ platform: "android" });
    expect(await syncTodayRemainingReminder({ openCount: 1, locale: "en" })).toBe("not_native");
    expect(android.calls).toEqual([]);
    const old = fakeBridge({ withPlugin: false });
    expect(await syncTodayRemainingReminder({ openCount: 1, locale: "en" })).toBe("not_native");
    expect(old.calls).toEqual([]);
  });
});

describe("reconcile", () => {
  it("zero open items → cancels ONLY the fixed id (never cancelAll), no permission asked", async () => {
    const f = fakeBridge({ permission: "prompt" });
    f.pending.set("999", { id: 999 } as never); // someone else's notification
    expect(await syncTodayRemainingReminder({ openCount: 0, locale: "en" })).toBe("cancelled");
    expect(f.LocalNotifications.cancel).toHaveBeenCalledWith({ notifications: [{ id: TODAY_REMAINING_REMINDER_ID }] });
    expect(f.LocalNotifications.cancelAll).not.toHaveBeenCalled();
    expect(f.LocalNotifications.requestPermissions).not.toHaveBeenCalled();
    expect([...f.pending.keys()]).toEqual(["999"]);
  });

  it("open items after 08:00 → one-shot for TOMORROW 08:00", async () => {
    const f = fakeBridge();
    expect(await syncTodayRemainingReminder({ openCount: 2, locale: "en", now: at9 })).toBe("scheduled");
    const n = f.pending.get(String(TODAY_REMAINING_REMINDER_ID))!;
    expect(n.schedule.at).toEqual(new Date(2026, 8, 27, 8, 0, 0, 0));
    expect(n.schedule).not.toHaveProperty("every");
    expect(n.schedule).not.toHaveProperty("repeats");
  });

  it("open items before 08:00 → one-shot for TODAY 08:00", async () => {
    const f = fakeBridge();
    await syncTodayRemainingReminder({ openCount: 1, locale: "en", now: at7 });
    expect(f.pending.get(String(TODAY_REMAINING_REMINDER_ID))!.schedule.at).toEqual(new Date(2026, 8, 26, 8, 0, 0, 0));
  });

  it("first open item on a never-asked device → asks ONCE, then schedules", async () => {
    const f = fakeBridge({ permission: "prompt", afterRequest: "granted" });
    expect(await syncTodayRemainingReminder({ openCount: 1, locale: "en", now: at9 })).toBe("scheduled");
    expect(f.LocalNotifications.requestPermissions).toHaveBeenCalledTimes(1);
  });

  it("permission denied → no schedule, no throw, and never asked again", async () => {
    const f = fakeBridge({ permission: "prompt", afterRequest: "denied" });
    expect(await syncTodayRemainingReminder({ openCount: 1, locale: "en" })).toBe("denied");
    expect(await syncTodayRemainingReminder({ openCount: 1, locale: "en" })).toBe("denied");
    expect(f.LocalNotifications.requestPermissions).toHaveBeenCalledTimes(1);
    expect(f.LocalNotifications.schedule).not.toHaveBeenCalled();
    expect(f.pending.size).toBe(0);
  });

  it("already denied in Settings → silent: no prompt, no schedule", async () => {
    const f = fakeBridge({ permission: "denied" });
    expect(await syncTodayRemainingReminder({ openCount: 4, locale: "en" })).toBe("denied");
    expect(f.LocalNotifications.requestPermissions).not.toHaveBeenCalled();
    expect(f.LocalNotifications.schedule).not.toHaveBeenCalled();
  });

  it("a plugin that throws is contained: 'failed', never an exception to Today", async () => {
    const f = fakeBridge();
    f.LocalNotifications.schedule.mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(syncTodayRemainingReminder({ openCount: 1, locale: "en" })).resolves.toBe("failed");
    // the queue survives a failure
    await expect(syncTodayRemainingReminder({ openCount: 0, locale: "en" })).resolves.toBe("cancelled");
  });

  it("duplicate / concurrent refreshes → exactly ONE pending reminder", async () => {
    const f = fakeBridge();
    await Promise.all([
      syncTodayRemainingReminder({ openCount: 1, locale: "en", now: at9 }),
      syncTodayRemainingReminder({ openCount: 3, locale: "en", now: at9 }),
      syncTodayRemainingReminder({ openCount: 2, locale: "en", now: at9 }),
    ]);
    await syncTodayRemainingReminder({ openCount: 2, locale: "en", now: at9 });
    expect(f.pending.size).toBe(1);
  });

  it("item completion (open → 0) cancels the pending reminder", async () => {
    const f = fakeBridge();
    await syncTodayRemainingReminder({ openCount: 1, locale: "en", now: at9 });
    expect(f.pending.size).toBe(1);
    await syncTodayRemainingReminder({ openCount: 0, locale: "en", now: at9 });
    expect(f.pending.size).toBe(0);
  });

  it("serialization: a late 'open' then 'zero' ends cancelled, in call order", async () => {
    const f = fakeBridge();
    const a = syncTodayRemainingReminder({ openCount: 1, locale: "en", now: at9 });
    const b = syncTodayRemainingReminder({ openCount: 0, locale: "en", now: at9 });
    expect(await a).toBe("scheduled");
    expect(await b).toBe("cancelled");
    expect(f.pending.size).toBe(0);
  });

  it("KO locale → Korean body, locale carried; nothing sensitive in the payload", async () => {
    const f = fakeBridge();
    await syncTodayRemainingReminder({ openCount: 5, locale: "ko", now: at9 });
    const n = f.pending.get(String(TODAY_REMAINING_REMINDER_ID))!;
    expect(n.body).toBe("Today에 아직 남아 있는 항목이 있습니다.");
    expect(n.extra).toEqual({ kind: "today_remaining", locale: "ko" });
    expect(JSON.stringify(n)).not.toMatch(/"5"|patient|stableId|title":"(?!BTY)/);
  });
});

describe("listeners, resume and tap", () => {
  it("binding many times (re-render, remount, auth transition) registers each listener ONCE", async () => {
    const f = fakeBridge();
    for (let i = 0; i < 4; i++) {
      const unbind = bindTodayRemainingReminder({ locale: "en", onResume: () => {} });
      if (i % 2 === 0) unbind();
    }
    await Promise.resolve();
    await Promise.resolve();
    expect(f.calls.filter((c) => c === "addListener:localNotificationActionPerformed")).toHaveLength(1);
    expect(f.calls.filter((c) => c === "App.addListener:appStateChange")).toHaveLength(1);
  });

  it("foreground return calls the CURRENT binding's resync; background and unbound do nothing", async () => {
    const f = fakeBridge();
    const first = vi.fn();
    const second = vi.fn();
    const unbindFirst = bindTodayRemainingReminder({ locale: "en", onResume: first });
    unbindFirst();
    const unbindSecond = bindTodayRemainingReminder({ locale: "en", onResume: second });
    await Promise.resolve();
    f.emit("appStateChange", { isActive: false });
    f.emit("appStateChange", { isActive: true });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    unbindSecond();
    f.emit("appStateChange", { isActive: true });
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("tap with the shell mounted → in-shell Today via the shell's own destination event, no reload", async () => {
    const f = fakeBridge();
    const destination = vi.fn();
    window.addEventListener(BTY_SHELL_DESTINATION_EVENT, destination);
    bindTodayRemainingReminder({ locale: "en", onResume: () => {} });
    await Promise.resolve();
    f.emit("localNotificationActionPerformed", {
      actionId: "tap",
      notification: { id: TODAY_REMAINING_REMINDER_ID, extra: { kind: "today_remaining", locale: "en" } },
    });
    expect(window.location.pathname + window.location.search).toBe("/en/app?tab=today&src=notification&focus=remaining");
    expect(destination).toHaveBeenCalledTimes(1);
    window.removeEventListener(BTY_SHELL_DESTINATION_EVENT, destination);
  });

  it("a tap on some other notification id is ignored", async () => {
    const f = fakeBridge();
    const destination = vi.fn();
    window.addEventListener(BTY_SHELL_DESTINATION_EVENT, destination);
    bindTodayRemainingReminder({ locale: "en", onResume: () => {} });
    await Promise.resolve();
    f.emit("localNotificationActionPerformed", { notification: { id: 12345 } });
    expect(destination).not.toHaveBeenCalled();
    window.removeEventListener(BTY_SHELL_DESTINATION_EVENT, destination);
  });

  it("locale preserved: a KO reminder opens /ko Today — navigating when the /ko shell is not the page", () => {
    fakeBridge();
    bindTodayRemainingReminder({ locale: "en", onResume: () => {} }); // /en/app is mounted
    const navigate = vi.fn();
    openTodayFromReminder("ko", navigate);
    expect(navigate).toHaveBeenCalledWith("/ko/app?tab=today&src=notification&focus=remaining");
  });

  it("no shell mounted yet (cold launch door) → same-origin navigation to canonical Today", () => {
    fakeBridge();
    window.history.replaceState({}, "", "/start");
    const navigate = vi.fn();
    openTodayFromReminder("en", navigate);
    expect(navigate).toHaveBeenCalledWith("/en/app?tab=today&src=notification&focus=remaining");
    expect(navigate.mock.calls[0][0]).not.toMatch(/^https?:/);
  });
});
