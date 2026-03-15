import { LocaleAwareRouteLoading } from "@/components/LocaleAwareRouteLoading";

/**
 * Arena route loading: §9 locale 기반 로딩 문구 (pathname으로 ko/en 추론).
 */
export default function BtyArenaLoading() {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
      <LocaleAwareRouteLoading icon="📋" withSkeleton showHint={false} />
    </div>
  );
}
