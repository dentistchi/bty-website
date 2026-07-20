/**
 * Display labels for the leadership responsibility taxonomy (Slice 3.1B-1).
 *
 * Deliberately OUTSIDE `src/domain` (domain-purity: no display strings). These are
 * human-facing copy that may change without a migration; they are NEVER authorization
 * keys and never reach the DB.
 *
 * Note `TEAM_LEAD` renders as "Lead" / "리드": the canonical KEY is namespaced to stay
 * distinct from the unrelated authorization flag `office_assignments.is_lead`, while the
 * label remains the word admins actually use.
 */

import type { ResponsibilityKey } from "@/domain/arena/orgResponsibilities";

export const RESPONSIBILITY_LABELS: Readonly<Record<ResponsibilityKey, string>> = {
  PARTNER: "Partner",
  CLINICAL_DIRECTOR: "Clinical Director",
  TRAINER: "Trainer",
  TEAM_LEAD: "Lead",
  PEOPLE_MANAGER: "People Manager",
};

export const RESPONSIBILITY_LABELS_KO: Readonly<Record<ResponsibilityKey, string>> = {
  PARTNER: "파트너",
  CLINICAL_DIRECTOR: "임상 디렉터",
  TRAINER: "트레이너",
  TEAM_LEAD: "리드",
  PEOPLE_MANAGER: "피플 매니저",
};
