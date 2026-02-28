# 성능·번들 점검 (NEXT_TASKS_2 §3-4)

**일자**: 2025-02 기준  
**범위**: 메인 경로 — 대시보드, Arena, 리더보드

---

## 1. 빌드 결과 요약 (Next.js 15 production build)

| 경로 | 페이지 크기 | First Load JS |
|------|-------------|----------------|
| `/[locale]/bty/dashboard` | 7.61 kB | **128 kB** |
| `/[locale]/bty-arena` | **40.4 kB** | **160 kB** |
| `/[locale]/bty/leaderboard` | 3.04 kB | **123 kB** |

- **공유 JS (shared by all)**: 106 kB  
- **Middleware**: 79.7 kB  
- 대시보드·리더보드는 First Load 123–128 kB로 양호. **Arena 페이지만 160 kB**로 상대적으로 무거움.

---

## 2. 개선 제안 (1~2개, 선택)

1. **Arena 페이지 (40.4 kB / 160 kB)**  
   시나리오 UI·상태·엔진이 한 청크에 포함되어 있음.  
   - **제안**: `ScenarioIntro`, `ChoiceList`, `OutputPanel` 등을 `next/dynamic`으로 lazy 로드하면 첫 화면(스텝 1) JS를 줄일 수 있음.  
   - 우선순위: 낮음 (선택). 체감 로딩이 문제될 때 적용.

2. **이미지 최적화 (LCP·대역폭)**  
   빌드 시 대시보드에서 `<img>` 사용에 대한 `@next/next/no-img-element` 경고가 있음.  
   - **제안**: 아바타/업로드 미리보기 등 고정 크기 이미지는 `next/image`로 교체 시 LCP·대역폭 개선 기대.  
   - 우선순위: 낮음. 필요 시 1~2곳부터 적용.

---

## 3. 확인 방법

- **번들 재점검**: `cd bty-app && npm run build` 후 터미널의 `Route (app)` 테이블에서 해당 경로의 Size / First Load JS 확인.
- **Lighthouse**: preview/prod 배포 후 메인 경로 3개에 대해 Performance·LCP 측정 (선택).
