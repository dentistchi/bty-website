---
description: BTY Architecture rules — layer boundaries, import direction, system separation
paths:
  - bty-app/src/**
---

# Architecture Rules

이 문서는 다음 3개 룰을 통합합니다:
- bty-import-direction (의존 방향)
- bty-layer-import (계층 검사)
- bty-system-boundary (시스템 영역 구분)

*참조: `docs/architecture/DOMAIN_LAYER_TARGET_MAP.md`, `docs/architecture/ARCHITECTURE_MAP.md`*

---

## 1. Import Direction (의존 방향)

```text
UI (app, components)  →  API (app/api)  →  Service (lib/bty)  →  Domain (domain)
```

### 허용

- UI → API, Service, Domain
- API → Service, Domain
- Service → Domain
- Service → adapter, repository

### 금지

- domain → lib
- domain → api
- domain → ui
- domain → external service
- lib → ui
- lib/bty → app

---

## 2. Layer Boundary 검사 (4항)

1. **`src/domain` 은 `src/lib` 또는 `src/app` 을 import 할 수 없다.**
   Domain은 순수 규칙·타입·value object·repository interface만; 외부 기술/프레임워크 의존 금지.

2. **`src/lib/bty` 는 `src/app` 을 import 할 수 없다.**
   Service/조립 계층은 domain만 참조하고, app·components 쪽을 참조하지 않는다.

3. **`src/app/api` 는 domain 규칙을 직접 구현할 수 없다.**
   API handler는 request → validation → **service 호출** → response만. 비즈니스 로직은 domain/lib에 두고 호출.

4. **UI는 domain 규칙을 직접 구현할 수 없다.**
   `src/app`, `src/components` 는 전달받은 데이터를 렌더만 하고, XP/리더보드/시즌 등 규칙 계산·정렬·상태 전이를 하지 않는다.

---

## 3. System Boundary (Arena / Center / Foundry)

BTY 시스템은 **세 영역**으로 나뉜다. 각 시스템은 **자기 영역 코드만** 수정한다.

### Arena
- `src/domain/arena`
- `src/lib/bty/arena`
- `src/app/[locale]/bty-arena`

### Center
- `src/domain/center`
- `src/lib/bty/center`
- `src/app/[locale]/dear-me`

### Foundry
- `src/domain/foundry`
- `src/lib/bty/foundry`
- `src/app/[locale]/bty/(protected)`

**다른 시스템의 domain 규칙을 직접 수정하지 않는다.**

---

## 위반 시 행동

- 새로 추가하는 import가 위 규칙을 어기면 수정 제안
- 리팩터 시 기존 위반을 정리할 때 이 규칙을 적용

## Checklist

- [ ] domain 파일에 `from '…/lib/…'` 또는 `from '…/app/…'` 없음
- [ ] lib/bty 파일에 `from '…/app/…'` 없음
- [ ] app/api handler 안에 비즈니스 규칙 구현 없음 (service/domain 호출만)
- [ ] UI에 XP/리더보드/시즌 규칙 계산·정렬 없음
- [ ] 다른 시스템(Arena/Center/Foundry)의 domain을 import하지 않음
