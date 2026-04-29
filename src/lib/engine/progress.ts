import { DEFAULT_HIDDEN } from "./constants";
import { deriveStageFromCoreXp } from "./stage";
import type { UserId, UserProgress, EmploymentRole, OrgId, TeamId } from "./types";

/**
 * Create a new progress snapshot for a new user.
 * A1: everything starts at 0.
 */
export function createNewProgress(args: {
  userId: UserId;
  orgId?: OrgId;
  teamId?: TeamId;
  role?: EmploymentRole;
  seasonId?: string;
}): UserProgress {
  const coreXp = 0;
  const leagueXp = 0;
  return {
    userId: args.userId,
    orgId: args.orgId,
    teamId: args.teamId,
    role: args.role,
    coreXp,
    leagueXp,
    seasonId: args.seasonId,
    stage: deriveStageFromCoreXp(coreXp),
    hidden: { ...DEFAULT_HIDDEN },
    streakDays: 0,
    lastActiveDate: undefined,
  };
}

/**
 * Recompute derived fields (stage) after progress changes.
 */
export function withDerived(p: UserProgress): UserProgress {
  return {
    ...p,
    stage: deriveStageFromCoreXp(p.coreXp),
  };
}
