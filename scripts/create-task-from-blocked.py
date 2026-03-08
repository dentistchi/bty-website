#!/usr/bin/env python3
"""
BLOCKED 검증 결과로 CURSOR_TASK_BOARD.md 맨 위(현재 작업 표 첫 행)에 새 task 추가.

사용:
  python3 scripts/create-task-from-blocked.py --cause "root cause 한 줄" --files "path1 path2" --tag UI
  echo "cause" | python3 scripts/create-task-from-blocked.py --files "a.ts b.tsx" --tag API

태그: AUTH | API | DOMAIN | UI | DOCS (필수)
"""

import argparse
import re
import sys

BOARD_PATH = "docs/CURSOR_TASK_BOARD.md"
TAG_VALID = {"AUTH", "API", "DOMAIN", "UI", "DOCS"}


def infer_tag_from_files(files: str) -> str:
    """파일 경로로 태그 추론. 확실하지 않으면 UI."""
    paths = files.strip().split()
    for p in paths:
        p = p.lower()
        if "middleware" in p or "auth" in p or "login" in p:
            return "AUTH"
        if "api/" in p or "route.ts" in p:
            return "API"
        if "domain/" in p or "engine" in p:
            return "DOMAIN"
        if "docs/" in p or ".md" in p:
            return "DOCS"
    return "UI"


def main() -> None:
    parser = argparse.ArgumentParser(description="Add a task from BLOCKED to CURSOR_TASK_BOARD.md")
    parser.add_argument("--cause", type=str, help="Root cause (한 줄 권장)")
    parser.add_argument("--files", type=str, required=True, help="Space-separated file paths")
    parser.add_argument("--tag", type=str, choices=list(TAG_VALID), help="AUTH|API|DOMAIN|UI|DOCS (default: infer from --files)")
    parser.add_argument("--board", type=str, default=BOARD_PATH, help=f"Path to board (default: {BOARD_PATH})")
    args = parser.parse_args()

    tag = args.tag or infer_tag_from_files(args.files)
    cause = (args.cause or "").strip() or "BLOCKED 해결"
    # 표에서 파이프 이스케이프: | 있으면 제거하거나 한 칸으로
    cause_clean = cause.replace("|", " ").strip()[:80]
    files_str = " ".join(args.files.strip().split()[:5])

    # [TAG] description 형태로 한 줄
    task_desc = f"[{tag}] {cause_clean} (blocked: {files_str})"
    new_row = f"| Fix/Polish | {task_desc} | <span style=\"color:red\">대기</span> | blocked |"

    with open(args.board, "r", encoding="utf-8") as f:
        content = f.read()

    # "## 현재 작업" 이후 첫 테이블 구분선(|---|) 다음에 새 행 삽입
    marker = "## 현재 작업"
    idx = content.find(marker)
    if idx == -1:
        print("FAIL: ## 현재 작업 not found", file=sys.stderr)
        sys.exit(1)
    rest = content[idx:]
    sep_match = re.search(r"\n(\|[-\s|]+\|)\n", rest)
    if not sep_match:
        print("FAIL: table separator not found", file=sys.stderr)
        sys.exit(1)
    insert_pos = idx + sep_match.end()
    new_content = content[:insert_pos] + new_row + "\n" + content[insert_pos:]

    with open(args.board, "w", encoding="utf-8") as f:
        f.write(new_content)

    print("TASK_ADDED")
    print(new_row)
    print("BOARD", args.board)


if __name__ == "__main__":
    main()
