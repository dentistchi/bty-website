/** Client-side shapes for the Foundry Training Rooms manager UI (mirror the API JSON). */

export type FoundryEventStatus = "open" | "closed";

export type ManagerRosterStatus =
  | "joined"
  | "watching"
  | "reading"
  | "response_pending"
  | "complete"
  | "removed";

export type ManagerParticipant = {
  id: string;
  display_name: string;
  joined_at: string;
  training_status: ManagerRosterStatus;
};

export type ManagerTraining = {
  youtube_video_id: string;
  youtube_title: string | null;
  youtube_thumbnail_url: string;
  completion_prompt: string;
};

export type ManagerDocument = {
  source_type?: "uploaded_pdf" | "google_drive";
  file_name: string | null;
  page_count: number;
  min_read_seconds: number;
  intro: string | null;
  completion_prompt: string;
};

export type ManagerEvent = {
  id: string;
  title: string;
  status: FoundryEventStatus;
  content_type?: "youtube" | "document";
  join_url: string;
  created_at: string;
  closed_at: string | null;
  training?: ManagerTraining | null;
  document?: ManagerDocument | null;
};

/**
 * TRAINING OUTCOME (Slice R4-R3A) — mirrors the server aggregate exactly. Read-only.
 * Deliberately contains NO learner identifier and no private learner text: the decisions are an
 * unattributed list, and `response_text` / `learner_reflection_text` / `reflection` are never
 * selected by the service that builds this.
 */
export type ManagerOutcome = {
  participation: {
    joined: number;
    completed: number;
    /** R4-R3B2 — completions a configured follow-up can actually reach (the obligation decides). */
    followUpReachable: number;
    /** Completions the configured follow-up has not reached. A count, never a diagnosis. */
    followUpNotConnected: number;
  };
  followUp: {
    /** R4-R3A-R1 — the ONLY thing that decides whether this training ends at completion. */
    configured: boolean;
    days: 7 | 30 | null;
    applied: number; partlyApplied: number; notYet: number; blocked: number;
    waiting: number; overdue: number; total: number; answered: number;
  };
  observation: { confirmed: number; notEstablished: number; couldntTell: number; total: number };
  /** Apply-window capability — carried, never rendered. It does not speak for the follow-up. */
  applicationJourney: "none" | "journey_no_decision" | "action_decision";
  decisionCount: number;
  reading:
    | "ends_at_completion"
    | "awaiting_connection"
    | "nothing_yet"
    | "unknown_yet"
    | "reported_only"
    | "confirmed";
  decisions: string[];
};

export type ManagerSnapshot = {
  event: ManagerEvent;
  participants: ManagerParticipant[];
  joined_count: number;
  completed_count: number;
  /** Guided "Create new version" eligibility (Slice 3.2C-B1); server-computed, boolean only. */
  revisable?: boolean;
};

export type ManagerEventSummary = {
  id: string;
  title: string;
  status: FoundryEventStatus;
  joined_count: number;
  created_at: string;
  closed_at: string | null;
};
