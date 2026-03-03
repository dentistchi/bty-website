import { Suspense } from "react";
import AvatarSettingsClient from "./AvatarSettingsClient";
import { LoadingFallback } from "@/components/bty-arena";

export const dynamic = "force-dynamic";

export default function AvatarSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 max-w-2xl mx-auto">
          <LoadingFallback icon="⏳" message="Loading…" withSkeleton />
        </div>
      }
    >
      <AvatarSettingsClient />
    </Suspense>
  );
}
