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

export type HostDeepLink = {
  eventId: string;
  section: HostFocusSection;
  focusId: string;
};

/** Same UUID-ish shape the shell already uses for review/followup/entry ids (server does real authz). */
const UUIDISH = /^[0-9a-fA-F-]{16,}$/;

function isHostFocusSection(v: string | null): v is HostFocusSection {
  return v === "followups" || v === "shared-understanding";
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
    return { eventId, section, focusId };
  } catch {
    return null;
  }
}
