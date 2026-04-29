"use client";

import React from "react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

type Tone = "arena" | "foundry" | "center" | "neutral";

export type EmptyStateProps = {
  tone?: Tone;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
};

/**
 * BTY Arena Design System – Empty state block.
 * Component Inventory: ui/EmptyState. bty-arena/EmptyState is the existing feature-specific variant.
 */
export function EmptyState({
  tone = "neutral",
  title,
  description,
  ctaLabel,
  onCtaClick,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "w-[360px] rounded-2xl border border-neutral-borderBase bg-neutral-bgBase p-6",
        "space-y-3"
      )}
    >
      <div className="space-y-1">
        <div className="text-h2">{title}</div>
        {description ? (
          <div className="text-body text-neutral-textLight">{description}</div>
        ) : null}
      </div>
      {ctaLabel ? (
        <div className="pt-2">
          <Button tone={tone} variant="primary" onClick={onCtaClick}>
            {ctaLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
