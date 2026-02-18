"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TrainIndexPage() {
  const router = useRouter();

  useEffect(() => {
    // 기본은 Day 1로 (실제로는 progress 로드 후 가능 day로 이동하도록 TrainLayout에서 처리해도 됨)
    router.replace("/train/day/1");
  }, [router]);

  return null;
}
