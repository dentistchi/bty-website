import { LocaleAwareRouteLoading } from "@/components/LocaleAwareRouteLoading";

/**
 * §9 locale 기반 로딩 문구. pathname으로 ko/en 추론.
 */
export default function DashboardLoading() {
  return (
    <div className="p-6" style={{ maxWidth: 980, margin: "0 auto" }}>
      <LocaleAwareRouteLoading icon="📋" withSkeleton showHint={false} />
    </div>
  );
}
