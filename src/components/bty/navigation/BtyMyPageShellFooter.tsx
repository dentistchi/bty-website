import { BtyMyPageTabs } from "./BtyMyPageTabs";

type Props = { locale: string };

/** My Page 카드 푸터: 서브 탭 (메인 3탭은 고정 `BottomNav`) */
export function BtyMyPageShellFooter({ locale }: Props) {
  return (
    <div className="space-y-3">
      <BtyMyPageTabs locale={locale} />
    </div>
  );
}
