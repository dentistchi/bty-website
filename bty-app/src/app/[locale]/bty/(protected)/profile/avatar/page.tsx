import { Suspense } from "react";
import AvatarSettingsClient from "./AvatarSettingsClient";
import { PageLoadingFallback } from "@/components/bty-arena";

export const dynamic = "force-dynamic";

export default function AvatarSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 max-w-2xl mx-auto">
          <PageLoadingFallback />
        </div>
      }
    >
      <AvatarSettingsClient />
    </Suspense>
  );
}
