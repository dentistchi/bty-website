/**
 * TODAY REMAINING REMINDER — native iPhone adapter for the one local notification.
 *
 * Reached ONLY through the runtime-injected `window.Capacitor.Plugins` bridge (this web code carries
 * no `@capacitor/*` dependency, matching `isNative.ts` / `keepAwake.ts`). Everywhere else — a plain
 * browser, the Teams tab, an older native build without the plugin — `reminderBridge()` is null and
 * NOTHING below touches a plugin: no permission prompt, no schedule, no cancel.
 *
 * WHAT IT DOES NOT DECIDE. Whether anything is waiting is `selectTodayOpenWork` (the predicate Today
 * renders from); when and what to show is `todayRemainingReminder` in the domain. This file only
 * carries those answers across the bridge, one at a time.
 *
 * SERIALIZED. A Today load and a foreground resume can both reconcile at once; every reconcile runs
 * after the previous one settles, so a cancel can never land between another call's cancel and
 * schedule. With a fixed identifier that means at most ONE pending reminder, ever.
 *
 * LISTENERS ARE PER DOCUMENT, NOT PER MOUNT. They are registered once and kept on `window`, so a
 * re-render, a remount, an auth transition or an HMR module re-evaluation can never add a second
 * tap handler. What changes between mounts (locale, the resume action) lives in a mutable context
 * the listeners read at fire time.
 */
import { isNative } from "@/lib/native/isNative";
import { BTY_SHELL_DESTINATION_EVENT } from "@/domain/teams/btyDestination";
import {
  TODAY_REMAINING_REMINDER_ID,
  buildRemainingReminderNotification,
  reminderLocale,
  todayRemainingReminderRoute,
  type ReminderLocale,
} from "@/domain/daily/todayRemainingReminder";

type PermissionState = { display?: string };
type ListenerHandle = { remove?: () => unknown };

/** The subset of `@capacitor/local-notifications` 8.x this feature calls. */
export type LocalNotificationsBridge = {
  checkPermissions: () => Promise<PermissionState>;
  requestPermissions: () => Promise<PermissionState>;
  schedule: (options: { notifications: unknown[] }) => Promise<unknown>;
  cancel: (options: { notifications: { id: number }[] }) => Promise<unknown>;
  addListener: (
    eventName: "localNotificationActionPerformed",
    listener: (event: { notification?: { id?: unknown; extra?: { locale?: unknown } | null } }) => void,
  ) => Promise<ListenerHandle> | ListenerHandle;
};

type AppStateBridge = {
  addListener: (
    eventName: "appStateChange",
    listener: (state: { isActive?: boolean }) => void,
  ) => Promise<ListenerHandle> | ListenerHandle;
};

type Plugins = { LocalNotifications?: LocalNotificationsBridge; App?: AppStateBridge };

/**
 * The plugin, only on the BTY iPhone app. Requires the canonical native detector AND the injected
 * bridge reporting iOS AND the plugin actually registered — a UA token alone never reaches a plugin.
 */
export function reminderBridge(): { notifications: LocalNotificationsBridge; app: AppStateBridge | null } | null {
  if (typeof window === "undefined" || !isNative()) return null;
  const cap = window.Capacitor;
  if (cap?.isNativePlatform?.() !== true || cap.getPlatform?.() !== "ios") return null;
  const plugins = (cap.Plugins ?? {}) as unknown as Plugins;
  const notifications = plugins.LocalNotifications;
  if (!notifications || typeof notifications.schedule !== "function") return null;
  return { notifications, app: plugins.App ?? null };
}

type ReminderContext = { token: symbol; locale: ReminderLocale; onResume: () => void };

type ReminderState = {
  chain: Promise<unknown>;
  listenersInstalled: boolean;
  /** Set once a permission request has been made in this document. iOS itself never re-prompts. */
  requested: boolean;
  context: ReminderContext | null;
};

const STATE_KEY = "__btyTodayRemainingReminder__";

function state(): ReminderState {
  const w = window as unknown as Record<string, ReminderState | undefined>;
  if (!w[STATE_KEY]) {
    w[STATE_KEY] = { chain: Promise.resolve(), listenersInstalled: false, requested: false, context: null };
  }
  return w[STATE_KEY]!;
}

