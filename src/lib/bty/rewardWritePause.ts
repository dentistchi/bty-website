/**
 * Recovery switch for every reward write in this release. With
 * REWARD_WRITES_PAUSED=1 the server reward helpers return REWARD_WRITES_PAUSED
 * before any database call; learning, saving and reading keep working. The
 * database has the matching switch (`public.bty_reward_write_control.paused`),
 * which also stops writers that do not read this environment.
 */
export const REWARD_WRITES_PAUSED = "REWARD_WRITES_PAUSED";

export function rewardWritesPaused(): boolean {
  return process.env.REWARD_WRITES_PAUSED === "1";
}

