import { LocaleAwareRouteLoading } from "@/components/LocaleAwareRouteLoading";

/** §2: 전환 중 로딩 문구는 locale에 맞게 (LocaleAwareRouteLoading이 pathname으로 ko/en 구분) */
export default function LocaleLoading() {
  return <LocaleAwareRouteLoading />;
}
