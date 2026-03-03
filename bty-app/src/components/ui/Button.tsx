"use client";

import React from "react";
import { cn } from "@/lib/utils";

type Tone = "arena" | "foundry" | "center" | "neutral";
type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
};

const toneClass: Record<
  Tone,
  { primary: string; accent: string; bg: string; text: string; border: string }
> = {
  arena: {
    primary: "bg-arena-primary text-white",
    accent: "bg-arena-accent text-white",
    bg: "bg-arena-bg text-arena-text-primary",
    text: "text-arena-text-primary",
    border: "border-neutral-borderBase",
  },
  foundry: {
    primary: "bg-foundry-primary text-white",
    accent: "bg-foundry-accent text-white",
    bg: "bg-foundry-bg text-foundry-text-primary",
    text: "text-foundry-text-primary",
    border: "border-neutral-borderBase",
  },
  center: {
    primary: "bg-center-primary text-white",
    accent: "bg-center-accent text-neutral-textBase",
    bg: "bg-center-bg text-center-text-primary",
    text: "text-center-text-primary",
    border: "border-neutral-borderBase",
  },
  neutral: {
    primary: "bg-neutral-textBase text-white",
    accent: "bg-neutral-textLight text-white",
    bg: "bg-neutral-bgBase text-neutral-textBase",
    text: "text-neutral-textBase",
    border: "border-neutral-borderBase",
  },
};

const sizeClass: Record<Size, string> = {
  sm: "h-9 px-3 text-button rounded-md",
  md: "h-11 px-4 text-button rounded-lg",
  lg: "h-12 px-5 text-button rounded-xl",
};

export function Button({
  tone = "arena",
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 select-none whitespace-nowrap border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
  const hit = "min-w-[44px] min-h-[44px]";

  const variantStyle =
    variant === "primary"
      ? cn(toneClass[tone].primary, "border-transparent")
      : variant === "secondary"
        ? cn("bg-transparent", toneClass[tone].text, "border", toneClass[tone].border)
        : cn("bg-transparent", toneClass[tone].text, "border-transparent");

  const disabledStyle = "disabled:opacity-50 disabled:cursor-not-allowed";
  const motionReduced =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-reduced-motion") === "true";
  const transitionStyle = motionReduced ? "transition-none" : "transition-colors";

  return (
    <button
      className={cn(base, transitionStyle, hit, sizeClass[size], variantStyle, disabledStyle, className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <span className="text-caption">Loading…</span> : children}
    </button>
  );
}
