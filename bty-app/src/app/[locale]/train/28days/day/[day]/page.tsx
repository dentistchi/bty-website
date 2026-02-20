import TrainDayClient from "@/components/train/TrainDayClient";

type DayParams = { day: string };

export default async function Page({ params }: { params: Promise<DayParams> }) {
  const { day } = await params;
  return <TrainDayClient day={day} />;
}
