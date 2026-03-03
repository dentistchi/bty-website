"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { getSelfEsteemResult, getSafeMirrorPositive } from "@/lib/utils";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

const BRIDGE_CHECK_EVENT = "dear-bridge-check";

/**
 * The Bridge — 회복이 어느 정도 되었을 때만 "문 열고 나가기" 문구 표시 (CTA는 페이지 하단 단일 버튼으로 통합)
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

/** CENTER_PAGE_IMPROVEMENT_SPEC §5·§8: CTA 문구는 i18n center.bridgeHeading/bridgeSub. */
export function EmotionalBridge({
  theme = "sanctuary",
  locale = "ko",
}: {
  theme?: "dear" | "sanctuary";
  locale?: Locale;
}) {
  const visible = useBridgeVisible();
  const isDear = theme === "dear";
  const t = getMessages(locale).center;

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
        {t.bridgeHeading}
      </h2>
      <p
        className={cn(
          "text-sm mt-1",
          isDear ? "text-dear-charcoal-soft" : "text-sanctuary-text-soft"
        )}
      >
        {t.bridgeSub}
      </p>
    </section>
  );
}
