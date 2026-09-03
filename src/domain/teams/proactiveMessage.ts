/**
 * The one message BTY sends into Teams. PURE — no I/O, no DB, no side effects.
 *
 * WHY IT IS THIS SHORT. The person receiving it may never have opened BTY. They get one
 * interruption, and it has to answer three things before they decide whether to care:
 * who is asking, what they want, and where to go. Anything past that is noise arriving
 * from an app they do not use yet.
 *
 * ★ THE HOST'S FRAMING, NEVER THE SOURCE MESSAGE. The tracked Teams message is evidence the
 * Host saved; it lives in a channel or chat whose membership BTY has NOT verified this
 * recipient belongs to. Quoting it here would republish someone else's message to an
 * audience the original conversation never had. The Host wrote the framing FOR these people,
 * so the framing is the only body that is theirs to receive.
 *
 * ★ NO Got it / Question / Need help BUTTONS. Those exist in BTY, bound to a recipient row and
 * a write-once response contract. Repeating them as card actions would be a second response
 * system that has to be kept honest against the first, and the first is the one the Host reads.
 * The message's whole job is to hand the person to that experience, not to imitate it.
 */

/** Long enough for any framing a Host can type (the DB caps it at 1000) plus the wrapper. */
export const PROACTIVE_TEXT_MAX = 1400;

export type ProactiveMessageInput = {
  /** Provider-supplied Host name, or null when it could not be resolved. */
  hostName: string | null;
  /** The Host's own words from the Track dialog. */
  hostFraming: string;
  /** Where BTY opens. */
  openUrl: string;
};

/**
 * Markdown for a Bot Framework `message` activity.
 *
 * A missing Host name degrades to "Someone on your team" rather than an empty lead-in or a
 * placeholder: the recipient still learns this came from a person, and no identifier is
 * invented to fill the gap. An email would fill it perfectly and is exactly what must not be
 * used -- a notification is not the place an employee address gets disclosed.
 */
export function buildProactiveMessage(input: ProactiveMessageInput): string {
  const who = input.hostName?.trim() || "Someone on your team";
  const framing = input.hostFraming.trim();
  const text = [
    `**${who}** asked you to follow up in BTY.`,
    "",
    framing,
    "",
    `[Open BTY](${input.openUrl})`,
  ].join("\n");
  return text.length > PROACTIVE_TEXT_MAX ? `${text.slice(0, PROACTIVE_TEXT_MAX - 1)}…` : text;
}
