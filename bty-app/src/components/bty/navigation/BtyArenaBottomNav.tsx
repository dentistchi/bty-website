import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { BottomNav } from "./BottomNav";

type Active = "arena" | "growth" | "my-page";

type Props = {
  locale: string;
  active: Active;
};

/** Arena·Growth·My Page 3탭 (BTY_COMPONENT_PROPS_SPEC §7). Arena → wireframe 허브. */
export function BtyArenaBottomNav({ locale, active }: Props) {
  const base = `/${locale}`;
  const loc = locale as Locale;
  const t = getMessages(loc).uxPhase1Stub;
  return (
    <BottomNav
      aria-label="Arena main navigation"
      items={[
        {
          label: t.bottomNavArena,
          href: `${base}/bty-arena/wireframe`,
          active: active === "arena",
        },
        {
          label: t.bottomNavGrowth,
          href: `${base}/growth`,
          active: active === "growth",
        },
        {
          label: t.bottomNavMyPage,
          href: `${base}/my-page`,
          active: active === "my-page",
        },
      ]}
    />
  );
}
