"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function BtyIndexPage() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  useEffect(() => {
    const base = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
    router.replace(`${base}/mentor`);
  }, [pathname, router]);
  return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">
      <p>Redirecting…</p>
    </div>
  );
}