export type ReminderOutcome = "not_native" | "cancelled" | "scheduled" | "denied" | "failed";

async function reconcile(
  bridge: LocalNotificationsBridge,
  openCount: number,
  locale: ReminderLocale,
  now: Date,
): Promise<ReminderOutcome> {
  const ours = { notifications: [{ id: TODAY_REMAINING_REMINDER_ID }] };
  if (!(openCount > 0)) {
    await bridge.cancel(ours);
    return "cancelled";
  }
  let permission = (await bridge.checkPermissions())?.display;
  if (permission === "prompt" || permission === "prompt-with-rationale") {
    const s = state();
    if (s.requested) return "denied";
    s.requested = true;
    permission = (await bridge.requestPermissions())?.display;
  }
  if (permission !== "granted") return "denied";
  // Replace, never add: iOS keys pending requests by identifier, and cancelling first also clears a
  // reminder left from an earlier day before the new instant is set.
  await bridge.cancel(ours);
  await bridge.schedule({ notifications: [buildRemainingReminderNotification(locale, now)] });
  return "scheduled";
}

/**
 * Bring the pending reminder in line with what Today shows. `openCount` MUST come from a brief read
 * that succeeded — an unknown Today is not an empty one, so callers do not call this on failure.
 */
export function syncTodayRemainingReminder(input: {
  openCount: number;
  locale: string;
  now?: () => Date;
}): Promise<ReminderOutcome> {
  const bridge = reminderBridge();
  if (!bridge) return Promise.resolve("not_native");
  const s = state();
  const locale = reminderLocale(input.locale);
  const run = s.chain.then(() =>
    reconcile(bridge.notifications, input.openCount, locale, (input.now ?? (() => new Date()))()).catch(
      (e: unknown) => {
        console.warn("[today-reminder] reconcile failed:", e instanceof Error ? e.message : e);
        return "failed" as const;
      },
    ),
  );
  s.chain = run;
  return run;
}

/**
 * Open Today from a tapped reminder, in THIS WebView. When the shell for that locale is already
 * mounted, the destination goes through the shell's own interpreter (no document reload);
 * otherwise a same-origin navigation, which the native shell keeps inside the WebView.
 */
export function openTodayFromReminder(
  rawLocale: unknown,
  navigate: (url: string) => void = (url) => window.location.assign(url),
): void {
  const s = state();
  const locale = reminderLocale(rawLocale ?? s.context?.locale);
  const route = todayRemainingReminderRoute(locale);
  const shellPath = `/${locale}/app`;
  if (s.context && window.location.pathname === shellPath) {
    try {
      window.history.replaceState({}, "", route);
      window.dispatchEvent(new Event(BTY_SHELL_DESTINATION_EVENT));
      return;
    } catch {
      /* fall through to a navigation */
    }
  }
  navigate(route);
}

async function installListeners(bridge: NonNullable<ReturnType<typeof reminderBridge>>): Promise<void> {
  const s = state();
  if (s.listenersInstalled) return;
  s.listenersInstalled = true;
  try {
    await bridge.notifications.addListener("localNotificationActionPerformed", (event) => {
      if (Number(event?.notification?.id) !== TODAY_REMAINING_REMINDER_ID) return;
      openTodayFromReminder(event.notification?.extra?.locale);
    });
  } catch (e) {
    console.warn("[today-reminder] tap listener unavailable:", e instanceof Error ? e.message : e);
  }
  try {
    await bridge.app?.addListener("appStateChange", (appState) => {
      if (appState?.isActive) state().context?.onResume();
    });
  } catch (e) {
    console.warn("[today-reminder] resume listener unavailable:", e instanceof Error ? e.message : e);
  }
}

/**
 * Bind the mounted shell to the reminder: installs the per-document listeners (once) and records
 * what a foreground resume should do. Returns an unbind for unmount. A no-op off the iPhone app.
 */
export function bindTodayRemainingReminder(input: { locale: string; onResume: () => void }): () => void {
  const bridge = reminderBridge();
  if (!bridge) return () => {};
  const s = state();
  const token = Symbol("today-reminder-binding");
  s.context = { token, locale: reminderLocale(input.locale), onResume: input.onResume };
  void installListeners(bridge);
  return () => {
    if (state().context?.token === token) state().context = null;
  };
}
