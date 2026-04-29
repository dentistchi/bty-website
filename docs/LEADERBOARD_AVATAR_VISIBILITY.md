# 리더보드에서 타 유저 캐릭터(아바타)가 안 보일 때

## 증상
- 내 캐릭터만 리더보드에 보이고, 다른 유저는 기본 아이콘(실루엣)만 보임.

## 원인
리더보드 API가 `arena_profiles`에서 **모든 유저의 프로필**을 읽어와야 합니다.  
서비스 역할 키가 없을 때는 RLS 때문에 anon/authenticated 클라이언트로는 **본인 행만** 반환되어, 타 유저는 기본 아바타만 보입니다.

## 동작 방식 (수정 후)
- **admin(서비스 역할) 있음**: 기존처럼 `arena_profiles` 테이블 직접 조회.
- **admin 없음**: `get_leaderboard_profiles(p_user_ids)` RPC 호출. 이 함수는 **SECURITY DEFINER**라서 RLS를 우회하고, 지정한 user_id 목록의 프로필을 모두 반환합니다.

따라서 **마이그레이션 `20260329000000_leaderboard_profiles_rpc.sql`이 프로덕션 DB에 적용**되어 있으면, 서비스 역할 키 없이도 타 유저 캐릭터가 보입니다.

## 조치

### 1) 프로덕션에 마이그레이션 적용

Supabase 프로덕션 DB에 아래 마이그레이션이 적용되어 있어야 합니다.

- `supabase/migrations/20260329000000_leaderboard_profiles_rpc.sql`  
  → `get_leaderboard_profiles(uuid[])` 함수 생성 (SECURITY DEFINER)

로컬/CI에서 `supabase db push` 또는 Supabase Dashboard → SQL Editor에서 해당 파일 내용을 실행해 주세요. 적용 후 리더보드 새로고침 시 타 유저 아바타가 보여야 합니다.

### 2) (선택) 서비스 역할 키

배포 환경에 `SUPABASE_SERVICE_ROLE_KEY`를 넣어 두면, API가 admin으로 `arena_profiles`를 직접 조회하므로 위 RPC 없이도 동작합니다.

### 3) 타 유저가 캐릭터를 설정했는지 확인

해당 유저가 Arena 대시보드에서 **캐릭터/테마를 저장**했는지 확인하세요. 저장하지 않았으면 기본 아이콘이 나오는 것이 맞습니다.

## 참고
- 마이그레이션: `20260329000000_leaderboard_profiles_rpc.sql`, (이전) `20260328000000_arena_profiles_leaderboard_select.sql`
- API: `bty-app/src/app/api/arena/leaderboard/route.ts` (admin 있으면 테이블 조회, 없으면 RPC)
