/**
 * What comes back from the Teams people picker, and what each field is allowed to be used for.
 * PURE. Slice Teams-Native Delivery V1.
 *
 * THE DISTINCTION THIS FILE EXISTS TO HOLD. `people.selectPeople` returns three things per person:
 * a Microsoft Entra object id, a display name, and an email. They are NOT interchangeable, and the
 * product has one rule about them:
 *
 *   objectId (Entra oid)  THE COORDINATE. Canonical, tenant-scoped, non-reassignable. This is what
 *                         BTY means by "which person", and the only field that may ever be joined
 *                         to a BTY user — always together with the tenant id, server-side.
 *
 *   email / UPN           A TRANSPORT ADDRESS, and nothing else. `chat.openGroupChat` addresses a
 *                         conversation by email, so the value is used to open a chat window and is
 *                         never stored, never looked up, and never compared to a BTY account.
 *                         Addresses are reassignable; treating one as identity is how the wrong
 *                         person inherits someone else's training history.
 *
 *   displayName           PRESENTATION. Never identity, never a key. Anyone can be called anything.
 *
 * Nothing in this slice persists a selection at all — the Host is composing a chat message, and
 * Teams delivers it. The rule is stated and enforced here anyway, because the next slice that wants
 * to remember who was invited will start from this function.
 */

export type PickedPerson = {
  /** Microsoft Entra object id. */
  objectId?: unknown;
  displayName?: unknown;
  email?: unknown;
};

export type TeamsSelection = {
  /** The canonical coordinates of the chosen people, in picker order, de-duplicated. */
  entraIds: string[];
  /** Addresses for Teams chat NAVIGATION ONLY. May be shorter than `entraIds`. */
  chatTargets: string[];
  /** Presentation only — used to name the first recipient in a status line. */
  displayNames: string[];
};

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > 0 && s.length <= 320 ? s : null;
};

/** A transport address must at least be shaped like one; a display name is not an address. */
const isAddress = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/**
 * Normalise a picker result into the three separated lists.
 *
 * A person with no Entra id is DROPPED: without a coordinate there is nothing BTY can ever say
 * about them truthfully, and silently keeping them as "an email" is exactly the collapse this
 * module prevents.
 */
export function readTeamsSelection(raw: unknown): TeamsSelection {
  const rows: PickedPerson[] = Array.isArray(raw) ? (raw as PickedPerson[]) : [];
  const entraIds: string[] = [];
  const chatTargets: string[] = [];
  const displayNames: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const objectId = str(row.objectId);
    if (!objectId || seen.has(objectId)) continue;
    seen.add(objectId);
    entraIds.push(objectId);

    const email = str(row.email);
    if (email && isAddress(email)) chatTargets.push(email);
    const name = str(row.displayName);
    if (name) displayNames.push(name);
  }
  return { entraIds, chatTargets, displayNames };
}

/** Can a chat actually be opened for this selection? Separate question from "who was chosen". */
export function canComposeChat(selection: TeamsSelection): boolean {
  return selection.chatTargets.length > 0;
}
