# 아바타 레이어 명세 — 캐릭터 고정 + 옷 선택 (개발자 모드용)

**목표**: 아바타를 캐릭터(base) + 옷(outfit) + 악세사리(accessory) 레이어로 저장/조회/수정하고, 리더보드·대시보드에서 키 기반으로 합성 렌더링한다.

**상세 및 Cursor 할일**: 이 문서 §6·§7에 정리.  
**커맨더 백로그**: [COMMANDER_BACKLOG_AND_NEXT.md](./COMMANDER_BACKLOG_AND_NEXT.md) §4.2, §8 테이블 "Arena 아바타" → 이 문서로 대체·연결.

---

## 0. 브레인스토밍 축 — 이번 구현에서 딱 5개만 "고정 결정"

| # | 결정 | 설명 |
|---|------|------|
| 1 | **서버는 URL 대신 키(key)를 내려준다** | DB에는 `char_01`, `fantasy_outfit_07` 같은 **키** 저장. 프론트는 `assetMap[key] => URL` 로 매핑. 에셋 경로가 바뀌어도 DB 마이그레이션 없음. |
| 2 | **선택 저장 필드는 최소 2개** | `avatar_selected_outfit_id` (필수), `avatar_accessory_ids` (옵션, 배열). |
| 3 | **캐릭터 잠금 정책은 DB에서 강제** | `avatar_character_locked = true` 이면 `avatar_character_id` 변경 불가. **트리거**로 강제. |
| 4 | **레이어 순서(z-index)** | base(얼굴/몸) → outfit(옷) → accessory(악세사리). |
| 5 | **리더보드 성능** | thumb(작은 PNG) + lazy-load 전제. 한 화면 50명 대비. |

---

## 1. DB 변경 (Supabase / Postgres)

### 1.1 컬럼 추가

- `arena_profiles` 에 이미 있음: `avatar_character_id`, `avatar_character_locked`, `avatar_outfit_theme`, `avatar_selected_outfit_id`.
- **추가**:
  - `avatar_accessory_ids` — `text[] not null default '{}'::text[]`
  - (선택) `avatar_outfit_updated_at`, `avatar_accessories_updated_at` — `timestamptz`

```sql
-- 1) arena_profiles에 선택 옷/악세사리 추가
alter table public.arena_profiles
  add column if not exists avatar_accessory_ids text[] not null default '{}'::text[];

-- (선택) 마지막 변경 추적
alter table public.arena_profiles
  add column if not exists avatar_outfit_updated_at timestamptz,
  add column if not exists avatar_accessories_updated_at timestamptz;
```

### 1.2 캐릭터 잠금 트리거

- `avatar_character_locked = true` 일 때 `avatar_character_id` 변경 시도 시 예외 발생.

```sql
create or replace function public.enforce_avatar_character_lock()
returns trigger language plpgsql as $$
begin
  if (old.avatar_character_locked = true) then
    if (new.avatar_character_id is distinct from old.avatar_character_id) then
      raise exception 'avatar_character_id is locked';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_avatar_character_lock on public.arena_profiles;
create trigger trg_enforce_avatar_character_lock
  before update on public.arena_profiles
  for each row execute function public.enforce_avatar_character_lock();
```

### 1.3 RLS (요지)

- 본인 프로필만 UPDATE 가능.
- 리더보드용 SELECT는 기존 정책(또는 `get_leaderboard_profiles` RPC) 유지 — 아바타 관련 컬럼 포함해 공개 가능.

---

## 2. 키 기반 에셋 맵 (프론트/서버 컨벤션)

### 2.1 키 규칙 예시

- **캐릭터**: 기존 id를 키로 사용 (예: `hero_01`, `mage_02`) 또는 `char_01`~`char_04` 등.
- **옷**: `{theme}_outfit_{id}` — 예: `professional_outfit_figs_scrub`, `fantasy_outfit_adventurer`.
- **악세사리**: `acc_{name}_{nn}` — 예: `acc_crown_01`, `acc_handpiece`.

(기존 코드는 `avatar_character_id` = hero_01, `avatar_selected_outfit_id` = figs_scrub 이므로, API 응답에서 **outfitKey** = `theme + "_outfit_" + outfitId` 로 내려주면 됨.)

### 2.2 프론트 `avatarAssets.ts` (또는 기존 모듈 확장)

