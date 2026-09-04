import { safeSourceUrl } from "@/domain/action-capture/captureSource";

/**
 * Where "Open in Teams" should send a saved item. PURE — no I/O, no DOM, no side effects.
 *
 * ★ THE DEVICE FAILURE THIS EXISTS FOR (2026-09-04, real participant iPhone).
 *
 *   Saved for later → Open in Teams
 *     → left the tab to an iOS browser surface
 *     → landed on arena.btydaily.com
 *     → "BTY couldn't open yet." / "Open BTY"
 *
 * The stored URL was never the problem. Capture `a2945cd1` holds the canonical Microsoft form,
 * `https://teams.microsoft.com/l/message/<chatId>/<messageId>?context={"contextType":"chat"}`,
 * and so does `a9c6da27`.
 *
 * MEASURED CAUSE. The row rendered a plain `<a href={sourceUrl} target="_blank">`, and the Teams
 * frame containment that exists precisely to route off-origin links through the host bailed one
 * line early:
 *
 *     if (el.target === "_blank") return;   // "already leaving, on purpose"
 *
 * True in a browser; exactly wrong inside a Teams tab, where LEAVING is the part that needs the
 * host API. So `app.openLink` was never called. The native `_blank` navigation was handed to the
 * Teams iOS webview, whose manifest declares `validDomains: ["arena.btydaily.com"]` and nothing
 * else — so an off-domain navigation could not be honoured in-frame, the tab was knocked back to
 * its own `contentUrl`, `TeamsTabShell` re-mounted, and its bootstrap failure screen is the
 * "BTY couldn't open yet." the person saw. Nothing about it was about BTY failing to open.
 *
 * ★ THE BUTTON MEANS "RETURN TO THAT MESSAGE", NEVER "OPEN BTY". So the stored URL is passed
 *   THROUGH, verbatim: never wrapped in an arena.btydaily.com URL, never routed via /teams or
 *   /en/app, never turned into the BTY tab entity link, and never rebuilt from ids or an address
 *   when a stored URL exists.
 */

export type OpenLinkPlan =
  | { mode: "teams"; url: string }
  | { mode: "browser"; url: string }
  | { mode: "refuse"; reason: "no_url" | "unsafe_url" };

/**
 * Decide how to open one saved item's source.
 *
 * SECURITY IS THE EXISTING ALLOW-LIST, REUSED. `safeSourceUrl` already decides which schemes may
 * ever be presented as "Open in Teams" (`https:` and `msteams:` only, everything else dropped),
 * and it is the same function the capture write path uses. A second opinion about what is safe to
 * open is how the two drift; this asks the one that already exists.
 *
 * The URL comes from the server-returned, owner-scoped capture — never a query parameter and never
 * anything the client composed.
 */
export function planOpenSourceLink(
  rawUrl: string | null | undefined,
  host: { teamsHosted: boolean },
): OpenLinkPlan {
  if (rawUrl == null || String(rawUrl).trim() === "") return { mode: "refuse", reason: "no_url" };
  const safe = safeSourceUrl(rawUrl);
  if (!safe) return { mode: "refuse", reason: "unsafe_url" };
  // VERBATIM in both modes. The host differs; the destination never does.
  return host.teamsHosted ? { mode: "teams", url: safe } : { mode: "browser", url: safe };
}
