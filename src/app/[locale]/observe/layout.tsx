import type { ReactNode } from "react";

/**
 * Observer route FLOOR (Slice R4-R1B).
 *
 * `/{locale}/observe/{id}` is reached by tapping a card inside the native app, so it must never
 * look like a web page opening. It had no floor and no loading boundary of its own, which meant
 * the nearest one applied — `[locale]/loading.tsx`, a CREAM `#F8F4F0` page with ⏳, skeleton bars
 * and "First load may take 1–2 minutes." Between navy Practice and the dark observer page, that
 * is the bootstrap flash the Founder saw.
 *
 * `/{locale}/app` already solved exactly this, twice: a server-rendered navy floor in its layout
 * and a calm navy `loading.tsx`. This is the same pair, in the same shape, for the one other
 * in-app destination — and the colour is the OBSERVER page's own `#0B1220` rather than the
 * shell's `#0B1F3A`, so the floor, the fallback and the loaded page are one continuous surface
 * with no second flash when content arrives.
 *
 * Server-rendered and unconditional, so it paints even if the client bundle never executes.
 * It does NOT gate auth — middleware still does that before this renders — and it changes
 * nothing about the observation request, its authority, or its payload.
 */
export default function ObserveLayout({ children }: { children: ReactNode }) {
  return (
    <div data-bty-observe-floor="1" style={{ minHeight: "100dvh", background: "#0B1220" }}>
      {children}
    </div>
  );
}
