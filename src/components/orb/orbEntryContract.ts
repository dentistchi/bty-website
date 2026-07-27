/**
 * Canonical Orb hold-to-enter contract (Slice 3.2C-B3A.2F).
 *
 * The SINGLE source of the deliberate press-and-hold threshold shared by every door
 * that reuses the canonical {@link OrbLiving} runtime:
 *   - cold launch      → /start (StartShellClient)
 *   - the in-shell Me  → MeOrbDoor
 *
 * There is exactly ONE hold duration; neither door invents its own (Commander:
 * "do not invent a new threshold when one already exists"). Changing it here changes
 * BOTH doors together — do not fork this value back into a local literal.
 */
export const ORB_HOLD_MS = 3000;
