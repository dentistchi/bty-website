/**
 * Weekly reflection quest: 3 reflections per week (Monday 00:00 UTC) grant +15 Seasonal XP once.
 */

/** Returns Monday 00:00 UTC of the week containing d, as YYYY-MM-DD. */
export function getWeekStartUTC(d: Date = new Date()): string {
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + mondayOffset);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export const REFLECTION_QUEST_TARGET = 3;
export const REFLECTION_QUEST_BONUS_XP = 15;
