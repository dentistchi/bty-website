"use client";

import { usePathname } from "next/navigation";
import { getMessages } from "@/lib/i18n";
import { LoadingFallback } from "@/components/bty-arena";

/**
 * CENTER_PAGE_IMPROVEMENT_SPEC §2, §9: 전환 중 로딩/대기 문구를 현재 locale에 맞게 표시.
 * pathname으로 locale 추론 (ko → 한국어, 그 외 → 영어).
 * [locale]/loading.tsx 또는 route별 loading.tsx에서 사용. icon·withSkeleton·wrapper 스타일 선택 가능.
 */
export interface LocaleAwareRouteLoadingProps {
  icon?: string;
  withSkeleton?: boolean;
  showHint?: boolean;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

export function LocaleAwareRouteLoading({
  icon = "⏳",
  withSkeleton = true,
  showHint = true,
  className,
  style,
  ariaLabel,
}: LocaleAwareRouteLoadingProps = {}) {
  const pathname = usePathname() ?? "";
  const locale = pathname.startsWith("/ko") ? "ko" : "en";
  const t = getMessages(locale).loading;

  const content = (
    <LoadingFallback icon={icon} message={t.message} withSkeleton={withSkeleton} />
  );

  if (showHint) {
    return (
      <div
        className={className ?? "min-h-screen flex flex-col items-center justify-center bg-[#F8F4F0] p-6"}
        style={style}
        aria-busy="true"
        aria-label={ariaLabel ?? t.message}
      >
        {content}
        <p className="text-xs mt-4 text-[#6B6560] opacity-80">{t.hint}</p>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={style}
      aria-busy="true"
      aria-label={ariaLabel ?? t.message}
    >
      {content}
    </div>
  );
}
