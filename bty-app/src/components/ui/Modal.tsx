"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  /** Visible title in DOM (sr-only). Prefer ariaLabel if you render your own heading. */
  title?: string;
  /** When set, dialog is labelled by this string instead of title (no duplicate sr-only heading). */
  ariaLabel?: string;
  children: React.ReactNode;
  className?: string;
};

export function Modal({ open, onClose, title, ariaLabel, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handle);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? undefined}
      aria-labelledby={!ariaLabel && title ? "modal-title" : undefined}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "relative w-full max-w-md rounded-2xl border border-foundry-purple-muted bg-foundry-white shadow-xl",
          "transition-all duration-200",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {!ariaLabel && title ? (
          <h2 id="modal-title" className="sr-only">
            {title}
          </h2>
        ) : null}
        {children}
      </div>
    </div>
  );
}
