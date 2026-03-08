#!/usr/bin/env python3
from pathlib import Path
import argparse
import sys

ROOT = Path(__file__).resolve().parent.parent
BOARD = ROOT / "docs" / "CURSOR_TASK_BOARD.md"

HEADER_1 = "| Cursor 타입 | 할 일 (한 줄) | 상태 | 비고 |"
HEADER_2 = "|-------------|----------------|------|------|"

def insert_task_row(cursor_type: str, tag: str, task: str, note: str, status: str) -> None:
    if not BOARD.exists():
        raise SystemExit(f"missing board file: {BOARD}")

    text = BOARD.read_text(encoding="utf-8")
    lines = text.splitlines()

    header_idx = None
    sep_idx = None
    for i, line in enumerate(lines):
        if line.strip() == HEADER_1:
            header_idx = i
            if i + 1 < len(lines) and lines[i + 1].strip() == HEADER_2:
                sep_idx = i + 1
            break

    if header_idx is None or sep_idx is None:
        raise SystemExit("current task table header not found")

    status_html = f'<span style="color:red">{status}</span>' if status in ("대기", "진행 중") else status
    row = f"| {cursor_type} | [{tag}] {task} | {status_html} | {note} |"

    insert_at = sep_idx + 1
    lines.insert(insert_at, row)

    BOARD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("TASK ADDED")
    print(row)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--type", required=True, dest="cursor_type")
    parser.add_argument("--tag", required=True, choices=["AUTH", "API", "DOMAIN", "UI", "DOCS"])
    parser.add_argument("--task", required=True)
    parser.add_argument("--note", default="")
    parser.add_argument("--status", default="대기")
    args = parser.parse_args()

    insert_task_row(
        cursor_type=args.cursor_type,
        tag=args.tag,
        task=args.task,
        note=args.note,
        status=args.status,
    )

if __name__ == "__main__":
    main()
