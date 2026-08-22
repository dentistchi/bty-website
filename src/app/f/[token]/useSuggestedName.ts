"use client";

import { useEffect, useRef } from "react";

/**
 * SEED THE JOIN FIELD ONCE, AND NEVER OVER THE LEARNER (Slice R4-R5C7A).
 *
 * The suggestion arrives with the room snapshot, which resolves AFTER the pre-join screen can
 * already be on the page — so a naive effect could land a provider name on top of something the
 * learner had begun typing. That would be a worse bug than the empty field it replaces, and it is
 * the same failure mode the device-draft hook had to design around.
 *
 * Two independent guards, both required:
 *   `seeded`  — the suggestion is a DEFAULT, not a synchronised value. It is applied at most once
 *               per mount, so a later snapshot reload cannot re-apply it.
 *   `touched` — once the learner has typed ANYTHING, including deleting back to empty, the field
 *               is theirs. A cleared field is a decision, not an invitation to refill it.
 *
 * PREFILL IS NOT SUBMISSION. Nothing here joins, creates a participant, or sends a name. The join
 * request still carries whatever the field holds when the learner presses Continue.
 */
export function useSuggestedName(
  suggested: string | null | undefined,
  current: string,
  setName: (v: string) => void,
  touched: React.MutableRefObject<boolean>,
): void {
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    if (touched.current) return; // the learner got here first — leave it alone
    if (current !== "") return; // belt and braces: never replace existing text
    const v = (suggested ?? "").trim();
    if (!v) return; // no suggestion (anonymous, or an account with no provider name)
    seeded.current = true;
    setName(v);
  }, [suggested, current, setName, touched]);
}
