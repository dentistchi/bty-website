"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { JourneyBoard } from "@/components/journey/JourneyBoard";

export default function BtyPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const r = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
      const data = await r.json();

      if (cancelled) return;

      if (!data?.hasSession) {
        router.replace("/");
        router.refresh();
        return;
      }

      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) return <div>Loading...</div>;

  return <JourneyBoard />;
}
