/**
 * ISO calendar day **YYYY-MM-DD** — 순수 검증. 멤버십 `joined_at` 등 날짜-only 필드용.
 * XP·랭킹·시즌 무관.
 * Non-strings (including top-level **`Symbol`** / **`bigint`**) → **`null`**.
 */

export const ARENA_ISO_DATE_ONLY_LENGTH = 10;

export function arenaIsoDateOnlyFromUnknown(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().slice(0, ARENA_ISO_DATE_ONLY_LENGTH);
  if (s.length !== ARENA_ISO_DATE_ONLY_LENGTH) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [ys, ms, ds] = s.split("-");
  const y = Number(ys);
  const mo = Number(ms);
  const d = Number(ds);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return null;
  return s;
}
