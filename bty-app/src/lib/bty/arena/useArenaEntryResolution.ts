"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  arenaEntryContractFromResolutionPayload,
  defaultArenaEntryContract,
  type ArenaEntryContract,
} from "@/lib/bty/arena/arenaEntryContract";
import { ARENA_ENTRY_RESOLUTION_INVALIDATE_EVENT } from "@/lib/bty/arena/arenaEntryResolutionInvalidate";
import { fetchArenaEntryResolutionClient } from "@/lib/bty/arena/fetchArenaEntryResolution.client";

/**
 * Client-side Arena entry: conservative default href, then GET session-router snapshot authority.
 *
 * **First paint (P5 decision):** Keep {@link defaultArenaEntryContract} (`arena_play` → `/${locale}/bty-arena`) until
 * `fetchArenaEntryResolutionClient` settles. We intentionally **do not** block nav on a loading skeleton — href updates
 * on first successful fetch; failed fetch keeps the conservative default. Server-driven entry resolution (RSC/layout)
 * would remove first-paint mismatch; left as a **TODO** only if product requires zero default mismatch.
 *
 * Refetches when the route changes, when {@link dispatchArenaEntryResolutionInvalidate} from `arenaEntryResolutionInvalidate.ts` runs (e.g. after QR verify), or
 * when the tab becomes visible again — so entry href / active tab stay aligned with DB after post-contract resolution.
 *
 * @see `productArenaEntryGuard.ts` — do not add new static product CTAs bypassing this hook.
 */
export function useArenaEntryResolution(locale: "ko" | "en"): {
  contract: ArenaEntryContract;
  /** True until first fetch settles (success or failure — failure keeps default contract). */
  resolving: boolean;
} {
  const pathname = usePathname() ?? "";
  const [contract, setContract] = useState<ArenaEntryContract>(() => defaultArenaEntryContract(locale));
  const [resolving, setResolving] = useState(true);
  /** Bumps on custom invalidate + visibility — not part of URL; avoids stale entry after Center/My Page contract flow. */
  const [authorityTick, setAuthorityTick] = useState(0);

  useEffect(() => {
    const onInvalidate = () => setAuthorityTick((n) => n + 1);
    window.addEventListener(ARENA_ENTRY_RESOLUTION_INVALIDATE_EVENT, onInvalidate);
    return () => window.removeEventListener(ARENA_ENTRY_RESOLUTION_INVALIDATE_EVENT, onInvalidate);
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") setAuthorityTick((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setResolving(true);
    setContract(defaultArenaEntryContract(locale));
    void fetchArenaEntryResolutionClient(locale)
      .then((r) => {
        if (!cancelled) setContract(arenaEntryContractFromResolutionPayload(r));
      })
      .catch(() => {
        if (!cancelled) setContract(defaultArenaEntryContract(locale));
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, pathname, authorityTick]);

  return { contract, resolving };
}
