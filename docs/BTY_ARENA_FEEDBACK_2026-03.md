# BTY Arena 사용자 피드백 및 변경 사항 (2026-03)

QA/사용자 테스트에서 수집된 이슈와 의견. **변경 사항 서류**로 반영 요망.

---

## 1. 캐릭터의 옷이 입혀지지 않음 / 옷이 나타나지 않음

**현상**
- Avatar 화면에서 옷(Outfit)을 선택해도 메인 Preview에 반영되지 않음.
- Professional 테마의 옷 목록에서 선택한 아이템(예: 반팔 Figs 스크럽)을 선택해도, 작은 썸네일과 메인 Preview 모두 동일한 기본 위저드 모습만 표시됨.

**관련**
- `src/components/bty-arena/AvatarComposite.tsx`
- `src/lib/bty/arena/avatarOutfits.ts`, `avatarAssets.ts`
- `src/app/[locale]/bty/(protected)/profile/avatar/AvatarSettingsClient.tsx`

**에셋 현황 (확인 결과)**  
- **옷 이미지는 아직 없음.** `public/avatars/outfits/` 폴더에는 README.md만 있고, `outfit_scrub_general.png` 등 PNG 파일은 하나도 없음.  
- 코드·README는 `/avatars/outfits/outfit_{outfitId}.png` 규칙을 전제로 함.  
- **C5 제안대로** `public/avatars/outfits/outfit_scrub_general.png` 등 자산 추가가 필요함.

**설계: 체형 타입 4종 + 옷 매칭**  
- 캐릭터마다 자세·몸형이 다르면, **옷 1장을 모든 캐릭터에 공통으로 덮어씌우는 건 어색함.**  
- 제안: **(1) 모든 캐릭터를 비슷한 몸형으로 통일**하거나, **(2) 몸형을 3가지 타입(A/B/C)으로만 나누고, 옷도 타입별로 3벌 제작** 후 매칭.  
- (2)일 때: 캐릭터에 `bodyType: "A" | "B" | "C"` 부여, 옷 에셋은 `outfit_scrub_general_A.png` / `_B.png` / `_C.png` 또는 `outfits/typeA/outfit_scrub_general.png` 등 **타입별 파일**로 두고, 해석 시 `characterKey → bodyType → 해당 타입 outfit URL` 사용.  
- 그러면 “옷이 오버레이돼서 보이는” 수준에서도, 같은 타입 내에서는 포즈·실루엣이 맞아서 자연스럽게 보일 수 있음.

**조치**
- [ ] 옷 PNG 자산 추가: Professional 7종 — 체형 4종 도입 시 타입별 4벌 또는 통일 실루엣 1벌.
- [ ] (진행 중) 체형 타입 4종: 캐릭터별 bodyType 부여, outfit URL 해석 시 타입 반영 (avatarCharacters + avatarAssets/avatarOutfits 수정). 옷 4종 몸형별 제작 중.
- [ ] 옷 레이어가 Preview/썸네일에 실제로 합성되는지 확인 및 수정.
- [ ] API/이미지 URL이 outfit별로 올바르게 전달·표시되는지 검증.

---

## 2. 영어 버전인데 한글이 보임 (i18n)

**현상**
- UI 언어를 EN으로 두어도 일부 화면에서 한글만 노출됨.
- 예: Avatar 화면 "캐릭터 변경(잠김) — 다음 Code 진화 전까지 고정됩니다.", 옷 이름(일반 스크럽, Figs 스크럽 등)이 한글로만 표시.

**조치**
- [ ] Avatar/Profile 관련 문자열을 locale 기반 메시지로 분리 (getMessages(locale) 또는 공통 i18n 키).
- [ ] 옷 라벨 등 모든 사용자 가시 텍스트가 선택된 locale(en/ko)에 맞게 나오도록 수정.

---

## 3. Fantasy 테마에 옷 선택이 없음

**현상**
- Outfit theme에서 "Fantasy" 선택 시 "No outfits available for this theme."만 표시됨.
- Professional은 7종 옷이 있으나, Fantasy용 옷 데이터/UI가 없음.

**조치**
- [ ] 기획 결정: Fantasy 테마에 옷을 추가할지, 아니면 "준비 중" 등 안내 문구로 유지할지.
- [ ] 추가 시: `avatarOutfits`(또는 해당 데이터 소스)에 Fantasy용 outfit 목록 추가 및 UI 연동.

---

## 4. 시나리오 화면에서 Past scenarios 노출 — UX 의견

**현상**
- 시나리오/시뮬레이션 화면 하단에 "Past scenarios" 목록이 항상 표시됨.
- 의견: "보이는 게 도움이 될지, 안 보이는 게 더 깔끔할지" 검토 필요.

**조치**
- [x] 제품/UX 결정: Past scenarios **기본 노출 + 접기**로 확정.
- [x] UI 반영: `ArenaRunHistory` — 기본 노출, 접기/펼치기 토글 버튼, arenaRun i18n(pastScenariosExpand/Collapse/Heading).

---

## 5. 메뉴(네비게이션) 항목이 너무 많음 — 정리 필요

