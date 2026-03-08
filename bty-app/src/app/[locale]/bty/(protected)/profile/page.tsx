import { Suspense } from "react";
import ProfileClient from "./ProfileClient";
import { LoadingFallback } from "@/components/bty-arena";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 max-w-2xl mx-auto">
          <LoadingFallback icon="⏳" message="Loading…" withSkeleton />
        </div>
      }
    >
      <ProfileClient />
    </Suspense>
  );
}
