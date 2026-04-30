---
description: Service layer rules — orchestration only, no core business rules
paths:
  - bty-app/src/lib/bty/**
---

# Service Layer Rule

`src/lib/bty` 는 **서비스 계층**이다.

## 역할

- domain 호출
- repository 호출
- adapter 호출
- 여러 domain 규칙 조합
- API / UI에서 쓰기 좋은 shape 조립

## 금지

- 핵심 비즈니스 규칙 구현 (domain에)
- 상태 전이 정책 정의 (domain에)
- 순수 계산 공식 정의 (domain에)

## Import 규칙

### 허용

- `src/lib/bty` → `src/domain`
- `src/lib/bty` → adapter
- `src/lib/bty` → repository

### 금지

- `src/lib/bty` → `src/app`

*참조: `docs/architecture/DOMAIN_LAYER_TARGET_MAP.md`*
