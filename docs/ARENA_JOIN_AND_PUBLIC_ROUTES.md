# Arena 가입·로그인·공개 경로 정리

---

## 1. 로그인 없이 들어가는 경로 ("첫 두 페이지")

미들웨어에서 **공개(public)** 로 허용하는 경로는 아래만 있습니다.

| 경로 | 설명 |
|------|------|
| `/` | 루트 → `/en`으로 리다이렉트 |
| `/en`, `/en/` | 랜딩 (첫 페이지) |
| `/ko`, `/ko/` | 랜딩 |
| `/[locale]/dear-me` | Dear Me 페이지 |
| `/[locale]/bty/login` | 로그인 페이지 |
| `/[locale]/bty/logout` | 로그아웃 |
| `/[locale]/admin/login` | Admin 로그인 |

→ **로그인 없이** 들어갈 수 있는 건 보통 **랜딩(`/en` 또는 `/ko`) + Dear Me(`/en/dear-me`)** 이렇게 두 페이지입니다.  
나머지(`/en/bty`, `/en/bty/dashboard`, `/en/bty-arena` 등)는 **로그인 필요**하며, 미들웨어에서 세션을 확인해 없으면 로그인 페이지로 보냅니다.

**추가 수정**: 미들웨어 `catch` 블록에서 예외가 나도 **로그인 페이지로 리다이렉트**하도록 바꿔 두었습니다. 예전에는 예외 시 `return res`로 그냥 통과시켜서, 일부 환경에서 로그인 없이 들어갈 수 있었습니다.

---

## 2. "가입하라는 내용 없고" — Arena 가입 폼

스크린샷에 나온 **Arena 가입** 폼(직군·입사일·리더시작일·제출)은 **이 bty-app 저장소에는 없습니다.**

- 이 앱에는 그 UI와 제출 API가 구현되어 있지 않습니다.
- 다른 앱/관리자 도구에서 나온 화면이거나, 설계/목업일 수 있습니다.

**이 앱에서 Arena 가입을 쓰려면** 다음이 필요합니다.

1. **페이지**: 예) `/[locale]/bty/join` 또는 `/[locale]/bty/arena-join` 에서  
   직군(드롭다운), 입사일, 리더시작일(선택) 입력 폼 노출  
2. **API**: 제출 시 `memberships` 테이블에 insert (현재 user_id + org_id, region_id, role, created_at 등).  
   - `memberships`는 RLS로 **insert 정책이 없을 수 있어**, 서버에서 service role로 insert하거나, RLS 정책을 추가해야 합니다.  
   - org_id, region_id는 기본값/선택 규칙이 필요합니다.

원하면 이 경로와 API 스펙을 정한 뒤, 구현 단계로 이어갈 수 있습니다.

---

## 3. 다른 컴퓨터에서 나온 자료가 안 보일 때

아이디 통일·memberships 정리 후에도 **다른 PC에서 보이던 데이터**가 안 나오면:

- 그 데이터는 **예전에 로그인했던 user_id**의 `arena_profiles`, `weekly_xp`, `memberships`에 있었을 가능성이 큽니다.
- 지금 로그인한 **한 user_id**로 통일했으면, **그 user_id**에 대한 데이터만 보입니다.
- 자세한 확인 절차는 `docs/OTHER_PC_LEVEL_AVATAR_NOT_VISIBLE.md` §6·§7 참고.

---

*미들웨어: `src/middleware.ts`*
