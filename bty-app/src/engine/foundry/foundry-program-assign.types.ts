/** `foundry_program_assign` 이벤트 — 라우터·추천기 공용 (순환 import 방지). */

export const FOUNDRY_PROGRAM_ASSIGN_EVENT = "foundry_program_assign" as const;

export type FoundryProgramAssignPayload = {
  type: typeof FOUNDRY_PROGRAM_ASSIGN_EVENT;
  userId: string;
  track: "self-awareness" | "team-dynamics";
  occurredAt: string;
};
