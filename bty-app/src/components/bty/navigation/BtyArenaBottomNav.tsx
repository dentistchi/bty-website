import BottomNav from "@/components/bty/navigation/BottomNav";

type Props = {
  locale: string;
};

/**
 * @deprecated Prefer `BottomNav` or `ScreenShell`; active 탭은 pathname으로 자동.
 * 하위 호환용 래퍼.
 */
export function BtyArenaBottomNav({ locale }: Props) {
  return <BottomNav locale={locale} aria-label="Arena main navigation" />;
}