- `characterAssetMap`: key → `{ base, thumb? }`
- `outfitAssetMap`: key → `{ layer, thumb?, theme }`
- `accessoryAssetMap`: key → `{ layer, thumb? }`
- `resolveAvatarUrls({ characterKey, outfitKey?, accessoryKeys?, useThumb? })` → `{ characterUrl, outfitUrl?, accessoryUrls[] }`

위치: `src/lib/bty/arena/avatarAssets.ts` (신규) 또는 `avatarOutfits.ts` / `avatarCharacters.ts` 확장.

---

## 3. API 설계 (GET / PATCH)

### 3.1 DTO

- **서버가 내려주는 표시용 키** (GET 프로필/아바타, 리더보드 행):

```ts
export type AvatarCompositeKeys = {
  characterKey: string;           // 예: hero_01
  theme: "professional" | "fantasy";
  outfitKey: string | null;       // 예: fantasy_outfit_adventurer
  accessoryKeys: string[];       // 예: ["acc_crown_01"]
};
```

- **PATCH 요청**:

```ts
export type PatchAvatarRequest = {
  theme?: "professional" | "fantasy";
  outfitKey?: string | null;     // theme 내 유효한지 서버 검증
  accessoryKeys?: string[];      // 허용 슬롯/티어 검증
};
```

- **응답**: `{ avatar: AvatarCompositeKeys }` 또는 기존 `profile` 객체에 `avatar` 필드로 포함.

### 3.2 API 확장: UI용 응답 — `allowed` 포함 (추천)

GET 응답에서 아바타 키에 더해 **허용 목록**을 같이 내려주면, 프론트가 탭/갤러리/슬롯을 바로 그릴 수 있고 치팅 방지(서버가 허용한 것만 표시)가 유지된다.

```ts
export type AvatarUiResponse = {
  avatar: {
    characterKey: string;
    theme: "professional" | "fantasy";
    outfitKey: string | null;
    accessoryKeys: string[];
    characterLocked: boolean;
  };
  allowed: {
    outfits: Array<{ key: string; name: string; rarity?: "common" | "rare" | "epic" }>;
    accessorySlots: number;   // tier 기반
    accessories: Array<{ key: string; name: string }>;  // (옵션) 허용 악세사리 목록
  };
};
```

- **bty-app 경로**: `GET /api/arena/profile` 확장 또는 전용 `GET /api/arena/profile/avatar` → 위 `AvatarUiResponse` 반환.

### 3.3 허용 옷/악세사리 검증 (서버)

- **옷**: 기존 `getOutfitById(theme, outfitId)` 또는 테마별 허용 목록과 비교. `outfitKey`에서 theme + outfitId 파싱 후 검증.
- **악세사리**: tier/level 기반 허용 슬롯 수 (예: tier 25마다 1슬롯). `accessoryKeys.length <= allowedSlots` 검증.

### 3.4 GET에서 `allowed` 내려주기 (치팅 방지 핵심)

서버에서 사용자 `levelId` / `tier` 를 읽고 다음을 계산해 내려준다.

- **allowedOutfits(theme, levelId)** → 해당 테마·레벨에서 열린 옷만 `allowed.outfits[]`
- **accessorySlots(tier)** → tier 기반 슬롯 수 (예: tier 25마다 1슬롯)
- (선택) 허용 악세사리 목록 → `allowed.accessories[]`

**PATCH 검증 (필수)**  
- `outfitKey` 가 `allowed.outfits` 에 있는지  
- `accessoryKeys.length <= allowed.accessorySlots`  
- theme 변경 시 `outfitKey` 가 null 이면 서버가 레벨 기본 outfit 으로 채워도 됨

### 3.5 엔드포인트

- **GET** `/api/arena/profile` 확장 또는 **GET** `/api/arena/profile/avatar`: `AvatarUiResponse` (avatar + allowed) 반환.
- **PATCH** `/api/arena/profile` (기존) 또는 **PATCH** `/api/arena/profile/avatar`: `theme` / `outfitKey` / `accessoryKeys` 업데이트. 위 검증 적용.

(bty-app: `src/app/api/arena/profile/route.ts` GET 확장 또는 `src/app/api/arena/profile/avatar/route.ts` 신규.)

---

## 4. 리더보드 응답 형태

리더보드 Row에 아바타 **키** 포함 (URL 아님).

```ts
export type LeaderboardRow = {
  userId: string;
  displayName: string;
  score: number;
  avatar: {
    characterKey: string;
    theme: "professional" | "fantasy";
    outfitKey: string | null;
    accessoryKeys: string[];
  };
};
```

