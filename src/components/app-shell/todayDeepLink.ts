import type { AppTabKey } from "@/components/app-shell/AppTabBar";
import { resolveInitialAppTab } from "@/components/app-shell/initialTab";

/**
 * Today item deep-link parsing (Slice R4-R5C1) — pure, sanitizing, UI-navigation only.
 *
 * Today's cards each carry a SERVER-AUTHORED `canonicalDeepLink`. They were rendered as raw
 * anchors, so every tap performed a full document navigation: inside the installed app that is a
 * shell reboot — "Opening BTY…", Today, then a jump to the destination — for a move the shell can
 * already make in state.
 *
 * This turns that server string into a STRUCTURED in-shell target, exactly as
 * {@link parseHostDeepLink} already does for the Host attention rows. Same contract as that module:
 *
 *   · it never authorizes — the server owner-scopes every read behind these ids
 *   · it never reads display text; only the canonical link the server built
 *   · anything unrecognised parses to `null`, and the caller's answer to `null` is to let the
 *     anchor navigate natively. An unknown shape therefore degrades to today's behaviour rather
 *     than to a dead end.
 *
 * IT DOES NOT INVENT PRECISION. `?tab=arena` (an Arena action contract, a due practice) carries no
 * target id, and the shell has no focused-practice contract to receive one — so it parses to the
 * honest `{ kind: "tab" }` container. Removing the reboot is worth doing on its own; pretending the
 * container is the task is not.
 */

/** Same UUID-ish shape the shell already applies to review/followup/entry/assignment ids. */
const UUIDISH = /^[0-9a-fA-F-]{16,}$/;

export type TodayTarget =
  /** Learn → Required Learning, with one assignment card brought into view. */
  | { kind: "learn-assignment"; assignmentId: string }
  /** Learn → My Learning, optionally focused on one completed record. */
  | { kind: "learn-my-learning"; entryId: string | null }
  /** Learn → the focused follow-up response surface. */
  | { kind: "learn-followup"; followupId: string }
  /** Practice → the focused Field Actions surface, scrolled to one action. */
  | { kind: "practice-field-action"; contractId: string }
  /** Today → the Field Action producer for one contract. */
  | { kind: "today-field-action-contract"; contractId: string }
  /** Today → the read-only Host action review detail. */
  | { kind: "today-action-review"; actionReviewId: string }
  /** An honest container: the tab itself, because no focused contract exists for this item. */
  | { kind: "tab"; tab: AppTabKey };

/** The query part of a same-origin app link, or null if this is not one. */
function queryOf(href: string): string | null {
  if (typeof href !== "string") return null;
  const trimmed = href.trim();
  // Same-origin app paths only. A protocol, protocol-relative or backslash form is not ours.
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.includes("://") || trimmed.startsWith("//") || trimmed.includes("\\")) return null;
  if (!/^\/(en|ko)\/app(\?|$)/.test(trimmed)) return null;
  const q = trimmed.indexOf("?");
  return q === -1 ? "" : trimmed.slice(q);
}

/**
 * Parse a Today card's canonical deep link into an in-shell target.
 *
 * Returns null when the link is not a same-origin `/{en|ko}/app` link or names no tab we can
 * resolve — the caller then lets the browser follow the href, which is the pre-existing behaviour.
 */
export function parseTodayDeepLink(href: string): TodayTarget | null {
  const search = queryOf(href);
  if (search === null) return null;

  let sp: URLSearchParams;
  try {
    sp = new URLSearchParams(search);
  } catch {
    return null;
  }

  // The tab is resolved by the SHELL'S OWN alias table (foundry→learn, arena→practice, center→me),
  // so this module can never disagree with a cold deep link about where a tab points.
  const tab = resolveInitialAppTab(search);
  if (!tab) return null;

  const id = (k: string): string | null => {
    const v = sp.get(k);
    return v && UUIDISH.test(v) ? v : null;
  };

  // Ordered like the shell's own resolution so an in-shell tap and a cold URL agree exactly.
  const fieldAction = id("fieldAction");
  if (fieldAction) return { kind: "practice-field-action", contractId: fieldAction };

  const fieldActionContract = id("fieldActionContract");
  if (fieldActionContract) return { kind: "today-field-action-contract", contractId: fieldActionContract };

  const actionReview = id("actionReview");
  if (actionReview) return { kind: "today-action-review", actionReviewId: actionReview };

  const followup = id("followup");
  if (followup) return { kind: "learn-followup", followupId: followup };

  if (sp.get("view") === "my-learning") {
    // `entry` is optional: My Learning without a focus is still the right destination.
    return { kind: "learn-my-learning", entryId: id("entry") };
  }

  const assignment = id("assignment");
  if (assignment) return { kind: "learn-assignment", assignmentId: assignment };

  // No focused contract for this item — the tab is the honest answer.
  return { kind: "tab", tab };
}
