export function extractChecklist(text: string): string[] {
  if (!text) return [];
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const items = lines
    .map((l) => l.replace(/^[-•\d\)\.]+/g, "").trim())
    .filter((l) => l.length >= 3);

  // 너무 길면 상위 6개만(UX)
  return items.slice(0, 6);
}
