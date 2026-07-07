"use client";

import type { UserPatternSignaturePublic } from "@/lib/bty/arena/patternSignature.types";

type Props = {
  locale: string;
  rows: UserPatternSignaturePublic[] | undefined;
  title: string;
  lead: string;
  empty: string;
  regionAria: string;
};

/**
 * Arena pattern signatures — SUPPRESSED (P2 #1, Commander decision B).
 *
 * This panel previously exposed internal pattern-signature diagnostics directly to the user:
 *   - `pattern_family` — a raw enum key, rendered verbatim in `font-mono`
 *   - `axis` — a raw internal axis string
 *   - `current_state` — the raw `PatternSignatureAggregateState` enum, rendered as a badge
 * These are internal machine identifiers, not user-facing narrative. The remaining fields
 * (repeat count / confidence / watchpoint dates) are meaningless once the identifiers are
 * removed, and there is no i18n-safe standalone narrative substitute for the signature
 * identity — so the panel is collapsed (renders nothing) rather than shown headerless.
 *
 * Suppression is unconditional (independent of entry source / `arena_contract=resolve`).
 * No route/API/persistence change: `GET /api/bty/my-page/state` still returns
 * `pattern_signatures`; only this UI render is suppressed. The `Props` shape is preserved
 * so the call site compiles unchanged.
 */
export function PatternSignaturePanel(_props: Props) {
  return null;
}
