/**
 * Yesterday summary — pure copy builder (Slice 3.2C-B3A.2B).
 *
 * Turns canonical prior-day counts into one calm, truthful sentence (+ an optional
 * compact count line). Rules:
 *   - a category is OMITTED unless its count is a real number > 0 (an `undefined`
 *     count means the source was unavailable — never estimated);
 *   - singular/plural is correct;
 *   - if every supported count is zero, use canonical PRESENCE language only when
 *     presence is proven, otherwise a truthful neutral line;
 *   - no internal terms (Program / Run / Event / Foundry / ledger / progress).
 *
 * Pure domain: inputs in, strings out. No I/O.
 */

export type YesterdayCounts = {
  /** Trainings the user completed yesterday (undefined = source unavailable → omit). */
  trainingsCompleted?: number;
  /** New trainings the user created yesterday (undefined = omit). */
  trainingsCreated?: number;
  /** Center reflections/check-ins yesterday (undefined = omit). */
  centerReflections?: number;
  /** True only when a canonical presence/attendance record proves the user showed up. */
  presence?: boolean;
};

export type YesterdaySummary = { sentence: string; compact: string | null };

type Loc = "en" | "ko";

const n = (v: number | undefined): number | null => (typeof v === "number" && v > 0 ? v : null);

export function buildYesterdaySummary(c: YesterdayCounts, loc: Loc): YesterdaySummary {
  const completed = n(c.trainingsCompleted);
  const created = n(c.trainingsCreated);
  const center = n(c.centerReflections);

  if (loc === "ko") return ko(completed, created, center, c.presence === true);
  return en(completed, created, center, c.presence === true);
}

// ---------------------------------------------------------------------------
// English
// ---------------------------------------------------------------------------
function en(completed: number | null, created: number | null, center: number | null, presence: boolean): YesterdaySummary {
  const trainings = (k: number) => `${k} training${k === 1 ? "" : "s"}`;

  const clauses: string[] = [];
  if (completed) clauses.push(`completed ${trainings(completed)}`);
  if (created) clauses.push(`created ${trainings(created)}`);
  if (center) clauses.push(center === 1 ? "reflected in Center" : `completed ${center} Center reflections`);

  if (clauses.length === 0) {
    return { sentence: presence ? "You showed up yesterday." : "No completed activity was recorded yesterday.", compact: null };
  }

  const sentence = `You ${joinClauses(clauses)}.`;
  const compactParts: string[] = [];
  if (completed) compactParts.push(`${completed} learned`);
  if (created) compactParts.push(`${created} created`);
  if (center) compactParts.push(`${center} Center reflection${center === 1 ? "" : "s"}`);
  return { sentence, compact: compactParts.length > 1 ? compactParts.join(" · ") : null };
}

/** Oxford-style join: "a", "a and b", "a, b, and c". */
function joinClauses(parts: string[]): string {
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Korean
// ---------------------------------------------------------------------------
function ko(completed: number | null, created: number | null, center: number | null, presence: boolean): YesterdaySummary {
  const clauses: string[] = [];
  if (completed) clauses.push(`트레이닝 ${completed}개를 완료`);
  if (created) clauses.push(`트레이닝 ${created}개를 만들`);
  if (center) clauses.push("센터에서 성찰");

  if (clauses.length === 0) {
    return { sentence: presence ? "어제 당신은 이 자리에 왔습니다." : "어제 완료된 활동이 기록되지 않았습니다.", compact: null };
  }

  const sentence = `어제 ${clauses.join("하고, ")}했습니다.`;
  const compactParts: string[] = [];
  if (completed) compactParts.push(`${completed} 완료`);
  if (created) compactParts.push(`${created} 생성`);
  if (center) compactParts.push(`센터 성찰 ${center}`);
  return { sentence, compact: compactParts.length > 1 ? compactParts.join(" · ") : null };
}
