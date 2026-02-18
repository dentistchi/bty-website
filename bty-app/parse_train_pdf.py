import re, json, sys
from pathlib import Path
import PyPDF2

PDF = Path("src/content/사용자_28일실천가이드.pdf")  # 너 레포 경로에 맞게
OUT = Path("src/content/train-28days.json")

DAY_PATTERN = re.compile(r"Week\s*\d+\s*\|\s*Day\s*(\d+)\s*:\s*", re.IGNORECASE)

SECTION_KEYS = [
  "아침 의식",
  "핵심 실천",
  "왜 효과가 있을까?",
  "예상되는 저항",
  "돌파 전략",
  "저녁 의식",
  "오늘의 질문",
  "메모",
]

def parse_korean_date(text: str):
  m = re.search(r"(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일", text)
  if not m: return None
  y, mo, d = map(int, m.groups())
  return f"{y:04d}-{mo:02d}-{d:02d}"

def split_sections(seg: str):
  seg = seg.replace("\x00", "").strip()
  lines = [l.strip() for l in seg.splitlines() if l.strip()]
  title = lines[0] if lines else ""
  date = parse_korean_date(seg)

  positions = []
  for k in SECTION_KEYS:
    mm = re.search(re.escape(k), seg)
    if mm:
      positions.append((mm.start(), k))
  positions.sort()

  sections = {}
  for i, (st, key) in enumerate(positions):
    content_start = st + len(key)
    content_end = positions[i + 1][0] if i + 1 < len(positions) else len(seg)
    sections[key] = seg[content_start:content_end].strip()

  return title, date, sections

def main():
  reader = PyPDF2.PdfReader(str(PDF))
  all_text = ""
  for p in reader.pages:
    all_text += (p.extract_text() or "") + "\n"

  matches = list(DAY_PATTERN.finditer(all_text))
  if len(matches) < 28:
    raise SystemExit(f"Day marker 부족: {len(matches)}개 발견")

  out = {}
  for i, m in enumerate(matches):
    day = int(m.group(1))
    start = m.end()
    end = matches[i+1].start() if i+1 < len(matches) else len(all_text)
    seg = all_text[start:end].strip()
    title, date, sections = split_sections(seg)
    out[str(day)] = {
      "day": day,
      "date": date,
      "title": title,
      "sections": sections,
      "raw": seg.replace("\x00","").strip(),
    }

  OUT.parent.mkdir(parents=True, exist_ok=True)
  OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
  print("OK:", OUT)

if __name__ == "__main__":
  main()
