/** Client-side shapes for the Foundry Event Rooms manager UI (mirror the API JSON). */

export type FoundryEventStatus = "open" | "closed";

export type ManagerParticipant = {
  id: string;
  display_name: string;
  joined_at: string;
  status: "joined" | "removed";
};

export type ManagerEvent = {
  id: string;
  title: string;
  status: FoundryEventStatus;
  join_url: string;
  created_at: string;
  closed_at: string | null;
};

export type ManagerSnapshot = {
  event: ManagerEvent;
  participants: ManagerParticipant[];
};

export type ManagerEventSummary = {
  id: string;
  title: string;
  status: FoundryEventStatus;
  joined_count: number;
  created_at: string;
  closed_at: string | null;
};
