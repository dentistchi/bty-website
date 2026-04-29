/**
 * Maps system events to `user_notifications` rows + Realtime (`notifications_updated` broadcast + table changes).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ArenaEjectedPayload } from "@/engine/integration/arena-center-ejection";
import { onArenaEjected } from "@/engine/integration/arena-center-ejection";
import type { CertifiedLeaderGrantedFromElitePayload, EliteSpecNominatedPayload } from "@/engine/integration/elite-spec-flow";
import {
  onCertifiedLeaderGrantedFromEliteSpec,
  onEliteSpecNominated,
} from "@/engine/integration/elite-spec-flow";
import type { WeeklyReportReadyPayload } from "@/engine/integrity/weekly-air-report.service";
import { onWeeklyReportReady } from "@/engine/integrity/weekly-air-report.service";
import type { ResilienceMilestonePayload } from "@/engine/resilience/resilience-tracker.service";
import { onResilienceMilestone } from "@/engine/resilience/resilience-tracker.service";
import {
  NOTIFICATIONS_REALTIME_CHANNEL_PREFIX,
  NOTIFICATIONS_UPDATED_EVENT,
} from "@/lib/bty/notifications-realtime";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const NOTIFICATION_TYPES = [
  "certified_leader_granted",
  "elite_spec_nominated",
  "arena_ejected",
  "avatar_tier_upgraded",
  "resilience_milestone_reached",
  "weekly_report_ready",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title_ko: string;
  title_en: string;
  read_at: string | null;
  created_at: string;
};

const TITLES: Record<NotificationType, { ko: string; en: string }> = {
  certified_leader_granted: { ko: "Certified Leader 획득", en: "Certified Leader granted" },
  elite_spec_nominated: { ko: "Elite 후보 등록됨", en: "Elite Spec nomination received" },
  arena_ejected: { ko: "Arena 일시 중단", en: "Arena temporarily suspended" },
  avatar_tier_upgraded: { ko: "아바타 레벨 업", en: "Avatar tier up" },
  resilience_milestone_reached: { ko: "회복력 마일스톤 달성", en: "Resilience milestone reached" },
  weekly_report_ready: { ko: "주간 리포트 준비됨", en: "Weekly report ready" },
};

let listenersRegistered = false;

function resolveClient(supabase?: SupabaseClient): SupabaseClient | null {
  return supabase ?? getSupabaseAdmin();
}

function broadcastNotificationsUpdated(userId: string): void {
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const channelName = `${NOTIFICATIONS_REALTIME_CHANNEL_PREFIX}${userId}`;
  const ch = admin.channel(channelName);
  const done = () => {
    try {
      admin.removeChannel(ch);
    } catch {
      /* ignore */
    }
  };
  const t = setTimeout(done, 8000);
  ch.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    void ch
      .send({
        type: "broadcast",
        event: NOTIFICATIONS_UPDATED_EVENT,
        payload: { userId },
      })
      .finally(() => {
        clearTimeout(t);
        done();
      });
  });
}

/**
 * Insert a notification (service role). Triggers Realtime on `user_notifications` + badge broadcast.
 */
export async function insertNotificationForEvent(
  userId: string,
  type: NotificationType,
  supabase?: SupabaseClient,
): Promise<Notification | null> {
  const client = resolveClient(supabase);
  if (!client) {
    console.warn("[notification-router] no Supabase client; skip notification", type);
    return null;
  }

  const t = TITLES[type];
  const { data, error } = await client
    .from("user_notifications")
    .insert({
      user_id: userId,
      type,
      title_ko: t.ko,
      title_en: t.en,
    })
    .select("id, user_id, type, title_ko, title_en, read_at, created_at")
    .single();

  if (error) {
    console.warn("[notification-router] insert failed", error.message);
    return null;
  }

  broadcastNotificationsUpdated(userId);

  const row = data as Notification;
  return row;
}

/** Public hook for resilience milestones (call when domain emits a milestone). */
export function notifyResilienceMilestoneReached(
  userId: string,
  supabase?: SupabaseClient,
): Promise<Notification | null> {
  return insertNotificationForEvent(userId, "resilience_milestone_reached", supabase);
}

export async function getUnreadNotifications(
  userId: string,
  supabase?: SupabaseClient,
): Promise<Notification[]> {
  const client = resolveClient(supabase);
  if (!client) {
    throw new Error(
      "getUnreadNotifications: pass supabase from a route (getSupabaseServerClient) or use service role (SUPABASE_SERVICE_ROLE_KEY)",
    );
  }
  const { data, error } = await client
    .from("user_notifications")
    .select("id, user_id, type, title_ko, title_en, read_at, created_at")
    .eq("user_id", userId)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(`getUnreadNotifications: ${error.message}`);
  return (data ?? []) as Notification[];
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveClient(supabase);
  if (!client) {
    throw new Error(
      "markNotificationRead: pass supabase from a route (getSupabaseServerClient) or use service role (SUPABASE_SERVICE_ROLE_KEY)",
    );
  }
  const now = new Date().toISOString();
  const { error } = await client
    .from("user_notifications")
    .update({ read_at: now })
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) throw new Error(`markNotificationRead: ${error.message}`);
  broadcastNotificationsUpdated(userId);
}

/** Marks every unread row for the user (UI “mark all read”). */
export async function markAllNotificationsRead(
  userId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveClient(supabase);
  if (!client) {
    throw new Error(
      "markAllNotificationsRead: pass supabase from a route (getSupabaseServerClient) or use service role (SUPABASE_SERVICE_ROLE_KEY)",
    );
  }
  const now = new Date().toISOString();
  const { error } = await client
    .from("user_notifications")
    .update({ read_at: now })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) throw new Error(`markAllNotificationsRead: ${error.message}`);
  broadcastNotificationsUpdated(userId);
}

/**
 * Subscribe in-process event emitters → DB notifications. Idempotent.
 */
export function registerNotificationRouterListeners(): void {
  if (listenersRegistered) return;
  listenersRegistered = true;

  onEliteSpecNominated((p: EliteSpecNominatedPayload) => {
    void insertNotificationForEvent(p.userId, "elite_spec_nominated");
  });

  onCertifiedLeaderGrantedFromEliteSpec((p: CertifiedLeaderGrantedFromElitePayload) => {
    void insertNotificationForEvent(p.userId, "certified_leader_granted");
  });

  onArenaEjected((p: ArenaEjectedPayload) => {
    void insertNotificationForEvent(p.userId, "arena_ejected");
  });

  onWeeklyReportReady((p: WeeklyReportReadyPayload) => {
    void insertNotificationForEvent(p.userId, "weekly_report_ready");
  });

  onResilienceMilestone((p: ResilienceMilestonePayload) => {
    void insertNotificationForEvent(p.userId, "resilience_milestone_reached");
  });
}

if (typeof window === "undefined") {
  registerNotificationRouterListeners();
}
