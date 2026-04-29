# Phase 3-1: 아바타 서비스 선정

**목표**: "내 모습 닮은 아바타" 생성·표시를 위해, 2D 우선으로 쓸 아바타 서비스 1곳을 선정한다.

---

## 0. Ready Player Me 종료 (2026-01-31)

**Ready Player Me 서비스는 2026년 1월 31일 종료되었습니다.**  
기존 RPM 기반 아바타를 사용 중이었다면 아래 대안으로 마이그레이션을 검토해야 합니다.

---

## 1. 후보 요약

| 서비스 | 2D 지원 | 사진→아바타 | 비용(요약) | 정책·제약 |
|--------|---------|-------------|------------|-----------|
| **Ready Player Me** | ✅ (종료됨) | ✅ | **종료** 2026-01-31 | 서비스 중단 |
| **Avatar SDK** | ✅ Head/MetaPerson 2D | ✅ 사진 기반 | **Pro $800/월** (6,000 아바타), 초과 $0.03/개 | RPM 대체용 마이그레이션 지원, iframe+JS API 유사 |
| **Loom (Loom.ai / Loomie)** | 스티커/프로필 2D, 3D(GLTF) 중심 | ✅ 사진 기반 | **Basic 1k 호출**, Pro 100k, Enterprise 무제한 (문의) | 게이밍/VR/에이전시 타겟 |
| **Avaturn** | 3D 중심, export로 2D 활용 | ✅ 사진 업로드 API | **Pro $800/월** (6,000 아바타), 무료 티어 있음 | REST API, dataURL/httpURL export |
| **Meta Avatars** | 2D 앱 지원 (Horizon OS) | 메타 생태계 중심 | SDK 무료, **Meta Horizon OS** 전제 | VR/메타 플랫폼 연동 시 적합, 일반 웹앱 단독에는 부적합 |

---

## 2. 2D·웹앱 관점 비교

### Ready Player Me (2026-01-31 종료)

- **2D**: `GET https://models.readyplayer.me/{avatarId}.png` (옵션: `expression`, `pose`, `size`, `camera`, `background`, `quality`). 최대 1024px, portrait/fullbody 등.
- **생성**: Avatar Creator(iframe/WebView) + Photo Capture 요소로 사진 촬영·연동 가능. 생성된 아바타는 CDN에 저장되고 `avatarId`로 2D/3D 모두 조회.
- **웹**: REST API·React/웹 가이드 있음. 우리 스택(Next.js 등)에 연동 용이.
- **상태**: 서비스 종료. 기존 구현은 대안으로 마이그레이션 필요.

### Avatar SDK (RPM 대체 권장)

- **2D**: Head avatars REST API, MetaPerson full-body. iframe + JS API로 MetaPerson Creator 임베드 가능 (RPM과 유사한 플로우).
- **생성**: 사진 기반 생성, 실시간 커스터마이징. Web, Unity, Unreal 지원.
- **웹**: REST API, iframe 임베드, LOD·포맷(FBX/GLB)·텍스처 해상도 설정 가능.
- **마이그레이션**: RPM 종료 대비 마이그레이션 지원·샘플 프로젝트 제공. [support@avatarsdk.com](mailto:support@avatarsdk.com) 문의.

### Loom (Loom.ai / Loomie)

