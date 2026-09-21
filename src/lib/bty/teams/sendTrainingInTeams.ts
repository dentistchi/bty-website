"use client";

import { readTeamsSelection, canComposeChat, type TeamsSelection } from "@/domain/teams/peopleSelection";

/**
 * "Send in Teams" — the Host's side of Teams-native delivery. BROWSER ONLY.
 * Slice Teams-Native Delivery V1.
 *
 * WHAT THIS REPLACES, AND WHY. The Host used to press "Share to Teams", which opened
 * `teams.microsoft.com/share` in a popup. Microsoft documents that surface (and `pages.shareDeepLink`)
 * as unsupported on Teams MOBILE, and mobile is where this product is used: the Founder's iPhone
 * showed "Link not supported", or fell out into Safari and asked for a browser Microsoft login.
 * Neither is a share.
 *
 * SO INSIDE TEAMS THE HOST NEVER LEAVES TEAMS:
 *
 *   people.selectPeople(...)   the host picks colleagues in Teams' own org-wide picker
 *   chat.openGroupChat(...)    Teams opens a chat with the invitation ALREADY DRAFTED
 *   the Host presses Send      — BTY never sends a message as the Host
 *
 * THE MESSAGE IS A DRAFT, NOT A SEND. That is a deliberate product decision, not a limitation: a
 * silent send would need a proactive bot conversation (an installation dependency, and a message
 * the Host never saw). The Host reads what goes out under their name.
 *
 * CAPABILITIES ARE CHECKED, NOT ASSUMED. `people.isSupported()` and `chat.isSupported()` are the
 * documented way to ask, and an older client that answers `false` gets an honest fallback rather
 * than a thrown error or a silent nothing.
 */

export type SendOutcome =
  /** Teams opened a chat with the invitation drafted. The Host still has to press Send. */
  | { k: "composed"; selection: TeamsSelection }
  /** The Host closed the picker without choosing. Not an error. */
  | { k: "cancelled" }
  /** This client cannot pick people or open a chat. The caller offers the copy fallback. */
  | { k: "unsupported"; reason: "not_in_teams" | "people" | "chat" | "no_address" }
  /** Teams was asked and refused/failed. The caller offers the copy fallback. */
  | { k: "failed" };

/** Is this document the BTY personal tab? The only place the Teams-native path applies. */
export function isInsideTeamsTab(): boolean {
  if (typeof window === "undefined") return false;
  const p = window.location.pathname;
  return p === "/teams" || p === "/teams/";
}

/**
 * Pick people, then open a Teams chat with the invitation drafted.
 *
 * `message` already contains the PERSONAL-TAB deep link. A raw `/f/<token>` web URL must never be
 * composed here — that is the browser handoff this slice removes, and a test asserts it.
 */
export async function sendTrainingInTeams(message: string): Promise<SendOutcome> {
  if (!isInsideTeamsTab()) return { k: "unsupported", reason: "not_in_teams" };

  let sdk: typeof import("@microsoft/teams-js");
  try {
    sdk = await import("@microsoft/teams-js");
    await sdk.app.initialize();
  } catch {
    return { k: "failed" };
  }

  if (!sdk.people.isSupported()) return { k: "unsupported", reason: "people" };

  let selection: TeamsSelection;
  try {
    /*
      ORG-WIDE, as a personal app scope requires: there is no team or channel roster to scope to
      here, so without this the picker would have nobody to offer. Multi-select, because a Host
      assigning one training to a shift is the ordinary case.
    */
    const picked = await sdk.people.selectPeople({
      openOrgWideSearchInChatOrChannel: true,
      singleSelect: false,
      title: "Send training to",
    });
    selection = readTeamsSelection(picked);
  } catch {
    // The picker rejects when the Host dismisses it. That is a cancellation, not a failure.
    return { k: "cancelled" };
  }

  if (selection.entraIds.length === 0) return { k: "cancelled" };
  if (!sdk.chat.isSupported()) return { k: "unsupported", reason: "chat" };
  // Entra ids are the coordinate; a chat still has to be ADDRESSED, and only an address can do that.
  if (!canComposeChat(selection)) return { k: "unsupported", reason: "no_address" };

  try {
    if (selection.chatTargets.length === 1) {
      // `openGroupChat` documents that a single user falls back to `openChat`; call it directly
      // rather than depending on that fallback.
      await sdk.chat.openChat({ user: selection.chatTargets[0]!, message });
    } else {
      await sdk.chat.openGroupChat({ users: selection.chatTargets, message });
    }
  } catch {
    return { k: "failed" };
  }
  return { k: "composed", selection };
}
