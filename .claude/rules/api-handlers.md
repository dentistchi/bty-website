---
description: API handlers — thin entry points only, no business logic
paths:
  - bty-app/src/app/api/**
---

# API Thin Handler Rule

`src/app/api` 는 **얇은 진입점**으로 유지한다.

## 역할

1. request parsing
2. validation (Zod)
3. service 호출
4. response 반환

API handler **내부에서 비즈니스 규칙을 직접 구현하지 않는다.**

## 금지

- XP 계산
- leaderboard 규칙
- 상태 전이 정책
- 복잡한 데이터 조합
- 여러 도메인 규칙 직접 구현

## 허용

- API → `src/lib/bty` services 호출
- API → Zod 스키마로 입력 검증
- API → 서비스 결과를 클라이언트 형식으로 직렬화

## QR Validation (CRITICAL)

QR validation은 **반드시** `/api/arena/leadership-engine/qr/validate` 라우트만 통한다.
다른 경로에 QR 검증 로직 추가 금지.

*참조: `docs/architecture/DOMAIN_LAYER_TARGET_MAP.md`*
