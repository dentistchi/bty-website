/**
 * Slip recovery routing after `slip_recovery_tasks` persist: Dear Me, mentor chat, biased Arena retry, or Dojo micro-assessment.
 * Emits {@link RecoveryTaskAssignedPayload} (`recovery_task_assigned`) per routed path.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assignDojoAssessment,
  type DojoAssessmentAssignment,
  weakestSkillAreaFromScenarioStats,
  type DojoSkillArea,
} from "@/engine/foundry/dojo-assessment.service";
import { POST_SESSION_INTEGRITY_SLIP_FLAG } from "@/engine/integration/post-session-router";
import { getNextScenarioForSession, type ScenarioRouteResult } from "@/engine/integration/scenario-type-router";
import {
  getRecoveryTask,
  type SlipRecoveryTask,
  type SlipRecoveryTaskType,
} from "@/engine/integrity/slip-recovery.service";
import { getScenarioStats } from "@/engine/scenario/scenario-stats.service";
import type { ScenarioLocalePreference } from "@/engine/scenario/scenario-selector.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { CENTER_CHAT_OPEN_EVENT, getDearMeHref } from "@/domain/center/paths";

export type RecoveryTaskAssignedPayload = {
  event: "recovery_task_assigned";
  userId: string;
  task_type: SlipRecoveryTaskType;
  assigned_at: string;
  routeKind: RecoveryRoute["kind"];
};

const assignedListeners = new Set<(p: RecoveryTaskAssignedPayload) => void | Promise<void>>();

export function onRecoveryTaskAssigned(
  fn: (p: RecoveryTaskAssignedPayload) => void | Promise<void>,
): () => void {
  assignedListeners.add(fn);
  return () => assignedListeners.delete(fn);
}

function emitRecoveryTaskAssigned(p: RecoveryTaskAssignedPayload): void {
  for (const fn of assignedListeners) {
    try {
      void fn(p);
    } catch {
      /* listeners must not break recovery */
    }
  }
}

export type RecoveryRoute =
  | { kind: "no_open_task" }
  | {
      kind: "reflection_letter";
      taskId: string;
      task_type: "reflection_letter";
      assigned_at: string;
      dearMeHref: string;
    }
  | {
      kind: "mentor_session";
      taskId: string;
      task_type: "mentor_session";
      assigned_at: string;
      /** Client should open Foundry mentor / chat (same convention as Center §6). */
      openChatbotEvent: typeof CENTER_CHAT_OPEN_EVENT;
    }
  | {
      kind: "scenario_retry";
      taskId: string;
      task_type: "scenario_retry";
      assigned_at: string;
      /** Result of {@link getNextScenarioForSession} with `INTEGRITY_SLIP` bias; `null` if ejected. */
      scenarioRoute: ScenarioRouteResult | null;
    }
  | {
      kind: "dojo_assessment";
      taskId: string;
      task_type: "dojo_assessment";
      assigned_at: string;
      skill_area: DojoSkillArea;
      assignment: DojoAssessmentAssignment;
    };

export type HandleSlipRecoveryOptions = {
  locale?: ScenarioLocalePreference;
  supabase?: SupabaseClient;
};

function basePayload(
  userId: string,
  task: SlipRecoveryTask,
  routeKind: RecoveryRoute["kind"],
): RecoveryTaskAssignedPayload {
  return {
    event: "recovery_task_assigned",
    userId,
    task_type: task.task_type,
    assigned_at: task.assigned_at,
    routeKind,
  };
}

/**
 * Loads the latest open {@link getRecoveryTask} and runs the matching recovery path (Dear Me href,
 * chat open signal, next scenario with slip bias, or Dojo assignment by weakest skill from {@link getScenarioStats}).
 */
export async function handleSlipRecovery(
  userId: string,
  options?: HandleSlipRecoveryOptions,
): Promise<RecoveryRoute> {
  const admin = options?.supabase ?? getSupabaseAdmin();
  const locale = options?.locale ?? "en";

  const task = await getRecoveryTask(userId, admin ? { supabase: admin } : undefined);
  if (!task) {
    return { kind: "no_open_task" };
  }

  switch (task.task_type) {
    case "reflection_letter": {
      const route: RecoveryRoute = {
        kind: "reflection_letter",
        taskId: task.id,
        task_type: task.task_type,
        assigned_at: task.assigned_at,
        dearMeHref: getDearMeHref(locale),
      };
      emitRecoveryTaskAssigned(basePayload(userId, task, "reflection_letter"));
      return route;
    }
    case "mentor_session": {
      const route: RecoveryRoute = {
        kind: "mentor_session",
        taskId: task.id,
        task_type: task.task_type,
        assigned_at: task.assigned_at,
        openChatbotEvent: CENTER_CHAT_OPEN_EVENT,
      };
      emitRecoveryTaskAssigned(basePayload(userId, task, "mentor_session"));
      return route;
    }
    case "scenario_retry": {
      const scenarioRoute = await getNextScenarioForSession(userId, locale, {
        preferFlagType: POST_SESSION_INTEGRITY_SLIP_FLAG,
      });
      const route: RecoveryRoute = {
        kind: "scenario_retry",
        taskId: task.id,
        task_type: task.task_type,
        assigned_at: task.assigned_at,
        scenarioRoute,
      };
      emitRecoveryTaskAssigned(basePayload(userId, task, "scenario_retry"));
      return route;
    }
    case "dojo_assessment": {
      if (!admin) {
        const route: RecoveryRoute = {
          kind: "no_open_task",
        };
        return route;
      }
      const stats = await getScenarioStats(userId, locale);
      const skill_area = weakestSkillAreaFromScenarioStats(stats);
      const assignment = await assignDojoAssessment(userId, skill_area, { supabase: admin, locale });
      const route: RecoveryRoute = {
        kind: "dojo_assessment",
        taskId: task.id,
        task_type: task.task_type,
        assigned_at: task.assigned_at,
        skill_area,
        assignment,
      };
      emitRecoveryTaskAssigned(basePayload(userId, task, "dojo_assessment"));
      return route;
    }
  }
}
