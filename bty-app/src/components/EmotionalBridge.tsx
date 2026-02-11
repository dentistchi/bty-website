"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  getSelfEsteemResult,
  getSafeMirrorPositive,
} from "@/lib/utils";

const BRIDGE_CHECK_EVENT = "dear-bridge-check";
const BTY_PATH = "/bty";

/**
 * The Bridge — 회복이 어느 정도 되었을 때만 BTY(성장)로 가는 버튼 표시
 * 조건: 자존감 테스트 결과 mid 이상, 또는 Safe Mirror에서 AI 답장을 받은 경우
 */
function useBridgeVisible(): boolean {
  const [visible, setVisible] = useState(false);

  const check = () => {
    if (typeof window === "undefined") return;
    const result = getSelfEsteemResult();
    const selfEsteemOk =
      result?.level === "high" || result?.level === "mid";
    const safeMirrorOk = getSafeMirrorPositive();
    setVisible(Boolean(selfEsteemOk || safeMirrorOk));
  };

  useEffect(() => {
    check();
    window.addEventListener(BRIDGE_CHECK_EVENT, check);
    return () => window.removeEventListener(BRIDGE_CHECK_EVENT, check);
  }, []);

  return visible;
}

export function EmotionalBridge({ theme = "sanctuary" }: { theme?: "dear" | "sanctuary" }) {
  const visible = useBridgeVisible();
  const isDear = theme === "dear";

  if (!visible) return null;

  return (
    <section
      aria-labelledby="emotional-bridge-heading"
      className={cn(
        !isDear && "rounded-2xl border border-sanctuary-sage/50 bg-sanctuary-blush/30 p-6 sm:p-8",
        "text-center"
      )}
    >
      <h2
        id="emotional-bridge-heading"
        className={cn(
          "text-lg font-medium",
          isDear ? "font-serif text-dear-charcoal" : "text-sanctuary-text"
        )}
      >
        이제 문을 열고 밖으로 나가볼까요?
      </h2>
      <p
        className={cn(
          "text-sm mt-1 mb-4",
          isDear ? "text-dear-charcoal-soft" : "text-sanctuary-text-soft"
        )}
      >
        (Go to BTY Practice)
      </p>
      <a
        href={BTY_PATH}
        className={cn(
          "inline-block rounded-xl px-6 py-3 font-medium text-sm transition-colors",
          "animate-bridge-glow",
          isDear
            ? "bg-dear-sage text-white hover:bg-dear-sage-soft border border-dear-sage"
            : "bg-sanctuary-sage/80 text-sanctuary-text hover:bg-sanctuary-sage border border-sanctuary-sage/60"
        )}
      >
        이제 문을 열고 밖으로 나가볼까요? (Go to BTY Practice)
      </a>
    </section>
  );
}
