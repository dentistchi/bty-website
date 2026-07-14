/** Client-side shapes for the Foundry Training Rooms manager UI (mirror the API JSON). */

export type FoundryEventStatus = "open" | "closed";

export type ManagerRosterStatus =
  | "joined"
  | "watching"
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

export type ManagerEvent = {
  id: string;
  title: string;
  status: FoundryEventStatus;
  join_url: string;
  created_at: string;
  closed_at: string | null;
  training: ManagerTraining | null;
};

export type ManagerSnapshot = {
  event: ManagerEvent;
  participants: ManagerParticipant[];
  joined_count: number;
  completed_count: number;
};

export type ManagerEventSummary = {
  id: string;
  title: string;
  status: FoundryEventStatus;
  joined_count: number;
  created_at: string;
  closed_at: string | null;
};
