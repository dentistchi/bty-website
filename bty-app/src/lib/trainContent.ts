import raw from "@/content/train-28days.json";
import train from "@/data/train-28days.en-base.json";

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

type Locale = "en" | "ko";

export function getDayContent(day: number, locale: Locale = "en") {
  const d = (train as any).days[String(day)];
  if (!d) return null;

  const t = (x: any) => x?.[locale] ?? x?.en ?? x?.ko ?? "";

  return {
    day: d.day,
    title: t(d.title),
    sections: Object.entries(d.sections ?? {}).map(([key, val]) => ({
      key,
      label: t((train as any).meta.sectionLabels?.[key]),
      body: t(val),
    })),
  };
}

export function dateForDay(startDateISO: string, day: number) {
  const start = new Date(startDateISO + "T00:00:00");
  const dt = new Date(start);
  dt.setDate(start.getDate() + (day - 1));
  return dt.toISOString().slice(0, 10);
}
