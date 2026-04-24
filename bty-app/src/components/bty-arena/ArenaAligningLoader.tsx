"use client";

import React from "react";
import { LoadingFallback } from "./LoadingFallback";

type Props = {
  message: string;
  lead?: string;
  icon?: string;
};

/**
 * Unified “aligning with server” surface — intentional loader, not an error state.
 */
export function ArenaAligningLoader({ message, lead, icon = "📋" }: Props) {
  return (
    <div
      data-testid="arena-aligning-loader"
      aria-busy="true"
      aria-live="polite"
      className="mx-auto max-w-lg px-2"
    >
      {lead ? (
        <p className="mb-3 text-center text-sm text-bty-secondary/90" data-testid="arena-aligning-lead">
          {lead}
        </p>
      ) : null}
      <LoadingFallback icon={icon} message={message} withSkeleton />
    </div>
  );
}
