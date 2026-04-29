#!/usr/bin/env bash
# 완료 알람 — 에이전트/작업 끝났을 때 터미널에서 실행하면 소리 + 알림.
# 사용: ./scripts/notify-done.sh 또는 bash scripts/notify-done.sh

set -e
if [[ "$OSTYPE" == "darwin"* ]]; then
  afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || true
  osascript -e 'display notification "작업 완료" with title "Cursor" sound name "Glass"' 2>/dev/null || true
else
  echo -e "\a"
fi