**현상**
- 상단에 Arena, Main, Dashboard, Leaderboard 등이 있고, 메인에는 "Practice & tools" 아래 Dojo 50 Questions, Integrity Mirror, Dr. Chi Mentor, Dashboard, Elite 등 카드가 다수 존재.
- 사용자 체감: "메뉴가 너무 많다. 깔끔하게 정리해야 한다."

**조치**
- [x] 정보 구조(I.A) 검토: **현재 BtyTopNav 플랫 유지**로 결정. 그룹핑·계층 정리는 추후 진행.
- [ ] (추후) 중복/유사 기능 통합·메뉴 라벨·배치 개선 시 재검토.

---

## 6. Leaderboard / Today's growth — 기능 동작 확인 필요

**현상**
- 같은 화면(메인 등)에 "Leaderboard" 링크와 "Today's growth" 섹션이 함께 있음.
- Leaderboard 전용 페이지에서는 "Failed" / "UNAUTHENTICATED" 로 데이터 미표시.
- 시뮬레이션 화면의 "Live ranking"에서는 "Failed to load" + Retry.
- Today's growth는 "No records yet. Try Arena or chat to start."로 비어 있음.

**조치**
- [ ] Leaderboard API 호출 시 인증(session/cookie)이 올바르게 전달되는지 확인.
- [ ] 인증 실패 시 재시도/리다이렉트 로그인 등 UX 처리.
- [ ] Today's growth 데이터 소스·조건 확인 후, 정상 데이터일 때만 노출하거나 빈 상태 문구 정리.

---

## 7. 시뮬레이션 중 에러 발생

**현상**
- 시뮬레이션 화면에서 "Past scenarios" 영역: "Could not load history." + Retry.
- "Live ranking" 영역: "Failed to load" + Retry.

**조치**
- [ ] Past scenarios history API: 엔드포인트·권한·응답 형식 점검.
- [ ] Live ranking API: 인증·권한·에러 핸들링 점검.
- [ ] 에러 시 사용자에게 안내 문구 및 Retry 동작이 명확한지 확인.

---

## 8. 리더보드 에러

**현상**
- Leaderboard 페이지에서 "Failed" / "UNAUTHENTICATED" 표시.
- 데이터가 로드되지 않음.

**조치**
- [ ] 리더보드 API가 인증된 사용자만 허용하는지, 쿠키/세션이 올바르게 포함되는지 확인.
- [ ] 미인증 시 로그인 유도 또는 "Sign in to see leaderboard" 등 명시 처리.
- [ ] docs/BTY_RELEASE_GATE_CHECK.md 등에 리더보드 인증 요구사항 반영.

---

## 9. 화면 이동 시 로딩 문구가 한글로 표시됨 (영어 버전에서도) — 서류 반영 요망

**현상**
- 언어를 EN으로 설정해도, 화면 전환 시 "로딩 중" 등 한글 로딩 문구가 뜸.
- 사용자 요청: "변경 사항 서류에 반영 요망."

**원인 후보 (코드 기준)**
- `bty-app/src/app/[locale]/bty-arena/loading.tsx`: `message="잠시만 기다려 주세요."` 로 **한글이 하드코딩**되어 있음. locale과 무관하게 표시됨.
- 기타 route `loading.tsx` 또는 Suspense fallback에서 `message`를 locale 없이 한글 고정으로 쓰는 부분이 있으면 동일 이슈.

**조치**
- [ ] **문서 반영**: 본 문서 §9에 위 내용 기재 완료.
- [ ] `bty-arena/loading.tsx`: locale을 읽어와서 `getMessages(locale).loading.message` 등으로 메시지 표시 (또는 LocaleAwareRouteLoading 사용).
- [ ] 프로젝트 전체에서 route loading / Suspense fallback 메시지가 locale 기반인지 검색·수정.
- [ ] i18n 규칙에 "로딩 문구는 반드시 현재 locale 사용" 명시.

---

## 요약 체크리스트

| # | 요약 | 우선순위 | 담당 |
|---|------|----------|------|
| 1 | 아바타 옷 미적용/미표시 | 높음 | UI/도메인 |
| 2 | EN에서 한글 노출 (Avatar 등) | 높음 | i18n |
| 3 | Fantasy 옷 없음 | 중간 | 기획/데이터 |
| 4 | Past scenarios 노출 여부 | 중간 | UX |
| 5 | 메뉴 정리 | 중간 | IA/디자인 |
| 6 | Leaderboard / Today's growth 동작 확인 | 높음 | API/인증 |
| 7 | 시뮬레이션 Past/Live 에러 | 높음 | API |
| 8 | 리더보드 UNAUTHENTICATED | 높음 | API/인증 |
| 9 | 로딩 문구 locale 반영 + 서류 반영 | 높음 | i18n |

---

## 참조

- 스크린샷: 2026-03-14 캡처 (Avatar, 시나리오, 메인, 시뮬레이션, 리더보드).
- 단일 작업 보드: `docs/SPRINT_PLAN.md`
- Release Gate: `docs/BTY_RELEASE_GATE_CHECK.md`