- **2D**: 스티커·프로필 사진 수준. 본격 2D 렌더 API는 3D(GLTF) 중심. Create & Animate 서비스에서 profile photos 지원.
- **생성**: REST API로 사진 기반 아바타 생성. OAuth 2.0 인증. Unity, Docker, REST, Web Browser 지원.
- **웹**: [Loomie API 문서](https://docs.loomai.com/). GLTF(3D) export는 프리미엄·별도 문의.
- **비용**: Basic 1k 호출, Pro 100k, Enterprise 무제한. 구체적 금액은 영업 문의.

### Avaturn

- **2D**: 3D 아바타 생성 후 export 시 `dataURL`(Base64) 또는 `httpURL`(영구 링크)로 2D 활용 가능.
- **생성**: `POST /avatars/new`로 사진 업로드 후 아바타 생성. `POST /exports/new`로 export.
- **웹**: REST API ([api.avaturn.me](https://api.avaturn.me/docs)), 유료 플랜에서 API 사용. 무료 티어는 UI만.
- **비용**: Pro $800/월 (6,000 아바타), 초과 $0.15/개. 무료 티어(제한 있음).

### Meta Avatars

- Horizon OS·메타 디바이스용. 일반 웹앱만 쓸 경우 2D 아바타 단독 도입에는 맞지 않음.

---

## 3. 비용·정책 요약

| 항목 | Avatar SDK | Loom | Avaturn | Meta |
|------|------------|------|---------|------|
| **개발/사용 비용** | Pro $800/월 (6,000 아바타), 초과 $0.03/개. 1주 무료 체험 | Basic 1k 호출, Pro 100k, Enterprise 문의 | Pro $800/월 (6,000 아바타), 무료 티어 있음 | SDK 무료, 플랫폼 제약 |
| **2D 이미지 URL** | REST API·Head avatars. MetaPerson은 Enterprise | 프로필/스티커 2D. 3D GLTF 별도 | export 시 `httpURL` 영구 링크 → DB 저장 | Horizon 2D 앱 문서 참고 |
| **데이터/정책** | 커스텀 데이터 보존 정책(Pro). [Privacy Policy](https://avatarsdk.com/privacy-policy/) | [Loom.ai Terms](https://loomai.com/terms) | Avaturn 이용약관 | 메타 이용약관·데이터 정책 적용 |
| **연동 방식** | iframe + JS API (RPM 유사), REST API, Unity/Unreal | REST API, OAuth 2.0, Unity/Docker/Web | REST API (`/avatars/new`, `/exports/new`), Session URL | Meta Horizon SDK |

---

## 4. 권장안 (2D 먼저, 웹앱 단독)

- **1순위: Avatar SDK**
  - RPM 종료 대비 공식 대체 옵션. iframe + JS API 플로우가 RPM과 유사해 마이그레이션 부담 적음.
  - 2D Head avatars REST API, MetaPerson full-body(Enterprise). Web·Unity·Unreal 지원.
  - Pro $800/월부터. 마이그레이션 시 할인·지원 문의 가능 ([support@avatarsdk.com](mailto:support@avatarsdk.com)).
- **2순위: Loom**
  - 프로필/스티커 2D 지원. Basic 1k 호출로 소규모 PoC 가능. 가격·2D API 스펙은 영업 문의.
- **3순위: Avaturn**
  - 3D 생성 후 export로 2D URL 확보. REST API 명확. 무료 티어로 검증 후 Pro 전환 가능.
- **제외**: Meta는 웹앱 단독 사용 시 부적합. RPM은 2026-01-31 종료.

---

## 5. 다음 단계 (3-2 연계)

- **Avatar SDK** 선정 시:
  - [ ] [Avatar SDK](https://avatarsdk.com/) 가입·Pro 체험(1주 무료).
  - [ ] MetaPerson Creator iframe·JS API 연동 ([RPM 마이그레이션 가이드](https://avatarsdk.com/blog/2026/01/15/switch-from-ready-player-me-to-avatar-sdk-fast-familiar-production-ready/)).
  - [ ] 생성된 아바타 → 2D URL 또는 avatar ID 저장 플로우 설계 (3-3 DB `avatar_url` 연동).
- **Loom** 선정 시:
  - [ ] [Loom.ai](https://loomai.com/pricing) 가입·Basic/Pro 플랜 확인.
  - [ ] [Loomie API](https://docs.loomai.com/) 문서로 프로필/스티커 2D 생성·저장 플로우 검토.
- **Avaturn** 선정 시:
  - [ ] [Avaturn Developer](https://developer.avaturn.me/) 프로젝트 생성·토큰 발급.
  - [ ] `POST /avatars/new` 사진 업로드 → `POST /exports/new` → `httpURL` 저장 플로우 검토.

---

## 6. RPM 마이그레이션 참고 (레거시)

RPM 기반 구현에서 대안으로 옮길 때 참고할 수 있는 RPM 당시 플로우입니다.

### 1) RPM Studio (종료됨 — 참고용)

1. **Studio(개발자 대시보드)** 접속: [https://studio.readyplayer.me](https://studio.readyplayer.me)
2. 가입한 계정으로 로그인.
3. **My Applications** 대시보드에서:
   - **Subdomain**: 앱별 서브도메인(예: `xxxxx`). Avatar Creator URL은 `https://xxxxx.readyplayer.me/` 형태.
   - **Application ID**: API 호출 시 사용하는 앱 ID. (앱 클릭 → 설정에서 확인)
4. 상단에서 Subdomain을 클릭하거나 URL을 복사해 **Avatar Creator** 미리보기로 들어가 보며, 옵션 변경 시 바로 반영되는지 확인.

참고: [Studio (Developer Dashboard)](https://docs.readyplayer.me/ready-player-me/customizing-guides/studio-developer-dashboard)

### 2) 우리 앱에 쓸 방식 정하기 (3-2 준비)

| 방식 | 설명 | 언제 쓰기 좋은지 |
|------|------|------------------|
| **Avatar Creator iframe** | RPM이 제공하는 생성 UI를 iframe으로 넣기. 사용자가 브라우저에서 직접 꾸미기·사진 촬영(Photo Capture). | 빠르게 “아바타 만들기” 화면을 넣고 싶을 때. |
| **REST API만** | 익명 유저 생성 → 템플릿 목록 조회 → 템플릿으로 아바타 생성·저장. [Quickstart](https://docs.readyplayer.me/ready-player-me/integration-guides/api-integration/quickstart) 참고. | 우리 UI로 단계를 완전히 제어하고 싶을 때. |

- **2D만 쓸 경우**: 아바타 생성/저장 후 **avatar ID**만 있으면 `https://models.readyplayer.me/{avatarId}.png?size=256&camera=portrait` 로 2D 이미지 사용 가능.
- **사진 기반 생성**을 쓰려면 Avatar Creator에 포함된 **Photo Capture** 플로우를 iframe으로 넣는 방식이 문서상 가장 명확함.

### 3) 3-2에서 할 일 (요약)

1. **iframe 연동**이면:  
   - 허용 도메인(로컬/스테이징/운영)을 Studio 앱 설정에 등록(문서·대시보드 확인).  
   - bty-app에 “아바타 만들기” 페이지 추가 → `https://{subdomain}.readyplayer.me/` iframe 삽입.  
   - [postMessage API](https://docs.readyplayer.me/ready-player-me/integration-guides/api-integration/custom-avatar-creator)로 “아바타 생성 완료” 이벤트 수신 후 `avatarId` 취득.
2. **avatarId 저장**:  
   - 3-3에서 `arena_profiles`(또는 프로필 테이블)에 `avatar_url` 컬럼 추가.  
   - 저장 시 URL은 `https://models.readyplayer.me/{avatarId}.png?size=256&camera=portrait` 형태로 저장하거나, `avatar_id`만 저장하고 노출 시 URL 조합.
3. **대시보드·리더보드 노출**(3-4·3-5):  
   - 위 URL을 쓰는 공통 `UserAvatar` 컴포넌트 하나 만들고, 대시보드·프로필·(선택) 리더보드에 배치.

### 4) RPM → Avatar SDK 마이그레이션 요약

- **2D URL**: RPM `https://models.readyplayer.me/{avatarId}.png` (종료) → Avatar SDK REST API·Head avatars
- **iframe**: Avatar Creator + Photo Capture → MetaPerson Creator (iframe + JS API 유사)
- **저장**: `arena_profiles.avatar_url`에 2D URL 저장 — 구조 동일

Avatar SDK는 RPM과 플로우가 비슷해 마이그레이션 부담이 적습니다. [support@avatarsdk.com](mailto:support@avatarsdk.com) 문의.

---

## 7. 참고 링크

### RPM 대안 (2026-01-31 종료 대비)

- **Avatar SDK**: [Pricing](https://avatarsdk.com/pricing-cloud/), [RPM 마이그레이션 가이드](https://avatarsdk.com/blog/2026/01/15/switch-from-ready-player-me-to-avatar-sdk-fast-familiar-production-ready/), [API](https://api.avatarsdk.com/)
- **Loom**: [Loom.ai Pricing](https://loomai.com/pricing), [Loomie API](https://docs.loomai.com/), [Terms](https://loomai.com/terms)
- **Avaturn**: [Pricing](https://avaturn.me/pricing/), [API Docs](https://docs.avaturn.me/api/), [Basic Flow](https://docs.avaturn.me/docs/integration/api/basic_flow/)

### 기타

- **Meta**: [Meta Avatars SDK](https://developers.meta.com/horizon/discover/avatars)
- **RPM (종료)**: [2D Render API](https://docs.readyplayer.me/ready-player-me/api-reference/rest-api/avatars/get-2d-avatars) — 참고용

---

*이 문서는 Phase 3-1 아바타 서비스 선정 산출물이며, `docs/PROJECT_PROGRESS_ORDER.md` 및 `bty-app/docs/ROADMAP_NEXT_STEPS.md` Phase 3와 연동됩니다. RPM 종료(2026-01-31) 대비 Loom·Avatar SDK·Avaturn 등 대안을 정리했습니다.*
