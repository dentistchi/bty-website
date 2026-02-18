import raw from "@/content/train-28days.json";

export type TrainDay = {
  day: number;
  date: string; // YYYY-MM-DD
  title: string;
  sections: Record<string, string>;
  raw: string;
};

const map = raw as Record<string, TrainDay>;

export function getTrainDay(day: number): TrainDay | null {
  return map[String(day)] ?? null;
}

export function getAllTrainDays(): TrainDay[] {
  return Object.values(map).sort((a, b) => a.day - b.day);
}
