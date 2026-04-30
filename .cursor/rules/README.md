# Cursor Rules — Legacy (Migrated to Claude Code)

이 폴더의 룰들은 모두 `.claude/`로 마이그레이션됨.

**마이그레이션 일자**: 2026-04-28
**가이드**: `.claude/migration-notes/MIGRATION_GUIDE.md`

## 현재 정책

- **Claude Code** (`claude` CLI) = 메인 도구
- **Cursor** = 백업 / 가끔 IDE로 사용
- 새 룰은 `.claude/`에만 추가
- 이 폴더는 **동결** (수정 금지)

## ⚠️ 중요

이 폴더의 룰을 수정하면 `.claude/`와 분기됨.
어느 게 진짜인지 모르게 됨.
모든 변경은 `.claude/`에서만 하라.

## 한 달 후 (2026-05-28경) 재평가

- Cursor 한 번도 안 썼다면 → 이 폴더 통째로 archive
- 가끔 썼다면 → 그대로 유지
