/**
 * BTY Daily OS — the daily gate state union (pure domain type).
 *
 * Single source of truth for the 7 canonical gate states. Kept in `domain` so pure
 * derivations (e.g. Today Intelligence) can depend on it without importing the `lib`
 * service that computes it. The service layer (`dailyGateCheck`) re-exports this type,
 * so existing `@/lib/bty/daily/dailyGateCheck` imports keep working unchanged.
 */
export type DailyGate =
  | "FORCED_RESET"
  | "ACTION_REQUIRED"
  | "REEXPOSURE_DUE"
  | "YESTERDAY_MIRROR"
  | "QUIET_INVITATION"
  | "FIRST_DAY"
  | "OPEN_DAY";
