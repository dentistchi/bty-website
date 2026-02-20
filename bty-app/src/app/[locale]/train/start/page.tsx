"use client";

import Link from "next/link";

export default function TrainStartPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">28일 훈련 시작</h1>
      <p className="opacity-80">
        왼쪽에서 Day를 선택하면 레슨이 보이고, 오른쪽에서 코치와 대화할 수 있어요.
      </p>
      <div className="rounded-lg border p-4">
        <Link className="underline" href="/train/day/1">
          Day 1부터 시작하기
        </Link>
      </div>
    </div>
  );
}
