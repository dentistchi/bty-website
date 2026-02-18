"use client";

function clampDay(n: number) {
  if (!Number.isFinite(n)) return 1;
  return Math.min(28, Math.max(1, n));
}

export default function TrainDayClient({ day }: { day: string }) {
  const dayNum = clampDay(Number(day));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Day {dayNum}</h1>

      <div className="rounded-lg border p-4 space-y-2">
        <div className="font-medium">오늘의 한 문장</div>
        <p className="opacity-80">{'"나는 안전하다. 지금은 내려놓아도 된다."'}</p>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <div className="font-medium">오늘의 실습</div>
        <p className="opacity-80">오늘 가장 긴장되는 한 가지를 적어봐.</p>
        <textarea className="w-full border rounded p-2 min-h-[120px]" placeholder="여기에 적어줘." />
      </div>
    </div>
  );
}
