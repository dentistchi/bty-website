# Feature Pipeline

작업은 **Feature 단위**로 관리한다.

---

## 작업 선택 규칙

1. **현재 IN PROGRESS Feature 확인**
2. **해당 Feature의 Task 우선 수행**
3. Feature의 Task가 **모두 완료**되면 → Status **DONE** 처리
4. **다음 Feature** 시작

---

## 우선순위

1. **Arena**
2. **Center**
3. **Foundry**
4. **Platform**

---

## System Boundary

프로젝트는 세 시스템으로 나뉜다. **MODE**가 설정되면 **해당 영역 코드만** 수정한다.

### ARENA MODE

**허용 경로**

- `src/app/[locale]/bty-arena/`
- `src/components/bty-arena/`
- `src/lib/bty/arena/`
- `src/app/api/arena/`

### CENTER MODE

**허용 경로**

- `src/app/[locale]/dear-me/`
- `src/domain/center/`
- `src/app/api/center/`

### FOUNDRY MODE

**허용 경로**

- `src/app/[locale]/bty/(protected)/`
- `src/domain/dojo/`
- `src/app/api/dojo/`

---

## 적용 원칙

- 작업 생성·할당 시 **Boundary를 벗어나지 않도록** 제한한다.
- 공통/인프라(예: auth, layout, Nav)는 MODE와 무관하게 필요 시 수정 가능하다는 별도 규칙이 있으면 그에 따른다.

---

## Feature 목록 (예시)

| Feature | Status | MODE | 비고 |
|---------|--------|------|------|
| *(추가 시 이 표에 Feature·Status·MODE 기록)* | | | |

*이 파일을 갱신할 때는 CURSOR_TASK_BOARD·CURRENT_TASK·NEXT_PHASE_AUTO4의 First Task가 현재 IN PROGRESS Feature의 Task와 일치하도록 유지한다.*
