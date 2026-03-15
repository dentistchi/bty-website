import { LocaleAwareRouteLoading } from "@/components/LocaleAwareRouteLoading";

/** §9 locale 기반 로딩 문구 */
export default function DearMeLoading() {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
      <LocaleAwareRouteLoading icon="✉️" withSkeleton showHint={false} />
    </div>
  );
}
