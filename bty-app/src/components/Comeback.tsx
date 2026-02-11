"use client";

import { useEffect, useState } from "react";
import {
  getLastVisit,
  setLastVisit,
  shouldShowComeback,
} from "@/lib/utils";
import { cn } from "@/lib/utils";

const COMEBACK_MESSAGE =
  "다시 돌아와줘서 고마워요. 언제든 기다리고 있었어요.";

/**
 * The Comeback (환영 인사)
 * - 3일 이상 미접속 후 복귀 시 "왜 안 왔어?"가 아닌 "다시 돌아와줘서 고마워요. 언제든 기다리고 있었어요." 표시.
 */

export function Comeback() {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;

    const last = getLastVisit();
    const now = Date.now();

    if (last === null) {
      setLastVisit(now);
      return;
    }

    if (shouldShowComeback()) {
      setShow(true);
    }
    setLastVisit(now);
  }, [mounted]);

  const close = () => setShow(false);

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="comeback-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dojo-ink/40"
      onClick={close}
    >
      <div
        className={cn(
          "rounded-2xl border border-dojo-purple-muted bg-dojo-white",
          "shadow-lg max-w-md w-full p-6 sm:p-8",
          "animate-fadeIn"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="comeback-title"
          className="text-lg font-semibold text-dojo-purple-dark"
        >
          돌아오신 걸 환영해요
        </h2>
        <p className="mt-3 text-dojo-ink leading-relaxed">
          {COMEBACK_MESSAGE}
        </p>
        <button
          type="button"
          onClick={close}
          className={cn(
            "mt-6 w-full py-3 rounded-xl font-medium",
            "bg-dojo-purple text-dojo-white hover:bg-dojo-purple-dark",
            "transition-colors"
          )}
        >
          확인
        </button>
      </div>
    </div>
  );
}