프론트는 `resolveAvatarUrls({ ...row.avatar, useThumb: true })` 로 URL 해석 후 `AvatarComposite` 로 렌더링.

---

## 5. 프론트: CSS 레이어 합성 컴포넌트 `AvatarComposite`

- **Props**: `size`, `characterUrl`, `outfitUrl?`, `accessoryUrls[]`, `alt`, `className`.
- **구조**: `position: relative` 컨테이너 안에, 레이어 순서대로:
  1. base (character) — zIndex 1  
  2. outfit — zIndex 2  
  3. accessories — zIndex 3, 4, …
- **스타일**: 각 레이어 `position: absolute`, `inset: 0`, `objectFit: contain`, `loading="lazy"`.
- **접근성**: `aria-label={alt}`, 이미지 `alt` 처리.

위치: `src/components/AvatarComposite.tsx` (또는 `src/components/bty-arena/AvatarComposite.tsx`).

리더보드/대시보드에서는 `resolveAvatarUrls(..., { useThumb: true })` + `AvatarComposite` 사용.

---

### 5.1 UX 흐름 (최소, 운영용) — 프로필/아바타 화면

| 영역 | 내용 |
|------|------|
| **상단** | `AvatarComposite` 미리보기 (base + outfit + accessory) |
| **탭/토글** | Theme 선택 (professional / fantasy) |
| **Outfit Gallery** | 서버가 내려준 `allowed.outfits[]` 만 카드로 표시. 카드 클릭 → 미리보기 반영 → "저장" 버튼 활성화 (또는 즉시 저장 가능) |
| **Accessories** | `allowed.accessorySlots` 만큼 슬롯 표시. 슬롯 클릭 → 허용 악세사리 목록에서 선택 (랜덤 보너스는 별도 버튼) |
| **캐릭터 변경** | `avatar.characterLocked === true` 이면 버튼 숨김 또는 disabled + "다음 Code 진화 전까지 고정" 문구 |

### 5.2 훅: `useAvatar`

- `GET /api/arena/profile/avatar` (또는 profile 확장) 호출 → `data: AvatarUiResponse`
- `patch(payload)` → PATCH 후 로컬 `data.avatar` 갱신
- bty-app: API 경로는 ` /api/arena/profile` 이면 `fetch("/api/arena/profile")` 로 통일 가능. 전용 avatar 라우트를 쓰면 `fetch("/api/arena/profile/avatar")`.

```ts
// src/hooks/useAvatar.ts
export function useAvatar() {
  const [data, setData] = useState<AvatarUiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const r = await fetch("/api/arena/profile/avatar");  // or /api/arena/profile
    const j = await r.json();
    setData(j);
    setLoading(false);
  }
  async function patch(payload: { theme?: "professional" | "fantasy"; outfitKey?: string | null; accessoryKeys?: string[] }) {
    const r = await fetch("/api/arena/profile/avatar", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json();
    setData((prev) => (prev ? { ...prev, avatar: j.avatar ?? prev.avatar } : prev));
    return j;
  }
  useEffect(() => { refresh(); }, []);
  return { data, loading, refresh, patch };
}
```

### 5.3 컴포넌트: `OutfitCard`

- `characterKey`, `outfitKey`, `accessoryKeys`, `selected`, `onClick`. `resolveAvatarUrls(..., useThumb: true)` + `AvatarComposite` 로 카드 내 미리보기.

```tsx
// src/components/bty-arena/OutfitCard.tsx
import { resolveAvatarUrls } from "@/lib/bty/arena/avatarAssets";
import { AvatarComposite } from "@/components/AvatarComposite";

export function OutfitCard({
  characterKey,
  outfitKey,
  accessoryKeys,
  selected,
  onClick,
}: {
  characterKey: string;
  outfitKey: string;
  accessoryKeys: string[];
  selected: boolean;
  onClick: () => void;
}) {
  const urls = resolveAvatarUrls({
    characterKey,
    outfitKey,
    accessoryKeys,
    useThumb: true,
  });
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-xl border p-3 text-left transition",
        selected ? "border-black" : "border-gray-200 hover:border-gray-400",
      ].join(" ")}
      type="button"
    >
      <div className="flex items-center gap-3">
        <AvatarComposite
          size={56}
          characterUrl={urls.characterUrl!}
          outfitUrl={urls.outfitUrl}
          accessoryUrls={urls.accessoryUrls}
        />
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{outfitKey}</div>
          <div className="text-xs opacity-60">미리보기</div>
        </div>
      </div>
    </button>
  );
}
```

