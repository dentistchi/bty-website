import { BtyArenaBottomNav } from "./BtyArenaBottomNav";
import { BtyMyPageTabs } from "./BtyMyPageTabs";

type Props = { locale: string };

/** My Page: 서브 탭 + 메인 3탭 BottomNav (Phase 1 스텁) */
export function BtyMyPageShellFooter({ locale }: Props) {
  return (
    <div className="space-y-3">
      <BtyMyPageTabs locale={locale} />
      <BtyArenaBottomNav locale={locale} active="my-page" />
    </div>
  );
}
