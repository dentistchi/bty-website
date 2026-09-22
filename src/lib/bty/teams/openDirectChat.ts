/**
 * Open a DIRECT 1:1 Teams chat between the Host and one learner, pre-filled but unsent.
 * CLIENT ONLY. Slice Training Result → Human Teams Chat V1.
 *
 * ★ HUMAN TO HUMAN, NOT THROUGH THE BOT. The BTY bot delivers training; a Host asking someone
 * about a question they missed is not training, and a message from a bot account would hide who is
 * actually asking. So this opens the Host's own chat with the learner, and BTY is not a party to
 * what is said there.
 *
 * ★ PRE-POPULATED, NEVER AUTO-SENT. Both paths below put text in the COMPOSE box. Teams has no
 * API that sends on the user's behalf here, and that is the correct shape: the Host reads the
 * draft, edits it, and presses send themselves.
 *
 * ★ THE ADDRESS IS A TRANSPORT VALUE. `chatTarget` is a UPN the server resolved for this one tap.
 * It is used to point a window and then discarded — never stored, never compared to a BTY account.
 */

export type OpenChatOutcome = { k: "opened" } | { k: "unsupported" } | { k: "failed" };

/** The published deep link for a 1:1 chat with a pre-filled message. */
export function directChatDeepLink(chatTarget: string, message: string): string {
  const params = new URLSearchParams({ users: chatTarget, message });
  return `https://teams.microsoft.com/l/chat/0/0?${params.toString()}`;
}

export async function openDirectChat(chatTarget: string, message: string): Promise<OpenChatOutcome> {
  const target = (chatTarget ?? "").trim();
  if (!target) return { k: "unsupported" };

  try {
    const { chat } = await import("@microsoft/teams-js");
    /*
      Inside a Teams client this opens the chat in place, which keeps the Host where they are. The
      capability check is what distinguishes "Teams cannot do this here" from "this failed".
    */
    if (chat && typeof chat.isSupported === "function" && chat.isSupported()) {
      await chat.openChat({ user: target, message });
      return { k: "opened" };
    }
  } catch {
    // Fall through to the link. A host that refuses the capability is not an error to report.
  }

  /*
    OUTSIDE A TEAMS CLIENT, or where the capability is unavailable: the published deep link does
    the same job through the browser or the desktop app. `_blank` so the Host does not lose the
    training surface they were reading.
  */
  try {
    if (typeof window === "undefined") return { k: "unsupported" };
    window.open(directChatDeepLink(target, message), "_blank", "noopener,noreferrer");
    return { k: "opened" };
  } catch {
    return { k: "failed" };
  }
}
