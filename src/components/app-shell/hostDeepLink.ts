/**
 * Host Leadership Attention deep-link parsing (Slice 3.1B-3L) — pure, sanitizing, UI-navigation only.
 *
 * A Host attention item in Today links to the EXACT owned Event Control Room + section + row:
 *   /<locale>/app?tab=foundry&event=<event-id>&section=followups|shared-understanding&focus=<id>
 * This parses/validates that query string shape. It never authorizes — the server owner-scopes every
 * read; a not-owned event simply resolves to nothing there. An invalid/partial link parses to null
 * (fails safely, no disclosure, no dead-end). Distinct from the learner ?followup=<id> surface.
 */

export type HostFocusSection = "followups" | "shared-understanding";

/** Bounded in-shell return origin (3.2G-R1). NAVIGATION METADATA ONLY — a closed enum, never a URL,
 *  so it can never authorize, reveal data, override the canonical target, or open-redirect. Any value
 *  other than the known origins parses to null → the existing safe (Learn/home) back behavior. */
export type HostReturnTab = "today";

export type HostDeepLink = {
  eventId: string;
  section: HostFocusSection;
  focusId: string;
  /** Where Back should return to, when a known origin was tagged; null = existing safe fallback. */
  returnTab: HostReturnTab | null;
};

/** Same UUID-ish shape the shell already uses for review/followup/entry ids (server does real authz). */
const UUIDISH = /^[0-9a-fA-F-]{16,}$/;

function isHostFocusSection(v: string | null): v is HostFocusSection {
  return v === "followups" || v === "shared-understanding";
}

/** Only a known in-shell origin is honored; anything else (missing, "learn", a URL, junk) → null. */
function parseReturnTab(v: string | null): HostReturnTab | null {
  return v === "today" ? "today" : null;
}

/**
 * Parse a Host attention deep link from a URL query string. Returns null unless ALL of tab=foundry,
 * a UUID-ish event, a known section, and a UUID-ish focus id are present — so a malformed or foreign
 * link never opens a partial/dead-end state.
 */
export function parseHostDeepLink(search: string): HostDeepLink | null {
  try {
    const sp = new URLSearchParams(search);
    if (sp.get("tab") !== "foundry") return null;
    const eventId = sp.get("event");
    const section = sp.get("section");
    const focusId = sp.get("focus");
    if (!eventId || !UUIDISH.test(eventId)) return null;
    if (!isHostFocusSection(section)) return null;
    if (!focusId || !UUIDISH.test(focusId)) return null;
    return { eventId, section, focusId, returnTab: parseReturnTab(sp.get("from")) };
  } catch {
    return null;
  }
}

/**
 * DRAFT REVIEW DEEP LINK (Slice 3.2L-R11.4E) — the same shape, for a training still being built.
 *
 * An event has had a deep link since 3.1B-3L; a DRAFT never did, so the only way to a draft's
 * review was the Learn list plus one Next press per remaining step. That made an ordinary
 * product action — "look at my training and draft its program" — into a navigation exercise,
 * and every one of those Next presses wrote a resume position.
 *
 *   /<locale>/app?tab=foundry&draft=<draft-id>&view=review
 *
 * `view=review` is PRESENTATION, never authoring: it asks the Builder to show the review it
 * already renders, and nothing about the draft is written by arriving. Absent or unknown
 * `view` opens the draft at the Host's own saved position, exactly as tapping the list does.
 *
 * It authorizes nothing. The draft id travels to the same owner-scoped GET the Builder always
 * uses; a draft the Host does not own simply does not load.
 */
export type DraftDeepLinkView = "review";

export type DraftDeepLink = {
  draftId: string;
  /** null = open wherever the Host left off. */
  view: DraftDeepLinkView | null;
};

export function parseDraftDeepLink(search: string): DraftDeepLink | null {
  try {
    const sp = new URLSearchParams(search);
    if (sp.get("tab") !== "foundry") return null;
    const draftId = sp.get("draft");
    if (!draftId || !UUIDISH.test(draftId)) return null;
    return { draftId, view: sp.get("view") === "review" ? "review" : null };
  } catch {
    return null;
  }
}
