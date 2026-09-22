"use client";

import { readTeamsSelection, type TeamsSelection } from "@/domain/teams/peopleSelection";

/**
 * "Send in Teams" — choosing who receives a training. BROWSER ONLY.
 * Slice Teams Chat-Native Text Training + Quiz V1.
 *
 * ★ WHAT CHANGED, AND WHY.
 *
 * This used to pick people and then open a Teams chat with a DRAFTED invitation containing a
 * personal-tab deep link. Repeated real-iPhone evidence showed Teams iOS controls that handoff and
 * does not reliably preserve the training destination — the app opened, the training did not. So
 * the invitation stops being a link at all.
 *
 * The People Picker stays, because choosing colleagues in Teams' own UI is right and was never the
 * problem. What follows it is now a server send: BTY's bot delivers the training as a card into
 * each employee's own chat, and they read it and answer the quiz there. No draft to send, no link
 * to tap, no browser.
 *
 * ★ NOTHING IS SENT ON SELECTION. This function only returns who was chosen. The caller shows a
 * confirmation and the Host presses Send — which is what authorizes the bot notifications.
 *
 * ★ IDENTITY VS TRANSPORT IS UNCHANGED. Only the Entra object ids leave the browser. Email, UPN
 * and display name are not sent to BTY's server, because the server derives everything it needs
 * about a recipient from Graph using the object id.
 */

export type PickOutcome =
  | { k: "picked"; selection: TeamsSelection }
  /** The Host closed the picker without choosing. Not an error. */
  | { k: "cancelled" }
  /** This client cannot pick people. The caller offers the ordinary web fallbacks. */
  | { k: "unsupported"; reason: "not_in_teams" | "people" }
  | { k: "failed" };

/** Is this document the BTY personal tab? The only place the Teams-native path applies. */
export function isInsideTeamsTab(): boolean {
  if (typeof window === "undefined") return false;
  const p = window.location.pathname;
  return p === "/teams" || p === "/teams/";
}

/**
 * Open Teams' own People Picker and return who was chosen.
 *
 * ORG-WIDE, as a personal app scope requires: there is no team or channel roster to scope to here,
 * so without it the picker would have nobody to offer. Multi-select, because assigning one
 * training to a shift is the ordinary case.
 */
export async function pickTrainingRecipients(): Promise<PickOutcome> {
  if (!isInsideTeamsTab()) return { k: "unsupported", reason: "not_in_teams" };

  let sdk: typeof import("@microsoft/teams-js");
  try {
    sdk = await import("@microsoft/teams-js");
    await sdk.app.initialize();
  } catch {
    return { k: "failed" };
  }

  if (!sdk.people.isSupported()) return { k: "unsupported", reason: "people" };

  try {
    const picked = await sdk.people.selectPeople({
      openOrgWideSearchInChatOrChannel: true,
      singleSelect: false,
      title: "Send training to",
    });
    const selection = readTeamsSelection(picked);
    if (selection.entraIds.length === 0) return { k: "cancelled" };
    return { k: "picked", selection };
  } catch {
    // The picker rejects when the Host dismisses it. A cancellation, not a failure.
    return { k: "cancelled" };
  }
}
