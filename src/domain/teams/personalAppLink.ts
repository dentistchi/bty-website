import { BTY_TEAMS_APP_ID, BTY_TEAMS_PERSONAL_TAB_ENTITY_ID } from "./trainingTarget";

/**
 * A link that opens the BTY PERSONAL APP INSIDE TEAMS, not a web page about BTY. PURE.
 * Slice No-Browser-Escape V1.
 *
 * ★ THE DEFECT THIS REPLACES. A bot message linking to `https://arena.btydaily.com/` is a web
 * address, and Teams does the only thing it can with one: it opens a browser. The person is then
 * looking at BTY in Safari, signed out, outside the app they already had installed — having
 * pressed a button in BTY to get there. The bot is the trigger; the Personal App is the
 * experience, and the link has to say so.
 *
 * ★ THE SAME DESTINATION VOCABULARY AS EVERYTHING ELSE. `search` is the shell's own query string
 * — `?tab=today`, `?tab=center&entry=…` — carried through two transports: `context.subEntityId`
 * for hosts that navigate the tab, and a self-contained `webUrl` for hosts that do not. Both land
 * on `/teams` with the same query, so the shell resolves them with the same code that handles a
 * cold open. There is no second destination language for the bot.
 */
export function buildPersonalAppLink(input: {
  /** Absolute origin of the BTY deployment, e.g. `https://arena.btydaily.com`. */
  origin: string;
  /** The shell destination as a query string (leading `?`), or `""` for the default surface. */
  search?: string;
  /** What the host shows while the tab opens. */
  label?: string;
}): string | null {
  const origin = (input.origin ?? "").trim().replace(/\/+$/, "");
  if (!/^https:\/\/[^\s/]+$/.test(origin)) return null;

  const raw = (input.search ?? "").trim();
  // A leading `?` is accepted and normalised away; anything else is not a query and is refused.
  const search = raw === "" ? "" : raw.startsWith("?") ? raw.slice(1) : null;
  if (search === null) return null;

  const params = new URLSearchParams({
    webUrl: `${origin}/teams${search ? `?${search}` : ""}`,
    label: (input.label ?? "").trim().slice(0, 120) || "BTY",
    openInMeeting: "false",
  });
  /*
    `context` carries the destination as the tab's subEntityId only when there IS one. An empty
    context tells the host to navigate to a subpage that does not exist, which some clients honour
    by showing nothing at all.
  */
  if (search) params.set("context", JSON.stringify({ subEntityId: `q:${search}` }));

  return `https://teams.microsoft.com/l/entity/${BTY_TEAMS_APP_ID}/${BTY_TEAMS_PERSONAL_TAB_ENTITY_ID}?${params.toString()}`;
}