### 5.4 프로필/아바타 페이지: `AvatarSettingsPage`

- `useAvatar()` → `data.avatar`, `data.allowed`
- 상단: 미리보기 `AvatarComposite`, 캐릭터 변경 버튼 (characterLocked 이면 disabled + "캐릭터 변경(잠김)")
- 테마 토글 (professional / fantasy)
- Outfit Gallery: `allowed.outfits` 중 현재 테마에 맞는 것만 필터 → `OutfitCard` 그리드. 클릭 시 draftOutfitKey 갱신.
- 저장 버튼: dirty 일 때만 활성화, PATCH 호출.

**bty-app 경로**: `src/app/[locale]/bty/(protected)/dashboard/page.client.tsx` 내 아바타 섹션 또는 전용 `src/app/[locale]/bty/(protected)/profile/avatar/page.tsx`.

**페이지 예시 (참고용)**  
- `useAvatar()` 로 `data?.avatar`, `data?.allowed` 사용.  
- `draftTheme`, `draftOutfitKey` 로컬 state, `avatar` 로드 후 초기화.  
- `previewUrls = resolveAvatarUrls({ characterKey, outfitKey: draftOutfitKey, accessoryKeys, useThumb: false })`.  
- dirty: `draftTheme !== avatar.theme || draftOutfitKey !== avatar.outfitKey`.  
- 저장: `patch({ theme: draftTheme, outfitKey: draftOutfitKey })`.  
- Outfit Gallery: `(allowed?.outfits ?? []).filter(o => o.key.startsWith(\`${draftTheme}_\`))` 후 `OutfitCard` 맵.  
- 캐릭터 변경: `avatar.characterLocked` 이면 disabled 버튼 "캐릭터 변경(잠김)", 아니면 "캐릭터 변경".

### 5.5 해야 할 일 체크리스트

| # | 담당 | 내용 |
|---|------|------|
| 1 | **서버** | GET `/api/arena/profile` 또는 `/api/arena/profile/avatar` 응답에 `allowed.outfits[]`(theme+levelId 기반), `allowed.accessorySlots`(tier 기반) 포함. |
| 2 | **서버** | PATCH: `theme`/`outfitKey`/`accessoryKeys` 업데이트. `outfitKey`는 allowed 목록 검증, `accessoryKeys.length <= slots` 검증. |
| 3 | **프론트** | 아바타 설정 화면: AvatarComposite 미리보기, Theme 토글, Outfit Gallery(allowed.outfits 카드), 저장 버튼(PATCH). `characterLocked` 이면 캐릭터 변경 버튼 숨김/비활성. |
| 4 | **프론트** | 리더보드/대시보드: `resolveAvatarUrls(..., useThumb: true)` + `AvatarComposite`, lazy load. |

---

## 6. Cursor별 할일 — 구현 분배

| Cursor | 담당 | 내용 |
|--------|------|------|
| **Cursor 1** | DB + API | §1 마이그레이션, 트리거, RLS. §3 GET 응답에 `avatar` + `allowed`(outfits, accessorySlots, accessories). PATCH 검증(outfitKey ∈ allowed, accessoryKeys.length ≤ slots). |
| **Cursor 3** | 프론트 레이어 + UX | §2 `avatarAssets.ts`, §5 `AvatarComposite`. §5.1~5.4: `useAvatar`, `OutfitCard`, 프로필/아바타 화면(Theme 토글, Outfit Gallery, 저장, characterLocked 시 캐릭터 버튼 비활성). 리더보드/대시보드 thumb + lazy. |
| **Cursor 4** | 검증·테스트 | 허용 outfit/accessory 슬롯 검증 단위 테스트, `AvatarUiResponse` 등 타입/DTO 정리, (선택) E2E. |

병렬 진행: Cursor 1 DB+API(GET allowed 포함) → Cursor 3가 DTO 확정 후 avatarAssets + AvatarComposite + useAvatar + 아바타 설정 페이지 + 리더보드/대시보드. Cursor 4는 API 완료 후 검증·테스트.

---

## 7. Cursor별 복사용 프롬프트

### Cursor 1 — DB + API

