/**
 * Types only — no runtime dependency on @supabase/supabase-js.
 * Use this from client code (e.g. JourneyBoard) so the worker never loads supabase-admin.ts
 * during Collecting page data.
 */

export type JourneyProfile = {
  user_id: string;
  current_day: number;
  started_at: string;
  updated_at: string;
  season?: number;
  bounce_back_count?: number;
};

export type DayEntry = {
  id?: string;
  user_id: string;
  day: number;
  completed: boolean;
  mission_checks: number[];
  reflection_text: string | null;
  created_at?: string;
  updated_at?: string;
};
