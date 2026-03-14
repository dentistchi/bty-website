# .cursor/rules — 추천 구조

계층·시스템 경계·import 방향용 **추천 규칙 세트** (6개).

```
bty-domain-pure-only.mdc
bty-service-layer.mdc
bty-api-thin-handler.mdc
bty-ui-render-only.mdc
bty-system-boundary.mdc
bty-import-direction.mdc
```

자세한 목표 구조와 매핑은 `docs/architecture/DOMAIN_LAYER_TARGET_MAP.md` 참조.

chat 계층(`src/lib/bty/chat`) 작업 시 추가 적용: **bty-chat-boundary.mdc** (`docs/architecture/CHAT_LAYER_SPEC.md` 연동).

지휘/오케스트레이션 모드: **c1-commander.mdc** (`docs/agent-runtime/C1_MASTER_COMMANDER.md` 연동).