```
docs/AVATAR_LAYER_SPEC.md 기준으로 다음을 구현해줘.

1) DB (Supabase)
- arena_profiles에 avatar_accessory_ids (text[] not null default '{}'), (선택) avatar_outfit_updated_at, avatar_accessories_updated_at 추가하는 마이그레이션 작성.
- enforce_avatar_character_lock 트리거: avatar_character_locked = true 일 때 avatar_character_id 변경 시 예외. 기존 RLS 유지.

2) API — GET (UI용 allowed 포함)
- GET /api/arena/profile 또는 전용 GET /api/arena/profile/avatar 응답을 AvatarUiResponse 형태로: avatar: { characterKey, theme, outfitKey, accessoryKeys, characterLocked }, allowed: { outfits[] (theme+levelId 기반 허용만), accessorySlots (tier 기반), accessories[] (선택) }.
- allowed.outfits는 getOutfitForLevel/테마별 허용 목록에서 현재 유저 levelId 기준으로 열린 옷만. accessorySlots는 tier 기반(예: tier 25마다 1슬롯).

3) API — PATCH
- PATCH에서 theme, outfitKey, accessoryKeys 수신. outfitKey는 allowed.outfits에 있는지 검증, accessoryKeys.length <= allowed.accessorySlots 검증 후 arena_profiles 업데이트.

구현 후 이 문서 AVATAR_LAYER_SPEC.md 하단 "완료 이력"에 완료 §와 변경 파일 요약을 추가해줘.
```

### Cursor 3 — avatarAssets + AvatarComposite + 프로필/아바타 UX

```
docs/AVATAR_LAYER_SPEC.md 기준으로 다음을 구현해줘.

1) 키→URL 매핑
- src/lib/bty/arena/avatarAssets.ts (또는 기존 avatarCharacters/avatarOutfits 확장): characterAssetMap, outfitAssetMap, accessoryAssetMap, resolveAvatarUrls({ characterKey, outfitKey, accessoryKeys, useThumb }).

2) AvatarComposite
- src/components/AvatarComposite.tsx: size, characterUrl, outfitUrl, accessoryUrls, alt, className. 레이어 base → outfit → accessory, lazy, aria-label.

3) 프로필/아바타 화면 (§5.1~5.4)
- useAvatar 훅: GET /api/arena/profile/avatar(또는 profile) → data (AvatarUiResponse), patch(payload). 경로는 bty-app에 맞게 /api/arena/profile 또는 /api/arena/profile/avatar.
- OutfitCard: allowed.outfits 카드 한 장. 클릭 시 선택, AvatarComposite 미리보기.
- 아바타 설정 페이지: 상단 AvatarComposite 미리보기, Theme 토글(professional/fantasy), Outfit Gallery(allowed.outfits만 카드로), 저장 버튼(dirty 시 PATCH). avatar.characterLocked 이면 캐릭터 변경 버튼 disabled + "캐릭터 변경(잠김)".
- 페이지 위치: 대시보드 내 아바타 섹션 또는 app/[locale]/bty/(protected)/profile/avatar/page.tsx.

4) 리더보드/대시보드
- resolveAvatarUrls(useThumb: true) + AvatarComposite, lazy load.

구현 후 이 문서 AVATAR_LAYER_SPEC.md 하단 "완료 이력"에 완료 §와 변경 파일 요약을 추가해줘.
```

### Cursor 4 — 검증·테스트

```
docs/AVATAR_LAYER_SPEC.md 기준으로 다음을 구현해줘.

1) 서버 검증
- 허용 outfit 검증: theme + levelId 기준 allowedOutfits, getOutfitById 유효성 단위 테스트.
- 허용 accessory 슬롯: tier 기반 allowedSlots, accessoryKeys.length ≤ slots 단위 테스트.

2) 타입/DTO
- AvatarUiResponse, AvatarCompositeKeys, PatchAvatarRequest 등 API 경계 타입을 한 곳(src/types/arena.ts 또는 기존 경로)에 정리, API·프론트에서 import.

3) (선택) E2E
- GET → allowed.outfits/accessorySlots 반환, PATCH 후 리더보드에서 아바타 키 반영 확인.

구현 후 이 문서 AVATAR_LAYER_SPEC.md 하단 "완료 이력"에 완료 §와 변경 파일 요약을 추가해줘.
```

---

## 8. 완료 이력

(각 Cursor가 작업 완료 시 아래에 추가)

| 일자 | 담당 | 완료 § | 변경 파일 요약 |
|------|------|--------|----------------|
| — | — | — | — |
