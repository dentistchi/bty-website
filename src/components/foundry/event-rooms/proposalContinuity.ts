/**
 * PROPOSAL CONTINUITY (Slice 3.2L-R11.4K).
 *
 * THE LIVE DEFECT. A governed generation succeeded, the Host read the seven-section
 * proposal, left the screen, and came back to find it gone. Attempt `496302b6` is still
 * `success` with a digest and `applied_at` null — a finished, adoptable piece of work that
 * the product had no path back to.
 *
 * The cause was not subtle: the proposal lived ONLY in `ProgramAuthorship` component state.
 * `ModuleBuilderShell` is keyed by draft id and `FoundryEventRooms` re-lists from the server
 * on tab re-entry, so an unmount is guaranteed by ordinary navigation — and the server
 * deliberately never stores the proposal body, so nothing could serve it back.
 *
 * WHAT R7 ACTUALLY FORBIDS. The privacy contract is about DURABLE SERVER STORAGE of
 * generated prose: attempts and calls record shape metadata, timings, token counts and a
 * hash of the raw response, never the words. It says nothing about the authenticated Host's
 * own browser holding, for the length of one browsing session, the proposal they are being
 * shown on screen anyway. So the repair is client-side and session-scoped, and no prose is
 * added to the database.
 *
 * THE CACHE IS NOT AUTHORITY. It restores what to RENDER. Adoption still runs the full
 * server chain — owner-scoped attempt read, same draft, success, current fingerprint,
 * newest eligible success, and `journeyDigest` recomputed from the journey actually being
 * adopted and compared against `attempt.proposal_digest`. Editing one character of a cached
 * proposal therefore fails at Apply with `proposal_mismatch`, exactly as an edit made on
 * screen would. There is no path by which a client value becomes the identity.
 *
 * `sessionStorage`, not `localStorage`, on purpose: continuity has to survive a reload and
 * ordinary in-app navigation, which it does, and it must not become indefinite retention of
 * a Host's training content on a shared device, which `localStorage` would be.
 */
import type { ProgramProposal } from "@/domain/foundry/module/program-authorship";

const KEY_PREFIX = "bty_program_proposal_v1:";

export type CachedProposal = {
  /** Which generation this is. Sent to the server on Apply; proved there, never here. */
  readonly attemptId: string | null;
  /** The Host-input authority the proposal was written from. */
  readonly contextFingerprint: string;
  readonly proposal: ProgramProposal;
  readonly evidenceCeiling: string;
};

function keyFor(draftId: string): string {
  return `${KEY_PREFIX}${draftId}`;
}

/** Reading someone else's draft is impossible before this: the draft GET is owner-scoped. */
function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    // Private mode / storage disabled. Continuity is lost, nothing else is.
    return null;
  }
}

function looksLikeProposal(v: unknown): v is ProgramProposal {
  if (typeof v !== "object" || v === null) return false;
  const p = v as { displayTitle?: unknown; elements?: unknown };
  if (typeof p.displayTitle !== "string") return false;
  if (!Array.isArray(p.elements) || p.elements.length === 0) return false;
  return p.elements.every((e) => {
    if (typeof e !== "object" || e === null) return false;
    const el = e as { kind?: unknown; content?: unknown };
    return typeof el.kind === "string" && typeof el.content === "string";
  });
}

export function writeCachedProposal(draftId: string, entry: CachedProposal): void {
  const s = store();
  if (!s || !draftId) return;
  try {
    s.setItem(keyFor(draftId), JSON.stringify(entry));
  } catch {
    // Quota or serialization failure — the on-screen proposal is unaffected.
  }
}

/**
 * The cached proposal for this draft, or null.
 *
 * `currentFingerprint` is required, not optional: a proposal written from inputs the Host
 * has since changed is not the proposal for this draft any more, and restoring it would put
 * a stale program in front of them that the server would refuse anyway.
 */
export function readCachedProposal(draftId: string, currentFingerprint: string): CachedProposal | null {
  const s = store();
  if (!s || !draftId) return null;
  let raw: string | null = null;
  try {
    raw = s.getItem(keyFor(draftId));
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CachedProposal>;
    if (typeof parsed.contextFingerprint !== "string" || parsed.contextFingerprint.length === 0) return null;
    if (typeof parsed.evidenceCeiling !== "string") return null;
    if (parsed.attemptId !== null && typeof parsed.attemptId !== "string") return null;
    if (!looksLikeProposal(parsed.proposal)) return null;
    if (parsed.contextFingerprint !== currentFingerprint) return null;
    return {
      attemptId: parsed.attemptId ?? null,
      contextFingerprint: parsed.contextFingerprint,
      proposal: parsed.proposal,
      evidenceCeiling: parsed.evidenceCeiling,
    };
  } catch {
    return null;
  }
}

export function clearCachedProposal(draftId: string): void {
  const s = store();
  if (!s || !draftId) return;
  try {
    s.removeItem(keyFor(draftId));
  } catch {
    /* nothing to do */
  }
}
