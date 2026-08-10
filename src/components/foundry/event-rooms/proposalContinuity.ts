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
 * WHY IT IS NO LONGER `sessionStorage` (Slice 3.2L-R11.4K-R2). That choice was bounded and
 * private, and it was also wrong: measured in a real browser against the deployed origin, a
 * NEW TAB in the SAME browsing session reads `sessionStorage` as `null` while `localStorage`
 * is shared. The Founder opened the canonical Review URL from a chat — a new tab — and the
 * pending proposal was invisible there, so the product asked them to draft it again. A Host
 * must not have to remember which tab holds their unfinished work.
 *
 * So continuity is shared storage, bounded three ways instead of by tab lifetime: an
 * absolute TTL, removal the moment the work is finished or discarded, and a purge on logout.
 * Nothing here is indefinite, and nothing reaches the database.
 */
import { PROGRAM_AUTHORSHIP_VERSION, type ProgramProposal } from "@/domain/foundry/module/program-authorship";

const KEY_PREFIX = "bty_program_proposal_v2:";

/**
 * How long unfinished work stays resumable. Long enough to come back to it tomorrow, short
 * enough that a shared device does not keep a Host's training content indefinitely.
 */
export const PROPOSAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type CachedProposal = {
  /**
   * The semantic acceptance contract this proposal was generated under (Slice 3.2P-W4-R1).
   *
   * MEASURED: a successful W3 proposal sat here for 24 hours across four changes to what the
   * validator accepts, and reappeared on Review re-entry looking like current work — naming a
   * learner population the host had not chosen and a record keeper the source never mentioned.
   * The fingerprint gate could not see it, because the host had changed nothing; the inputs were
   * identical and the RULES had moved. Absent on an entry written before this field existed,
   * which is treated as "not the current contract".
   */
  readonly authorityVersion?: string;
  /** When it was written. Read back to enforce the TTL — never sent anywhere. */
  readonly savedAt?: number;
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

/**
 * Shared across tabs, which is the point. Reaching another Host's proposal is still
 * impossible: the draft GET is owner-scoped, so a Builder for that draft never mounts for
 * them, and the eligibility GET is owner-scoped too — a foreign owner is answered
 * `attempt_not_found`.
 */
function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
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
    // The authority is stamped here, never taken from the caller — one source for both halves.
    s.setItem(keyFor(draftId), JSON.stringify({ ...entry, authorityVersion: PROGRAM_AUTHORSHIP_VERSION, savedAt: Date.now() }));
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
    /*
      Same inputs is not the same thing as the same rules. A proposal accepted under an older
      acceptance contract is not offered again, and the stale entry is removed rather than left
      to reappear tomorrow. Only this draft's entry — never anyone else's work.
    */
    if (parsed.authorityVersion !== PROGRAM_AUTHORSHIP_VERSION) {
      clearCachedProposal(draftId);
      return null;
    }
    // Expired work is not offered, and is not left behind either.
    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : 0;
    if (!savedAt || Date.now() - savedAt > PROPOSAL_CACHE_TTL_MS) {
      clearCachedProposal(draftId);
      return null;
    }
    return {
      savedAt,
      authorityVersion: parsed.authorityVersion,
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

/**
 * Everything, for every draft — the logout purge.
 *
 * Continuity is for the person who generated it. When they leave the device, their
 * unfinished training content goes with them.
 */
export function clearAllCachedProposals(): void {
  const s = store();
  if (!s) return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < s.length; i += 1) {
      const k = s.key(i);
      if (k && k.startsWith(KEY_PREFIX)) doomed.push(k);
    }
    for (const k of doomed) s.removeItem(k);
  } catch {
    /* nothing to do */
  }
}
