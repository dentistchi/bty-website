/**
 * The ONE spelling of the participant-session header, importable from both sides.
 *
 * `publicRoute.ts` is server-only (it imports `next/server` and the route cookie helpers), so a
 * browser transport cannot import the constant from there without dragging the server module into
 * a client bundle. The name lives here and the server module re-exports it, so there is exactly
 * one string and no chance of the two drifting.
 */
export const PARTICIPANT_SESSION_HEADER = "x-bty-foundry-participant";
