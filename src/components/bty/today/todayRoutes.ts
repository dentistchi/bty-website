/**
 * BTY Daily OS — Today Shell route mapping.
 *
 * Maps a server gate `destination.kind` (and the three relationship doors) to EXISTING
 * routes. This is route convention only — no evidence logic, no new routes, no gate
 * re-ordering. The server payload omits `href` on purpose (locale→href is a UI concern),
 * so the mapping lives here (Scope Lock §4/§11, ui-render-only).
 */
import type { DailyDestinationKind } from "@/lib/bty/daily/dailyGateCheck";

export function destinationHref(kind: DailyDestinationKind, locale: string): string {
  switch (kind) {
    case "center":
      return `/${locale}/center`;
    case "open_loop":
      return `/${locale}/my-page?arena_contract=resolve`;
    case "arena_reexposure":
      return `/${locale}/bty-arena`;
    case "today":
      return `/${locale}/today`;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export const doorHref = {
  center: (locale: string) => `/${locale}/center`,
  arena: (locale: string) => `/${locale}/bty-arena`,
  foundry: (locale: string) => `/${locale}/bty/foundry`,
};
